import axios from 'axios';
import { QueryClient } from '@tanstack/react-query';
import { tokenStore } from './authToken';
import { viewAsStore } from './viewAs';
import { impersonationStore } from './impersonation';

const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : '/api/v1';

export const api = axios.create({
  baseURL,
  timeout: 30000,
});

// Attach auth to every request: a JWT bearer token when logged in, plus the
// legacy VITE_API_KEY (kept for backward compatibility during the transition).
api.interceptors.request.use((config) => {
  // Platform-admin impersonation wins: when "viewing as" an org, send that org
  // user's scoped token so every read is naturally isolated to their org. The
  // admin's own session stays intact in tokenStore for when they exit. Skipped
  // for the impersonate call itself (marked _skipImpersonation) so a stale/expired
  // impersonation token can't block minting a fresh one.
  const impToken = config._skipImpersonation ? null : impersonationStore.getToken();
  const token = impToken || tokenStore.getAccess();
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  const apiKey = import.meta.env.VITE_API_KEY;
  if (apiKey) {
    config.headers['X-API-Key'] = apiKey;
  }
  // Admin/manager "View as": scope reads to another user (or "all"). Harmless
  // on endpoints that don't support it — the backend ignores the extra param.
  const viewAs = viewAsStore.get();
  if (viewAs) {
    config.params = { ...(config.params || {}), view_as_user_id: viewAs };
  }
  return config;
});

// On a 401, transparently try one token refresh and replay the request. If the
// refresh fails (or this IS an auth request), clear the session so the app
// routes back to login.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    // If an impersonation token has gone stale (401), drop back to the admin's
    // own session rather than refreshing (there's no refresh token for the
    // impersonated user) or logging the admin out. The next request runs as the
    // platform admin again; the banner/context react to the cleared store.
    if (
      status === 401 &&
      original &&
      !original._skipImpersonation &&
      impersonationStore.getToken()
    ) {
      impersonationStore.clear();
      return Promise.reject(error);
    }

    // An organization (or account) deactivated mid-session makes the backend
    // return 403 "…deactivated" on EVERY request. Left unhandled the user would
    // sit on a wall of errors, so end the session and route back to login
    // (which shows the deactivation message). Scoped to the deactivation detail
    // so ordinary permission 403s (e.g. an agent hitting an admin route) are
    // untouched. While impersonating, drop back to the admin's own session
    // instead of logging the admin out.
    if (
      status === 403 &&
      original &&
      !original._skipAuthRefresh &&
      /deactivated/i.test(error.response?.data?.detail || '')
    ) {
      if (impersonationStore.getToken()) {
        impersonationStore.clear();
      } else {
        tokenStore.runLogout();
      }
      return Promise.reject(error);
    }

    if (
      status === 401 &&
      original &&
      !original._retry &&
      !original._skipAuthRefresh
    ) {
      original._retry = true;
      const newToken = await tokenStore.runRefresh();
      if (newToken) {
        original.headers = original.headers || {};
        original.headers['Authorization'] = `Bearer ${newToken}`;
        return api(original);
      }
      tokenStore.runLogout();
    }
    return Promise.reject(error);
  }
);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const companiesApi = {
  getAll: (params) => api.get('/companies/', { params }).then(r => r.data),
  getById: (id) => api.get(`/companies/${id}`).then(r => r.data),
  create: (data) => api.post('/companies/', data).then(r => r.data),
  update: (id, data) => api.patch(`/companies/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/companies/${id}`).then(r => r.data),
  getScores: (id) => api.get(`/companies/${id}/scores`).then(r => r.data),
  importCSV: (formData) => api.post('/import-export/import/csv', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data),
  score: (id) => api.post('/leads/score', { company_id: id }).then(r => r.data),
};

export const pipelineApi = {
  getPipeline: (params) => api.get('/leads/pipeline', { params }).then(r => r.data),
  transitionStage: (id, stage) => api.patch(`/companies/${id}/stage`, { stage }).then(r => r.data),
};

export const dashboardApi = {
  getMetrics: () => api.get('/dashboard/overview').then(r => r.data),
  getRecentActivity: (params) => api.get('/dashboard/recent-activity', { params }).then(r => r.data),
  getTopLeads: (params) => api.get('/dashboard/top-leads', { params }).then(r => r.data),
  getIndustry: (params) => api.get('/dashboard/industry', { params }).then(r => r.data),
  getEmailTrends: (params) => api.get('/dashboard/email-trends', { params }).then(r => r.data),
  getContactGrowth: (params) => api.get('/dashboard/contact-growth', { params }).then(r => r.data),
  getKPIs: () => api.get('/dashboard/kpis').then(r => r.data),
};

export const followUpsApi = {
  list: (params) => api.get('/follow-ups', { params }).then(r => r.data),
  create: (data) => api.post('/follow-ups', data).then(r => r.data),
  update: (id, data) => api.patch(`/follow-ups/${id}`, data).then(r => r.data),
  remove: (id) => api.delete(`/follow-ups/${id}`).then(r => r.data),
  staleContacts: (params) => api.get('/follow-ups/stale-contacts', { params }).then(r => r.data),
};

export const outreachApi = {
  getSequences: () => api.get('/outreach/sequences').then(r => r.data),
  createSequence: (data) => api.post('/outreach/sequences', data).then(r => r.data),
  deleteSequence: (id) => api.delete(`/outreach/sequences/${id}`).then(r => r.data),
  // The enrollment endpoint enrolls a single contact (contact_id + sequence_id).
  enrollContact: (data) => api.post('/outreach/enrollments', data).then(r => r.data),
  getEvents: (params) => api.get('/outreach/events', { params }).then(r => r.data),
  updateSequenceStatus: (id, status) => api.patch(`/sequences/${id}/status`, { status }).then(r => r.data),
  enrollBatch: (sequenceId, contactIds) => api.post(`/sequences/${sequenceId}/enroll`, { contact_ids: contactIds }).then(r => r.data),
};

export const contactsApi = {
  getAll: (params) => api.get('/contacts/', { params }).then(r => r.data),
  getById: (id) => api.get(`/contacts/${id}`).then(r => r.data),
  getByCompany: (companyId) => api.get(`/contacts/company/${companyId}`).then(r => r.data),
  create: (data) => api.post('/contacts/', data).then(r => r.data),
  update: (id, data) => api.patch(`/contacts/${id}`, data).then(r => r.data),
  remove: (id) => api.delete(`/contacts/${id}`).then(r => r.data),
  quickAdd: (data) => api.post('/contacts/quick-add', data).then(r => r.data),
  // Find existing contacts that look like the one about to be saved (email / phone / name).
  checkDuplicate: (params) => api.get('/contacts/check-duplicate', { params }).then(r => r.data),
  // Counts by Hunter verdict, source, industry and campaign — the contact
  // database grouped by category.
  facets: () => api.get('/contacts/facets').then(r => r.data),

  // --- Tags ---
  // Every tag in use with its contact count: { tags: [{ tag, count }] }.
  // Most-used first, so it reads as a filter menu.
  listTags: () => api.get('/contacts/tags').then(r => r.data),
  // Add/remove tags on one contact. `body` = { add?: [], remove?: [] }.
  // Deltas, never a replacement set — two people tagging from the same stale
  // list view would otherwise each write the set they last read, and whoever
  // saved second would drop the other's tag.
  updateTags: (id, body) => api.post(`/contacts/${id}/tags`, body).then(r => r.data),
  // The same deltas across many contacts. `body` = { contact_ids, add?, remove? }.
  bulkTag: (body) => api.post('/contacts/bulk-tag', body).then(r => r.data),
  // Rename a tag everywhere it appears; merging into an existing tag de-dupes.
  renameTag: (body) => api.post('/contacts/tags/rename', body).then(r => r.data),

  // --- Suppression ---
  // `body` = { contact_ids, suppressed?, reason? }. Suppressing also stops the
  // contacts' live enrollments; un-suppressing deliberately does NOT restart them.
  bulkSuppress: (body) => api.post('/contacts/bulk-suppress', body).then(r => r.data),

  // --- Engagement ---
  // Counters + recent history for one contact, read across BOTH send tables
  // (sequence sends live only in outreach_events, manual sends in email_sends).
  engagement: (id, limit = 50) =>
    api.get(`/contacts/${id}/engagement`, { params: { limit } }).then(r => r.data),
};

export const emailApi = {
  getTemplates: () => api.get('/email-templates').then(r => r.data),
  createTemplate: (data) => api.post('/email-templates', data).then(r => r.data),
  updateTemplate: (id, data) => api.put(`/email-templates/${id}`, data).then(r => r.data),
  deleteTemplate: (id) => api.delete(`/email-templates/${id}`).then(r => r.data),
  setDefault: (id) => api.post(`/email-templates/${id}/set-default`).then(r => r.data),
  preview: (data) => api.post('/email-templates/preview', data).then(r => r.data),
  // Saved HTML signatures (default first). Surfaced in the reply composer.
  getSignatures: () => api.get('/email-signatures').then(r => r.data),
  compose: (data) => api.post('/email-compose', data).then(r => r.data),
  getSends: (params) => api.get('/email-sends', { params }).then(r => r.data),
  sendTest: (data) => api.post('/email-templates/send-test', data).then(r => r.data),
  // Files sent with every email from a template. Upload needs a saved template,
  // so a new template's files are uploaded right after it is created.
  uploadTemplateAttachment: (templateId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/email-templates/${templateId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    }).then(r => r.data);
  },
  deleteTemplateAttachment: (templateId, attachmentId) =>
    api.delete(`/email-templates/${templateId}/attachments/${attachmentId}`).then(r => r.data),
  downloadTemplateAttachment: (templateId, attachmentId) =>
    api.get(`/email-templates/${templateId}/attachments/${attachmentId}`, { responseType: 'blob' })
      .then(r => r.data),
  getABStats: (templateId) => api.get(`/email-sends/ab-stats`, { params: { template_id: templateId } }).then(r => r.data),
  getAnalytics: () => api.get('/email-sends/analytics').then(r => r.data),
};

export const discoveryApi = {
  searchCompanies: (data) => api.post('/discovery/search-companies', data).then(r => r.data),
  // Gemini with Google Search grounding, on the org's own Gemini key. Grounded
  // search plus import takes longer than Apollo's indexed lookup.
  searchCompaniesGemini: (data) =>
    api.post('/discovery/search-companies-gemini', data, { timeout: 120000 }).then(r => r.data),
  enrichCompany: (id, data) => api.post(`/discovery/enrich/${id}`, data).then(r => r.data),
};

// Discovery from documents. All AI runs server-side on the org's Gemini key;
// nothing here ever sees a key.
export const discoveryDocsApi = {
  aiStatus: () => api.get('/discovery/documents/ai-status').then(r => r.data),
  list: () => api.get('/discovery/documents').then(r => r.data),
  get: (id) => api.get(`/discovery/documents/${id}`).then(r => r.data),
  upload: (file, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/discovery/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
      onUploadProgress: onProgress ? (e) => onProgress(e.loaded, e.total) : undefined,
    }).then(r => r.data);
  },
  // Several files in one request; each becomes its own document. Bad files come
  // back in `rejected` while the rest still upload.
  // `onProgress(loaded, total)` reports bytes sent for the whole request.
  uploadMany: (files, onProgress) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    return api.post('/discovery/documents/batch', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 180000,
      onUploadProgress: onProgress ? (e) => onProgress(e.loaded, e.total) : undefined,
    }).then(r => r.data);
  },
  importCandidates: (id, candidateIds, contactIds) =>
    api.post(
      `/discovery/documents/${id}/import`,
      // contact_ids (extracted ids) narrows who comes along; omitted = everyone.
      contactIds ? { candidate_ids: candidateIds, contact_ids: contactIds } : { candidate_ids: candidateIds },
      { timeout: 120000 }
    ).then(r => r.data),
  draft: (id, data) => api.post(`/discovery/documents/${id}/draft`, data, { timeout: 120000 }).then(r => r.data),
  preview: (id, data) => api.post(`/discovery/documents/${id}/preview`, data).then(r => r.data),
  send: (id, data) => api.post(`/discovery/documents/${id}/send`, data, { timeout: 120000 }).then(r => r.data),
  remove: (id) => api.delete(`/discovery/documents/${id}`).then(r => r.data),
  // Follow-up status for everyone the document's sequence emailed.
  outreach: (id) => api.get(`/discovery/documents/${id}/outreach`).then(r => r.data),
  // Pause / resume the document's sequence (held, not cancelled: resuming keeps the cadence).
  setSequenceStatus: (sequenceId, status) =>
    api.patch(`/sequences/${sequenceId}/status`, { status }).then(r => r.data),
};

// Autopilot Outreach campaigns. Creating one analyses its documents into an ICP;
// PATCH edits the ICP/settings and moves status (active / paused / stopped).
export const campaignsApi = {
  list: () => api.get('/campaigns').then(r => r.data),
  get: (id) => api.get(`/campaigns/${id}`).then(r => r.data),
  create: (data) => api.post('/campaigns', data, { timeout: 120000 }).then(r => r.data),
  update: (id, data) => api.patch(`/campaigns/${id}`, data).then(r => r.data),
  remove: (id) => api.delete(`/campaigns/${id}`).then(r => r.data),
  prospects: (id, params) => api.get(`/campaigns/${id}/prospects`, { params }).then(r => r.data),
  approve: (id, pid) => api.post(`/campaigns/${id}/prospects/${pid}/approve`).then(r => r.data),
  skip: (id, pid) => api.post(`/campaigns/${id}/prospects/${pid}/skip`).then(r => r.data),
  // { prospect_ids?, verified_only? } → { approved, skipped_unverified, skipped_ineligible, instant_send }.
  // No ids means every draft in the campaign.
  bulkApprove: (id, data) => api.post(`/campaigns/${id}/prospects/approve`, data || {}).then(r => r.data),
  // Approve + send in the request (same safety gates as the queue). One → { outcome, detail, status };
  // many (≤10) → { results: [...], sent }.
  sendNow: (id, pid) => api.post(`/campaigns/${id}/prospects/${pid}/send-now`, null, { timeout: 60000 }).then(r => r.data),
  sendNowMany: (id, pids) =>
    api.post(`/campaigns/${id}/prospects/send-now`, { prospect_ids: pids }, { timeout: 180000 }).then(r => r.data),
  // Connected Gmail + SMTP mailboxes a campaign can send from.
  senders: () => api.get('/campaigns/senders').then(r => r.data),
  // Contacts from the database: { contact_ids } → { queued, skipped: [{ email, reason, label }] }.
  addContacts: (id, contactIds) =>
    api.post(`/campaigns/${id}/prospects/add`, { contact_ids: contactIds }).then(r => r.data),
  // One person typed in: { company_name, domain?, first_name, last_name?, title?, email? }.
  addManual: (id, data) => api.post(`/campaigns/${id}/prospects/manual`, data).then(r => r.data),
  // Save a draft as an email template (prospect details → merge fields).
  // `body` = { name, use_for_campaign?: 'template' | 'ai_template' }.
  saveTemplate: (id, pid, body) =>
    api.post(`/campaigns/${id}/prospects/${pid}/save-template`, body).then(r => r.data),
  // Rewrite the unapproved drafts (after choosing or changing the template).
  redraft: (id) => api.post(`/campaigns/${id}/redraft`).then(r => r.data),
  // Search for more companies now instead of waiting for tomorrow's search.
  discover: (id) => api.post(`/campaigns/${id}/discover`).then(r => r.data),
  // Rewrite one draft now from another template: { template_id | null, template_mode }.
  // AI drafting can take a while, hence the longer timeout.
  redraftProspect: (id, pid, body) =>
    api.post(`/campaigns/${id}/prospects/${pid}/redraft`, body, { timeout: 90000 }).then(r => r.data),
  // Add or edit the person behind a prospect: { first_name, last_name?, title?, email? }.
  setContact: (id, pid, data) => api.put(`/campaigns/${id}/prospects/${pid}/contact`, data).then(r => r.data),
  // The bytes of one file the campaign's emails carry, for the draft preview.
  // Fetched with the auth header (an <iframe src> couldn't send it).
  attachment: (id, name) =>
    api.get(`/campaigns/${id}/attachments/file`, { params: { name }, responseType: 'arraybuffer' })
      .then(r => ({ data: r.data, type: r.headers['content-type'] || '' })),
};

export const aiApi = {
  generateEmail: (data) => api.post('/ai/generate-email', data).then(r => r.data),
  improveEmail: (data) => api.post('/ai/improve-email', data).then(r => r.data),
  scoreLead: (data) => api.post('/ai/score-lead', data).then(r => r.data),
  analyzeCompany: (id) => api.post(`/ai/analyze-company/${id}`).then(r => r.data),
  generateFollowup: (data) => api.post('/ai/generate-followup', data).then(r => r.data),
  scanCard: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/ai/scan-card', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    }).then(r => r.data);
  },
};

export const groupsApi = {
  getAll: () => api.get('/groups').then(r => r.data),
  create: (data) => api.post('/groups', data).then(r => r.data),
  update: (id, data) => api.patch(`/groups/${id}`, data).then(r => r.data),
  remove: (id) => api.delete(`/groups/${id}`).then(r => r.data),
  addMembers: (id, companyIds) => api.post(`/groups/${id}/members`, { company_ids: companyIds }).then(r => r.data),
  removeMembers: (id, companyIds) => api.delete(`/groups/${id}/members`, { data: { company_ids: companyIds } }).then(r => r.data),
  autoGroupByIndustry: () => api.post('/groups/auto-group-by-industry').then(r => r.data),
  autoGroupByCountry: () => api.post('/groups/auto-group-by-country').then(r => r.data),
  autoGroupByStage: () => api.post('/groups/auto-group-by-stage').then(r => r.data),
};

export const sendLimiterApi = {
  getStats: () => api.get('/discovery/send-stats').then(r => r.data),
};

export const newsApi = {
  getAll: (params) => api.get('/news', { params }).then(r => r.data),
  checkCompany: (id) => api.post(`/news/check/${id}`).then(r => r.data),
  checkAll: (limit) => api.post(`/news/check-all?limit=${limit || 5}`).then(r => r.data),
  markActioned: (id) => api.patch(`/news/${id}/action`).then(r => r.data),
};

export const tacticsApi = {
  discoverExecutives: (companyId) => api.post(`/tactics/discover-executives/${companyId}`).then(r => r.data),
  linkedinDraft: (data) => api.post('/tactics/linkedin-draft', data).then(r => r.data),
  phoneScript: (data) => api.post('/tactics/phone-script', data).then(r => r.data),
  referralDraft: (data) => api.post('/tactics/referral-draft', data).then(r => r.data),
  eventOutreach: (data) => api.post('/tactics/event-outreach', data).then(r => r.data),
  multiTouchPlan: (companyId) => api.post(`/tactics/multi-touch-plan/${companyId}`).then(r => r.data),
};

// ─── Client management ──────────────────────────────────────────────────────
// These hit the in-progress client-lifecycle backend. Hooks wrap every call in
// try/catch with graceful empty states so the UI renders before the API ships.

export const clientsApi = {
  // Aggregate stats + chart series for the client dashboard.
  getOverview: () => api.get('/clients/overview').then(r => r.data),
  // List of companies in the client stage, enriched with health/deal/task data.
  list: (params) => api.get('/clients', { params }).then(r => r.data),
};

export const dealsApi = {
  list: (params) => api.get('/deals', { params }).then(r => r.data),
  getByCompany: (companyId) => api.get('/deals', { params: { company_id: companyId } }).then(r => r.data),
  getById: (id) => api.get(`/deals/${id}`).then(r => r.data),
  create: (data) => api.post('/deals', data).then(r => r.data),
  update: (id, data) => api.patch(`/deals/${id}`, data).then(r => r.data),
  remove: (id) => api.delete(`/deals/${id}`).then(r => r.data),
  metrics: () => api.get('/deals/metrics').then(r => r.data),
  stages: () => api.get('/deals/stages').then(r => r.data),
  // Sequence attribution — deals + revenue credited to each outreach sequence.
  attribution: () => api.get('/deals/attribution').then(r => r.data),
  addNote: (id, data) => api.post(`/deals/${id}/notes`, data).then(r => r.data),
  listNotes: (id) => api.get(`/deals/${id}/notes`).then(r => r.data),
  listActivity: (id) => api.get(`/deals/${id}/activity`).then(r => r.data),
};

export const tasksApi = {
  list: (params) => api.get('/tasks', { params }).then(r => r.data),
  create: (data) => api.post('/tasks', data).then(r => r.data),
  update: (id, data) => api.patch(`/tasks/${id}`, data).then(r => r.data),
  remove: (id) => api.delete(`/tasks/${id}`).then(r => r.data),
};

export const interactionsApi = {
  list: (params) => api.get('/interactions', { params }).then(r => r.data),
  getByCompany: (companyId) => api.get('/interactions', { params: { company_id: companyId } }).then(r => r.data),
  create: (data) => api.post('/interactions', data).then(r => r.data),
  update: (id, data) => api.patch(`/interactions/${id}`, data).then(r => r.data),
  remove: (id) => api.delete(`/interactions/${id}`).then(r => r.data),
};

export const healthApi = {
  getForCompany: (id) => api.get(`/companies/${id}/health`).then(r => r.data),
};

export const reportsApi = {
  retention: (params) => api.get('/reports/retention', { params }).then(r => r.data),
  revenueFunnel: (params) => api.get('/reports/revenue-funnel', { params }).then(r => r.data),
  activityHeatmap: (params) => api.get('/reports/activity-heatmap', { params }).then(r => r.data),
  topClients: (params) => api.get('/reports/top-clients', { params }).then(r => r.data),
  emailPerformance: (params) => api.get('/reports/email-performance', { params }).then(r => r.data),
  pipelineAnalytics: (params) => api.get('/reports/pipeline-analytics', { params }).then(r => r.data),
  leadQuality: (params) => api.get('/reports/lead-quality', { params }).then(r => r.data),
  // Daily autonomous-activity summary: latest + short history, or a specific date.
  dailySummary: (days = 30) => api.get('/reports/daily-summary', { params: { days } }).then(r => r.data),
  dailySummaryByDate: (date) => api.get(`/reports/daily-summary/${date}`).then(r => r.data),
};

// Deliverability — sender health + sending-domain SPF/DKIM/DMARC checks
export const deliverabilityApi = {
  senders: () => api.get('/deliverability/senders').then(r => r.data),
  // Per-account reputation trend from the append-only snapshot table.
  sendersHistory: (days = 30) =>
    api.get('/deliverability/senders/history', { params: { days } }).then(r => r.data),
  // Re-assess every sending account now (recomputes reputation + throttle).
  assess: () => api.post('/deliverability/assess').then(r => r.data),
  // Pre-send spam-filter risk scan for a draft. Returns
  // { spam_score 0-100, risk: 'low'|'medium'|'high', issues[], suggestions[] }.
  // `use_ai` blends a Claude assessment on top of the heuristics.
  scanContent: ({ subject = '', body, hasUnsubscribe = true, useAi = false }) =>
    api.post('/deliverability/scan-content', {
      subject,
      body,
      has_unsubscribe: hasUnsubscribe,
      use_ai: useAi,
    }).then(r => r.data),
  domainAuth: (domain, dkimSelector) =>
    api.get('/deliverability/domain-auth', { params: { domain, dkim_selector: dkimSelector || undefined } }).then(r => r.data),
};

// System — kill switch, warm-up, and what the agent automates.
export const systemApi = {
  sendingStatus: () => api.get('/system/sending-status').then(r => r.data),
  sendingToggle: (body) => api.post('/system/sending-toggle', body).then(r => r.data),
  resetWarmup: () => api.post('/system/reset-warmup').then(r => r.data),
  // The real state of each autonomous behaviour, read from backend config and
  // the beat schedule. The Settings badges must come from here — they used to
  // be hardcoded, and two of the three were wrong.
  automation: () => api.get('/system/automation').then(r => r.data),
};

// Domain health — the multi-domain monitor (every sending domain's SPF/DKIM/
// DMARC + blacklist state), as opposed to `deliverabilityApi.domainAuth`, which
// is the older one-off check of a single domain you name.
export const domainHealthApi = {
  list: () => api.get('/deliverability/domains').then(r => r.data),
  detail: (domain) => api.get(`/deliverability/domains/${encodeURIComponent(domain)}`).then(r => r.data),
  recheck: (domain) => api.post(`/deliverability/domains/${encodeURIComponent(domain)}/recheck`).then(r => r.data),
};

// Danger signals — the auto-pause rail. Dialtone halts its own sending when
// bounce/complaint rates breach their thresholds; these endpoints expose why,
// and `resume` is the ONLY safe way back. It re-checks live metrics and refuses
// (409) to resume into a still-breaching state — `/system/sending-toggle` does
// no such check, so it must not be used to clear an auto-pause.
export const dangerSignalsApi = {
  health: () => api.get('/dialtone/health/signals').then(r => r.data),
  events: (params) => api.get('/dialtone/health/signals/events', { params }).then(r => r.data),
  test: () => api.post('/dialtone/health/signals/test').then(r => r.data),
  // `note` is required and audited; `force` overrides a still-live danger.
  resume: ({ acknowledgeDangerSignalId, note, force = false }) =>
    api.post('/dialtone/resume', {
      acknowledge_danger_signal_id: acknowledgeDangerSignalId,
      note,
      force,
    }).then(r => r.data),
};

// Dialtone replies inbox — cold-email replies classified by intent. Distinct
// from `emailHistoryApi.getInbox` (/emails/inbox), which is the generic mailbox:
// this is the agent's triaged queue, and the detail route lazily drafts a reply
// for anything classified `interested`.
export const repliesApi = {
  inbox: (params) => api.get('/dialtone/inbox', { params }).then(r => r.data),
  stats: () => api.get('/dialtone/inbox/stats').then(r => r.data),
  detail: (replyId) => api.get(`/dialtone/inbox/${replyId}`).then(r => r.data),
  // `category`, not `classification` — see ReclassifyRequest in schemas/replies.py.
  reclassify: (replyId, { category, priorityFlag } = {}) =>
    api.post(`/dialtone/inbox/${replyId}/reclassify`, {
      category,
      ...(priorityFlag == null ? {} : { priority_flag: priorityFlag }),
    }).then(r => r.data),
  markRead: (replyId) => api.post(`/dialtone/inbox/${replyId}/read`).then(r => r.data),
};

// Smart reply — dispatch an operator-approved (and optionally edited) response
// to a classified reply. The detail route drafts the copy; this actually sends
// it. The reply is identified by the path, and the subject/body are what the
// operator approved, which may differ from the AI's original draft. Omitting
// the subject lets the server use `Re: <original subject>`.
export const smartReplyApi = {
  send: ({ replyId, subject, body }) =>
    api.post(`/dialtone/inbox/${replyId}/approve-send`, {
      subject,
      body,
    }).then(r => r.data),
};

// AI drafts — the human review gate on AI-composed first touches. The first N
// AI emails per sequence are parked here instead of sent. Approving dispatches
// the AI's copy; rejecting sends the static template it would have replaced
// (the prospect is mid-sequence, so dropping the touch entirely is worse).
export const aiDraftsApi = {
  list: (params) => api.get('/ai-drafts', { params }).then(r => r.data),
  approve: (draftId, body) => api.post(`/ai-drafts/${draftId}/approve`, body || {}).then(r => r.data),
  reject: (draftId, body) => api.post(`/ai-drafts/${draftId}/reject`, body || {}).then(r => r.data),
};

// Google Places SMB discovery — the long tail Apollo's B2B database misses.
// Note this is `/dialtone/discovery/*`; `discoveryApi` above is the separate
// Apollo-backed `/discovery/*` feature.
export const placesDiscoveryApi = {
  // `body` = { query, location, radius_km, lat, lng, business_type, country,
  // limit (<=60), save }. `save: false` previews — it still spends credits.
  search: (body) => api.post('/dialtone/discovery/search', body).then(r => r.data),
  // `params` = { status, country, category, search_id, has_email, has_website,
  // q, limit, offset }.
  results: (params) => api.get('/dialtone/discovery/results', { params }).then(r => r.data),
  // `enrich` spends a Hunter credit and blocks on a scrape, so it's opt-in —
  // there is no separate enrich route, it's a flag on import.
  importBusiness: (businessId, { enrich = false, icpProfileId } = {}) =>
    api.post(`/dialtone/discovery/results/${businessId}/import`, {
      enrich,
      ...(icpProfileId ? { icp_profile_id: icpProfileId } : {}),
    }).then(r => r.data),
  stats: () => api.get('/dialtone/discovery/stats').then(r => r.data),
  savedSearches: () => api.get('/dialtone/discovery/searches').then(r => r.data),
  createSearch: (body) => api.post('/dialtone/discovery/searches', body).then(r => r.data),
  updateSearch: (id, body) => api.patch(`/dialtone/discovery/searches/${id}`, body).then(r => r.data),
  deleteSearch: (id) => api.delete(`/dialtone/discovery/searches/${id}`).then(r => r.data),
  runSearch: (id) => api.post(`/dialtone/discovery/searches/${id}/run`).then(r => r.data),
};

// Dialtone Console — the unified activity log for the autonomous cold-email agent.
export const dialtoneApi = {
  // At-a-glance header: sending state, warm-up ramp, the selected timeframe's
  // tallies (+ `previous`, `deltas`, `rates`, `range_start`/`range_end`), senders.
  // `timeframe` is one of today | yesterday | this_week | last_week |
  // this_month | last_month | all_time; omitted means the API default (today).
  console: (timeframe) =>
    api.get('/dialtone/console', { params: timeframe ? { timeframe } : {} }).then(r => r.data),
  // Chronological event stream (the archive — paginates the whole history).
  // `params` accepts { start, end, timeframe, types, status, contact_id, q,
  // page, page_size }; explicit start/end beat timeframe.
  activity: (params) => api.get('/dialtone/activity', { params }).then(r => r.data),
  // The live view — newest N events over a bounded lookback, cheap to poll.
  // `params` accepts { limit, since, window_hours, types }. Pass the previous
  // response's `latest_at` back as `since` and each poll returns only what's
  // new. Returns { items, server_time, latest_at, window_hours }.
  liveActivity: (params) => api.get('/dialtone/activity/live', { params }).then(r => r.data),
  // Warm-lead phone-enrichment roll-up: { enriched, attempts, hit_rate,
  // apollo, company, recent[] }. `recentLimit` caps the recent-activity strip;
  // `timeframe` scopes it by when each number was found (default all time).
  phoneEnrichment: (recentLimit = 8, timeframe) =>
    api.get('/dialtone/phone-enrichment/summary', {
      params: { recent_limit: recentLimit, ...(timeframe ? { timeframe } : {}) },
    }).then(r => r.data),
  // Warm-up plans (Feature 1): one per sending account, with today's usage.
  // [{ account_id, account_type, account_email, current_day, daily_limit,
  //    status, used_today, remaining_today, start_date }]
  warmupPlans: () => api.get('/dialtone/warmup').then(r => r.data),
  // Start a warm-up plan for a sender. `body` = { account_id, account_type?,
  // start_date? }. 409 if the sender already has one.
  createWarmupPlan: (body) => api.post('/dialtone/warmup', body).then(r => r.data),
  // Suppression list (Feature 2). Paginated do-not-contact list; `params`
  // accepts { q, page, page_size }.
  suppressionList: (params) => api.get('/dialtone/suppression', { params }).then(r => r.data),
  // Add one address by hand. `body` = { email, reason? }.
  addSuppression: (body) => api.post('/dialtone/suppression', body).then(r => r.data),
  // Bulk CSV/text upload. `reason` is the default for rows without one. Returns
  // { added, duplicates, invalid, total }.
  importSuppression: (file, reason = 'unsubscribe') => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/dialtone/suppression/import', form, {
      params: { reason },
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },
  deleteSuppression: (id) => api.delete(`/dialtone/suppression/${id}`).then(r => r.data),
  // Per-sequence analytics (Feature 4): per-step funnel counts + rates and the
  // enrolled → deal conversion rate.
  sequenceAnalytics: (id) => api.get(`/dialtone/sequences/${id}/analytics`).then(r => r.data),
  // Every campaign side by side — open/click/reply/bounce/conversion plus the
  // AI-composed share and mean personalization depth behind each one.
  // `params` accepts { days, sort_by, include_empty }. Returns
  // { timeframe_days, campaigns[], totals }.
  campaignAnalytics: (params) =>
    api.get('/dialtone/campaigns/analytics', { params }).then(r => r.data),
  // Prospects ranked by recency-weighted engagement (reply > click > open,
  // decayed by age). `params` accepts { limit, min_score, include_suppressed }.
  // Returns { leads[], tier_counts, total_ranked }.
  rankedLeads: (params) => api.get('/dialtone/leads/ranked', { params }).then(r => r.data),
};

// Per-sender calendar booking config. A sender with no `booking_url` falls back
// to the global `scheduling_link` (from systemApi.automation), so clearing the
// URL is how you "reset to global". `account_id` is the same id the Sender
// Health list (`/deliverability/senders`) returns.
export const bookingApi = {
  get: (accountId) => api.get(`/dialtone/senders/${accountId}/booking`).then(r => r.data),
  // `body` = { booking_url?, booking_provider?, booking_auto_inject? }. An empty
  // string clears the URL (resets to global). The URL is validated server-side
  // (https + known-scheduler-host allowlist); a bad one returns 400.
  set: (accountId, body) => api.put(`/dialtone/senders/${accountId}/booking`, body).then(r => r.data),
};

// Meeting Booking Agent — the autonomous scheduler that takes over once Dialtone
// gets a positive reply: proposes calendar slots, handles the back-and-forth,
// books the invite, and reminds. `config` is one row per org (lazily created);
// config writes need org_admin. Distinct from `bookingApi` above, which is just
// a per-sender scheduling *link* injected into follow-ups.
export const meetingAgentApi = {
  getConfig: () => api.get('/meeting-agent/config').then(r => r.data),
  // `body` = subset of { is_active, calendar_account_id, default_meeting_duration_minutes,
  // buffer_between_meetings_minutes, working_hours_start, working_hours_end, timezone,
  // booking_window_days, max_daily_meetings, confirmation_template, reminder_template }.
  updateConfig: (body) => api.put('/meeting-agent/config', body).then(r => r.data),
  // `params` = { filter: all|upcoming|past, status, limit, offset }.
  meetings: (params) => api.get('/meeting-agent/meetings', { params }).then(r => r.data),
  meeting: (id) => api.get(`/meeting-agent/meetings/${id}`).then(r => r.data),
  cancel: (id) => api.post(`/meeting-agent/meetings/${id}/cancel`).then(r => r.data),
  stats: () => api.get('/meeting-agent/stats').then(r => r.data),
};

// Smart Send-Time Optimization (Feature 6) — read-only Console surfaces under
// `/dialtone/send-timing`: the optimized-vs-control experiment, the global
// day/hour heatmap, overall optimizer status, and top learned per-contact windows.
export const sendTimingApi = {
  // Optimized-vs-control arms: per-arm open/reply rates, lift, z-test confidence.
  experiment: () => api.get('/dialtone/send-timing/experiment').then(r => r.data),
  // Full (day-of-week, hour) grid of open rates for the heatmap.
  heatmap: () => api.get('/dialtone/send-timing/heatmap').then(r => r.data),
  // Overall status: enabled flag, config, and how many contacts have profiles.
  status: () => api.get('/dialtone/send-timing/status').then(r => r.data),
  // Top learned contacts (by opens) with their computed optimal send windows.
  contacts: (limit = 20) =>
    api.get('/dialtone/send-timing/contacts', { params: { limit } }).then(r => r.data),
  // A single contact's resolved timezone, engagement profile, computed optimal
  // window, and next optimal send slot. Returns { contact_id, email, timezone,
  // tz_source, profile, window: { dow_preference[], hour_start, hour_end,
  // confidence, source }, next_send_at }.
  contact: (contactId) =>
    api.get(`/dialtone/send-timing/contacts/${contactId}`).then(r => r.data),
};

// A/B testing for Dialtone sequence steps: the subject/body variants the agent
// rotates through, their per-variant open/click/reply rates, the chi-squared
// significance the engine computes, and the operator's manual winner override.
export const abTestsApi = {
  // List tests newest-first. `params` accepts { status } (running /
  // insufficient_data / completed).
  list: (params) => api.get('/dialtone/ab-tests', { params }).then(r => r.data),
  // Full detail: per-variant stats, leader, confidence, significance.
  get: (testId) => api.get(`/dialtone/ab-tests/${testId}`).then(r => r.data),
  // Operator override — declare a winner by variant id or label.
  declareWinner: (testId, body) =>
    api.post(`/dialtone/ab-tests/${testId}/declare-winner`, body).then(r => r.data),
};

// Platform Admin — cross-org management (platform_admin role only; SaaS Phase 2).
// The god-view over every tenant: organization CRUD, platform-wide stats, and
// impersonation to "view as" any org for debugging.
export const platformApi = {
  // Platform-wide roll-up: total/active orgs, total users, total emails sent.
  stats: () => api.get('/platform/stats').then(r => r.data),
  // Every organization with per-org user + usage counts. `active_only` narrows.
  listOrganizations: (params) => api.get('/platform/organizations', { params }).then(r => r.data),
  // One org's detail: config, branding, users, and usage stats.
  getOrganization: (id) => api.get(`/platform/organizations/${id}`).then(r => r.data),
  // Provision a new organization.
  createOrganization: (body) => api.post('/platform/organizations', body).then(r => r.data),
  // Update name / slug / plan / config / branding / active state.
  updateOrganization: (id, body) => api.put(`/platform/organizations/${id}`, body).then(r => r.data),
  // Soft-deactivate (is_active=False; data retained).
  deactivateOrganization: (id) => api.delete(`/platform/organizations/${id}`).then(r => r.data),
  // Mint a JWT scoped to a user's org+role for debugging. Marked so the request
  // interceptor sends the ADMIN's token (never a stale impersonation token).
  impersonate: (userId) =>
    api.post(`/platform/impersonate/${userId}`, null, { _skipImpersonation: true }).then(r => r.data),
  // Every platform_admin account, for the dashboard's admin roster.
  listAdmins: () => api.get('/platform/admins').then(r => r.data),
  // Elevate an existing user (by email) to platform_admin; clears their org.
  promoteAdmin: (email) => api.post('/platform/promote-admin', { email }).then(r => r.data),
  // Demote a platform_admin back to org_admin, reassigning them to `orgId`.
  demoteAdmin: (userId, orgId) =>
    api.post('/platform/demote-admin', { user_id: userId, org_id: orgId }).then(r => r.data),

  // --- API credentials -------------------------------------------------------
  // Every managed credential with its masked value and provenance
  // ("database" = set here, "environment" = from the deploy, "unset" = dark).
  // Secrets never come back in full; client IDs do, because confirming which
  // Google project is live is the point of the screen.
  listCredentials: () => api.get('/platform/credentials').then(r => r.data),
  // Store an override. Takes effect on the worker that serves this call at
  // once, and on the others within the 5-minute refresh beat.
  setCredential: (key, value) =>
    api.put(`/platform/credentials/${key}`, { value }).then(r => r.data),
  // Drop the override, restoring whatever the deploy put in the environment.
  clearCredential: (key) => api.delete(`/platform/credentials/${key}`).then(r => r.data),
};

// Orchestration policies (feature 2.2) — the guardrails the autonomous engine
// runs within: cadence limits, allowed/required channels, human-review triggers.
// A policy is either global (user_id null) or scoped to one rep. The list
// endpoint returns a bare array; `setEnrollmentMode` flips one enrollment
// between manual / assisted / autonomous.
export const orchestrationApi = {
  // All policies, newest-first. `active_only` narrows to live ones.
  listPolicies: (params) => api.get('/orchestration/policies', { params }).then(r => r.data),
  getPolicy: (id) => api.get(`/orchestration/policies/${id}`).then(r => r.data),
  createPolicy: (data) => api.post('/orchestration/policies', data).then(r => r.data),
  updatePolicy: (id, data) => api.patch(`/orchestration/policies/${id}`, data).then(r => r.data),
  deletePolicy: (id) => api.delete(`/orchestration/policies/${id}`).then(r => r.data),
  // Set an enrollment's orchestration mode: manual | assisted | autonomous.
  setEnrollmentMode: (enrollmentId, mode) =>
    api.post(`/orchestration/enrollments/${enrollmentId}/mode`, { mode }).then(r => r.data),
};

// Referral & Warm-Intro agent — config + ON/OFF toggle, the referral pipeline,
// and the action queue (initial ask / follow-up / thank-you). All under
// /referral-agent; config writes + action execution require org_admin.
export const referralAgentApi = {
  getConfig: () => api.get('/referral-agent/config').then(r => r.data),
  updateConfig: (data) => api.put('/referral-agent/config', data).then(r => r.data),
  listReferrals: (params) => api.get('/referral-agent/referrals', { params }).then(r => r.data),
  createReferral: (data) => api.post('/referral-agent/referrals', data).then(r => r.data),
  updateReferral: (id, data) => api.put(`/referral-agent/referrals/${id}`, data).then(r => r.data),
  listActions: (params) => api.get('/referral-agent/actions', { params }).then(r => r.data),
  approveAction: (id) => api.post(`/referral-agent/actions/${id}/approve`).then(r => r.data),
  dismissAction: (id) => api.post(`/referral-agent/actions/${id}/dismiss`).then(r => r.data),
  getStats: () => api.get('/referral-agent/stats').then(r => r.data),
};

// Autonomous prospecting — the agent sources companies, scores them against the
// learned ICP, and parks the borderline ones for a human call.
export const prospectingApi = {
  // Candidates by disposition. `params` accepts { status, limit, sort, order }.
  // `status` is the *stored* disposition: 'review' is the pending queue and
  // 'enrolled' is what a reviewer approved — there is no 'approved' status.
  reviewQueue: (params) => api.get('/prospecting/review-queue', { params }).then(r => r.data),
  approve: (id, reviewer) =>
    api.post(`/prospecting/candidates/${id}/approve`, null, { params: { reviewer } }).then(r => r.data),
  reject: (id, reviewer) =>
    api.post(`/prospecting/candidates/${id}/reject`, null, { params: { reviewer } }).then(r => r.data),
  runs: (params) => api.get('/prospecting/runs', { params }).then(r => r.data),
  runCandidates: (runId) => api.get(`/prospecting/runs/${runId}/candidates`).then(r => r.data),
  // Trigger a run now. `target_volume` caps how many companies it sources;
  // `seed_candidates` skips sourcing entirely (unused by the UI).
  run: (body) => api.post('/prospecting/run', body || {}).then(r => r.data),
  icp: () => api.get('/prospecting/icp').then(r => r.data),
  // Pin ICP fields to human-chosen values. Only what's sent is pinned; `unpin`
  // hands fields back to the learner. Pinned fields survive the weekly re-learn.
  updateIcp: (body) => api.put('/prospecting/icp', body).then(r => r.data),
  learnIcp: () => api.post('/prospecting/icp/learn').then(r => r.data),
  // Why a company is in the pipeline: the candidate + run behind it.
  provenance: (companyId) =>
    api.get(`/prospecting/companies/${companyId}/provenance`).then(r => r.data),
};

// Email communication — unified inbox, lead threads, reply sending
export const emailHistoryApi = {
  getLeadEmails: (companyId, params) => api.get(`/emails/lead/${companyId}`, { params }).then(r => r.data),
  getInbox: (params) => api.get('/emails/inbox', { params }).then(r => r.data),
  getThread: (threadId) => api.get(`/emails/thread/${encodeURIComponent(threadId)}`).then(r => r.data),
  sendReply: (emailId, data) => api.post(`/emails/reply/${emailId}`, data).then(r => r.data),
  triggerSync: () => api.post('/emails/sync').then(r => r.data),
  // Conversation Intelligence — momentum, unresolved objections, recommended
  // next action, and a suggested next message. `refresh` re-runs the analysis.
  getThreadIntelligence: (threadId, { refresh = false } = {}) =>
    api.get(`/emails/thread/${encodeURIComponent(threadId)}/intelligence`, {
      params: refresh ? { refresh: true } : {},
    }).then(r => r.data),
  // Per-thread read state (P0-1) and archive (P0-2). Read is mailbox-scoped
  // server-side; archive is per-user thread state.
  markThreadRead: (threadId) =>
    api.post(`/emails/thread/${encodeURIComponent(threadId)}/read`).then(r => r.data),
  markThreadUnread: (threadId) =>
    api.post(`/emails/thread/${encodeURIComponent(threadId)}/unread`).then(r => r.data),
  archiveThread: (threadId) =>
    api.post(`/emails/thread/${encodeURIComponent(threadId)}/archive`).then(r => r.data),
  unarchiveThread: (threadId) =>
    api.post(`/emails/thread/${encodeURIComponent(threadId)}/unarchive`).then(r => r.data),
  // Bulk actions (P1-3). `thread_ids` is the selection.
  bulkMarkRead: (threadIds, isRead = true) =>
    api.post('/emails/threads/read', { thread_ids: threadIds }, {
      params: { is_read: isRead },
    }).then(r => r.data),
  bulkArchive: (threadIds, isArchived = true) =>
    api.post('/emails/threads/archive', { thread_ids: threadIds }, {
      params: { is_archived: isArchived },
    }).then(r => r.data),
  // Snooze — hide a thread until `snoozedUntil` (an ISO string), then it
  // resurfaces automatically. `null` un-snoozes.
  snoozeThread: (threadId, snoozedUntil) =>
    api.post(`/emails/thread/${encodeURIComponent(threadId)}/snooze`, {
      snoozed_until: snoozedUntil,
    }).then(r => r.data),
  unsnoozeThread: (threadId) =>
    api.post(`/emails/thread/${encodeURIComponent(threadId)}/unsnooze`).then(r => r.data),
  bulkSnooze: (threadIds, snoozedUntil) =>
    api.post('/emails/threads/snooze', {
      thread_ids: threadIds, snoozed_until: snoozedUntil,
    }).then(r => r.data),
  // Labels — user-created thread tags.
  listLabels: () => api.get('/emails/labels').then(r => r.data),
  createLabel: (name, color = 'gray') =>
    api.post('/emails/labels', { name, color }).then(r => r.data),
  updateLabel: (labelId, patch) =>
    api.patch(`/emails/labels/${labelId}`, patch).then(r => r.data),
  deleteLabel: (labelId) =>
    api.delete(`/emails/labels/${labelId}`).then(r => r.data),
  addThreadLabel: (threadId, labelId) =>
    api.post(`/emails/thread/${encodeURIComponent(threadId)}/labels/${labelId}`).then(r => r.data),
  removeThreadLabel: (threadId, labelId) =>
    api.delete(`/emails/thread/${encodeURIComponent(threadId)}/labels/${labelId}`).then(r => r.data),
  // Mailbox analytics — volume, response time, intent breakdown.
  getAnalytics: (days = 30) =>
    api.get('/emails/analytics', { params: { days } }).then(r => r.data),
};

// Gmail OAuth — connect a Google account so outreach sends from the user's own
// address (with Gmail's SPF/DKIM/DMARC, so it stays out of spam).
export const gmailApi = {
  status: () => api.get('/gmail/status').then(r => r.data),
  accounts: () => api.get('/gmail/accounts').then(r => r.data),
  authorize: () => api.get('/gmail/oauth/authorize').then(r => r.data),
  setActive: (id) => api.post(`/gmail/accounts/${id}/set-active`).then(r => r.data),
  toggleSending: (id, enabled) => api.post(`/gmail/accounts/${id}/toggle-sending`, { sending_enabled: enabled }).then(r => r.data),
  disconnect: (id) => api.delete(`/gmail/accounts/${id}`).then(r => r.data),
  purge: (id) => api.delete(`/gmail/accounts/${id}/purge`).then(r => r.data),
  testSend: (id, toEmail) => api.post(`/gmail/accounts/${id}/test`, { to_email: toEmail || null }).then(r => r.data),
};

// Org-admin only on the backend.
export const settingsApi = {
  // provider: 'gemini' | 'groq' | 'openrouter' (Groq/OpenRouter are Discovery fallbacks).
  listLlmKeys: () => api.get('/settings/llm-keys').then(r => r.data),
  getLlmKey: (provider = 'gemini') => api.get('/settings/llm-key', { params: { provider } }).then(r => r.data),
  setLlmKey: (apiKey, provider = 'gemini') => api.put('/settings/llm-key', { api_key: apiKey, provider }).then(r => r.data),
  deleteLlmKey: (provider = 'gemini') => api.delete('/settings/llm-key', { params: { provider } }).then(r => r.data),
};

export const apiKeysApi = {
  list: () => api.get('/org/api-keys').then(r => r.data),
  create: (data) => api.post('/org/api-keys', data).then(r => r.data),
  revoke: (id) => api.delete(`/org/api-keys/${id}`).then(r => r.data),
  scopes: () => api.get('/org/api-keys/scopes').then(r => r.data),
};

export const smtpApi = {
  accounts: () => api.get('/smtp/accounts').then(r => r.data),
  add: (payload) => api.post('/smtp/accounts', payload).then(r => r.data),
  update: (id, payload) => api.put(`/smtp/accounts/${id}`, payload).then(r => r.data),
  remove: (id) => api.delete(`/smtp/accounts/${id}`).then(r => r.data),
  setActive: (id) => api.post(`/smtp/accounts/${id}/set-active`).then(r => r.data),
  toggleSending: (id, enabled) => api.post(`/smtp/accounts/${id}/toggle-sending`, { sending_enabled: enabled }).then(r => r.data),
  verify: (id) => api.post(`/smtp/accounts/${id}/verify`).then(r => r.data),
  testSend: (id, toEmail) => api.post(`/smtp/accounts/${id}/test`, { to_email: toEmail || null }).then(r => r.data),
};

// ─── Knowledge Base (migration 027) ─────────────────────────────────────────
// Industry contacts, sales guideline docs, industry-vertical configs, and the
// AI sales-guidelines config. Hooks wrap each call in try/catch with empty-state
// fallbacks so the UI renders even before the backend ships.
export const knowledgeApi = {
  // Industry contacts
  getContacts: (params) => api.get('/knowledge/contacts', { params }).then(r => r.data),
  getContact: (id) => api.get(`/knowledge/contacts/${id}`).then(r => r.data),
  getIndustryCounts: () => api.get('/knowledge/contacts/industries').then(r => r.data),
  createContact: (data) => api.post('/knowledge/contacts', data).then(r => r.data),
  updateContact: (id, data) => api.put(`/knowledge/contacts/${id}`, data).then(r => r.data),
  deleteContact: (id) => api.delete(`/knowledge/contacts/${id}`).then(r => r.data),
  // Knowledge documents
  getDocuments: () => api.get('/knowledge/documents').then(r => r.data),
  getDocument: (slug) => api.get(`/knowledge/documents/${slug}`).then(r => r.data),
  getGuidelines: () => api.get('/knowledge/guidelines').then(r => r.data),
  getStrategy: () => api.get('/knowledge/strategy').then(r => r.data),
  // Industry verticals
  getIndustries: () => api.get('/knowledge/industries').then(r => r.data),
  getIndustry: (key) => api.get(`/knowledge/industries/${key}`).then(r => r.data),
  // AI sales-guidelines config
  getAiGuidelines: () => api.get('/knowledge/ai-guidelines').then(r => r.data),
};

// ─── Investor CRM (migration 029) ───────────────────────────────────────────
// Investor pipeline: firms, contacts, interaction timeline, data-room documents,
// pipeline funnel stats, and AI-drafted outreach. Hooks wrap each call in
// try/catch with graceful empty states so the UI renders before the backend ships.
export const investorsApi = {
  // Investors
  getAll: (params) => api.get('/investors/', { params }).then(r => r.data),
  getById: (id) => api.get(`/investors/${id}`).then(r => r.data),
  create: (data) => api.post('/investors/', data).then(r => r.data),
  update: (id, data) => api.put(`/investors/${id}`, data).then(r => r.data),
  remove: (id) => api.delete(`/investors/${id}`).then(r => r.data),
  // Move an investor along the outreach pipeline (status progression). There is
  // no dedicated status route — `InvestorUpdate` carries `status`, and the
  // update is a partial one (`exclude_unset`), so a body of just `{status}`
  // moves the stage and touches nothing else.
  updateStatus: (id, status) => api.put(`/investors/${id}`, { status }).then(r => r.data),
  // Pipeline funnel counts by status (+ stage breakdown).
  getPipeline: (params) => api.get('/investors/pipeline', { params }).then(r => r.data),
  // Interaction timeline (emails, calls, meetings, LinkedIn messages).
  getInteractions: (id) => api.get(`/investors/${id}/interactions`).then(r => r.data),
  createInteraction: (id, data) => api.post(`/investors/${id}/interactions`, data).then(r => r.data),
  // Interactions and documents are addressed by their own id, not nested under
  // the investor — a document can be investor-agnostic (the pitch deck belongs
  // to the round, not to one VC), so the collection cannot live under a single
  // investor and the investor is a filter rather than a path segment.
  removeInteraction: (id, interactionId) => api.delete(`/investors/interactions/${interactionId}`).then(r => r.data),
  // Data-room documents (pitch deck, financials, etc.).
  getDocuments: (id) => api.get('/investors/documents', { params: { investor_id: id } }).then(r => r.data),
  createDocument: (id, data) => api.post('/investors/documents', { ...data, investor_id: id }).then(r => r.data),
  removeDocument: (id, documentId) => api.delete(`/investors/documents/${documentId}`).then(r => r.data),
  // AI-drafted personalised outreach email for this investor.
  generateEmail: (id, data) => api.post(`/investors/${id}/outreach`, data).then(r => r.data),
};

// ─── Cold Calling (migration 028) ───────────────────────────────────────────
// Call task queue, per-task briefings, industry scripts, notifications, and the
// AI queue generator.
export const callsApi = {
  // Call tasks
  getTasks: (params) => api.get('/calls/tasks', { params }).then(r => r.data),
  getToday: () => api.get('/calls/tasks/today').then(r => r.data),
  createTask: (data) => api.post('/calls/tasks', data).then(r => r.data),
  updateTask: (id, data) => api.put(`/calls/tasks/${id}`, data).then(r => r.data),
  getBriefing: (id) => api.get(`/calls/tasks/${id}/briefing`).then(r => r.data),
  // Scripts
  getScripts: () => api.get('/calls/scripts').then(r => r.data),
  getScript: (industry) => api.get(`/calls/scripts/${industry}`).then(r => r.data),
  saveScript: (data) => api.post('/calls/scripts', data).then(r => r.data),
  // AI-generated custom script for a call task. GET caches + auto-generates;
  // pass { regenerate: true } to force a fresh personalised script.
  // pass { framework: 'challenger' } to request a specific sales methodology.
  getCustomScript: (id, params) =>
    api.get(`/calls/tasks/${id}/custom-script`, { params }).then(r => r.data),
  generateCustomScript: (data) => api.post('/calls/scripts/generate', data).then(r => r.data),
  // Notifications
  getNotifications: () => api.get('/calls/notifications').then(r => r.data),
  markNotificationRead: (id) => api.put(`/calls/notifications/${id}/read`).then(r => r.data),
  // AI queue generation
  generateQueue: () => api.post('/calls/queue/generate').then(r => r.data),
  // Analytics — objection trends and framework effectiveness (sales-book enhancements)
  getObjectionTrends: (params) => api.get('/calls/analytics/objections', { params }).then(r => r.data),
  getFrameworkStats: (params) => api.get('/calls/analytics/frameworks', { params }).then(r => r.data),
};

// --- Sentiment Analysis ---
export const sentimentApi = {
  analyze: (data) => api.post('/sentiment/analyze', data),
  analyzeReply: (replyId) => api.post(`/sentiment/analyze-reply/${replyId}`),
  getScores: (params) => api.get('/sentiment/scores', { params }),
  getSummary: (days = 30) => api.get('/sentiment/summary', { params: { days } }),
};

// --- GDPR data-subject requests ---
// Compliance surface for the right-to-access (export) and right-to-erasure
// (erase) obligations. Both are keyed by the data subject's email. Export
// returns everything held about that contact; erase is destructive and
// irreversible, so the UI gates it behind a typed confirmation.
export const gdprApi = {
  // Both take the subject's address as data, never as a path segment — an
  // email in a URL lands in access logs and in `Referer`, and this is the one
  // surface whose whole job is handling a person's data carefully.
  export: (email) => api.get('/gdpr/export', { params: { email } }).then(r => r.data),
  // `confirm` is the server's acknowledgement flag for an irreversible write.
  // It is set here because the caller has already made the operator retype the
  // exact address into a confirmation dialog — that typed match *is* the
  // acknowledgement. Without it the server refuses with a 400.
  erase: (email) => api.post('/gdpr/erase', { email, confirm: true }).then(r => r.data),
};

// --- Social Listening Agent ---
// The buying-intent listening agent: config (with masked LLM key), the feed of
// discovered signals, monitored companies, and stats. One config row per org
// (resolved from the JWT), so no org_id is ever passed.
export const socialListeningApi = {
  getConfig: () => api.get('/social-listening-agent/config').then(r => r.data),
  updateConfig: (data) => api.put('/social-listening-agent/config', data).then(r => r.data),
  listSignals: (params) => api.get('/social-listening-agent/signals', { params }).then(r => r.data),
  actionSignal: (id) => api.post(`/social-listening-agent/signals/${id}/action`).then(r => r.data),
  dismissSignal: (id) => api.post(`/social-listening-agent/signals/${id}/dismiss`).then(r => r.data),
  listMonitored: () => api.get('/social-listening-agent/monitored-companies').then(r => r.data),
  addMonitored: (data) => api.post('/social-listening-agent/monitored-companies', data).then(r => r.data),
  removeMonitored: (id) => api.delete(`/social-listening-agent/monitored-companies/${id}`).then(r => r.data),
  getStats: () => api.get('/social-listening-agent/stats').then(r => r.data),
  scanNow: () => api.post('/social-listening-agent/scan').then(r => r.data),
};

// --- Email Testing ---
export const emailTestingApi = {
  getScenarios: () => api.get('/email-testing/scenarios'),
  getPersonas: () => api.get('/email-testing/personas'),
  createExchange: (data) => api.post('/email-testing/exchanges', data),
  continueExchange: (id, data) => api.post(`/email-testing/exchanges/${id}/continue`, data),
  getExchanges: (params) => api.get('/email-testing/exchanges', { params }),
  getExchange: (id) => api.get(`/email-testing/exchanges/${id}`),
  deleteExchange: (id) => api.delete(`/email-testing/exchanges/${id}`),
};

// --- Deal Progression Agent ---
// Watches the pipeline and nudges stalled deals: drafts follow-ups, suggests
// next steps, advances stages off signals, and escalates rotting deals.
export const dealAgentApi = {
  getConfig: () => api.get('/deal-agent/config').then(r => r.data),
  updateConfig: (data) => api.put('/deal-agent/config', data).then(r => r.data),
  listActions: (params) => api.get('/deal-agent/actions', { params }).then(r => r.data),
  approveAction: (id) => api.post(`/deal-agent/actions/${id}/approve`).then(r => r.data),
  dismissAction: (id) => api.post(`/deal-agent/actions/${id}/dismiss`).then(r => r.data),
  stats: () => api.get('/deal-agent/stats').then(r => r.data),
};

// ─── Client Success Agent ────────────────────────────────────────────────────
// The autonomous client-success agent: watches per-client health and enqueues
// proactive plays (AI check-ins, escalations, review calls, celebrations). The
// config carries the master on/off switch and the per-agent OpenRouter model +
// key. The raw key is write-only — reads return only `llm_api_key_set` + a hint.
export const clientSuccessAgentApi = {
  // Current org's config (a default row is created on first read).
  getConfig: () => api.get('/client-success-agent/config').then(r => r.data),
  // Update config (org_admin). `llm_api_key`: omit to leave unchanged, '' to
  // clear (fall back to the org key), any value to set. Sending `is_active`
  // flips the master switch.
  updateConfig: (body) => api.put('/client-success-agent/config', body).then(r => r.data),
  // Action queue, newest-first. `params`: { action_type, status, contact_id,
  // limit, offset }. Returns { actions, total }.
  listActions: (params) => api.get('/client-success-agent/actions', { params }).then(r => r.data),
  // Approve a pending action (sends the check-in / marks the play done).
  approveAction: (id) => api.post(`/client-success-agent/actions/${id}/approve`).then(r => r.data),
  // Dismiss a pending action (drops it from the queue).
  dismissAction: (id) => api.post(`/client-success-agent/actions/${id}/dismiss`).then(r => r.data),
  // Dashboard roll-up: clients monitored, check-ins sent, escalations, etc.
  stats: () => api.get('/client-success-agent/stats').then(r => r.data),
  // Clients sorted by current health (lowest first) with trend arrows.
  healthOverview: (params) => api.get('/client-success-agent/health-overview', { params }).then(r => r.data),
};

export const feedbackApi = {
  submit: (data) => api.post('/feedback', data).then(r => r.data),
  list: (params) => api.get('/feedback', { params }).then(r => r.data),
};
