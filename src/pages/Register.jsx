import React, { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader2, Mail, Lock, Building2, User } from 'lucide-react';
import Logo from '../components/Logo';
import { DoAideFooter } from '../components/DoAideBrand';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Already logged in — nothing to sign up for.
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setSubmitting(true);
    try {
      await register({
        orgName: orgName.trim(),
        adminEmail: email.trim(),
        password,
        adminName: adminName.trim() || undefined,
      });
      toast.success('Organization created — welcome to DoAide Prospect');
      navigate('/', { replace: true });
    } catch (err) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      const msg =
        status === 409
          ? typeof detail === 'string'
            ? detail
            : 'That email or organization is already taken'
          : status === 400 || status === 422
          ? 'Please check your details and try again'
          : 'Something went wrong. Please try again.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 shadow-sm transition-colors placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo markSize={40} />
          <h1 className="mt-6 text-xl font-semibold tracking-tight text-gray-900">
            Create your organization
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Start using DoAide Prospect in a minute
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <div>
            <label htmlFor="orgName" className="mb-1.5 block text-sm font-medium text-gray-700">
              Organization name
            </label>
            <div className="relative">
              <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id="orgName"
                type="text"
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className={inputClass}
                placeholder="Acme Inc"
              />
            </div>
          </div>

          <div>
            <label htmlFor="adminName" className="mb-1.5 block text-sm font-medium text-gray-700">
              Your name <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id="adminName"
                type="text"
                autoComplete="name"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                className={inputClass}
                placeholder="Jane Doe"
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700">
              Work email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="you@company.com"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700">
              Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                placeholder="At least 8 characters"
              />
            </div>
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
            {submitting ? 'Creating…' : 'Create organization'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-700">
            Sign in
          </Link>
        </p>
      </div>
      <DoAideFooter className="mt-12 w-full max-w-xl" />
    </div>
  );
}
