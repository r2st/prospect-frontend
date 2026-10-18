import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const saveTemplate = vi.fn();
const attachment = vi.fn();
const redraftProspect = vi.fn();
const TEMPLATES = vi.hoisted(() => [
  { id: 't1', name: 'SRE intro', subject: '{{first_name}}, quick one about {{company}}',
    body: '<p>Hi {{first_name}},</p><p>Saw {{ company }} is scaling SRE.</p>', is_archived: false },
  { id: 't2', name: 'Follow-up', subject: 'Following up', body: '<p>Hi there</p>', is_archived: false },
  { id: 't3', name: 'Retired', subject: 'x', body: 'x', is_archived: true },
]);
vi.mock('../../api/client', () => ({
  queryClient: { invalidateQueries: vi.fn() },
  campaignsApi: {
    saveTemplate: (...a) => saveTemplate(...a),
    attachment: (...a) => attachment(...a),
    redraftProspect: (...a) => redraftProspect(...a),
  },
  emailApi: { getTemplates: async () => TEMPLATES },
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
      <MemoryRouter>
        <EmailPreviewModal prospect={PROSPECT} onClose={vi.fn()} onApprove={vi.fn()} onSkip={vi.fn()} {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('EmailPreviewModal', () => {
  beforeEach(() => {
    saveTemplate.mockReset();
    attachment.mockReset();
    redraftProspect.mockReset();
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

  it('links to the saved template in Outreach → Templates', async () => {
    saveTemplate.mockResolvedValue({ id: 't9', name: 'Mine' });
    renderModal({ campaignId: 'c1' });
    await userEvent.click(screen.getByRole('button', { name: /Save as template/ }));
    await userEvent.type(screen.getByLabelText('Template name'), 'Mine');
    await userEvent.click(screen.getByRole('button', { name: 'Save template' }));
    expect(await screen.findByTestId('template-saved')).toHaveTextContent('Saved as “Mine”');
    expect(screen.getByRole('link', { name: /Open in Outreach → Templates/ })).toHaveAttribute('href', '/outreach?tab=templates');
  });

  it('says the AI wrote a draft that has no template', () => {
    renderModal({ campaignId: 'c1' });
    expect(screen.getByTestId('draft-source')).toHaveTextContent('Written by the AI');
    expect(screen.queryByRole('group', { name: 'Show draft or template' })).not.toBeInTheDocument();
  });

  it('shows the template a draft came from with its merge fields visible', async () => {
    renderModal({ campaignId: 'c1', prospect: { ...PROSPECT, template_id: 't1', template_name: 'SRE intro' } });
    expect(screen.getByTestId('draft-source')).toHaveTextContent('Drafted from “SRE intro”');
    await userEvent.click(await screen.findByRole('button', { name: 'Template' }));
    expect(screen.getByTestId('template-subject')).toHaveTextContent('{{first_name}}, quick one about {{company}}');
    const body = screen.getByTestId('template-body');
    const fields = [...body.querySelectorAll('.merge-field')].map((n) => n.textContent);
    expect(fields).toEqual(['{{first_name}}', '{{ company }}']);
    expect(screen.getByTestId('merge-fields')).toHaveTextContent('{{first_name}}');
    expect(screen.getByTestId('merge-fields')).toHaveTextContent('{{company}}');
    await userEvent.click(screen.getByRole('button', { name: 'Draft' }));
    expect(screen.getByTestId('preview-subject')).toHaveTextContent('Partnering on DevOps automation');
  });

  it('switches one draft to another template', async () => {
    redraftProspect.mockResolvedValue({ id: 'p1', template_id: 't2', template_name: 'Follow-up' });
    renderModal({ campaignId: 'c1', prospect: { ...PROSPECT, template_id: 't1' } });
    const select = await screen.findByLabelText('Re-draft this email from a template');
    // Archived templates are not offered.
    expect(screen.queryByRole('option', { name: 'Retired' })).not.toBeInTheDocument();
    await userEvent.selectOptions(select, 't2');
    await userEvent.click(screen.getByLabelText('Personalised by AI'));
    await userEvent.click(screen.getByRole('button', { name: 'Re-draft' }));
    await waitFor(() => expect(redraftProspect).toHaveBeenCalledWith('c1', 'p1', {
      template_id: 't2', template_mode: 'ai_template',
    }));
    expect(toastMock.success).toHaveBeenCalledWith('Re-drafted from "Follow-up"');
  });

  it('can hand a draft back to the AI', async () => {
    redraftProspect.mockResolvedValue({ id: 'p1', template_id: null });
    renderModal({ campaignId: 'c1', prospect: { ...PROSPECT, template_id: 't1' } });
    await userEvent.selectOptions(await screen.findByLabelText('Re-draft this email from a template'), '');
    await userEvent.click(screen.getByRole('button', { name: 'Re-draft' }));
    await waitFor(() => expect(redraftProspect).toHaveBeenCalledWith('c1', 'p1', {
      template_id: null, template_mode: 'template',
    }));
  });

  it('offers no template switch on a sent email', async () => {
    renderModal({ campaignId: 'c1', prospect: { ...PROSPECT, status: 'sent' } });
    await screen.findByTestId('draft-source');
    expect(screen.queryByTestId('draft-template-switcher')).not.toBeInTheDocument();
  });
});
