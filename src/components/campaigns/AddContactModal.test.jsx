import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const addManual = vi.fn();
vi.mock('../../api/client', () => ({
  queryClient: { invalidateQueries: vi.fn() },
  campaignsApi: { addManual: (...a) => addManual(...a) },
}));
const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), loading: vi.fn(() => 'tid') }));
vi.mock('react-hot-toast', () => ({ default: toastMock }));

import AddContactModal from './AddContactModal';

function renderModal(onClose = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><AddContactModal campaignId="c1" onClose={onClose} /></MemoryRouter>
    </QueryClientProvider>,
  );
  return onClose;
}

describe('AddContactModal', () => {
  beforeEach(() => {
    addManual.mockReset();
    toastMock.success.mockReset();
    toastMock.error.mockReset();
  });

  it('needs an email or a website before it can add', async () => {
    renderModal();
    await userEvent.type(screen.getByLabelText('Company name *'), 'Acme');
    await userEvent.type(screen.getByLabelText('First name *'), 'Ana');
    expect(screen.getByRole('button', { name: 'Add contact' })).toBeDisabled();
    expect(screen.getByText(/so Hunter can find one/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Company website'), 'acme.com');
    expect(screen.getByRole('button', { name: 'Add contact' })).toBeEnabled();
  });

  it('sends only what was filled in, and closes when the contact was added', async () => {
    addManual.mockResolvedValue({ queued: 1, skipped: [], processing: 'dispatched' });
    const onClose = renderModal();
    await userEvent.type(screen.getByLabelText('Company name *'), ' Acme ');
    await userEvent.type(screen.getByLabelText('First name *'), 'Ana');
    await userEvent.type(screen.getByLabelText('Email'), 'ana@acme.com');
    await userEvent.click(screen.getByRole('button', { name: 'Add contact' }));
    await waitFor(() => expect(addManual).toHaveBeenCalledWith('c1', {
      company_name: 'Acme', first_name: 'Ana', email: 'ana@acme.com',
    }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    await waitFor(() => expect(toastMock.success).toHaveBeenCalled());
    expect(toastMock.success.mock.calls[0][0]).toMatch(/1 added/);
  });

  it('closes at once and says why when nothing was added', async () => {
    addManual.mockResolvedValue({ queued: 0, skipped: [{ label: 'Already a prospect in a campaign' }] });
    const onClose = renderModal();
    await userEvent.type(screen.getByLabelText('Company name *'), 'Acme');
    await userEvent.type(screen.getByLabelText('First name *'), 'Ana');
    await userEvent.type(screen.getByLabelText('Email'), 'ana@acme.com');
    await userEvent.click(screen.getByRole('button', { name: 'Add contact' }));
    expect(onClose).toHaveBeenCalled();
    expect(toastMock.loading).toHaveBeenCalledWith('Adding Ana…');
    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith(
      '0 added · 1 skipped (Already a prospect in a campaign)', { id: 'tid' }));
  });
});
