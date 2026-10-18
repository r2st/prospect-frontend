import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Loader2, UserPlus, ShieldAlert, KeyRound, Trash2, X } from 'lucide-react';
import { adminUsersApi } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABEL, normalizeRole } from '../lib/roles';

// Roles assignable from the admin console. platform_admin is intentionally not
// listed — it is granted out-of-band (migration / platform tooling), not here.
const ROLES = ['org_admin', 'org_manager', 'org_agent'];

const ROLE_BADGE = {
  platform_admin: 'bg-purple-50 text-purple-700 ring-purple-600/20',
  org_admin: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  org_manager: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  org_agent: 'bg-gray-100 text-gray-600 ring-gray-500/20',
};

const EMPTY_FORM = { email: '', name: '', role: 'org_agent', password: '' };

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  // The user whose password is being reset (null = modal closed).
  const [resetTarget, setResetTarget] = useState(null);
  // The user awaiting delete confirmation (null = modal closed).
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: users = [], isLoading, isError } = useQuery({
    queryKey: ['admin-users'],
    queryFn: adminUsersApi.list,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-users'] });

  const createMutation = useMutation({
    mutationFn: adminUsersApi.create,
    onSuccess: (data) => {
      toast.success(
        data?.welcome_email_sent
          ? 'User created and welcome email sent'
          : 'User created — no email account configured, so no welcome email was sent'
      );
      setForm(EMPTY_FORM);
      invalidate();
    },
    onError: (err) => {
      const status = err?.response?.status;
      toast.error(
        status === 409
          ? 'A user with that email already exists'
          : status === 422
          ? 'Check the form — password must be at least 8 characters'
          : 'Could not create user'
      );
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, newPassword }) => adminUsersApi.resetPassword(id, newPassword),
    onSuccess: () => {
      toast.success('Password reset — the user must change it on next login');
      setResetTarget(null);
      invalidate();
    },
    onError: (err) => {
      const status = err?.response?.status;
      toast.error(
        status === 422
          ? 'Password must be at least 6 characters'
          : err?.response?.data?.detail || 'Could not reset password'
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => adminUsersApi.update(id, payload),
    onSuccess: () => {
      toast.success('User updated');
      invalidate();
    },
    onError: (err) => {
      toast.error(err?.response?.data?.detail || 'Could not update user');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => adminUsersApi.remove(id),
    onSuccess: () => {
      toast.success('User deleted');
      setDeleteTarget(null);
      invalidate();
    },
    onError: (err) => {
      toast.error(err?.response?.data?.detail || 'Could not delete user');
    },
  });

  const onCreate = (e) => {
    e.preventDefault();
    createMutation.mutate({
      email: form.email.trim(),
      name: form.name.trim(),
      role: form.role,
      password: form.password,
    });
  };

  const toggleActive = (u) =>
    updateMutation.mutate({ id: u.id, payload: { is_active: !u.is_active } });

  const changeRole = (u, role) =>
    updateMutation.mutate({ id: u.id, payload: { role } });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Users</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage who can access DoAide Prospect and what they can do.
        </p>
      </div>

      {/* Create user */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-indigo-600" />
          <h2 className="text-sm font-semibold text-gray-900">Add a new user</h2>
        </div>
        <form onSubmit={onCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input
            type="email"
            required
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <input
            type="text"
            required
            placeholder="Full name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r] || r}
              </option>
            ))}
          </select>
          <input
            type="text"
            required
            minLength={8}
            placeholder="Initial password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
          >
            {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Create
          </button>
        </form>
        <p className="mt-2 text-xs text-gray-400">
          New users are required to change this password on first login.
        </p>
      </section>

      {/* Users table */}
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading users…
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-red-600">
            <ShieldAlert className="h-4 w-4" /> Could not load users.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => {
                  const isSelf = currentUser?.id === u.id;
                  return (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">
                        {u.name}
                        {isSelf && <span className="ml-2 text-xs text-gray-400">(you)</span>}
                        {u.must_change_password && (
                          <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-600/20">
                            pending password
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-600">{u.email}</td>
                      <td className="px-5 py-3">
                        {normalizeRole(u.role) === 'platform_admin' ? (
                          // Platform admins aren't editable from the org console.
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${ROLE_BADGE.platform_admin}`}
                          >
                            {ROLE_LABEL.platform_admin}
                          </span>
                        ) : (
                          <select
                            value={normalizeRole(u.role)}
                            disabled={isSelf || updateMutation.isPending}
                            onChange={(e) => changeRole(u, e.target.value)}
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset disabled:opacity-70 ${
                              ROLE_BADGE[normalizeRole(u.role)] || ROLE_BADGE.org_agent
                            }`}
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {ROLE_LABEL[r] || r}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {u.is_active ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-gray-400" /> Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={resetPasswordMutation.isPending}
                            onClick={() => setResetTarget(u)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <KeyRound className="h-3.5 w-3.5" /> Reset password
                          </button>
                          <button
                            type="button"
                            disabled={isSelf || updateMutation.isPending}
                            onClick={() => toggleActive(u)}
                            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                            title={isSelf ? 'You cannot change your own status' : ''}
                          >
                            {u.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            disabled={isSelf || deleteMutation.isPending}
                            onClick={() => setDeleteTarget(u)}
                            aria-label={`Delete ${u.name}`}
                            title={isSelf ? 'You cannot delete your own account' : ''}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {resetTarget && (
        <ResetPasswordModal
          user={resetTarget}
          isPending={resetPasswordMutation.isPending}
          onClose={() => setResetTarget(null)}
          onSubmit={(newPassword) =>
            resetPasswordMutation.mutate({ id: resetTarget.id, newPassword })
          }
        />
      )}

      {deleteTarget && (
        <DeleteUserModal
          user={deleteTarget}
          isPending={deleteMutation.isPending}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
        />
      )}
    </div>
  );
}

function DeleteUserModal({ user, isPending, onClose, onConfirm }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-user-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-600" />
            <h2 id="delete-user-title" className="text-base font-semibold text-gray-900">
              Delete user?
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-gray-500">
          <span className="font-medium text-gray-900">{user.name}</span>{' '}
          <span className="text-gray-400">({user.email})</span> will lose access immediately and
          be removed from this list. Their emails, tasks and deals keep their history.
        </p>

        <div className="flex justify-end gap-2 pt-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={onConfirm}
            className="flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete user
          </button>
        </div>
      </div>
    </div>
  );
}

function ResetPasswordModal({ user, isPending, onClose, onSubmit }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const tooShort = password.length > 0 && password.length < 6;
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = password.length >= 6 && password === confirm && !isPending;

  const submit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit(password);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-semibold text-gray-900">Reset password</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-4 text-sm text-gray-500">
          Set a new password for <span className="font-medium text-gray-900">{user.name}</span>{' '}
          <span className="text-gray-400">({user.email})</span>. They'll be required to change it
          on their next login.
        </p>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">New password</label>
            <input
              type="password"
              autoFocus
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {tooShort && (
              <p className="mt-1 text-xs text-red-600">Must be at least 6 characters.</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Confirm password
            </label>
            <input
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter the password"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {mismatch && <p className="mt-1 text-xs text-red-600">Passwords don't match.</p>}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Reset password
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
