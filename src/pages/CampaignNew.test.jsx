import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const docs = { list: vi.fn(), get: vi.fn(), uploadMany: vi.fn() };
const camp = { get: vi.fn(), create: vi.fn(), update: vi.fn(), senders: vi.fn(), templates: vi.fn() };
vi.mock('../api/client', () => ({
  queryClient: { invalidateQueries: vi.fn(), setQueryData: vi.fn(), removeQueries: vi.fn() },
  discoveryDocsApi: {
    list: (...a) => docs.list(...a),
    get: (...a) => docs.get(...a),
    uploadMany: (...a) => docs.uploadMany(...a),
  },
  campaignsApi: {
    get: (...a) => camp.get(...a),
    create: (...a) => camp.create(...a),
    update: (...a) => camp.update(...a),
    senders: (...a) => camp.senders(...a),
  },
  emailApi: { getTemplates: (...a) => camp.templates(...a) },
}));
const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: toastMock }));

import CampaignNew from './CampaignNew';

const DOCS = [
  { id: 'd1', filename: 'deck.pdf', status: 'ready', candidate_count: 3, created_at: '2026-10-10T00:00:00Z' },
  { id: 'd2', filename: 'customers.csv', status: 'ready', candidate_count: 12, created_at: '2026-10-11T00:00:00Z' },
];

const CAMPAIGN = {
  id: 'c1',
  name: 'Outreach — deck',
  status: 'ready',
  documents: [{ id: 'd1', filename: 'deck.pdf' }],
  document_ids: ['d1'],
  icp: {
    industries: ['CNC machining'],
    company_size: '51-200',
    geographies: ['Germany'],
    titles: ['Plant Manager'],
    value_props: ['Quotes in minutes'],
  },
  settings: { daily_limit: 25, send_window_start: '09:00', send_window_end: '17:00' },
};

function renderAt(url) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/campaigns/new" element={<CampaignNew />} />
          <Route path="/campaigns/:id" element={<p>dashboard</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('CampaignNew wizard', () => {
  beforeEach(() => {
    [...Object.values(docs), ...Object.values(camp)].forEach((f) => f.mockReset());
    toastMock.success.mockReset();
    docs.list.mockResolvedValue(DOCS);
    docs.get.mockResolvedValue({ ...DOCS[0], candidates: [{ id: 'k1', name: 'Acme Tooling', industry: 'CNC' }] });
    camp.get.mockResolvedValue(CAMPAIGN);
    camp.create.mockResolvedValue(CAMPAIGN);
    camp.update.mockImplementation((id, body) => Promise.resolve({ ...CAMPAIGN, ...body }));
    camp.templates.mockResolvedValue([
      { id: 't1', name: 'SRE intro', is_archived: false },
      { id: 't2', name: 'Old one', is_archived: true },
    ]);
    camp.senders.mockResolvedValue([
      { id: 'g1', kind: 'gmail', email: 'me@ourco.com', mine: true },
      { id: 's1', kind: 'smtp', email: 'outbound@ourco.com', mine: false },
    ]);
  });

  it('attaches documents and drafts from a chosen template', async () => {
    camp.get.mockResolvedValue({ ...CAMPAIGN, attachments: ['deck.pdf'], attach_documents: false });
    renderAt('/campaigns/new?id=c1&step=2');
    expect(await screen.findByText(/Every email carries deck.pdf/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('switch', { name: 'Attach campaign documents' }));
    const select = screen.getByLabelText('Default email template');
    await waitFor(() => expect(within(select).getAllByRole('option')).toHaveLength(2)); // archived hidden
    await userEvent.selectOptions(select, 't1');
    // Choosing a template defaults to AI personalisation; switch to "as written".
    expect(screen.getByRole('radio', { name: /Personalise with AI/ })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: /Use exactly as written/ }));
    await userEvent.click(screen.getByRole('button', { name: /^Next/ }));
    await waitFor(() => expect(camp.update).toHaveBeenCalled());
    expect(camp.update.mock.calls[0][1]).toMatchObject({
      attach_documents: true, template_id: 't1', template_mode: 'template',
    });
  });

  it('preselects the org default template when creating, and leaves it to the server', async () => {
    camp.templates.mockResolvedValue([
      { id: 't1', name: 'SRE intro', is_archived: false },
      { id: 't3', name: 'First touch', is_archived: false, is_default: true },
    ]);
    renderAt('/campaigns/new?docs=d1');
    const select = await screen.findByLabelText('Default email template');
    await waitFor(() => expect(select).toHaveValue('t3'));
    expect(within(select).getByRole('option', { name: 'First touch (org default)' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Personalise with AI/ })).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: /Analyze documents/ }));
    await waitFor(() => expect(camp.create).toHaveBeenCalled());
    // Untouched: the server applies the org default itself.
    expect(camp.create.mock.calls[0][0]).not.toHaveProperty('template_id');
  });

  it('sends a template chosen at creation, so the first drafts use it', async () => {
    renderAt('/campaigns/new?docs=d1');
    const select = await screen.findByLabelText('Default email template');
    await waitFor(() => expect(within(select).getAllByRole('option')).toHaveLength(2));
    await userEvent.selectOptions(select, 't1');
    await userEvent.click(screen.getByRole('radio', { name: /Use exactly as written/ }));
    await userEvent.click(screen.getByRole('button', { name: /Analyze documents/ }));
    await waitFor(() => expect(camp.create).toHaveBeenCalled());
    expect(camp.create.mock.calls[0][0]).toMatchObject({ template_id: 't1', template_mode: 'template' });
  });

  it('can opt out of the org default at creation', async () => {
    camp.templates.mockResolvedValue([{ id: 't3', name: 'First touch', is_archived: false, is_default: true }]);
    renderAt('/campaigns/new?docs=d1');
    const select = await screen.findByLabelText('Default email template');
    await waitFor(() => expect(select).toHaveValue('t3'));
    await userEvent.selectOptions(select, '');
    await userEvent.click(screen.getByRole('button', { name: /Analyze documents/ }));
    await waitFor(() => expect(camp.create).toHaveBeenCalled());
    expect(camp.create.mock.calls[0][0]).toMatchObject({ template_id: null, template_mode: 'ai' });
  });

  it('names the default template in the launch summary', async () => {
    camp.get.mockResolvedValue({ ...CAMPAIGN, template_id: 't1', template_mode: 'template' });
    renderAt('/campaigns/new?id=c1&step=3');
    expect(await screen.findByText('SRE intro — exactly as written')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Edit Email template' }));
    expect(await screen.findByText('Sending settings')).toBeInTheDocument();
  });

  it('lets you pick which mailbox the campaign sends from', async () => {
    renderAt('/campaigns/new?docs=d1');
    const select = await screen.findByLabelText('Send from');
    await waitFor(() => expect(within(select).getAllByRole('option')).toHaveLength(2));
    expect(within(select).getByRole('option', { name: /outbound@ourco.com · SMTP \(teammate\)/ })).toBeInTheDocument();
    await userEvent.selectOptions(select, 's1');
    await userEvent.click(screen.getByRole('button', { name: /Analyze documents/ }));
    await waitFor(() => expect(camp.create).toHaveBeenCalled());
    expect(camp.create.mock.calls[0][0].sender_account_id).toBe('s1');
  });

  it('reads the ICP the server actually returns (icp_json) and keeps what it does not edit', async () => {
    const serverShaped = {
      ...CAMPAIGN,
      icp: undefined,
      icp_json: {
        summary: 'Shops that quote by hand', search_query: 'CNC shops', keywords: ['quoting'],
        target_industries: ['CNC machining'], target_locations: ['Ontario'],
        buyer_titles: ['COO'], value_props: ['Fast quotes'], company_size: { min: 10, max: 50 },
      },
    };
    camp.get.mockResolvedValue(serverShaped);
    renderAt('/campaigns/new?id=c1&step=1');
    expect(await screen.findByDisplayValue('10-50')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Next/ }));
    await waitFor(() => expect(camp.update).toHaveBeenCalled());
    const body = camp.update.mock.calls[0][1].icp_json;
    expect(body.target_locations).toEqual(['Ontario']);
    expect(body.company_size).toEqual({ min: 10, max: 50 });
    // Fields the wizard doesn't show survive the save.
    expect(body.search_query).toBe('CNC shops');
    expect(body.keywords).toEqual(['quoting']);
  });

  it('preselects documents passed from Discovery and creates the campaign', async () => {
    renderAt('/campaigns/new?docs=d1');
    const deck = await screen.findByRole('checkbox', { name: 'Use deck.pdf' });
    expect(deck).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Use customers.csv' })).not.toBeChecked();

    await userEvent.click(screen.getByRole('button', { name: /Analyze documents/ }));
    await waitFor(() =>
      // In the API's own field names, with the wizard's defaults: the campaign
      // is live the moment it exists, so review-before-send must already be on.
      expect(camp.create).toHaveBeenCalledWith({
        name: 'Outreach — deck',
        document_ids: ['d1'],
        sender_account_id: 'g1',
        daily_send_limit: 25,
        send_window_start: '09:00',
        send_window_end: '17:00',
        send_on_weekends: false,
        review_before_send: true,
      })
    );
    // On to the ICP step for the new campaign.
    expect(await screen.findByText('Your ideal customer')).toBeInTheDocument();
  });

  it('needs at least one document before analysing', async () => {
    renderAt('/campaigns/new');
    await screen.findByRole('checkbox', { name: 'Use deck.pdf' });
    const next = screen.getByRole('button', { name: /Analyze documents/ });
    expect(next).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Use customers.csv' }));
    expect(next).toBeEnabled();
  });

  it('shows a document preview on demand', async () => {
    renderAt('/campaigns/new');
    await userEvent.click(await screen.findByRole('button', { name: 'Show preview of deck.pdf' }));
    expect(await screen.findByTestId('doc-preview-d1')).toHaveTextContent('Acme Tooling');
  });

  it('uploads new documents and selects them', async () => {
    docs.uploadMany.mockResolvedValue({
      documents: [{ id: 'd3', filename: 'pricing.pdf', status: 'parsing' }],
      rejected: [],
    });
    renderAt('/campaigns/new');
    await screen.findByRole('checkbox', { name: 'Use deck.pdf' });
    const file = new File(['x'], 'pricing.pdf', { type: 'application/pdf' });
    await userEvent.upload(screen.getByTestId('campaign-upload'), file);
    await waitFor(() => expect(docs.uploadMany).toHaveBeenCalled());
    expect(docs.uploadMany.mock.calls[0][0]).toEqual([file]);
  });

  it('waits while the documents are analysed', async () => {
    camp.get.mockResolvedValue({ ...CAMPAIGN, status: 'analyzing', icp: null });
    renderAt('/campaigns/new?id=c1&step=1');
    expect(await screen.findByTestId('icp-analyzing')).toBeInTheDocument();
  });

  it('edits the ICP and saves it', async () => {
    renderAt('/campaigns/new?id=c1&step=1');
    expect(await screen.findByText('CNC machining')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Decision-maker titles'), 'COO{enter}');
    await userEvent.click(screen.getByRole('button', { name: 'Remove Germany from Geography' }));
    await userEvent.click(screen.getByRole('button', { name: /^Next/ }));
    await waitFor(() => expect(camp.update).toHaveBeenCalled());
    // icp_json in the API's shape — an `icp` key is ignored by the server.
    expect(camp.update).toHaveBeenCalledWith('c1', {
      icp_json: {
        target_industries: ['CNC machining'],
        company_size: { min: 51, max: 200 },
        target_locations: [],
        buyer_titles: ['Plant Manager', 'COO'],
        value_props: ['Quotes in minutes'],
      },
    });
    expect(await screen.findByText('Sending settings')).toBeInTheDocument();
  });

  it('saves sending settings, with no send window to set', async () => {
    renderAt('/campaigns/new?id=c1&step=2');
    const slider = await screen.findByLabelText('Daily send limit');
    fireEvent.change(slider, { target: { value: '60' } });
    expect(screen.getByTestId('daily-limit-value')).toHaveTextContent('60 emails/day');

    await userEvent.click(screen.getByRole('switch', { name: 'Review before send' }));

    // Approved emails send immediately, so there's no window or weekend rule.
    expect(screen.queryByLabelText('Send window start')).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Send on weekends' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^Next/ }));
    await waitFor(() =>
      // Flat API fields — a `settings` key is ignored by the server, which is
      // how every choice made on this step used to be silently dropped.
      expect(camp.update).toHaveBeenCalledWith('c1', {
        daily_send_limit: 60,
        send_window_start: '09:00',
        send_window_end: '17:00',
        send_on_weekends: false,
        review_before_send: false,
        attach_documents: false,
        template_id: null,
        template_mode: 'ai',
      })
    );
  });

  it('summarises everything and starts the campaign', async () => {
    camp.update.mockResolvedValue({ ...CAMPAIGN, status: 'active' });
    renderAt('/campaigns/new?id=c1&step=3');
    expect(await screen.findByText('Ready to launch')).toBeInTheDocument();
    const summary = screen.getByText('Ideal customer', { selector: 'dt' }).closest('div');
    expect(within(summary).getByText(/CNC machining/)).toBeInTheDocument();
    expect(screen.getByText(/Up to 25 emails\/day/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Start Campaign/ }));
    await waitFor(() => expect(camp.update).toHaveBeenCalledWith('c1', { status: 'active' }));
    expect(toastMock.success).toHaveBeenCalledWith('Campaign started');
    expect(await screen.findByText('dashboard')).toBeInTheDocument();
  });

  it('jumps back to a step from the summary', async () => {
    renderAt('/campaigns/new?id=c1&step=3');
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Sending' }));
    expect(await screen.findByText('Sending settings')).toBeInTheDocument();
  });

  it('sends a launched campaign to its dashboard', async () => {
    camp.get.mockResolvedValue({ ...CAMPAIGN, status: 'active' });
    renderAt('/campaigns/new?id=c1&step=1');
    expect(await screen.findByText('This campaign has already been launched.')).toBeInTheDocument();
  });
});
