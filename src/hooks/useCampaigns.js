import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { campaignsApi, queryClient } from '../api/client';
import { errMsg } from './useDiscoveryDocuments';
import { normalizeCampaign, normalizeCampaignList, normalizeProspectPage, toApiStatus } from '../lib/campaigns';

// A 404 on the collection means this API server doesn't have campaigns yet.
export const isNotAvailable = (error) => error?.response?.status === 404;

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

export function useCreateCampaign() {
  return useMutation({
    mutationFn: (data) => campaignsApi.create(data),
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
    mutationFn: (data) => campaignsApi.update(id, data),
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
    onSuccess: () => {
      invalidateCampaign(id);
      toast.success('Email approved — it will go out in the next send window');
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
