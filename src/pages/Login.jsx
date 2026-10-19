import React, { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Loader2,
  Mail,
  Lock,
  Building2,
  Search,
  ShieldCheck,
  PenLine,
  Send,
  BadgeCheck,
  ChevronRight,
  Rocket,
  Sparkles,
  BarChart3,
  Inbox,
  ScanLine,
  HeartPulse,
} from 'lucide-react';
import Logo, { LogoMark } from '../components/Logo';
import { DoAideFooter } from '../components/DoAideBrand';
import ThemeToggle from '../components/ThemeToggle';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';

// The public face of Prospect: a Pulse-style landing page with sign-in and
// sign-up embedded in the hero. The hero is dark in both themes (it uses
// white/alpha and fixed hex colours, never the gray scale, which inverts with
// the theme); everything below it follows the theme.

const WORKFLOW = [
  { label: 'Discover', icon: Search },
  { label: 'Verify', icon: ShieldCheck },
  { label: 'Draft', icon: PenLine },
  { label: 'Send', icon: Send },
  { label: 'Convert', icon: BadgeCheck },
];

const STATS = [
  { value: '5', label: 'steps from lead to client' },
  { value: '100%', label: 'of addresses verified before send' },
  { value: '1-click', label: 'approve & send AI drafts' },
  { value: '24/7', label: 'autopilot campaigns' },
];

const FEATURES = [
  {
    title: 'Autopilot Campaigns',
    icon: Rocket,
    body: 'Set the audience and the goal once. Prospect finds leads, drafts and schedules every touch, and pauses itself on a reply.',
  },
  {
    title: 'Smart Verification',
    icon: ShieldCheck,
    body: 'Every address is checked before it is sent to, so bounces never reach your domain reputation.',
  },
  {
    title: 'AI Email Drafting',
    icon: Sparkles,
    body: 'Personalised first lines and follow-ups written from each company’s own site and news — reviewed by you before they go.',
  },
  {
    title: 'Pipeline Analytics',
    icon: BarChart3,
    body: 'From new lead to signed client on one board, with reply rates, stage velocity and revenue by campaign.',
  },
  {
    title: 'Multi-Mailbox',
    icon: Inbox,
    body: 'Connect several Gmail and SMTP senders, rotate between them with warm-up and daily limits, and read every reply in one inbox.',
  },
  {
    title: 'Card Scanner',
    icon: ScanLine,
    body: 'Photograph a business card at an event and it becomes a verified contact, ready for a sequence.',
  },
  {
    title: 'Client Health',
    icon: HeartPulse,
    body: 'Once they sign, health scores and alerts flag at-risk accounts before they churn.',
  },
  {
    title: 'Send Safeguards',
    icon: Lock,
    body: 'A sending kill switch, suppression lists and GDPR controls, so automation never outruns your judgement.',
  },
];

const inputClass =
  'w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm text-white shadow-sm transition-colors placeholder:text-white/35 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400';
const labelClass = 'mb-1.5 block text-sm font-medium text-white/80';
const iconClass = 'pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40';

function Field({ id, label, icon: Icon, ...props }) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="relative">
        <Icon className={iconClass} />
        <input id={id} className={inputClass} {...props} />
      </div>
    </div>
  );
}

function AuthCard({ initialMode = 'signin' }) {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState(initialMode);
  const [orgName, setOrgName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const from = location.state?.from?.pathname || '/';
  const signingUp = mode === 'signup';

  const switchMode = (next) => {
    setMode(next);
    setError('');
  };

  const onSignIn = async () => {
    try {
      const data = await login(email.trim(), password);
      if (data.must_change_password) {
        navigate('/change-password', { replace: true });
      } else {
        toast.success('Welcome back');
        navigate(from, { replace: true });
      }
    } catch (err) {
      const status = err?.response?.status;
      setError(
        status === 401
          ? 'Incorrect email or password'
          : status === 403
          ? 'This account has been deactivated'
          : 'Something went wrong. Please try again.'
      );
    }
  };

  const onSignUp = async () => {
    try {
      await register({ orgName: orgName.trim(), adminEmail: email.trim(), password });
      toast.success('Organization created — welcome to DoAide Prospect');
      navigate('/', { replace: true });
    } catch (err) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      setError(
        status === 409
          ? typeof detail === 'string'
            ? detail
            : 'That email or organization is already taken'
          : status === 400 || status === 422
          ? 'Please check your details and try again'
          : 'Something went wrong. Please try again.'
      );
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (signingUp && password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setSubmitting(true);
    try {
      await (signingUp ? onSignUp() : onSignIn());
    } finally {
      setSubmitting(false);
    }
  };

  const tabClass = (on) =>
    cn(
      'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
      on ? 'bg-white/10 text-white shadow-sm' : 'text-white/50 hover:text-white'
    );

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-indigo-950/50 backdrop-blur sm:p-7">
      <h2 className="text-lg font-semibold tracking-tight text-white">
        {signingUp ? 'Create your organization' : 'Sign in to your account'}
      </h2>
      <p className="mt-1 text-sm text-white/50">
        {signingUp ? 'Start turning leads into clients in minutes.' : 'Welcome back to DoAide Prospect.'}
      </p>

      <div role="tablist" aria-label="Account" className="mt-5 flex gap-1 rounded-lg bg-white/5 p-1">
        <button
          type="button"
          role="tab"
          aria-selected={!signingUp}
          onClick={() => switchMode('signin')}
          className={tabClass(!signingUp)}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={signingUp}
          onClick={() => switchMode('signup')}
          className={tabClass(signingUp)}
        >
          Create account
        </button>
      </div>

      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        {signingUp && (
          <Field
            id="orgName"
            label="Organization name"
            icon={Building2}
            type="text"
            autoComplete="organization"
            required
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="Acme Inc."
          />
        )}
        <Field
          id="email"
          label={signingUp ? 'Admin email' : 'Email'}
          icon={Mail}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
        />
        <Field
          id="password"
          label="Password"
          icon={Lock}
          type="password"
          autoComplete={signingUp ? 'new-password' : 'current-password'}
          required
          minLength={signingUp ? 8 : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={signingUp ? 'At least 8 characters' : '••••••••'}
        />

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-colors hover:bg-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-[#0b0a1a] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {signingUp
            ? submitting
              ? 'Creating…'
              : 'Create organization'
            : submitting
            ? 'Signing in…'
            : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

export default function Login({ initialMode = 'signin' }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  // Already logged in — bounce to where they were headed.
  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero — dark in both themes */}
      <section className="relative overflow-hidden bg-[#0b0a1a] text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(60% 50% at 20% 30%, rgba(99,102,241,0.28), transparent 70%), radial-gradient(40% 40% at 85% 70%, rgba(139,92,246,0.18), transparent 70%)',
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <header className="flex items-center justify-between gap-3 py-5">
            <Logo markSize={30} inverted />
            <ThemeToggle variant="onDark" />
          </header>

          <div className="grid items-center gap-10 pb-14 pt-6 lg:grid-cols-[1.15fr_1fr] lg:gap-16 lg:pb-20 lg:pt-12">
            <div className="text-center lg:text-left">
              <div className="flex justify-center lg:justify-start">
                <div className="relative">
                  <div aria-hidden="true" className="absolute inset-0 rounded-full bg-indigo-500/30 blur-3xl" />
                  <LogoMark size={112} title="DoAide mascot" className="relative drop-shadow-[0_10px_30px_rgba(99,102,241,0.45)]" />
                </div>
              </div>
              <h1 className="mt-8 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                AI-powered B2B{' '}
                <span className="bg-gradient-to-r from-indigo-300 to-violet-300 bg-clip-text text-transparent">
                  lead-to-client
                </span>{' '}
                platform
              </h1>
              <p className="mx-auto mt-4 max-w-xl text-base text-white/60 sm:text-lg lg:mx-0">
                Discover, verify, and engage prospects with AI-driven campaigns. Built for modern sales teams.
              </p>

              <ol aria-label="How Prospect works" className="mt-8 flex flex-wrap items-center justify-center gap-y-3 lg:justify-start">
                {WORKFLOW.map(({ label, icon: Icon }, i) => (
                  <li key={label} className="flex items-center">
                    <div className="flex flex-col items-center gap-1.5">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-indigo-400/20 bg-indigo-500/15 text-indigo-200">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="text-xs font-medium text-white/70">{label}</span>
                    </div>
                    {i < WORKFLOW.length - 1 && (
                      <ChevronRight aria-hidden="true" className="mx-1.5 mb-5 h-4 w-4 text-white/25 sm:mx-2.5" />
                    )}
                  </li>
                ))}
              </ol>
            </div>

            <div className="mx-auto w-full max-w-md lg:mx-0 lg:justify-self-end">
              <AuthCard initialMode={initialMode} />
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="relative border-t border-white/10 bg-white/[0.02]">
          <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-y-6 px-4 py-8 sm:px-6 lg:grid-cols-4 lg:px-8">
            {STATS.map((s) => (
              <div key={s.label} className="flex flex-col-reverse text-center">
                <dt className="mt-1 text-xs text-white/55 sm:text-sm">{s.label}</dt>
                <dd className="text-2xl font-bold tracking-tight text-indigo-300 sm:text-3xl">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Features — follows the theme */}
      <section aria-labelledby="features-heading" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">Everything in one place</p>
          <h2 id="features-heading" className="mt-2 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            From first touch to signed client
          </h2>
          <p className="mt-3 text-gray-500">
            The tools a sales team reaches for every day, with AI doing the legwork and you making the calls.
          </p>
        </div>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ title, icon: Icon, body }) => (
            <li
              key={title}
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-card transition-shadow hover:shadow-md"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-semibold text-gray-900">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-500">{body}</p>
            </li>
          ))}
        </ul>
      </section>

      <DoAideFooter className="border-t border-gray-200 px-4 py-8" />
    </div>
  );
}
