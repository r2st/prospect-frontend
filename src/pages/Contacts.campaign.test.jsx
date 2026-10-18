import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const api = { list: vi.fn(), addContacts: vi.fn() };
vi.mock('../api/client', () => ({
  queryClient: { invalidateQueries: vi.fn(), setQueryData: vi.fn() },
  contactsApi: {},
  companiesApi: {},
  campaignsApi: { list: (...a) => api.list(...a), addContacts: (...a) => api.addContacts(...a) },
}));
const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: toastMock }));

import { AddToCampaignModal, CategoryChips, VerificationBadge } from './Contacts';

function wrap(ui) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);
}

const FACETS = {
  total: 7,
  verification: [
    { value: 'deliverable', label: 'Deliverable', count: 3 },
    { value: 'undeliverable', label: 'Undeliverable', count: 1 },
    { value: 'unverified', label: 'Not verified', count: 3 },
  ],
  source: [], industry: [], campaign: [],
};

function Chips() {
  const [filters, setFilters] = useState({ verification: '' });
  return (
    <>
      <CategoryChips facets={FACETS} filters={filters} setFilters={setFilters} />
      <output data-testid="active">{filters.verification || 'all'}</output>
    </>
  );
}

describe('the contact database', () => {
  beforeEach(() => {
    api.list.mockReset();
    api.addContacts.mockReset();
  });

  it('groups contacts by Hunter verdict with counts, and filters on a click', async () => {
    wrap(<Chips />);
    expect(screen.getByRole('button', { name: 'All 7' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Deliverable 3' }));
    expect(screen.getByTestId('active')).toHaveTextContent('deliverable');
    await userEvent.click(screen.getByRole('button', { name: 'Deliverable 3' }));
    expect(screen.getByTestId('active')).toHaveTextContent('all');
  });

  it('labels each verdict and shows nothing for an unverified address', () => {
    const { container } = wrap(<><VerificationBadge result="deliverable" /><VerificationBadge result={null} /></>);
    expect(screen.getByText('Deliverable')).toBeInTheDocument();
    expect(container.querySelectorAll('span')).toHaveLength(1);
  });

  it('adds the selected contacts to the chosen campaign', async () => {
    api.list.mockResolvedValue([
      { id: 'c1', name: 'Q4 push', status: 'active' },
      { id: 'c2', name: 'Old', status: 'stopped' },
      { id: 'c3', name: 'Paused one', status: 'paused' },
    ]);
    api.addContacts.mockResolvedValue({ queued: 2, skipped: [] });
    const onClose = vi.fn();
    const onDone = vi.fn();
    wrap(<AddToCampaignModal contactIds={['a', 'b']} onClose={onClose} onDone={onDone} />);
    const select = await screen.findByLabelText('Campaign');
    // Stopped campaigns can't take contacts.
    expect(screen.queryByRole('option', { name: 'Old' })).not.toBeInTheDocument();
    await userEvent.selectOptions(select, 'c3');
    await userEvent.click(screen.getByRole('button', { name: 'Add to campaign' }));
    await waitFor(() => expect(api.addContacts).toHaveBeenCalledWith('c3', ['a', 'b']));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onDone).toHaveBeenCalled();
    expect(toastMock.success.mock.calls[0][0]).toMatch(/^2 added/);
  });
});
