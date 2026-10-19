import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { campaignsApi, queryClient } from '../api/client';
import { errMsg } from './useDiscoveryDocuments';
import {
  DEFAULT_SETTINGS,
  normalizeCampaign,
  normalizeCampaignList,
  normalizeProspectPage,
  toApiStatus,
  toCampaignPatch,
} from '../lib/campaigns';

// A 404 on the collection means this API server doesn't have campaigns yet.
export const isNotAvailable = (error) => error?.response?.status === 404;

// How long after an instant send to re-read the campaign so the row shows "sent".
export const SENT_REFRESH_MS = 8000;

const invalidateCampaign = (id) => {
  queryClient.invalidateQueries({ queryKey: ['campaigns', 'list'] });
  if (id) {
    queryClient.invalidateQueries({ queryKey: ['campaigns', 'detail', id] });
    queryClient.invalidateQueries({ queryKey: ['campaigns', 'prospects', id] });
  }
};

export function useCampaigns() {
  return useQuery({
    queryKey: ['campaigns', 'list'],
    queryFn: campaignsApi.list,
    select: normalizeCampaignList,
    staleTime: 15000,
    retry: (count, e) => !isNotAvailable(e) && count < 1,
  });
}

// Polls every 3s while the documents are being analysed into an ICP, and every
// 30s while the campaign is sending so the counters move.
export function useCampaign(id) {
  return useQuery({
    queryKey: ['campaigns', 'detail', id],
    queryFn: () => campaignsApi.get(id),
    select: normalizeCampaign,
    enabled: Boolean(id),
    retry: (count, e) => !isNotAvailable(e) && count < 1,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'analyzing') return 3000;
      if (status === 'active') return 30000;
      return false;
    },
  });
}

export function useCampaignProspects(id, { page = 1, pageSize = 25, status } = {}) {
  return useQuery({
    queryKey: ['campaigns', 'prospects', id, { page, pageSize, status: status || null }],
    queryFn: () =>
      campaignsApi.prospects(id, { page, page_size: pageSize, ...(status ? { status: toApiStatus(status) } : {}) }),
    select: (data) => normalizeProspectPage(data, pageSize),
    enabled: Boolean(id),
    placeholderData: (prev) => prev,
  });
}

// Creation carries the wizard's defaults (review before send on, a modest daily
// limit): the campaign is live — and runs its first search — the moment it is
// created, before the Sending step is ever reached.
export function useCreateCampaign() {
  return useMutation({
    mutationFn: ({ settings, ...data }) =>
      campaignsApi.create(toCampaignPatch({ settings: { ...DEFAULT_SETTINGS, ...(settings || {}) }, ...data })),
    onSuccess: (campaign) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', 'list'] });
      if (campaign?.id) queryClient.setQueryData(['campaigns', 'detail', campaign.id], campaign);
    },
    onError: (e) =>
      toast.error(
        isNotAvailable(e) ? 'Autopilot campaigns aren’t available on this server yet' : errMsg(e, 'Could not create the campaign')
      ),
  });
}

// Edits the ICP / settings / name without a toast; status moves go through
// useCampaignActions so each gets its own message.
export function useUpdateCampaign(id) {
  return useMutation({
    mutationFn: (data) => campaignsApi.update(id, toCampaignPatch(data)),
    onSuccess: (campaign) => {
      if (campaign?.id) queryClient.setQueryData(['campaigns', 'detail', id], campaign);
      invalidateCampaign(id);
    },
    onError: (e) => toast.error(errMsg(e, 'Could not save the campaign')),
  });
}

const STATUS_TOAST = {
  active: 'Campaign started',
  paused: 'Campaign paused',
  stopped: 'Campaign stopped',
};

// Manual sends this tab made recently. The server paces each mailbox (45s
// apart, 30 an hour); this only warns before a click that would hit that.
const recentManualSends = [];
const QUICK_WINDOW_MS = 2 * 60 * 1000;
const QUICK_LIMIT = 3;
function noteManualSend() {
  const now = Date.now();
  while (recentManualSends.length && now - recentManualSends[0] > QUICK_WINDOW_MS) recentManualSends.shift();
  recentManualSends.push(now);
  if (recentManualSends.length > QUICK_LIMIT) {
    toast("You're sending quickly. To protect the mailbox's reputation, sends are spaced at least 45s apart and capped at 30 an hour — extra ones wait in the queue.", { icon: '⚠️', duration: 6000 });
  }
}

function toastSendResult(r, to) {
  if (r?.outcome === 'sent') toast.success(`Email sent to ${to}`);
  else if (r?.outcome === 'held') toast(`Approved, not sent yet — ${r.detail || 'it will go out from the queue'}`, { icon: '⏳' });
  else toast.error(`Not sent — ${r?.detail || r?.outcome || 'unknown reason'}`);
}

export function useCampaignActions(id) {
  const setStatus = useMutation({
    // `resumed` only picks the toast; it isn't sent.
    // eslint-disable-next-line no-unused-vars
    mutationFn: ({ status, resumed, ...rest }) => campaignsApi.update(id, { ...rest, status }),
    onSuccess: (campaign, { status, resumed }) => {
      if (campaign?.id) queryClient.setQueryData(['campaigns', 'detail', id], campaign);
      invalidateCampaign(id);
      toast.success(resumed ? 'Campaign resumed' : STATUS_TOAST[status] || 'Campaign updated');
    },
    onError: (e) => toast.error(errMsg(e, 'Could not update the campaign')),
  });

  const remove = useMutation({
    mutationFn: () => campaignsApi.remove(id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['campaigns', 'detail', id] });
      queryClient.invalidateQueries({ queryKey: ['campaigns', 'list'] });
      toast.success('Campaign deleted');
    },
    onError: (e) => toast.error(errMsg(e, 'Could not delete the campaign')),
  });

  const approve = useMutation({
    mutationFn: (pid) => campaignsApi.approve(id, pid),
    onSuccess: (data) => {
      invalidateCampaign(id);
      if (data?.instant_send === 'dispatched') {
        toast.success('Email approved — sending now');
        // The send lands a few seconds later; show it without waiting for a poll.
        setTimeout(() => invalidateCampaign(id), SENT_REFRESH_MS);
      } else if (data?.instant_send === 'limit_reached') {
        toast.success("Email approved — today's warm-up limit is reached, so it goes out tomorrow");
      } else {
        // Broker unreachable: the 15-minute tick sends it instead.
        toast.success('Email approved — it will go out within 15 minutes');
      }
    },
    onError: (e) => toast.error(errMsg(e, 'Could not approve the email')),
  });

  const bulkApprove = useMutation({
    mutationFn: (data) => campaignsApi.bulkApprove(id, data),
    onSuccess: (data) => {
      invalidateCampaign(id);
      const n = data?.approved || 0;
      const left = data?.skipped_unverified || 0;
      const leftNote = left ? ` ${left} unverified left as draft${left === 1 ? '' : 's'}.` : '';
      if (!n) {
        toast.error(left ? `Nothing approved — ${left} draft${left === 1 ? ' is' : 's are'} unverified.` : 'No drafts to approve');
        return;
      }
      const what = `${n} email${n === 1 ? '' : 's'} approved`;
      if (data?.instant_send === 'dispatched') {
        toast.success(`${what} — sending now.${leftNote}`);
        setTimeout(() => invalidateCampaign(id), SENT_REFRESH_MS);
      } else if (data?.instant_send === 'limit_reached') {
        toast.success(`${what} — today's warm-up limit is reached, so they go out tomorrow.${leftNote}`);
      } else {
        toast.success(`${what}.${leftNote}`);
      }
    },
    onError: (e) => toast.error(errMsg(e, 'Could not approve the drafts')),
  });

  // Send now: { pid, to } where `to` names the recipient for the toast.
  const sendNow = useMutation({
    mutationFn: ({ pid }) => { noteManualSend(); return campaignsApi.sendNow(id, pid); },
    onSuccess: (r, { to }) => {
      invalidateCampaign(id);
      toastSendResult(r, to);
    },
    onError: (e) => toast.error(errMsg(e, 'Could not send the email')),
  });

  const composeSend = useMutation({
    mutationFn: ({ pid, subject, body }) => {
      noteManualSend();
      return campaignsApi.composeSend(id, pid, { email_subject: subject, email_body: body });
    },
    onSuccess: (r, { to }) => {
      invalidateCampaign(id);
      toastSendResult(r, to);
    },
    onError: (e) => toast.error(errMsg(e, 'Could not send the email')),
  });

  const sendNowMany = useMutation({
    mutationFn: (pids) => campaignsApi.sendNowMany(id, pids),
    onSuccess: (r) => {
      invalidateCampaign(id);
      const results = r?.results || [];
      const sent = results.filter((x) => x.outcome === 'sent').length;
      const queued = results.filter((x) => x.outcome === 'queued').length;
      const notSent = results.filter((x) => x.outcome !== 'sent' && x.outcome !== 'queued');
      const why = [...new Set(notSent.map((x) => x.detail || x.outcome))].join('; ');
      const msg = `${sent} sent`
        + (queued ? ` · ${queued} queued, 1–2 min apart` : '')
        + (notSent.length ? ` · ${notSent.length} not sent (${why})` : '');
      if (sent || queued) toast.success(msg);
      else toast.error(msg);
    },
    onError: (e) => toast.error(errMsg(e, 'Could not send the emails')),
  });

  const skip = useMutation({
    mutationFn: (pid) => campaignsApi.skip(id, pid),
    onSuccess: () => {
      invalidateCampaign(id);
      toast.success('Prospect skipped');
    },
    onError: (e) => toast.error(errMsg(e, 'Could not skip the prospect')),
  });

  return {
    start: (extra = {}, opts) => setStatus.mutate({ ...extra, status: 'active' }, opts),
    pause: (opts) => setStatus.mutate({ status: 'paused' }, opts),
    resume: (opts) => setStatus.mutate({ status: 'active', resumed: true }, opts),
    stop: (opts) => setStatus.mutate({ status: 'stopped' }, opts),
    remove: (opts) => remove.mutate(undefined, opts),
    approve: (pid, opts) => approve.mutate(pid, opts),
    skip: (pid, opts) => skip.mutate(pid, opts),
    // All verified drafts: bulkApprove(). Picked rows: bulkApprove({ prospect_ids }).
    bulkApprove: (data = { verified_only: true }, opts) => bulkApprove.mutate(data, opts),
    sendNow: (pid, to, opts) => sendNow.mutate({ pid, to }, opts),
    composeSend: (pid, { subject, body }, to, opts) => composeSend.mutate({ pid, subject, body, to }, opts),
    isComposeSending: composeSend.isPending,
    sendNowMany: (pids, opts) => sendNowMany.mutate(pids, opts),
    isSendingMany: sendNowMany.isPending,
    isBulkApproving: bulkApprove.isPending,
    isUpdating: setStatus.isPending,
    pendingStatus: setStatus.isPending ? setStatus.variables?.status : null,
    isDeleting: remove.isPending,
    pendingProspect: approve.isPending ? approve.variables
      : skip.isPending ? skip.variables
      : sendNow.isPending ? sendNow.variables?.pid : null,
    sendingProspect: sendNow.isPending ? sendNow.variables?.pid : null,
  };
}

// Delete from the campaign list, where there is no single campaign id to bind
// useCampaignActions to. Soft delete on the server: the campaign stops, its
// unsent prospects are skipped, and sent ones are kept so no address is mailed
// twice by a later campaign.
export function useDeleteCampaign() {
  const remove = useMutation({
    mutationFn: (id) => campaignsApi.remove(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: ['campaigns', 'detail', id] });
      queryClient.invalidateQueries({ queryKey: ['campaigns', 'list'] });
      toast.success('Campaign deleted');
    },
    onError: (e) => toast.error(errMsg(e, 'Could not delete the campaign')),
  });
  return {
    remove: (id, opts) => remove.mutate(id, opts),
    deletingId: remove.isPending ? remove.variables : null,
  };
}

// Connected Gmail + SMTP mailboxes a campaign can send from (yours first).
export function useCampaignSenders() {
  return useQuery({
    queryKey: ['campaigns', 'senders'],
    queryFn: campaignsApi.senders,
    staleTime: 60000,
  });
}

// "2 added · 1 skipped (Already a prospect in a campaign)" — so an add that did
// nothing always says why.
export function addResultMessage(result) {
  const queued = result?.queued ?? 0;
  const skipped = result?.skipped ?? [];
  const parts = [`${queued} added`];
  if (skipped.length) {
    const reasons = [...new Set(skipped.map((s) => s.label))].join('; ');
    parts.push(`${skipped.length} skipped (${reasons})`);
  }
  const tail = queued ? ' — verifying with Hunter before anything is sent' : '';
  return parts.join(' · ') + tail;
}

function toastAddResult(result, opts) {
  const msg = addResultMessage(result);
  if (result?.queued) toast.success(msg, opts);
  else toast.error(msg, opts);
}

export function useAddContactsToCampaign() {
  return useMutation({
    mutationFn: ({ campaignId, contactIds }) => campaignsApi.addContacts(campaignId, contactIds),
    onSuccess: (result, { campaignId }) => {
      invalidateCampaign(campaignId);
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toastAddResult(result);
    },
    onError: (e) => toast.error(errMsg(e, 'Could not add those contacts')),
  });
}

// Optimistic: the server saves the contact into the CRM and runs dedup before
// it answers, so the new person is shown at the top of the list straight away
// (as "Adding…") and replaced by the real row when the refetch lands.
export function useAddManualProspect(id) {
  const qc = useQueryClient();
  const listKey = ['campaigns', 'prospects', id];
  return useMutation({
    mutationFn: (data) => campaignsApi.addManual(id, data),
    onMutate: async (data) => {
      await qc.cancelQueries({ queryKey: listKey });
      const snapshot = qc.getQueriesData({ queryKey: listKey });
      const name = [data.first_name, data.last_name].filter(Boolean).join(' ');
      const row = {
        id: `pending-${Date.now()}`, pending: true, status: 'queued',
        company_name: data.company_name, company_domain: data.domain || null,
        contact_name: name, contact_title: data.title || null, to_email: data.email || null,
      };
      // Only the views a new queued prospect belongs in: page 1 of All / Queued.
      for (const [key, old] of snapshot) {
        const view = key[3] || {};
        if (!old || (view.page ?? 1) !== 1 || (view.status && view.status !== 'queued')) continue;
        qc.setQueryData(key, Array.isArray(old)
          ? [row, ...old]
          : { ...old, items: [row, ...(old.items || [])], total: (old.total || 0) + 1 });
      }
      const toastId = toast.loading(`Adding ${name || data.company_name}…`);
      return { snapshot, toastId };
    },
    onSuccess: (result, _data, ctx) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toastAddResult(result, { id: ctx?.toastId });
      if (!result?.queued) ctx?.snapshot?.forEach(([key, old]) => qc.setQueryData(key, old));
    },
    onError: (e, _data, ctx) => {
      ctx?.snapshot?.forEach(([key, old]) => qc.setQueryData(key, old));
      toast.error(errMsg(e, 'Could not add that contact'), { id: ctx?.toastId });
    },
    onSettled: () => invalidateCampaign(id),
  });
}

export function useSaveDraftAsTemplate(campaignId) {
  return useMutation({
    mutationFn: ({ prospectId, ...body }) => campaignsApi.saveTemplate(campaignId, prospectId, body),
    onSuccess: (t, { use_for_campaign: use }) => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      invalidateCampaign(campaignId);
      toast.success(use ? `Saved "${t.name}" — the rest of this campaign will use it` : `Saved template "${t.name}"`);
    },
    onError: (e) => toast.error(errMsg(e, 'Could not save the template')),
  });
}

export function useRedraftCampaign(id) {
  return useMutation({
    mutationFn: () => campaignsApi.redraft(id),
    onSuccess: (r) => {
      invalidateCampaign(id);
      toast.success(r.redrafting
        ? `Re-drafting ${r.redrafting} email${r.redrafting === 1 ? '' : 's'} with the current template`
        : 'No unapproved drafts to rewrite');
    },
    onError: (e) => toast.error(errMsg(e, 'Could not re-draft')),
  });
}

// "Find more prospects": a search runs in the worker; new rows appear as the
// campaign refetches, so refetch once more after a typical search.
export function useDiscoverMore(id) {
  return useMutation({
    mutationFn: () => campaignsApi.discover(id),
    onSuccess: () => {
      toast.success('Searching for more companies — new prospects appear here in a minute or two');
      setTimeout(() => invalidateCampaign(id), DISCOVERY_REFRESH_MS);
    },
    onError: (e) => toast.error(errMsg(e, 'Could not start a search')),
  });
}

export const DISCOVERY_REFRESH_MS = 60000;

// Switch one draft to another template (or back to the AI) from its preview.
export function useRedraftProspect(id) {
  return useMutation({
    mutationFn: ({ prospectId, ...body }) => campaignsApi.redraftProspect(id, prospectId, body),
    onSuccess: (p) => {
      invalidateCampaign(id);
      toast.success(p?.template_name ? `Re-drafted from "${p.template_name}"` : 'Re-drafted by the AI');
    },
    onError: (e) => toast.error(errMsg(e, 'Could not re-draft this email')),
  });
}

export function useSetProspectContact(id) {
  return useMutation({
    mutationFn: ({ prospectId, ...data }) => campaignsApi.setContact(id, prospectId, data),
    onSuccess: (r) => {
      invalidateCampaign(id);
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      if (r.skipped?.length) toast.error(`Saved, but it can't be emailed: ${r.skipped[0].label}`);
      else if (r.queued) toast.success('Saved — verifying the address and re-drafting the email');
      else toast.success('Contact saved');
    },
    onError: (e) => toast.error(errMsg(e, 'Could not save the contact')),
  });
}
