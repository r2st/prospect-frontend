import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockList = vi.fn();
const mockRemove = vi.fn();
vi.mock('../api/client', () => ({
  queryClient: { invalidateQueries: vi.fn(), setQueryData: vi.fn(), removeQueries: vi.fn() },
  campaignsApi: { list: (...a) => mockList(...a), remove: (...a) => mockRemove(...a) },
  discoveryDocsApi: {},
}));
vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import Campaigns from './Campaigns';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/campaigns']}>
        <Routes>
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/campaigns/new" element={<p>wizard</p>} />
          <Route path="/campaigns/:id" element={<p>dashboard</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const CAMPAIGN = {
  id: 'c1',
  name: 'Q4 machining push',
  status: 'active',
  documents: [{ id: 'd1', filename: 'deck.pdf' }],
  metrics: { total_prospects: 42, emails_sent: 17 },
  created_at: '2026-10-01T10:00:00Z',
};

describe('Campaigns list', () => {
  beforeEach(() => {
    mockList.mockReset();
    mockRemove.mockReset();
  });

  it('shows a skeleton while loading', () => {
    mockList.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId('campaigns-skeleton')).toBeInTheDocument();
  });

  it('lists campaigns with their columns', async () => {
    mockList.mockResolvedValue([CAMPAIGN, { ...CAMPAIGN, id: 'c2', name: 'Paused one', status: 'paused' }]);
    renderPage();
    const rows = await screen.findAllByTestId('campaign-row');
    expect(rows).toHaveLength(2);
    const first = within(rows[0]);
    expect(first.getByText('Q4 machining push')).toBeInTheDocument();
    expect(first.getByText('Active')).toBeInTheDocument();
    expect(first.getByText('deck.pdf')).toBeInTheDocument();
    expect(first.getByText('42')).toBeInTheDocument();
    expect(first.getByText('17')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Paused')).toBeInTheDocument();
  });

  it('opens the dashboard when a row is clicked', async () => {
    mockList.mockResolvedValue({ items: [CAMPAIGN] });
    renderPage();
    await userEvent.click(await screen.findByTestId('campaign-row'));
    expect(screen.getByText('dashboard')).toBeInTheDocument();
  });

  it('has an empty state that starts a campaign', async () => {
    mockList.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('No campaigns yet')).toBeInTheDocument();
    const buttons = screen.getAllByRole('button', { name: 'New Campaign' });
    await userEvent.click(buttons[buttons.length - 1]);
    expect(screen.getByText('wizard')).toBeInTheDocument();
  });

  it('explains when the server has no campaigns API yet', async () => {
    mockList.mockRejectedValue({ response: { status: 404 } });
    renderPage();
    expect(await screen.findByText('Autopilot campaigns are coming soon')).toBeInTheDocument();
  });

  it('shows other errors with a retry', async () => {
    mockList.mockRejectedValue({ response: { status: 500, data: { detail: 'boom' } } });
    renderPage();
    // The hook retries a 5xx once before giving up.
    expect(await screen.findByRole('alert', {}, { timeout: 4000 })).toHaveTextContent('boom');
    mockList.mockResolvedValue([CAMPAIGN]);
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByTestId('campaign-row')).toBeInTheDocument();
  });

  it('deletes a campaign from the list after confirming, without opening it', async () => {
    mockList.mockResolvedValue([CAMPAIGN]);
    mockRemove.mockResolvedValue(undefined);
    renderPage();
    const [row] = await screen.findAllByTestId('campaign-row');
    await userEvent.click(within(row).getByRole('button', { name: 'Delete Q4 machining push' }));
    // Still on the list: the click did not bubble to the row's navigation.
    expect(screen.queryByText('dashboard')).not.toBeInTheDocument();
    expect(screen.getByText('Delete “Q4 machining push”?')).toBeInTheDocument();
    expect(mockRemove).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Delete campaign' }));
    expect(mockRemove).toHaveBeenCalledWith('c1');
  });

  it('does nothing when the delete is cancelled', async () => {
    mockList.mockResolvedValue([CAMPAIGN]);
    renderPage();
    const [row] = await screen.findAllByTestId('campaign-row');
    await userEvent.click(within(row).getByRole('button', { name: 'Delete Q4 machining push' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Delete “Q4 machining push”?')).not.toBeInTheDocument();
    expect(mockRemove).not.toHaveBeenCalled();
  });
});
