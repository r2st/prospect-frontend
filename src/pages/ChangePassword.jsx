import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader2, ShieldCheck } from 'lucide-react';
import Logo from '../components/Logo';
import { DoAideFooter } from '../components/DoAideBrand';
import { useAuth } from '../context/AuthContext';

const MIN_LENGTH = 8;

export default function ChangePassword() {
  const { changePassword, mustChangePassword, logout, user } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < MIN_LENGTH) {
      setError(`New password must be at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirm) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('New password must be different from your current password.');
      return;
    }

    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      toast.success('Password updated');
      navigate('/', { replace: true });
    } catch (err) {
      const status = err?.response?.status;
      setError(
        status === 400
          ? 'Your current password is incorrect.'
          : status === 422
          ? `New password must be at least ${MIN_LENGTH} characters.`
          : 'Something went wrong. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-gray-300 bg-white py-2.5 px-3 text-sm text-gray-900 shadow-sm transition-colors placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo markSize={40} />
          <h1 className="mt-6 text-xl font-semibold tracking-tight text-gray-900">
            {mustChangePassword ? 'Set a new password' : 'Change your password'}
          </h1>
          {mustChangePassword && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
              <ShieldCheck className="h-4 w-4 text-indigo-500" />
              For security, please change your password before continuing.
            </p>
          )}
          {user?.email && (
            <p className="mt-1 text-xs text-gray-400">Signed in as {user.email}</p>
          )}
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <div>
            <label htmlFor="current" className="mb-1.5 block text-sm font-medium text-gray-700">
              Current password
            </label>
            <input
              id="current"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="new" className="mb-1.5 block text-sm font-medium text-gray-700">
              New password
            </label>
            <input
              id="new"
              type="password"
              autoComplete="new-password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClass}
              placeholder={`At least ${MIN_LENGTH} characters`}
            />
          </div>

          <div>
            <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium text-gray-700">
              Confirm new password
            </label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputClass}
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? 'Updating…' : 'Update password'}
          </button>

          <button
            type="button"
            onClick={logout}
            className="w-full rounded-lg px-4 py-2 text-sm font-medium text-gray-500 transition-colors hover:text-gray-800"
          >
            Sign out
          </button>
        </form>
      </div>
      <DoAideFooter className="mt-12 w-full max-w-xl" />
    </div>
  );
}
