import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const update = vi.fn();
const redraft = vi.fn();
vi.mock('../../api/client', () => ({
  queryClient: { invalidateQueries: vi.fn(), setQueryData: vi.fn() },
  campaignsApi: { update: (...a) => update(...a), redraft: (...a) => redraft(...a) },
  emailApi: {
    getTemplates: async () => [
      { id: 't1', name: 'Saved from a draft', is_archived: false },
      { id: 't3', name: 'First touch', is_archived: false, is_default: true },
      { id: 't2', name: 'Old one', is_archived: true },
    ],
  },
}));
const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: toastMock }));

import TemplatePanel from './TemplatePanel';

function renderPanel(campaign, draftsPending = 0, { open = true } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><TemplatePanel campaign={campaign} draftsPending={draftsPending} /></MemoryRouter>
    </QueryClientProvider>,
  );
  // The picker starts collapsed to one line; most tests work inside it.
  if (open) return userEvent.click(screen.getByRole('button', { name: /Change/ }));
  return undefined;
}

describe('TemplatePanel', () => {
  it('starts as one line naming the template, with the picker collapsed', async () => {
    await renderPanel({ id: 'c1', template_id: 't1', template_mode: 'template' }, 0, { open: false });
    expect(await screen.findByText('Drafting from “Saved from a draft” — exactly as written')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Change/ })).toHaveAttribute('aria-expanded', 'false');
  });

  beforeEach(() => {
    update.mockReset();
    redraft.mockReset();
    toastMock.success.mockReset();
  });

  it('offers the same templates as Outreach → Templates, without archived ones', async () => {
    await renderPanel({ id: 'c1', template_id: null, template_mode: 'ai' });
    expect(await screen.findByRole('option', { name: 'Saved from a draft' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Old one' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage templates' })).toHaveAttribute('href', '/outreach?tab=templates');
    expect(screen.getByRole('button', { name: 'Use this for new drafts' })).toBeDisabled();
  });

  it('saves a newly chosen template for new drafts', async () => {
    update.mockResolvedValue({ id: 'c1' });
    await renderPanel({ id: 'c1', template_id: null, template_mode: 'ai' });
    await screen.findByRole('option', { name: 'Saved from a draft' });
    await userEvent.selectOptions(screen.getByRole('combobox'), 't1');
    await userEvent.click(screen.getByRole('button', { name: 'Use this for new drafts' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith('c1', { template_id: 't1', template_mode: 'ai_template' }));
  });

  it('is labelled as the campaign\'s default template and marks the org default', async () => {
    await renderPanel({ id: 'c1', template_id: null, template_mode: 'ai' });
    expect(screen.getByRole('region', { name: 'Default email template' })).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: 'First touch (org default)' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Default email template' })).toHaveValue('');
  });

  it('switches back to AI drafting when the template is cleared', async () => {
    update.mockResolvedValue({ id: 'c1' });
    await renderPanel({ id: 'c1', template_id: 't1', template_mode: 'template' });
    await screen.findByRole('option', { name: 'Saved from a draft' });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Default email template' }), '');
    await userEvent.click(screen.getByRole('button', { name: 'Use this for new drafts' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith('c1', { template_id: null, template_mode: 'ai' }));
  });

  it('names the current template and offers to rewrite pending drafts', async () => {
    redraft.mockResolvedValue({ redrafting: 3 });
    await renderPanel({ id: 'c1', template_id: 't1', template_mode: 'template' }, 3);
    expect(await screen.findByText('Drafting from “Saved from a draft” — exactly as written')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Re-draft 3 unapproved emails' }));
    await waitFor(() => expect(redraft).toHaveBeenCalledWith('c1'));
    expect(toastMock.success).toHaveBeenCalledWith('Re-drafting 3 emails with the current template');
  });
});
