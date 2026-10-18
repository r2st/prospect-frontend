import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const setContact = vi.fn();
vi.mock('../../api/client', () => ({
  queryClient: { invalidateQueries: vi.fn() },
  campaignsApi: { setContact: (...a) => setContact(...a) },
}));
const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: toastMock }));

import ContactEditModal from './ContactEditModal';

const EXISTING = {
  id: 'p1', status: 'draft', company_name: 'Gart Solutions', company_domain: 'gart.io',
  contact_id: 'ct1', contact_name: 'Fedir K', contact_first_name: 'Fedir', contact_last_name: 'K',
  contact_title: 'CEO', contact_email: 'fedir@gart.io',
};

function renderModal(prospect, onClose = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <ContactEditModal campaignId="c1" prospect={prospect} onClose={onClose} />
    </QueryClientProvider>,
  );
  return onClose;
}

describe('ContactEditModal', () => {
  beforeEach(() => {
    setContact.mockReset();
    toastMock.success.mockReset();
    toastMock.error.mockReset();
  });

  it('prefills the contact and saves the edited details', async () => {
    setContact.mockResolvedValue({ queued: 1, skipped: [] });
    const onClose = renderModal(EXISTING);
    expect(screen.getByRole('dialog', { name: 'Edit contact' })).toBeInTheDocument();
    expect(screen.getByLabelText('First name *')).toHaveValue('Fedir');
    const title = screen.getByLabelText('Title');
    await userEvent.clear(title);
    await userEvent.type(title, 'Founder');
    await userEvent.click(screen.getByRole('button', { name: 'Save contact' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(setContact).toHaveBeenCalledWith('c1', 'p1', {
      first_name: 'Fedir', last_name: 'K', title: 'Founder', email: 'fedir@gart.io',
    });
    expect(toastMock.success).toHaveBeenCalledWith('Saved — verifying the address and re-drafting the email');
  });

  it('adds a contact where discovery found nobody, sending blanks as null', async () => {
    setContact.mockResolvedValue({ queued: 1, skipped: [] });
    renderModal({ id: 'p2', status: 'no_email', company_name: 'Obsium', company_domain: 'obsium.io', contact_id: null });
    expect(screen.getByText('Add a contact at Obsium')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('placeholder', 'name@obsium.io');
    expect(screen.getByRole('button', { name: 'Save contact' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('First name *'), 'Rahul');
    await userEvent.click(screen.getByRole('button', { name: 'Save contact' }));
    await waitFor(() => expect(setContact).toHaveBeenCalledWith('c1', 'p2', {
      first_name: 'Rahul', last_name: null, title: null, email: null,
    }));
  });

  it('says when the saved address cannot be emailed', async () => {
    setContact.mockResolvedValue({ queued: 0, skipped: [{ label: 'That address is your own organisation' }] });
    renderModal(EXISTING);
    await userEvent.click(screen.getByRole('button', { name: 'Save contact' }));
    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith(
      "Saved, but it can't be emailed: That address is your own organisation",
    ));
  });

  it('stays open when the save fails', async () => {
    setContact.mockRejectedValue({ response: { data: { detail: 'Another contact already has this email address' } } });
    const onClose = renderModal(EXISTING);
    await userEvent.click(screen.getByRole('button', { name: 'Save contact' }));
    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('Another contact already has this email address'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
