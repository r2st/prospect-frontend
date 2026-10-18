import { useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { gmailApi, queryClient } from '../api/client';

function errMsg(error, fallback) {
  return error?.response?.data?.detail || error?.message || fallback;
}

// Connection status: configured / connected / active account / all accounts.
export function useGmailStatus() {
  return useQuery({
    queryKey: ['gmail-status'],
    queryFn: async () => await gmailApi.status(),
    staleTime: 10000,
    // Coming back from the consent popup (or another tab) re-checks.
    refetchOnWindowFocus: true,
  });
}

const OAUTH_SOURCE = 'landline-gmail-oauth';

// Subscribe to the result the backend's OAuth callback page announces.
//
// The SPA is served with `Cross-Origin-Opener-Policy: same-origin`, which
// severs `window.opener` as soon as the popup navigates to Google — so the
// callback's postMessage never arrives in production. The callback page also
// announces itself on a BroadcastChannel and via a localStorage write (both
// same-origin, both survive COOP); listen on all three. A page that reaches us
// on more than one channel is delivered once.
export function subscribeGmailOAuth(onResult) {
  let lastKey = null;
  let lastAt = 0;
  const deliver = (data) => {
    if (!data || data.source !== OAUTH_SOURCE) return;
    const key = `${data.status}|${data.message || ''}`;
    const now = Date.now();
    if (key === lastKey && now - lastAt < 5000) return;
    lastKey = key;
    lastAt = now;
    onResult(data);
  };

  const onMessage = (event) => deliver(event.data);
  const onStorage = (event) => {
    if (event.key !== OAUTH_SOURCE || !event.newValue) return;
    try {
      deliver(JSON.parse(event.newValue));
    } catch {
      // not ours
    }
  };
  window.addEventListener('message', onMessage);
  window.addEventListener('storage', onStorage);

  let channel = null;
  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(OAUTH_SOURCE);
    channel.onmessage = (event) => deliver(event.data);
  }

  return () => {
    window.removeEventListener('message', onMessage);
    window.removeEventListener('storage', onStorage);
    if (channel) channel.close();
  };
}

// Open the Google consent screen in a popup and resolve once it closes.
//
// This deliberately does not wait for the callback's result: under COOP the
// opener's handle reports `closed` almost immediately, long before the user has
// finished on Google's page. The result is handled by the subscription in
// useConnectGmail, which outlives this promise.
function openOAuthPopup(authorizationUrl) {
  return new Promise((resolve, reject) => {
    const w = 520;
    const h = 640;
    const left = window.screenX + Math.max(0, (window.outerWidth - w) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - h) / 2);
    const popup = window.open(
      authorizationUrl,
      OAUTH_SOURCE,
      `width=${w},height=${h},left=${left},top=${top}`,
    );
    if (!popup) {
      reject(new Error('Popup blocked — allow popups for this site and try again.'));
      return;
    }
    const poll = setInterval(() => {
      if (popup.closed) {
        clearInterval(poll);
        resolve();
      }
    }, 600);
  });
}

export function useConnectGmail() {
  // Refresh the account list whenever a connection completes — on whichever
  // channel the callback reached us — and report the outcome.
  useEffect(
    () =>
      subscribeGmailOAuth((data) => {
        queryClient.invalidateQueries({ queryKey: ['gmail-status'] });
        if (data.status === 'connected') {
          toast.success(data.message || 'Gmail connected');
        } else {
          toast.error(data.message || 'Connection failed');
        }
      }),
    [],
  );

  return useMutation({
    mutationFn: async () => {
      const { authorization_url } = await gmailApi.authorize();
      return await openOAuthPopup(authorization_url);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gmail-status'] });
    },
    onError: (e) => toast.error(errMsg(e, 'Could not connect Gmail')),
  });
}

export function useSetActiveGmail() {
  return useMutation({
    mutationFn: async (id) => await gmailApi.setActive(id),
    onSuccess: (acct) => {
      queryClient.invalidateQueries({ queryKey: ['gmail-status'] });
      toast.success(`Now sending as ${acct.email}`);
    },
    onError: (e) => toast.error(errMsg(e, 'Failed to set active account')),
  });
}

export function useDisconnectGmail() {
  return useMutation({
    mutationFn: async (id) => await gmailApi.disconnect(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gmail-status'] });
      toast.success('Gmail account disconnected');
    },
    onError: (e) => toast.error(errMsg(e, 'Failed to disconnect')),
  });
}

export function usePurgeGmail() {
  return useMutation({
    mutationFn: async (id) => await gmailApi.purge(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['gmail-status'] });
      queryClient.invalidateQueries({ queryKey: ['email-inbox'] });
      toast.success(
        `Removed ${data.email} and deleted ${data.total_deleted} emails`
      );
    },
    onError: (e) => toast.error(errMsg(e, 'Failed to purge account')),
  });
}

export function useToggleSending() {
  return useMutation({
    mutationFn: async ({ id, enabled }) => await gmailApi.toggleSending(id, enabled),
    onSuccess: (acct) => {
      queryClient.invalidateQueries({ queryKey: ['gmail-status'] });
      toast.success(
        acct.sending_enabled
          ? `${acct.email} added to sending rotation`
          : `${acct.email} removed from rotation`
      );
    },
    onError: (e) => toast.error(errMsg(e, 'Failed to toggle sending')),
  });
}
