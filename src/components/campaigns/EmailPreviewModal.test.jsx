import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const saveTemplate = vi.fn();
vi.mock('../../api/client', () => ({
  queryClient: { invalidateQueries: vi.fn() },
  campaignsApi: { saveTemplate: (...a) => saveTemplate(...a) },
}));
const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: toastMock }));

import EmailPreviewModal from './EmailPreviewModal';

const PROSPECT = {
  id: 'p1', status: 'draft', contact_name: 'Fedir Kompaniiets', company_name: 'Gart Solutions',
  subject: 'Partnering on DevOps automation', body: 'Hi Fedir,\n\nQuick one.',
};

function renderModal(props = {}) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <EmailPreviewModal prospect={PROSPECT} onClose={vi.fn()} onApprove={vi.fn()} onSkip={vi.fn()} {...props} />
    </QueryClientProvider>,
  );
}

describe('EmailPreviewModal', () => {
  beforeEach(() => {
    saveTemplate.mockReset();
    toastMock.success.mockReset();
  });

  it('lists what the email will carry', () => {
    renderModal({ attachments: ['SteadyState_Partner_Brief.pdf'], campaignId: 'c1' });
    expect(screen.getByTestId('preview-attachments')).toHaveTextContent('SteadyState_Partner_Brief.pdf');
  });

  it('shows no attachment section when there is nothing attached', () => {
    renderModal({ campaignId: 'c1' });
    expect(screen.queryByTestId('preview-attachments')).not.toBeInTheDocument();
  });

  it('saves the draft as a template and can make it the campaign template', async () => {
    saveTemplate.mockResolvedValue({ id: 't1', name: 'SRE intro', campaign_template_mode: 'ai_template' });
    renderModal({ campaignId: 'c1' });
    await userEvent.click(screen.getByRole('button', { name: /Save as template/ }));
    await userEvent.type(screen.getByLabelText('Template name'), 'SRE intro');
    await userEvent.selectOptions(screen.getByLabelText('For the rest of this campaign'), 'ai_template');
    await userEvent.click(screen.getByRole('button', { name: 'Save template' }));
    await waitFor(() => expect(saveTemplate).toHaveBeenCalledWith('c1', 'p1', {
      name: 'SRE intro', use_for_campaign: 'ai_template',
    }));
    expect(toastMock.success.mock.calls[0][0]).toMatch(/rest of this campaign will use it/);
  });

  it('just saves when the campaign should keep drafting as before', async () => {
    saveTemplate.mockResolvedValue({ id: 't1', name: 'Keep' });
    renderModal({ campaignId: 'c1' });
    await userEvent.click(screen.getByRole('button', { name: /Save as template/ }));
    await userEvent.type(screen.getByLabelText('Template name'), 'Keep');
    await userEvent.click(screen.getByRole('button', { name: 'Save template' }));
    await waitFor(() => expect(saveTemplate).toHaveBeenCalledWith('c1', 'p1', { name: 'Keep' }));
  });
});
