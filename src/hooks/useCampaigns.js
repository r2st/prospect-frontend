import { useQuery, useMutation } from '@tanstack/react-query';
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
      } else if (data?.instant_send === 'window_closed') {
        toast.success('Email approved — it will go out when the send window opens');
      } else {
        toast.success('Email approved — it will go out in the next send window');
      }
    },
    onError: (e) => toast.error(errMsg(e, 'Could not approve the email')),
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
    isUpdating: setStatus.isPending,
    pendingStatus: setStatus.isPending ? setStatus.variables?.status : null,
    isDeleting: remove.isPending,
    pendingProspect: approve.isPending ? approve.variables : skip.isPending ? skip.variables : null,
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

function toastAddResult(result) {
  const msg = addResultMessage(result);
  if (result?.queued) toast.success(msg);
  else toast.error(msg);
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

export function useAddManualProspect(id) {
  return useMutation({
    mutationFn: (data) => campaignsApi.addManual(id, data),
    onSuccess: (result) => {
      invalidateCampaign(id);
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toastAddResult(result);
    },
    onError: (e) => toast.error(errMsg(e, 'Could not add that contact')),
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
