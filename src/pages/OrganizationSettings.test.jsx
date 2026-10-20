import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockGet = vi.fn();
const mockUpdate = vi.fn();
vi.mock('../api/org', async () => {
  const actual = await vi.importActual('../api/org');
  return {
    ...actual,
    orgApi: {
      getSettings: (...a) => mockGet(...a),
      updateSettings: (...a) => mockUpdate(...a),
    },
  };
});
vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

let mockUser = { id: 'u1', role: 'org_admin', name: 'Admin' };
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

let mockPlatform = { isPlatformAdmin: false, isImpersonating: false };
vi.mock('../context/PlatformContext', () => ({
  usePlatform: () => mockPlatform,
}));

import toast from 'react-hot-toast';
import OrganizationSettings from './OrganizationSettings';

const ORG = {
  id: 'org-1',
  name: 'Apprend Technologies',
  slug: 'apprend-technologies',
  is_active: true,
  industry: 'metal_stamping',
  billing_plan: 'pro',
  config: { feature_flags: { beta: true } },
  branding: { primary_color: '#4f46e5' },
  ai_monthly_call_limit: null,
  effective_ai_call_limit: 25000,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
};

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <OrganizationSettings />
      </MemoryRouter>
    </QueryClientProvider>
  );

describe('OrganizationSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'u1', role: 'org_admin', name: 'Admin' };
    mockPlatform = { isPlatformAdmin: false, isImpersonating: false };
    mockGet.mockResolvedValue(ORG);
    mockUpdate.mockResolvedValue({ ...ORG, name: 'Renamed Inc' });
  });

  it('renders current org settings', async () => {
    renderPage();
    expect(await screen.findByDisplayValue('Apprend Technologies')).toBeInTheDocument();
    expect(screen.getByDisplayValue('metal_stamping')).toBeInTheDocument();
    // Plan shown read-only.
    expect(screen.getByText('Pro')).toBeInTheDocument();
    expect(screen.getByText(/25,000 AI calls/)).toBeInTheDocument();
  });

  it('saves edited settings for an admin', async () => {
    const user = userEvent.setup();
    renderPage();
    const nameInput = await screen.findByDisplayValue('Apprend Technologies');
    await user.clear(nameInput);
    await user.type(nameInput, 'Renamed Inc');

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockUpdate.mock.calls[0][0]).toMatchObject({ name: 'Renamed Inc', industry: 'metal_stamping' });
    expect(toast.success).toHaveBeenCalled();
  });

  it("edits the email footer's company name, address and website, with a live preview", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByDisplayValue('Apprend Technologies');
    const preview = screen.getByLabelText('Footer preview');
    expect(preview).toHaveTextContent(/aren.t CAN-SPAM compliant/);

    await user.type(screen.getByLabelText('Company name'), 'DevHeal Labs');
    await user.type(screen.getByLabelText('Company address'), 'IDA Mallapur, Hyderabad, Telangana, India');
    await user.type(screen.getByLabelText('Company website'), 'https://devheallabs.com');
    expect(preview).toHaveTextContent('DevHeal Labs · IDA Mallapur, Hyderabad, Telangana, India');
    expect(preview).toHaveTextContent('https://devheallabs.com');
    expect(preview).not.toHaveTextContent(/CAN-SPAM/);

    await user.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockUpdate.mock.calls[0][0].branding).toMatchObject({
      company_name: 'DevHeal Labs',
      company_address: 'IDA Mallapur, Hyderabad, Telangana, India',
      company_website: 'https://devheallabs.com',
      primary_color: '#4f46e5',
    });
  });

  it('rejects invalid JSON in the config editor', async () => {
    const user = userEvent.setup();
    renderPage();
    const textarea = await screen.findByLabelText(/organization config json/i);
    await user.clear(textarea);
    // Double braces escape userEvent's special-key syntax → literal "{".
    await user.type(textarea, '{{ not json');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText(/must be valid json/i)).toBeInTheDocument();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('prompts a platform admin (no org context) to pick an org instead of erroring', async () => {
    mockUser = { id: 'p1', role: 'platform_admin', name: 'Platform' };
    mockPlatform = { isPlatformAdmin: true, isImpersonating: false };
    renderPage();
    expect(await screen.findByText(/no organization selected/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /platform dashboard/i })).toBeInTheDocument();
    // Must not fire the doomed /org/settings request.
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('shows settings for a platform admin while impersonating an org', async () => {
    mockUser = { id: 'p1', role: 'platform_admin', name: 'Platform' };
    mockPlatform = { isPlatformAdmin: true, isImpersonating: true };
    renderPage();
    expect(await screen.findByDisplayValue('Apprend Technologies')).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalled();
  });

  it('disables editing and hides save for non-admins', async () => {
    mockUser = { id: 'u2', role: 'org_agent', name: 'Rep' };
    renderPage();
    const nameInput = await screen.findByDisplayValue('Apprend Technologies');
    expect(nameInput).toBeDisabled();
    expect(screen.getByText('Admin only')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument();
  });
});
