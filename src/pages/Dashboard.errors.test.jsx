import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Each dashboard hook can be told to fail; the rest return empty data.
const state = { failing: new Set(), refetches: [] };
const hook = (name, data) => () => {
  const isError = state.failing.has(name);
  return {
    data: isError ? undefined : data,
    isLoading: false,
    isError,
    refetch: () => state.refetches.push(name),
  };
};

vi.mock('../hooks/useDashboard', () => ({
  useDashboardMetrics: (...a) => hook('metrics', { industry_breakdown: [] })(...a),
  useRecentActivity: (...a) => hook('activity', [])(...a),
  useTopLeads: (...a) => hook('topLeads', [])(...a),
  useEmailTrends: (...a) => hook('trends', [])(...a),
  useUpcomingTasks: (...a) => hook('tasks', [])(...a),
  useKPIs: (...a) => hook('kpis', {})(...a),
}));
vi.mock('../hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ data: { full_name: 'Test' } }) }));
vi.mock('../hooks/useFollowUps', () => ({
  useFollowUps: () => ({ data: [], isLoading: false }),
  useStaleContacts: () => ({ data: [], isLoading: false }),
}));
vi.mock('../components/GettingStarted', () => ({ default: () => null }));
vi.mock('../components/SmartSuggestions', () => ({ default: () => null }));
vi.mock('../components/ClientHealthAlerts', () => ({ default: () => null }));
vi.mock('../api/client', () => ({ emailApi: { getSends: async () => [] } }));

import Dashboard from './Dashboard';

function renderDashboard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Dashboard error handling', () => {
  beforeEach(() => {
    state.failing = new Set();
    state.refetches = [];
  });

  it('shows no error banner when everything loads', () => {
    renderDashboard();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('names the sections that failed and retries only those', async () => {
    state.failing = new Set(['metrics', 'kpis']);
    renderDashboard();
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('metrics');
    expect(alert.textContent).toContain('KPIs');
    expect(alert.textContent).not.toContain('top leads');

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(state.refetches.sort()).toEqual(['kpis', 'metrics']);
  });
});
