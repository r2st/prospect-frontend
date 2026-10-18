import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const saveTemplate = vi.fn();
const attachment = vi.fn();
vi.mock('../../api/client', () => ({
  queryClient: { invalidateQueries: vi.fn() },
  campaignsApi: {
    saveTemplate: (...a) => saveTemplate(...a),
    attachment: (...a) => attachment(...a),
  },
}));

// pdf.js needs a real canvas and worker; jsdom has neither. Stand in a
// two-page document and record which pages were drawn.
const pdf = vi.hoisted(() => ({ rendered: [], fail: false }));
vi.mock('../../lib/pdf', () => ({
  openPdf: async () => {
    if (pdf.fail) throw new Error('bad pdf');
    return {
      numPages: 2,
      destroy: () => {},
      getPage: async (n) => ({
        getViewport: ({ scale }) => ({ width: 600 * scale, height: 800 * scale }),
        render: () => {
          pdf.rendered.push(n);
          return { promise: Promise.resolve(), cancel: () => {} };
        },
      }),
    };
  },
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
    attachment.mockReset();
    toastMock.success.mockReset();
    pdf.rendered = [];
    pdf.fail = false;
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
  });

  it('opens an attached PDF and pages through it', async () => {
    attachment.mockResolvedValue({ data: new ArrayBuffer(8), type: 'application/pdf' });
    renderModal({ attachments: ['SteadyState_Partner_Brief.pdf'], campaignId: 'c1' });
    await userEvent.click(screen.getByRole('button', { name: 'Preview SteadyState_Partner_Brief.pdf' }));
    expect(attachment).toHaveBeenCalledWith('c1', 'SteadyState_Partner_Brief.pdf');
    expect(await screen.findByTestId('pdf-page')).toHaveTextContent('Page 1 of 2');
    await waitFor(() => expect(pdf.rendered).toEqual([1]));
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByTestId('pdf-page')).toHaveTextContent('Page 2 of 2');
    await waitFor(() => expect(pdf.rendered).toEqual([1, 2]));
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    expect(screen.getByRole('link', { name: /Download/ })).toHaveAttribute('download', 'SteadyState_Partner_Brief.pdf');
    // Clicking the chip again closes the viewer.
    await userEvent.click(screen.getByRole('button', { name: 'Hide SteadyState_Partner_Brief.pdf' }));
    expect(screen.queryByTestId('pdf-preview')).not.toBeInTheDocument();
  });

  it('says so when a PDF cannot be displayed', async () => {
    pdf.fail = true;
    attachment.mockResolvedValue({ data: new ArrayBuffer(8), type: 'application/pdf' });
    renderModal({ attachments: ['broken.pdf'], campaignId: 'c1' });
    await userEvent.click(screen.getByRole('button', { name: 'Preview broken.pdf' }));
    expect(await screen.findByText('This PDF could not be displayed.')).toBeInTheDocument();
  });

  it('offers a download for a file it cannot preview', async () => {
    attachment.mockResolvedValue({ data: new ArrayBuffer(8), type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    renderModal({ attachments: ['brief.docx'], campaignId: 'c1' });
    await userEvent.click(screen.getByRole('button', { name: 'Preview brief.docx' }));
    expect(await screen.findByText(/No preview for this file type/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Download brief.docx/ })).toHaveAttribute('download', 'brief.docx');
  });

  it('reports a file that failed to load', async () => {
    attachment.mockRejectedValue(new Error('404'));
    renderModal({ attachments: ['gone.pdf'], campaignId: 'c1' });
    await userEvent.click(screen.getByRole('button', { name: 'Preview gone.pdf' }));
    expect(await screen.findByText("Couldn't load gone.pdf.")).toBeInTheDocument();
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
