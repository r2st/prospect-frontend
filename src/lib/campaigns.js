// Shapes and labels for Autopilot Outreach campaigns. The API is new, so every
// reader here tolerates missing fields and a couple of naming variants rather
// than letting one renamed key blank a page.

export const CAMPAIGN_STATUS = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400' },
  analyzing: { label: 'Analyzing', className: 'bg-blue-50 text-blue-700', dot: 'bg-blue-500' },
  ready: { label: 'Ready', className: 'bg-indigo-50 text-indigo-700', dot: 'bg-indigo-500' },
  active: { label: 'Active', className: 'bg-green-50 text-green-700', dot: 'bg-green-500' },
  paused: { label: 'Paused', className: 'bg-yellow-50 text-yellow-700', dot: 'bg-yellow-500' },
  stopped: { label: 'Stopped', className: 'bg-red-50 text-red-700', dot: 'bg-red-500' },
  completed: { label: 'Completed', className: 'bg-gray-100 text-gray-700', dot: 'bg-gray-500' },
};

export const PROSPECT_STATUS = {
  queued: { label: 'Queued', className: 'bg-gray-100 text-gray-700' },
  draft: { label: 'Draft', className: 'bg-indigo-50 text-indigo-700' },
  approved: { label: 'Ready to send', className: 'bg-teal-50 text-teal-700' },
  sent: { label: 'Sent', className: 'bg-blue-50 text-blue-700' },
  replied: { label: 'Replied', className: 'bg-green-50 text-green-700' },
  bounced: { label: 'Bounced', className: 'bg-red-50 text-red-700' },
  skipped: { label: 'Skipped', className: 'bg-gray-100 text-gray-500' },
  no_email: { label: 'No email', className: 'bg-amber-50 text-amber-700' },
};

// The API calls a written-but-unapproved email `draft_created`; the UI calls it
// `draft`. Translate both ways so the Draft filter and Approve button work.
const API_STATUS = { draft: 'draft_created' };
const UI_STATUS = { draft_created: 'draft' };
export const toApiStatus = (s) => API_STATUS[s] || s;

// Hunter's verdict on a prospect's address. Only `verified` is ever sent.
export function emailVerification(p) {
  if (!p.contact_email) return null;
  if (p.email_verified) return { key: 'verified', label: 'Verified', className: 'bg-green-50 text-green-700' };
  if (p.email_verification) {
    return { key: 'rejected', label: `Not deliverable (${p.email_verification})`, className: 'bg-red-50 text-red-700' };
  }
  return { key: 'unverified', label: 'Unverified', className: 'bg-amber-50 text-amber-700' };
}

export const EMAIL_ORIGIN = { hunter_finder: 'Found by Hunter', pattern: 'Guessed from name' };

export const DEFAULT_SETTINGS = {
  daily_limit: 25,
  send_window_start: '09:00',
  send_window_end: '17:00',
  send_on_weekends: false,
  review_before_send: true,
};

export const EMPTY_ICP = {
  industries: [],
  company_size: '',
  geographies: [],
  titles: [],
  value_props: [],
};

const asList = (v) => {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === 'string') return v.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
  return [];
};

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// "09:00:00" → "09:00" so <input type="time"> accepts it.
const hhmm = (v, fallback) => (typeof v === 'string' && /^\d{2}:\d{2}/.test(v) ? v.slice(0, 5) : fallback);

// The API keeps company size as { min, max }; the wizard edits it as text.
export function sizeFromApi(size) {
  if (size == null) return '';
  if (typeof size !== 'object') return String(size);
  const { min, max } = size;
  if (min && max) return `${min}-${max}`;
  if (min) return `${min}+`;
  if (max) return `1-${max}`;
  return '';
}

// "51-200" → {min: 51, max: 200}; "500+" → {min: 500}; "200" → {max: 200}.
export function sizeToApi(text) {
  const nums = (String(text || '').match(/\d[\d,]*/g) || []).map((n) => Number(n.replace(/,/g, '')));
  if (!nums.length) return { min: null, max: null };
  if (/\+/.test(text)) return { min: nums[0], max: null };
  if (nums.length === 1) return { min: null, max: nums[0] };
  return { min: Math.min(nums[0], nums[1]), max: Math.max(nums[0], nums[1]) };
}

export function normalizeIcp(raw) {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_ICP };
  return {
    industries: asList(raw.industries ?? raw.target_industries ?? raw.industry),
    company_size: sizeFromApi(raw.company_size ?? raw.company_size_range ?? raw.employee_range),
    geographies: asList(raw.geographies ?? raw.target_locations ?? raw.geography ?? raw.locations),
    titles: asList(raw.titles ?? raw.buyer_titles ?? raw.decision_maker_titles ?? raw.job_titles),
    value_props: asList(raw.value_props ?? raw.value_propositions),
  };
}

/**
 * The wizard's { settings, icp } in the field names PATCH /campaigns accepts.
 *
 * The API has no `settings` or `icp` key, and it ignores unknown fields — so
 * sending them as-is (as the wizard did) saved nothing: every campaign kept
 * the server's defaults whatever was chosen, review-before-send included.
 * `baseIcp` is the campaign's current icp_json, so the fields the wizard
 * doesn't edit (summary, keywords, search query) survive the save.
 */
export function toCampaignPatch(data = {}) {
  const { settings, icp, baseIcp, ...rest } = data;
  const out = { ...rest };
  if (settings) {
    out.daily_send_limit = settings.daily_limit;
    out.send_window_start = settings.send_window_start;
    out.send_window_end = settings.send_window_end;
    out.send_on_weekends = settings.send_on_weekends;
    out.review_before_send = settings.review_before_send;
    if (settings.sender_account_id) out.sender_account_id = settings.sender_account_id;
    if (settings.attach_documents !== undefined) out.attach_documents = settings.attach_documents;
    if (settings.template_mode !== undefined) {
      // No template means the AI writes the drafts, whatever mode was picked.
      out.template_id = settings.template_id || null;
      out.template_mode = settings.template_id ? settings.template_mode : 'ai';
    }
  }
  if (icp) {
    out.icp_json = {
      ...(baseIcp || {}),
      target_industries: icp.industries,
      target_locations: icp.geographies,
      buyer_titles: icp.titles,
      value_props: icp.value_props,
      company_size: sizeToApi(icp.company_size),
    };
  }
  return out;
}

export function isIcpEmpty(icp) {
  const i = normalizeIcp(icp);
  return !i.industries.length && !i.company_size && !i.geographies.length && !i.titles.length && !i.value_props.length;
}

export function normalizeSettings(raw) {
  const s = raw || {};
  return {
    daily_limit: Math.min(100, Math.max(5, num(s.daily_limit ?? s.daily_send_limit) || DEFAULT_SETTINGS.daily_limit)),
    send_window_start: hhmm(s.send_window_start, DEFAULT_SETTINGS.send_window_start),
    send_window_end: hhmm(s.send_window_end, DEFAULT_SETTINGS.send_window_end),
    send_on_weekends: Boolean(s.send_on_weekends ?? DEFAULT_SETTINGS.send_on_weekends),
    review_before_send: Boolean(s.review_before_send ?? DEFAULT_SETTINGS.review_before_send),
    // Gmail or SMTP; whichever column the campaign holds.
    sender_account_id: s.sender_account_id || s.gmail_account_id || s.smtp_account_id || '',
    attach_documents: Boolean(s.attach_documents),
    // '' = no template; 'ai' | 'template' | 'ai_template'.
    template_id: s.template_id || '',
    template_mode: s.template_mode || 'ai',
  };
}

export function normalizeCampaign(raw) {
  if (!raw) return null;
  const m = raw.metrics || raw.stats || {};
  const sent = num(m.emails_sent ?? raw.emails_sent);
  const bounced = num(m.bounced ?? m.emails_bounced ?? raw.bounced);
  const bounceRate =
    m.bounce_rate != null ? num(m.bounce_rate) : raw.bounce_rate != null ? num(raw.bounce_rate) : sent ? bounced / sent : 0;
  const documents = Array.isArray(raw.documents)
    ? raw.documents
    : (raw.document_ids || []).map((id) => ({ id, filename: null }));
  const daily = m.daily ?? m.daily_activity ?? raw.daily_activity ?? [];
  return {
    ...raw,
    name: raw.name || 'Untitled campaign',
    status: raw.status || 'draft',
    documents,
    document_ids: raw.document_ids || documents.map((d) => d.id),
    icp: normalizeIcp(raw.icp ?? raw.icp_json),
    settings: normalizeSettings({ ...raw, ...(raw.settings || {}) }),
    metrics: {
      total_prospects: num(m.total_prospects ?? m.prospects_found ?? raw.prospects_found ?? raw.total_prospects),
      emails_sent: sent,
      replies: num(m.replies ?? m.replied ?? raw.replies),
      bounced,
      // Stored as a fraction (0.04). A backend sending 4 for 4% is caught here.
      bounce_rate: bounceRate > 1 ? bounceRate / 100 : bounceRate,
      drafts_pending: num(m.drafts_pending ?? m.pending_review ?? m.awaiting_review),
      companies_discovered: num(m.companies_discovered),
      companies_without_email: num(m.companies_without_email),
      queued_to_send: num(m.queued_to_send),
      pending_verified: num(m.pending_verified),
      pending_unverified: num(m.pending_unverified),
    },
    daily: (Array.isArray(daily) ? daily : []).map((d) => ({
      date: d.date ?? d.day,
      sent: num(d.sent ?? d.emails_sent ?? d.count),
    })),
  };
}

export function normalizeCampaignList(data) {
  const list = Array.isArray(data) ? data : data?.items ?? data?.campaigns ?? [];
  return list.map(normalizeCampaign);
}

export function normalizeProspect(p) {
  const company = p.company || {};
  const contact = p.contact || {};
  const email = p.email || p.draft || {};
  const contactName =
    p.contact_name ||
    contact.name ||
    [contact.first_name, contact.last_name].filter(Boolean).join(' ') ||
    null;
  return {
    ...p,
    status: UI_STATUS[p.status] || p.status || p.email_status || 'queued',
    company_name: p.company_name || company.name || '—',
    company_domain: p.company_domain || company.domain || null,
    contact_name: contactName,
    contact_title: p.contact_title || contact.title || null,
    contact_email: p.contact_email || contact.email || p.to_email || null,
    email_verified: Boolean(p.email_verified),
    email_verification: p.email_verification || null,
    email_origin: p.email_origin || null,
    sent_at: p.sent_at || null,
    subject: p.email_subject ?? p.subject ?? email.subject ?? '',
    body: p.email_body ?? p.body ?? email.body ?? '',
  };
}

// `GET /prospects` may be a bare array or `{items, total, page, page_size}`.
export function normalizeProspectPage(data, pageSize) {
  if (Array.isArray(data)) {
    return { items: data.map(normalizeProspect), total: data.length, pages: 1 };
  }
  const items = (data?.items ?? data?.prospects ?? []).map(normalizeProspect);
  const total = num(data?.total ?? items.length);
  const size = num(data?.page_size) || pageSize;
  return { items, total, pages: Math.max(1, Math.ceil(total / size)) };
}

export function formatPercent(fraction) {
  return `${(num(fraction) * 100).toFixed(1)}%`;
}

export const canPause = (status) => status === 'active';
export const canResume = (status) => status === 'paused';
export const canStop = (status) => status === 'active' || status === 'paused';

// "Mon, Oct 19, 9:00 AM EDT" in the campaign's own time zone.
export function formatWindowTime(iso, timeZone) {
  if (!iso) return null;
  const opts = { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' };
  try {
    return new Date(iso).toLocaleString('en-US', { ...opts, timeZone: timeZone || undefined });
  } catch {
    return new Date(iso).toLocaleString('en-US', opts);
  }
}

// Approved emails held because the send window is shut — and when it opens.
// Null when nothing is waiting on the window.
export function sendWindowNotice(campaign) {
  if (!campaign || campaign.status !== 'active' || campaign.window_open !== false) return null;
  const waiting = campaign.metrics?.queued_to_send || 0;
  if (!waiting) return null;
  const s = campaign.settings || {};
  const tz = campaign.timezone;
  const isWeekend = (() => {
    try {
      const day = new Date().toLocaleString('en-US', { weekday: 'short', timeZone: tz || undefined });
      return day === 'Sat' || day === 'Sun';
    } catch {
      return false;
    }
  })();
  return {
    waiting,
    opensAt: formatWindowTime(campaign.send_window_opens_at, tz),
    schedule: `${s.send_on_weekends ? 'every day' : 'weekdays'} ${s.send_window_start}–${s.send_window_end}${tz ? ` (${tz})` : ''}`,
    // Today is a weekend and the campaign skips weekends: offer to include them.
    canSendWeekends: isWeekend && !s.send_on_weekends,
  };
}
