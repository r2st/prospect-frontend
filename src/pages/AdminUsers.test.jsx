import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockList = vi.fn();
const mockRemove = vi.fn();

vi.mock('../api/auth', () => ({
  adminUsersApi: {
    list: (...a) => mockList(...a),
    remove: (...a) => mockRemove(...a),
    create: vi.fn(),
    update: vi.fn(),
    resetPassword: vi.fn(),
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'me' } }),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import AdminUsers from './AdminUsers';

const USERS = [
  { id: 'me', name: 'Admin Me', email: 'me@x.com', role: 'org_admin', is_active: true },
  { id: 'u2', name: 'Agent Two', email: 'two@x.com', role: 'org_agent', is_active: true },
];

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AdminUsers />
    </QueryClientProvider>
  );
}

describe('AdminUsers delete', () => {
  beforeEach(() => {
    mockList.mockReset().mockResolvedValue(USERS);
    mockRemove.mockReset().mockResolvedValue({ id: 'u2', is_active: false });
  });

  it('shows a Delete button per user, disabled for yourself', async () => {
    renderPage();
    expect(await screen.findByRole('button', { name: 'Delete Agent Two' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Delete Admin Me' })).toBeDisabled();
  });

  it('asks for confirmation before deleting', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Delete Agent Two' }));

    const dialog = screen.getByRole('dialog', { name: 'Delete user?' });
    expect(dialog).toHaveTextContent('two@x.com');
    expect(mockRemove).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Delete user' }));
    await waitFor(() => expect(mockRemove).toHaveBeenCalledWith('u2'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('cancel closes the dialog without deleting', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Delete Agent Two' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockRemove).not.toHaveBeenCalled();
  });
});
