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
import Logo, { HERO_ACCENT } from '../components/Logo';
import { DoAideFooter } from '../components/DoAideBrand';
import ThemeToggle from '../components/ThemeToggle';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';

// The public face of Prospect: a Pulse-style landing page with sign-in and
// sign-up embedded in the hero. Like Pulse's, the whole page is near-black and
// teal in both themes: the root carries the `dark` class, so the themed gray
// scale and tints (tailwind.config.js) resolve to their dark values inside it
// whatever the app theme is. The theme switch still sets the app's theme.

const HERO_BG = '#0A0A0B';

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
  'w-full rounded-lg border border-white/[0.12] bg-[#0A0A0B]/60 py-2.5 pl-10 pr-3 text-sm text-white transition-colors placeholder:text-white/35 focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400';
const labelClass = 'mb-1.5 block text-sm font-medium text-white/80';
const iconClass = 'pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40';

// Pulse's hero robot, in the same teal, floating with a pulsing antenna and
// blinking eyes (animations in index.css).
function HeroRobot() {
  const color = HERO_ACCENT;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 180 150"
      width="180"
      height="150"
      className="hero-robot"
      role="img"
      aria-label="DoAide mascot"
    >
      <line x1="90" y1="28" x2="90" y2="10" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <circle cx="90" cy="7" r="5" fill={color} className="antenna-glow" />
      <circle cx="90" cy="7" r="2.5" fill="#2DD4BF" />
      <rect x="35" y="28" width="110" height="80" rx="22" fill={color} />
      <rect x="50" y="40" width="80" height="58" rx="14" fill="#0F766E" opacity="0.3" />
      <g className="robot-eye">
        <ellipse cx="62" cy="62" rx="12" ry="14" fill="#0A0A0B" />
        <circle cx="65" cy="59" r="5" fill="#2DD4BF" />
        <circle cx="67" cy="56" r="2" fill="white" opacity="0.5" />
      </g>
      <g className="robot-eye">
        <ellipse cx="118" cy="62" rx="12" ry="14" fill="#0A0A0B" />
        <circle cx="121" cy="59" r="5" fill="#2DD4BF" />
        <circle cx="123" cy="56" r="2" fill="white" opacity="0.5" />
      </g>
      <path d="M68 88Q90 102 112 88" stroke="#0A0A0B" strokeWidth="3" fill="none" strokeLinecap="round" />
      <rect x="14" y="48" width="18" height="28" rx="7" fill={color} opacity="0.8" />
      <rect x="148" y="48" width="18" height="28" rx="7" fill={color} opacity="0.8" />
      <rect x="75" y="108" width="30" height="10" rx="4" fill="#0F766E" />
      <rect x="52" y="118" width="76" height="28" rx="12" fill={color} />
      <circle cx="90" cy="130" r="5" fill="#0A0A0B" />
    </svg>
  );
}

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
      on ? 'bg-white/[0.08] text-teal-300' : 'text-white/50 hover:text-white'
    );

  return (
    <div className="w-full rounded-2xl border border-white/[0.07] bg-[#101012]/80 p-6 shadow-2xl shadow-black/60 backdrop-blur sm:p-7">
      <h2 className="text-lg font-semibold tracking-tight text-white">
        {signingUp ? 'Create your organization' : 'Sign in to your account'}
      </h2>
      <p className="mt-1 text-sm text-white/50">
        {signingUp ? 'Start turning leads into clients in minutes.' : 'Welcome back to DoAide Prospect.'}
      </p>

      <div role="tablist" aria-label="Account" className="mt-5 flex gap-1 rounded-lg border border-white/[0.06] bg-[#1A1A1D] p-1">
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
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 focus:ring-offset-[#0A0A0B] disabled:cursor-not-allowed disabled:opacity-60"
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
    <div className="dark min-h-screen bg-gray-50" style={{ colorScheme: 'dark' }}>
      {/* Hero — Pulse near-black and teal in both themes */}
      <section className="relative overflow-hidden text-[#E4E4E7]" style={{ backgroundColor: HERO_BG }}>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(50% 45% at 20% 30%, rgba(13,148,136,0.12), transparent 70%), radial-gradient(35% 35% at 85% 70%, rgba(45,212,191,0.06), transparent 70%)',
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
                <div className="hero-robot-float">
                  <HeroRobot />
                </div>
              </div>
              <h1 className="mt-6 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                AI-powered B2B{' '}
                <span className="font-serif font-normal italic text-teal-400">
                  lead-to-client
                </span>{' '}
                platform
              </h1>
              <p className="mx-auto mt-4 max-w-xl text-base text-[#A1A1AA] sm:text-lg lg:mx-0">
                Discover, verify, and engage prospects with AI-driven campaigns. Built for modern sales teams.
              </p>

              <ol aria-label="How Prospect works" className="mt-8 flex flex-wrap items-center justify-center gap-y-3 lg:justify-start">
                {WORKFLOW.map(({ label, icon: Icon }, i) => (
                  <li key={label} className="flex items-center">
                    <div className="flex flex-col items-center gap-1.5">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.06] bg-[#1A1A1D] text-teal-400">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="text-xs font-medium text-[#A1A1AA]">{label}</span>
                    </div>
                    {i < WORKFLOW.length - 1 && (
                      <ChevronRight aria-hidden="true" className="mx-1.5 mb-5 h-4 w-4 text-teal-600/60 sm:mx-2.5" />
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
        <div className="relative border-t border-white/[0.06] bg-white/[0.02]">
          <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-y-6 px-4 py-8 sm:px-6 lg:grid-cols-4 lg:px-8">
            {STATS.map((s) => (
              <div key={s.label} className="flex flex-col-reverse text-center">
                <dt className="mt-2 font-mono text-[11px] uppercase tracking-wider text-[#71717A] sm:text-xs">{s.label}</dt>
                <dd className="font-serif text-3xl italic leading-none text-teal-400 sm:text-4xl">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Features — dark-gray cards with thin borders, as on Pulse */}
      <section aria-labelledby="features-heading" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-indigo-600">Everything in one place</p>
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
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-card transition hover:border-indigo-200 hover:shadow-md"
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
