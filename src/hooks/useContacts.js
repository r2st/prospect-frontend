import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { contactsApi, companiesApi, queryClient } from '../api/client';

// Normalize a list response (backend returns {items,total} for contacts, an array for companies).
function normalize(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  return [];
}

/**
 * Fetch contacts enriched with their company's name, industry, and city so the
 * compose view can display and merge them.
 *
 * Accepts optional pagination / search / sort params that are forwarded to the
 * backend.  When called without arguments the hook falls back to the original
 * behaviour (fetch first page of 200).
 */
export function useContacts(params = {}) {
  const {
    page = 1, pageSize = 50, search = '', sortBy = 'created_at', sortDir = 'desc',
    status, source, city, companyName, group,
    tags, tagMatch = 'all', suppressed, hasBounced,
    verification, industry, campaignId,
  } = params;
  return useQuery({
    queryKey: ['contacts', 'all', {
      page, pageSize, search, sortBy, sortDir, status, source, city, companyName,
      group, tags, tagMatch, suppressed, hasBounced, verification, industry, campaignId,
    }],
    staleTime: 60000,
    queryFn: async () => {
      const apiParams = {
        page, page_size: pageSize,
        q: search || undefined,
        sort_by: sortBy, sort_dir: sortDir,
      };
      // Pass supported filters to backend
      if (status && status !== 'all') apiParams.status = status;
      if (source && source !== 'all') {
        // card_scan maps to 'card_scan' source on the backend
        apiParams.source = source;
      }
      if (city) apiParams.city = city;
      if (companyName) apiParams.company_name = companyName;
      // Genuine vs test contact group (server-side filter).
      if (group && group !== 'all') apiParams.group = group;
      // Tags are filtered server-side: a client-side filter would only ever see
      // the current page, so "show me everyone tagged X" would silently mean
      // "…among the 50 rows already loaded".
      if (Array.isArray(tags) && tags.length) {
        apiParams.tags = tags.join(',');
        apiParams.tag_match = tagMatch;
      }
      if (suppressed !== undefined && suppressed !== null) apiParams.suppressed = suppressed;
      if (hasBounced !== undefined && hasBounced !== null) apiParams.has_bounced = hasBounced;
      // Hunter verdict / industry / source campaign: all server-side, like tags.
      if (verification) apiParams.verification = verification;
      if (industry) apiParams.industry = industry;
      if (campaignId) apiParams.campaign_id = campaignId;

      const [contactsRaw, companiesRaw] = await Promise.all([
        contactsApi.getAll(apiParams),
        companiesApi.getAll({ page_size: 200 }),
      ]);
      const contacts = normalize(contactsRaw);
      const total = contactsRaw?.total ?? contacts.length;
      const companies = normalize(companiesRaw);
      const byId = Object.fromEntries(companies.map((c) => [String(c.id), c]));
      const enriched = contacts.map((ct) => {
        const co = byId[String(ct.company_id)] || {};
        return {
          ...ct,
          company: co.name || '',
          industry_segment: co.industry_segment || co.industry || '',
          // Prefer the contact's own values (scanned cards store these directly);
          // fall back to the company record for older/manually-added contacts.
          city: ct.city || co.city || '',
          state: ct.state || co.state_province || co.state || '',
          country: ct.country || co.country || '',
          website: ct.website || co.website || '',
        };
      });
      return { items: enriched, total, page, pageSize };
    },
  });
}

/** Fetch the contacts that belong to a single company. */
export function useCompanyContacts(companyId) {
  return useQuery({
    queryKey: ['contacts', 'company', companyId],
    queryFn: async () => normalize(await contactsApi.getByCompany(companyId)),
    enabled: !!companyId,
  });
}

function invalidateContacts(companyId) {
  queryClient.invalidateQueries({ queryKey: ['contacts'] });
  if (companyId) {
    queryClient.invalidateQueries({ queryKey: ['contacts', 'company', companyId] });
    queryClient.invalidateQueries({ queryKey: ['company', companyId] });
  }
  queryClient.invalidateQueries({ queryKey: ['companies'] });
}

export function useCreateContact() {
  return useMutation({
    mutationFn: async (data) => await contactsApi.create({ source: 'manual', ...data }),
    onSuccess: (result) => {
      invalidateContacts(result?.company_id);
      toast.success('Contact added');
    },
    onError: (e) => toast.error(e?.response?.data?.detail || e?.message || 'Failed to add contact'),
  });
}

export function useUpdateContact() {
  return useMutation({
    mutationFn: async ({ id, data }) => await contactsApi.update(id, data),
    onSuccess: (result) => {
      invalidateContacts(result?.company_id);
      toast.success('Contact updated');
    },
    onError: (e) => toast.error(e?.response?.data?.detail || e?.message || 'Failed to update contact'),
  });
}

export function useDeleteContact() {
  return useMutation({
    mutationFn: async ({ id }) => await contactsApi.remove(id),
    onSuccess: (_result, variables) => {
      invalidateContacts(variables?.companyId);
      toast.success('Contact removed');
    },
    onError: (e) => toast.error(e?.response?.data?.detail || e?.message || 'Failed to remove contact'),
  });
}

export function useQuickAddContact() {
  return useMutation({
    mutationFn: async (data) => await contactsApi.quickAdd(data),
    onSuccess: (result) => {
      invalidateContacts(result?.contact?.company_id);
      const name = [result?.contact?.first_name, result?.contact?.last_name].filter(Boolean).join(' ') || result?.contact?.email;
      toast.success(`Contact "${name}" added${result?.company_created ? ` (new company: ${result.company_name})` : ''}`);
    },
    onError: (e) => toast.error(e?.response?.data?.detail || e?.message || 'Failed to add contact'),
  });
}

// ─── Tags ─────────────────────────────────────────────────────────────────────

/** Every tag in use, with its contact count — the filter menu's source. */
export function useContactTags() {
  return useQuery({
    queryKey: ['contact-tags'],
    staleTime: 30000,
    queryFn: async () => {
      try {
        const data = await contactsApi.listTags();
        return Array.isArray(data?.tags) ? data.tags : [];
      } catch {
        // A missing tag list must not take the contacts page down with it.
        return [];
      }
    },
    retry: false,
  });
}

function invalidateTagSurfaces() {
  queryClient.invalidateQueries({ queryKey: ['contacts'] });
  queryClient.invalidateQueries({ queryKey: ['contact-tags'] });
}

/** Add/remove tags on one contact. Deltas, never a replacement set. */
export function useUpdateContactTags() {
  return useMutation({
    mutationFn: async ({ id, add = [], remove = [] }) =>
      await contactsApi.updateTags(id, { add, remove }),
    onSuccess: invalidateTagSurfaces,
    onError: (e) => toast.error(e?.response?.data?.detail || e?.message || 'Failed to update tags'),
  });
}

/** The same deltas across a selection. */
export function useBulkTag() {
  return useMutation({
    mutationFn: async ({ contactIds, add = [], remove = [] }) =>
      await contactsApi.bulkTag({ contact_ids: contactIds, add, remove }),
    onSuccess: (res) => {
      invalidateTagSurfaces();
      // Report the ids that didn't exist rather than counting them as success —
      // a bad paste otherwise looks like it worked.
      const missing = res?.not_found?.length || 0;
      toast.success(
        `Tagged ${res?.updated ?? 0} contact${res?.updated === 1 ? '' : 's'}` +
        (missing ? ` (${missing} not found)` : ''),
      );
    },
    onError: (e) => toast.error(e?.response?.data?.detail || e?.message || 'Failed to tag contacts'),
  });
}

export function useRenameTag() {
  return useMutation({
    mutationFn: async ({ oldTag, newTag }) =>
      await contactsApi.renameTag({ old: oldTag, new: newTag }),
    onSuccess: (res) => {
      invalidateTagSurfaces();
      toast.success(`Renamed on ${res?.updated ?? 0} contact${res?.updated === 1 ? '' : 's'}`);
    },
    onError: (e) => toast.error(e?.response?.data?.detail || e?.message || 'Failed to rename tag'),
  });
}

// ─── Suppression ──────────────────────────────────────────────────────────────

/**
 * Suppress (or un-suppress) a selection.
 *
 * Suppressing also stops those contacts' live enrollments, so the toast reports
 * both numbers — "12 suppressed" alone hides the fact that 30 in-flight
 * sequences just ended, which is the part someone might need to undo.
 */
export function useBulkSuppress() {
  return useMutation({
    mutationFn: async ({ contactIds, suppressed = true, reason }) =>
      await contactsApi.bulkSuppress({
        contact_ids: contactIds, suppressed, ...(reason ? { reason } : {}),
      }),
    onSuccess: (res, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['suppression'] });
      const verb = variables?.suppressed === false ? 'Un-suppressed' : 'Suppressed';
      const stopped = res?.enrollments_stopped || 0;
      toast.success(
        `${verb} ${res?.updated ?? 0} contact${res?.updated === 1 ? '' : 's'}` +
        (stopped ? ` · ${stopped} sequence${stopped === 1 ? '' : 's'} stopped` : ''),
      );
    },
    onError: (e) => toast.error(e?.response?.data?.detail || e?.message || 'Failed to update suppression'),
  });
}

// ─── Engagement ───────────────────────────────────────────────────────────────

/**
 * What we've sent one contact and what came back.
 *
 * Reads both send tables server-side, so this is the only per-contact number
 * that doesn't under-report whichever half of the sending stack was used.
 */
export function useContactEngagement(contactId, limit = 50) {
  return useQuery({
    queryKey: ['contact-engagement', contactId, limit],
    enabled: !!contactId,
    queryFn: async () => {
      try {
        return await contactsApi.engagement(contactId, limit);
      } catch {
        return null;
      }
    },
    retry: false,
  });
}

// The contact database grouped by category (Hunter verdict, source, industry,
// campaign), with counts.
export function useContactFacets() {
  return useQuery({
    queryKey: ['contacts', 'facets'],
    queryFn: contactsApi.facets,
    staleTime: 60000,
  });
}
