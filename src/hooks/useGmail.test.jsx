import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { mockInvalidate, mockAuthorize, mockToast } = vi.hoisted(() => ({
  mockInvalidate: vi.fn(),
  mockAuthorize: vi.fn(),
  mockToast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('react-hot-toast', () => ({ default: mockToast }));
vi.mock('../api/client', () => ({
  gmailApi: { authorize: (...a) => mockAuthorize(...a) },
  queryClient: { invalidateQueries: (...a) => mockInvalidate(...a) },
}));

import { useConnectGmail, subscribeGmailOAuth } from './useGmail';

const SOURCE = 'landline-gmail-oauth';

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return function Wrapper({ children }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

// What the backend callback page writes when window.opener is gone (COOP).
function storageAnnouncement(payload) {
  window.dispatchEvent(
    new StorageEvent('storage', {
      key: SOURCE,
      newValue: JSON.stringify({ source: SOURCE, t: Date.now(), ...payload }),
    }),
  );
}

function statusInvalidations() {
  return mockInvalidate.mock.calls.filter(
    ([arg]) => arg?.queryKey?.[0] === 'gmail-status',
  ).length;
}

describe('Gmail OAuth refreshes the settings page (COOP severs window.opener)', () => {
  beforeEach(() => {
    mockInvalidate.mockReset();
    mockAuthorize.mockReset();
    mockToast.success.mockReset();
    mockToast.error.mockReset();
  });
  afterEach(() => vi.restoreAllMocks());

  it('refetches the account list when the callback announces via localStorage', () => {
    renderHook(() => useConnectGmail(), { wrapper: makeWrapper() });
    act(() => storageAnnouncement({ status: 'connected', message: 'Connected a@b.com' }));
    expect(statusInvalidations()).toBe(1);
    expect(mockToast.success).toHaveBeenCalledWith('Connected a@b.com');
  });

  it('refetches when the callback announces via BroadcastChannel', async () => {
    renderHook(() => useConnectGmail(), { wrapper: makeWrapper() });
    const bc = new BroadcastChannel(SOURCE);
    bc.postMessage({ source: SOURCE, status: 'connected', message: 'Connected c@d.com' });
    bc.close();
    await waitFor(() => expect(statusInvalidations()).toBe(1));
    expect(mockToast.success).toHaveBeenCalledWith('Connected c@d.com');
  });

  it('still refetches after the popup handle already read as closed', async () => {
    // Under COOP the opener sees popup.closed === true right away, so the
    // mutation settles before the user has finished on Google's page. The
    // later announcement must still refresh the list.
    mockAuthorize.mockResolvedValue({ authorization_url: 'https://accounts.google.com/x' });
    vi.spyOn(window, 'open').mockReturnValue({ closed: true });
    const { result } = renderHook(() => useConnectGmail(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.mutateAsync();
    });
    const before = statusInvalidations();

    act(() => storageAnnouncement({ status: 'connected', message: 'Connected late@x.com' }));
    expect(statusInvalidations()).toBe(before + 1);
    expect(mockToast.success).toHaveBeenCalledWith('Connected late@x.com');
  });

  it('reports a failed connection as an error', () => {
    renderHook(() => useConnectGmail(), { wrapper: makeWrapper() });
    act(() => storageAnnouncement({ status: 'error', message: 'No refresh token' }));
    expect(mockToast.error).toHaveBeenCalledWith('No refresh token');
    expect(statusInvalidations()).toBe(1);
  });

  it('delivers once when the same result arrives on several channels', () => {
    const seen = vi.fn();
    const unsubscribe = subscribeGmailOAuth(seen);
    const payload = { source: SOURCE, status: 'connected', message: 'Connected a@b.com' };
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data: payload }));
      storageAnnouncement({ status: 'connected', message: 'Connected a@b.com' });
    });
    expect(seen).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('ignores unrelated messages and stops listening on unmount', () => {
    const { unmount } = renderHook(() => useConnectGmail(), { wrapper: makeWrapper() });
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data: { source: 'other' } }));
      window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated', newValue: '{}' }));
    });
    expect(statusInvalidations()).toBe(0);

    unmount();
    act(() => storageAnnouncement({ status: 'connected', message: 'Connected a@b.com' }));
    expect(statusInvalidations()).toBe(0);
  });
});
