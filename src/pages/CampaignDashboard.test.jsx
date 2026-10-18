import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const api = {
  get: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  prospects: vi.fn(),
  approve: vi.fn(),
  skip: vi.fn(),
  discover: vi.fn(),
};
vi.mock('../api/client', () => ({
  queryClient: { invalidateQueries: vi.fn(), setQueryData: vi.fn(), removeQueries: vi.fn() },
  campaignsApi: {
    get: (...a) => api.get(...a),
    update: (...a) => api.update(...a),
    remove: (...a) => api.remove(...a),
    prospects: (...a) => api.prospects(...a),
    approve: (...a) => api.approve(...a),
    skip: (...a) => api.skip(...a),
    discover: (...a) => api.discover(...a),
  },
  discoveryDocsApi: {},
}));
const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: toastMock }));

import CampaignDashboard from './CampaignDashboard';

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const CAMPAIGN = {
  id: 'c1',
  name: 'Q4 machining push',
  status: 'active',
  documents: [{ id: 'd1', filename: 'deck.pdf' }],
  settings: { daily_limit: 30, send_window_start: '09:00', send_window_end: '17:00', review_before_send: true },
  metrics: {
    total_prospects: 120,
    emails_sent: 50,
    replies: 5,
    bounced: 2,
    drafts_pending: 1,
    daily: [
      { date: '2026-10-14', sent: 20 },
      { date: '2026-10-15', sent: 30 },
    ],
  },
};

const PROSPECTS = {
  items: [
    {
      id: 'p1',
      status: 'draft',
      company: { name: 'Acme Tooling', domain: 'acme.com' },
      contact: { first_name: 'Ana', last_name: 'Li', title: 'COO', email: 'ana@acme.com' },
      email_subject: 'Faster quotes for Acme',
      email_body: 'Hi Ana,\nWe help shops quote faster.',
    },
    {
      id: 'p2',
      status: 'sent',
      company_name: 'Beta Fab',
      contact_name: 'Bo Chen',
      sent_at: '2026-10-15T09:30:00Z',
    },
  ],
  total: 2,
  page: 1,
  page_size: 25,
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/campaigns/c1']}>
        <Routes>
          <Route path="/campaigns/:id" element={<CampaignDashboard />} />
          <Route path="/campaigns" element={<p>campaign list</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('CampaignDashboard', () => {
  beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset());
    toastMock.success.mockReset();
    toastMock.error.mockReset();
    api.get.mockResolvedValue(CAMPAIGN);
    api.prospects.mockResolvedValue(PROSPECTS);
  });

  it('shows a skeleton while the campaign loads', () => {
    api.get.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId('campaign-skeleton')).toBeInTheDocument();
  });

  it('renders the status, stats and chart', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Q4 machining push' })).toBeInTheDocument();
    expect(screen.getByTestId('campaign-status')).toHaveTextContent('Active');
    expect(screen.getByText('Total Prospects').parentElement).toHaveTextContent('120');
    expect(screen.getByText('Emails Sent').parentElement).toHaveTextContent('50');
    expect(screen.getByText('Replies').parentElement).toHaveTextContent('5');
    expect(screen.getByText('Bounce Rate').parentElement).toHaveTextContent('4.0%');
    expect(screen.getByTestId('daily-chart')).toBeInTheDocument();
    expect(screen.getByText(/1 draft\(s\) waiting for your review/)).toBeInTheDocument();
  });

  it('shows an empty chart message before any sends', async () => {
    api.get.mockResolvedValue({ ...CAMPAIGN, metrics: { ...CAMPAIGN.metrics, daily: [] } });
    renderPage();
    expect(await screen.findByTestId('chart-empty')).toBeInTheDocument();
  });

  it('pauses an active campaign', async () => {
    api.update.mockResolvedValue({ ...CAMPAIGN, status: 'paused' });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /Pause/ }));
    await waitFor(() => expect(api.update).toHaveBeenCalledWith('c1', { status: 'paused' }));
    expect(toastMock.success).toHaveBeenCalledWith('Campaign paused');
  });

  it('resumes a paused campaign', async () => {
    api.get.mockResolvedValue({ ...CAMPAIGN, status: 'paused' });
    api.update.mockResolvedValue({ ...CAMPAIGN, status: 'active' });
    renderPage();
    expect(await screen.findByTestId('campaign-status')).toHaveTextContent('Paused');
    expect(screen.queryByRole('button', { name: /Pause/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Resume/ }));
    await waitFor(() => expect(api.update).toHaveBeenCalledWith('c1', { status: 'active' }));
    expect(toastMock.success).toHaveBeenCalledWith('Campaign resumed');
  });

  it('asks before stopping', async () => {
    api.update.mockResolvedValue({ ...CAMPAIGN, status: 'stopped' });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Stop' }));
    expect(screen.getByText('Stop this campaign?')).toBeInTheDocument();
    expect(api.update).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Stop campaign' }));
    await waitFor(() => expect(api.update).toHaveBeenCalledWith('c1', { status: 'stopped' }));
    expect(toastMock.success).toHaveBeenCalledWith('Campaign stopped');
  });

  it('offers delete only once stopped, then returns to the list', async () => {
    api.get.mockResolvedValue({ ...CAMPAIGN, status: 'stopped' });
    api.remove.mockResolvedValue(null);
    renderPage();
    expect(await screen.findByTestId('campaign-status')).toHaveTextContent('Stopped');
    expect(screen.queryByRole('button', { name: 'Stop' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Delete campaign' }));
    // The dialog's confirm button shares the name; it renders last.
    await userEvent.click(screen.getAllByRole('button', { name: 'Delete campaign' }).at(-1));
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith('c1'));
    expect(await screen.findByText('campaign list')).toBeInTheDocument();
  });

  it('lists prospects with status badges and per-status actions', async () => {
    renderPage();
    const rows = await screen.findAllByTestId('prospect-row');
    expect(rows).toHaveLength(2);
    const draft = within(rows[0]);
    expect(draft.getByText('Acme Tooling')).toBeInTheDocument();
    expect(draft.getByText('Ana Li')).toBeInTheDocument();
    expect(draft.getByText('Draft')).toBeInTheDocument();
    expect(draft.getByRole('button', { name: 'Approve email to Ana Li' })).toBeInTheDocument();
    expect(draft.getByRole('button', { name: 'Skip Ana Li' })).toBeInTheDocument();
    const sent = within(rows[1]);
    expect(sent.getByText('Sent')).toBeInTheDocument();
    expect(sent.queryByRole('button', { name: /Approve/ })).not.toBeInTheDocument();
    expect(sent.queryByRole('button', { name: /Skip/ })).not.toBeInTheDocument();
  });

  it('approves and skips prospects', async () => {
    api.approve.mockResolvedValue({});
    api.skip.mockResolvedValue({});
    renderPage();
    const [row] = await screen.findAllByTestId('prospect-row');
    await userEvent.click(within(row).getByRole('button', { name: 'Approve email to Ana Li' }));
    await waitFor(() => expect(api.approve).toHaveBeenCalledWith('c1', 'p1'));
    await userEvent.click(within(row).getByRole('button', { name: 'Skip Ana Li' }));
    await waitFor(() => expect(api.skip).toHaveBeenCalledWith('c1', 'p1'));
    expect(toastMock.success).toHaveBeenCalledWith('Prospect skipped');
  });

  it.each([
    ['dispatched', 'Email approved — sending now'],
    ['window_closed', 'Email approved — it will go out when the send window opens'],
    [undefined, 'Email approved — it will go out in the next send window'],
  ])('says what approval did with the email (instant_send=%s)', async (instantSend, message) => {
    api.approve.mockResolvedValue({ status: 'approved', instant_send: instantSend });
    renderPage();
    const [row] = await screen.findAllByTestId('prospect-row');
    await userEvent.click(within(row).getByRole('button', { name: 'Approve email to Ana Li' }));
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith(message));
  });

  it('previews the generated email and approves from the modal', async () => {
    api.approve.mockResolvedValue({});
    renderPage();
    const [row] = await screen.findAllByTestId('prospect-row');
    await userEvent.click(within(row).getByRole('button', { name: 'Preview email to Ana Li' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByTestId('preview-subject')).toHaveTextContent('Faster quotes for Acme');
    expect(within(dialog).getByTestId('preview-body')).toHaveTextContent('We help shops quote faster.');
    await userEvent.click(within(dialog).getByRole('button', { name: /Approve/ }));
    await waitFor(() => expect(api.approve).toHaveBeenCalledWith('c1', 'p1'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('filters prospects by status', async () => {
    renderPage();
    await screen.findAllByTestId('prospect-row');
    await userEvent.click(screen.getByRole('button', { name: 'Replied' }));
    await waitFor(() =>
      expect(api.prospects).toHaveBeenLastCalledWith('c1', { page: 1, page_size: 25, status: 'replied' })
    );
  });

  it('shows an empty state when no prospects are found yet', async () => {
    api.prospects.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('No prospects yet')).toBeInTheDocument();
  });

  it('says so when the campaign does not exist', async () => {
    api.get.mockRejectedValue({ response: { status: 404 } });
    renderPage();
    expect(await screen.findByText('Campaign not found')).toBeInTheDocument();
  });

  it('shows discovery and send-queue numbers', async () => {
    api.get.mockResolvedValue({
      ...CAMPAIGN,
      metrics: {
        ...CAMPAIGN.metrics,
        companies_discovered: 12,
        companies_without_email: 4,
        queued_to_send: 3,
        pending_verified: 2,
        pending_unverified: 5,
      },
    });
    renderPage();
    const box = within(await screen.findByTestId('discovery-metrics'));
    expect(box.getByText('Companies Discovered')).toBeInTheDocument();
    expect(box.getByText('12')).toBeInTheDocument();
    expect(box.getByText('4 without an email yet')).toBeInTheDocument();
    expect(box.getByText('3')).toBeInTheDocument();
    expect(box.getByText('2')).toBeInTheDocument();
    expect(box.getByText('5')).toBeInTheDocument();
  });

  it('marks each address verified or unverified, as the API reports it', async () => {
    api.prospects.mockResolvedValue({
      items: [
        {
          id: 'p3', status: 'draft_created', company_name: 'Gamma', contact_name: 'Cy Day',
          to_email: 'cy@gamma.com', email_verified: false, email_verification: null, email_origin: 'pattern',
          email_subject: 's', email_body: 'b',
        },
        {
          id: 'p4', status: 'approved', company_name: 'Delta', contact_name: 'Di Eve',
          to_email: 'di@delta.com', email_verified: true, email_verification: 'deliverable',
          email_origin: 'hunter_finder',
        },
        { id: 'p5', status: 'no_email', company_name: 'Epsilon' },
      ],
      total: 3, page: 1, page_size: 25,
    });
    renderPage();
    const [gamma, delta, eps] = await screen.findAllByTestId('prospect-row');
    expect(within(gamma).getByText('cy@gamma.com')).toBeInTheDocument();
    expect(within(gamma).getByTestId('email-verification')).toHaveTextContent('Unverified');
    expect(within(gamma).getByText('· Guessed from name')).toBeInTheDocument();
    // draft_created is a draft: it can be approved.
    expect(within(gamma).getByRole('button', { name: 'Approve email to Cy Day' })).toBeInTheDocument();
    expect(within(delta).getByTestId('email-verification')).toHaveTextContent('Verified');
    expect(within(delta).getByText('Ready to send')).toBeInTheDocument();
    expect(within(eps).getByText('No email')).toBeInTheDocument();
    expect(within(eps).queryByTestId('email-verification')).not.toBeInTheDocument();
  });

  it('asks the API for draft_created when filtering by Draft', async () => {
    renderPage();
    await screen.findAllByTestId('prospect-row');
    await userEvent.click(screen.getByRole('button', { name: 'Draft' }));
    await waitFor(() =>
      expect(api.prospects).toHaveBeenLastCalledWith('c1', { page: 1, page_size: 25, status: 'draft_created' })
    );
  });

  it('edits contacts on unsent rows and adds one where discovery found nobody', async () => {
    api.get.mockResolvedValue({
      ...CAMPAIGN,
      sender: { email: 'me@sender.io', kind: 'gmail', ready: true },
    });
    api.prospects.mockResolvedValue({
      ...PROSPECTS,
      items: [
        { ...PROSPECTS.items[0], contact_id: 'ct1', company_id: 'co1' },
        { ...PROSPECTS.items[1], contact_id: 'ct2', company_id: 'co2' },
        { id: 'p3', status: 'no_email', company_name: 'Obsium', company_id: 'co3', contact_id: null },
      ],
      total: 3,
    });
    renderPage();
    expect((await screen.findAllByTestId('sender-line'))[0]).toHaveTextContent('me@sender.io');
    const rows = await screen.findAllByTestId('prospect-row');
    expect(within(rows[0]).getByRole('button', { name: 'Edit contact Ana Li' })).toBeInTheDocument();
    expect(within(rows[0]).getByRole('button', { name: 'Add another contact at Acme Tooling' })).toBeInTheDocument();
    // What went out stays as it was sent.
    expect(within(rows[1]).queryByRole('button', { name: /Edit contact/ })).not.toBeInTheDocument();
    await userEvent.click(within(rows[2]).getByRole('button', { name: 'Add contact at Obsium' }));
    expect(screen.getByRole('dialog', { name: 'Add contact' })).toHaveTextContent('Add a contact at Obsium');
  });

  it('searches for more prospects on demand', async () => {
    api.discover.mockResolvedValue({ processing: 'dispatched', searches_today: 1, searches_left: 4 });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Find more prospects' }));
    await waitFor(() => expect(api.discover).toHaveBeenCalledWith('c1'));
    expect(toastMock.success.mock.calls[0][0]).toMatch(/Searching for more companies/);
  });

  it('offers no search on a paused campaign', async () => {
    api.get.mockResolvedValue({ ...CAMPAIGN, status: 'paused' });
    renderPage();
    await screen.findByText('Q4 machining push');
    expect(screen.queryByRole('button', { name: 'Find more prospects' })).not.toBeInTheDocument();
  });

  describe('approved emails waiting for the window', () => {
    // Sunday 13:00 in Toronto. Only Date is faked, so userEvent still runs.
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-18T17:00:00Z'));
    });
    afterEach(() => vi.useRealTimers());

    const WAITING = {
      ...CAMPAIGN,
      timezone: 'America/Toronto',
      window_open: false,
      send_window_opens_at: '2026-10-19T13:00:00Z',
      settings: { ...CAMPAIGN.settings, send_window_end: '18:00', send_on_weekends: false },
      metrics: { ...CAMPAIGN.metrics, queued_to_send: 2 },
    };

    it('says when they will go out and can include weekends', async () => {
      api.get.mockResolvedValue(WAITING);
      api.update.mockResolvedValue({ ...WAITING, send_on_weekends: true });
      renderPage();
      const banner = await screen.findByTestId('send-window-banner');
      expect(banner).toHaveTextContent('2 approved emails are waiting for the send window — next opens Mon, Oct 19, 9:00 AM EDT');
      expect(banner).toHaveTextContent('sends weekdays 09:00–18:00 (America/Toronto)');
      await userEvent.click(within(banner).getByRole('button', { name: 'Send on weekends too' }));
      await waitFor(() => expect(api.update).toHaveBeenCalledWith('c1', { send_on_weekends: true }));
    });

    it('stays quiet while the window is open or nothing is approved', async () => {
      api.get.mockResolvedValue({ ...WAITING, window_open: true });
      const { unmount } = renderPage();
      await screen.findByText('Q4 machining push');
      expect(screen.queryByTestId('send-window-banner')).not.toBeInTheDocument();
      unmount();
      api.get.mockResolvedValue({ ...WAITING, metrics: { ...WAITING.metrics, queued_to_send: 0 } });
      renderPage();
      await screen.findByText('Q4 machining push');
      expect(screen.queryByTestId('send-window-banner')).not.toBeInTheDocument();
    });
  });
});
