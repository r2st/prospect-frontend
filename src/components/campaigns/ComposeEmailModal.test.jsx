import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const prospects = vi.fn();
vi.mock('../../api/client', () => ({
  queryClient: { invalidateQueries: vi.fn() },
  campaignsApi: { prospects: (...a) => prospects(...a) },
}));

import ComposeEmailModal from './ComposeEmailModal';

const ANA = {
  id: 'p1', status: 'draft', company_name: 'Acme', company_domain: 'acme.com', contact_name: 'Ana Li',
  contact_email: 'ana@acme.com', email_verified: true, subject: 'Faster quotes', body: 'Hi Ana,\nShort one.',
};

function renderModal(props) {
  const actions = { composeSend: vi.fn(), isComposeSending: false, ...props.actions };
  const onClose = vi.fn();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <ComposeEmailModal campaignId="c1" onClose={onClose} {...props} actions={actions} />
    </QueryClientProvider>,
  );
  return { actions, onClose };
}

describe('ComposeEmailModal', () => {
  beforeEach(() => prospects.mockReset());

  it('starts from the prospect’s draft, lets it be edited, and sends it', async () => {
    const { actions } = renderModal({ prospect: ANA });
    expect(screen.getByText(/Ana Li at acme.com/)).toBeInTheDocument();
    const subject = screen.getByLabelText('Subject');
    expect(subject).toHaveValue('Faster quotes');
    await userEvent.clear(subject);
    await userEvent.type(subject, 'A better subject');
    await userEvent.click(screen.getByRole('button', { name: 'Send now' }));
    expect(actions.composeSend).toHaveBeenCalledWith(
      'p1', { subject: 'A better subject', body: 'Hi Ana,\nShort one.' }, 'Ana Li at acme.com', expect.any(Object),
    );
  });

  it('shows the footer and the sending safeguards', () => {
    renderModal({ prospect: ANA });
    expect(screen.getByTestId('preview-unsubscribe')).toHaveTextContent('Reply UNSUBSCRIBE');
    expect(screen.getByText(/at most one email every 45 seconds and 30 an hour/)).toBeInTheDocument();
  });

  it('warns when the address is not verified', () => {
    renderModal({ prospect: { ...ANA, email_verified: false, email_verification: null } });
    expect(screen.getByRole('status')).toHaveTextContent('only verified addresses are sent');
  });

  it('from the header, picks anyone not yet emailed', async () => {
    prospects.mockResolvedValue({
      items: [
        ANA,
        { id: 'p2', status: 'sent', company_name: 'Beta', contact_name: 'Bo', contact_email: 'bo@beta.com' },
        { id: 'p3', status: 'queued', company_name: 'Gamma', contact_name: 'Cy', contact_email: 'cy@gamma.io' },
      ],
      total: 3,
    });
    const { actions } = renderModal({});
    const select = await screen.findByRole('combobox', { name: 'Recipient' });
    await waitFor(() => expect(select.querySelectorAll('option')).toHaveLength(3)); // placeholder + 2 eligible
    expect(screen.queryByRole('option', { name: /bo@beta.com/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send now' })).toBeDisabled();

    await userEvent.selectOptions(select, 'p3');
    await userEvent.type(screen.getByLabelText('Subject'), 'Hello');
    await userEvent.type(screen.getByLabelText('Message'), 'Hi Cy');
    await userEvent.click(screen.getByRole('button', { name: 'Send now' }));
    expect(actions.composeSend).toHaveBeenCalledWith('p3', { subject: 'Hello', body: 'Hi Cy' }, 'Cy at Gamma', expect.any(Object));
  });
});
