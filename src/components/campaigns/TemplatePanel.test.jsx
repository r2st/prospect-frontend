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
      { id: 't2', name: 'Old one', is_archived: true },
    ],
  },
}));
const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: toastMock }));

import TemplatePanel from './TemplatePanel';

function renderPanel(campaign, draftsPending = 0) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><TemplatePanel campaign={campaign} draftsPending={draftsPending} /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('TemplatePanel', () => {
  beforeEach(() => {
    update.mockReset();
    redraft.mockReset();
    toastMock.success.mockReset();
  });

  it('offers the same templates as Outreach → Templates, without archived ones', async () => {
    renderPanel({ id: 'c1', template_id: null, template_mode: 'ai' });
    expect(await screen.findByRole('option', { name: 'Saved from a draft' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Old one' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage templates' })).toHaveAttribute('href', '/outreach?tab=templates');
    expect(screen.getByRole('button', { name: 'Use this for new drafts' })).toBeDisabled();
  });

  it('saves a newly chosen template for new drafts', async () => {
    update.mockResolvedValue({ id: 'c1' });
    renderPanel({ id: 'c1', template_id: null, template_mode: 'ai' });
    await screen.findByRole('option', { name: 'Saved from a draft' });
    await userEvent.selectOptions(screen.getByRole('combobox'), 't1');
    await userEvent.click(screen.getByRole('button', { name: 'Use this for new drafts' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith('c1', { template_id: 't1', template_mode: 'ai_template' }));
  });

  it('names the current template and offers to rewrite pending drafts', async () => {
    redraft.mockResolvedValue({ redrafting: 3 });
    renderPanel({ id: 'c1', template_id: 't1', template_mode: 'template' }, 3);
    expect(await screen.findByText('Drafting from “Saved from a draft” — exactly as written')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Re-draft 3 unapproved emails' }));
    await waitFor(() => expect(redraft).toHaveBeenCalledWith('c1'));
    expect(toastMock.success).toHaveBeenCalledWith('Re-drafting 3 emails with the current template');
  });
});
