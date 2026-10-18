import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../api/client', () => ({ queryClient: { invalidateQueries: vi.fn() }, emailApi: {} }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

import TemplateCard from './TemplateCard';

function renderCard(template) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TemplateCard template={template} onEdit={vi.fn()} onPreview={vi.fn()} onDuplicate={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe('TemplateCard', () => {
  it('shows the merge fields a template fills in', () => {
    renderCard({ id: 't1', name: 'SRE intro', subject: '{{company}} and SRE', body: '<p>Hi {{first_name}}</p>' });
    expect(screen.getByTestId('template-card-subject').querySelector('[data-merge-field]')).toHaveTextContent('{{company}}');
    expect(screen.getByTestId('merge-fields')).toHaveTextContent('Merge fields:{{company}}{{first_name}}');
  });

  it('says when a template has none', () => {
    renderCard({ id: 't2', name: 'Static', subject: 'Hello', body: '<p>Hi there</p>' });
    expect(screen.getByTestId('merge-fields')).toHaveTextContent('No merge fields');
  });
});
