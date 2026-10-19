import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const mockUseAuth = vi.fn();
vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

import Login from './Login';

let login;
let register;

function renderLogin(props = {}) {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<Login {...props} />} />
        <Route path="/" element={<div>HOME PAGE</div>} />
        <Route path="/change-password" element={<div>CHANGE PASSWORD PAGE</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  login = vi.fn();
  register = vi.fn();
  mockUseAuth.mockReturnValue({ isAuthenticated: false, login, register });
});

describe('Login landing page', () => {
  it('carries the hero tagline, the workflow, the stats and the feature cards', () => {
    renderLogin();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'AI-powered B2B lead-to-client platform'
    );
    expect(
      screen.getByText(
        'Discover, verify, and engage prospects with AI-driven campaigns. Built for modern sales teams.'
      )
    ).toBeInTheDocument();

    const steps = within(screen.getByRole('list', { name: 'How Prospect works' })).getAllByRole('listitem');
    expect(steps.map((li) => li.textContent)).toEqual(['Discover', 'Verify', 'Draft', 'Send', 'Convert']);

    expect(screen.getAllByRole('definition')).toHaveLength(4);
    expect(screen.getByText('of addresses verified before send')).toBeInTheDocument();
    for (const f of ['Autopilot Campaigns', 'Smart Verification', 'AI Email Drafting', 'Pipeline Analytics', 'Multi-Mailbox']) {
      expect(screen.getByRole('heading', { name: f })).toBeInTheDocument();
    }
  });

  it('shows the DoAide product footer and a theme switch', () => {
    renderLogin();
    expect(screen.getByRole('navigation', { name: 'DoAide products' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeInTheDocument();
  });

  it('signs in from the hero form', async () => {
    login.mockResolvedValue({ must_change_password: false });
    renderLogin();
    await userEvent.type(screen.getByLabelText('Email'), ' me@acme.com ');
    await userEvent.type(screen.getByLabelText('Password'), 'hunter22');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(login).toHaveBeenCalledWith('me@acme.com', 'hunter22');
    expect(await screen.findByText('HOME PAGE')).toBeInTheDocument();
  });

  it('says so when the password is wrong', async () => {
    login.mockRejectedValue({ response: { status: 401 } });
    renderLogin();
    await userEvent.type(screen.getByLabelText('Email'), 'me@acme.com');
    await userEvent.type(screen.getByLabelText('Password'), 'nope');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password');
  });

  it('creates an organization from the Create account tab', async () => {
    register.mockResolvedValue({});
    renderLogin();
    await userEvent.click(screen.getByRole('tab', { name: 'Create account' }));
    await userEvent.type(screen.getByLabelText('Organization name'), 'Acme');
    await userEvent.type(screen.getByLabelText('Admin email'), 'admin@acme.com');
    await userEvent.type(screen.getByLabelText('Password'), 'longenough');
    await userEvent.click(screen.getByRole('button', { name: 'Create organization' }));
    expect(register).toHaveBeenCalledWith({ orgName: 'Acme', adminEmail: 'admin@acme.com', password: 'longenough' });
    expect(await screen.findByText('HOME PAGE')).toBeInTheDocument();
  });

  it('opens on the sign-up tab for /register', () => {
    renderLogin({ initialMode: 'signup' });
    expect(screen.getByRole('tab', { name: 'Create account' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Organization name')).toBeInTheDocument();
  });

  it('redirects home when already signed in', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, login, register });
    renderLogin();
    expect(screen.getByText('HOME PAGE')).toBeInTheDocument();
  });
});
