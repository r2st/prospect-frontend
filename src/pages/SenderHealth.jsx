import { useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, Calendar, CheckCircle2, ChevronRight, ExternalLink, Flame, Gauge,
  GraduationCap, Loader2, Mail, Minus, Pencil, RefreshCw, RotateCcw, TrendingDown, TrendingUp,
} from 'lucide-react';
import HelpIcon from '../components/HelpIcon';
import {
  CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import EmptyState from '../components/EmptyState';
import { useAutomation } from '../hooks/useAutomation';
import {
  useAssessSenders, useSenderBooking, useSenderHealth, useSenderHistory, useSetSenderBooking,
  useWarmupPlans,
} from '../hooks/useSenderHealth';
import {
  THRESHOLDS, fmtPct, fmtRepDelta, fmtThrottle, reputationTone, senderWarnings, statusMeta,
} from '../lib/senderHealth';
import { cn, timeAgo } from '../lib/utils';

/**
 * Sender Health — per-account reputation for every mailbox Dialtone sends from.
 *
 * Domain Health answers "can this domain be trusted?"; the auto-pause rail
 * answers "should sending stop right now, globally?". Neither shows the thing an
 * operator actually acts on: which individual sending *account* is degrading,
 * how fast, and whether it's about to be throttled. That's this page.
 */
export default function SenderHealth() {
  const { data, isLoading, isError, error, refetch, isFetching } = useSenderHealth();
  const { data: history } = useSenderHistory({ days: 30 });
  const { data: warmupPlans } = useWarmupPlans();
  const { data: automation } = useAutomation();
  const assess = useAssessSenders();

  // The global scheduling link a sender falls back to when it has no booking
  // URL of its own. Shown so "using global default" names the actual link.
  const globalBookingUrl = automation?.scheduling_link || '';

  const senders = Array.isArray(data) ? data : [];

  // Index history by account so each row can pull its own series without another
  // request. Missing history is fine — the row just won't draw a trend.
  const historyByAccount = useMemo(() => {
    const map = {};
    for (const s of history || []) map[s.account_id] = s.points || [];
    return map;
  }, [history]);

  // Index warm-up plans by account so each row can show its own ramp progress.
  const warmupByAccount = useMemo(() => {
    const map = {};
    for (const p of warmupPlans || []) map[p.account_id] = p;
    return map;
  }, [warmupPlans]);

  // Fleet-level roll-up of everything approaching or over a threshold, so the
  // operator sees the danger before scrolling the whole list.
  const atRisk = useMemo(
    () => senders
      .map((s) => ({ sender: s, warnings: senderWarnings(s) }))
      .filter((x) => x.warnings.length > 0),
    [senders],
  );

  return (
    <div className="space-y-6">
      <Header
        onRefresh={() => refetch()}
        refreshing={isFetching}
        onAssess={() => assess.mutate()}
        assessing={assess.isPending}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : isError ? (
        // A failed load must never read as "every sender is healthy".
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <AlertTriangle className="h-4 w-4" />
            Couldn't load sender health
          </h2>
          <p className="mt-1.5 text-sm text-amber-800">
            {error?.response?.data?.detail || error?.message || 'The endpoint did not respond.'}
          </p>
          <p className="mt-1 text-xs text-amber-700">
            This says nothing about whether your senders are healthy — only that we couldn't check.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </button>
        </div>
      ) : senders.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <EmptyState
            icon={Gauge}
            title="No senders assessed yet"
            description="Accounts appear here once Dialtone has sent enough from them to score a reputation. Run an assessment to force a first read."
          action={{ label: 'Connect an email account', href: '/settings' }}
        />
        </div>
      ) : (
        <>
          {atRisk.length > 0 && <RiskCallout atRisk={atRisk} />}
          <div className="space-y-3">
            {senders.map((s) => (
              <SenderRow
                key={`${s.account_type}:${s.account_id}`}
                sender={s}
                history={historyByAccount[s.account_id]}
                warmup={warmupByAccount[s.account_id]}
                globalBookingUrl={globalBookingUrl}
              />
            ))}
          </div>
          <ThresholdLegend />
        </>
      )}
    </div>
  );
}

function Header({ onRefresh, refreshing, onAssess, assessing }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
          <Gauge className="h-6 w-6 text-indigo-500" />
          Sender Health
          <HelpIcon articleId="sender-health" />
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Reputation, bounce and complaint rates for every mailbox Dialtone sends from — and how
          hard each one is being throttled.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={assessing}
          onClick={onAssess}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          {assessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
          Reassess now
        </button>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 shadow-sm hover:bg-gray-50"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
          Refresh
        </button>
      </div>
    </div>
  );
}

// The "act before it throttles" banner: every metric on every account that is
// near or over a pause line, worst first.
function RiskCallout({ atRisk }) {
  const anyBreach = atRisk.some((x) => x.warnings.some((w) => w.severity === 'breach'));
  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        anyBreach ? 'border-red-200 bg-red-50/70' : 'border-amber-200 bg-amber-50/70'
      )}
    >
      <h2
        className={cn(
          'flex items-center gap-1.5 text-sm font-semibold',
          anyBreach ? 'text-red-900' : 'text-amber-900'
        )}
      >
        <AlertTriangle className="h-4 w-4" />
        {atRisk.length} sender{atRisk.length === 1 ? ' needs' : 's need'} attention
      </h2>
      <ul className="mt-2 space-y-1.5">
        {atRisk.map(({ sender, warnings }) => (
          <li key={`${sender.account_type}:${sender.account_id}`} className="text-sm text-gray-700">
            <span className="font-medium">{sender.account_email || sender.account_id}</span>
            {' — '}
            {warnings.map((w, i) => (
              <span key={w.label}>
                {i > 0 && ', '}
                <span className={w.severity === 'breach' ? 'font-semibold text-red-700' : 'text-amber-700'}>
                  {w.label} {w.format(w.value)}
                  {w.severity === 'breach' ? ' (over ' : ' (nearing '}
                  {w.format(w.threshold)})
                </span>
              </span>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SenderRow({ sender: s, history, warmup, globalBookingUrl }) {
  const [open, setOpen] = useState(false);
  const meta = statusMeta(s.status);
  const warnings = senderWarnings(s);
  const points = Array.isArray(history) ? history : [];

  // Trend delta over the window: current reputation vs the oldest snapshot.
  const delta = points.length >= 2
    ? s.reputation_score - points[0].reputation_score
    : null;
  const repBar = Math.max(0, Math.min(100, s.reputation_score ?? 0));

  return (
    <div className={cn('rounded-xl border bg-white shadow-sm', open ? 'border-indigo-200' : 'border-gray-200')}>
      <div className="flex flex-wrap items-center gap-3 p-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={`${open ? 'Hide' : 'Show'} trend for ${s.account_email || s.account_id}`}
          className="rounded text-gray-400 hover:text-gray-700"
        >
          <ChevronRight className={cn('h-4 w-4 transition-transform', open && 'rotate-90')} />
        </button>

        <span className={cn('h-2.5 w-2.5 flex-shrink-0 rounded-full', meta.dot)} aria-hidden="true" />

        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate font-medium text-gray-900">
            <Mail className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
            {s.account_email || <span className="text-gray-400">Unknown address</span>}
          </p>
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-gray-400">
            <span>
              {s.account_type} · {s.sent_7d} sent (7d) ·{' '}
              {s.last_assessed ? `assessed ${timeAgo(s.last_assessed)}` : 'never assessed'}
            </span>
            {warmup && <WarmupBadge warmup={warmup} />}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
          <Metric label="Bounce" value={fmtPct(s.bounce_rate_7d)} danger={s.bounce_rate_7d >= THRESHOLDS.bounceRate} />
          <Metric label="Complaint" value={fmtPct(s.complaint_rate_7d)} danger={s.complaint_rate_7d >= THRESHOLDS.complaintRate} />
          <Metric label="Throttle" value={fmtThrottle(s.throttle_factor)} danger={s.throttle_factor < 1} muted={s.throttle_factor >= 1} />

          <div className="text-right">
            <div className="flex items-baseline justify-end gap-1.5">
              <span className={cn('text-2xl font-bold tabular-nums', reputationTone(s.reputation_score))}>
                {s.reputation_score ?? '—'}
              </span>
              <span className="text-xs text-gray-400">/100</span>
              <TrendArrow delta={delta} />
            </div>
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
                meta.tone
              )}
            >
              {meta.label}
            </span>
          </div>
        </div>
      </div>

      {/* Reputation bar under the row — the whole score at a glance. */}
      <div className="px-4 pb-3">
        <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
          <div className={cn('h-full rounded-full', meta.bar)} style={{ width: `${repBar}%` }} />
        </div>
      </div>

      {/* Warm-up progress — today's sends against the ramped daily cap. Only
          shown while the account is still warming (graduated senders have no
          cap to visualise). */}
      {warmup && warmup.status !== 'graduated' && <WarmupProgress warmup={warmup} />}

      {warnings.length > 0 && (
        <div className="border-t border-gray-100 px-4 py-2.5">
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {warnings.map((w) => (
              <li
                key={w.label}
                className={cn(
                  'flex items-center gap-1 text-xs',
                  w.severity === 'breach' ? 'text-red-700' : 'text-amber-700'
                )}
              >
                <AlertTriangle className="h-3 w-3" />
                {w.label} {w.format(w.value)}
                {w.severity === 'breach' ? ` over ${w.format(w.threshold)}` : ` nearing ${w.format(w.threshold)}`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {open && (
        <>
          <SenderBooking accountId={s.account_id} globalBookingUrl={globalBookingUrl} />
          <SenderTrend points={points} status={s.status} />
        </>
      )}
    </div>
  );
}

// Per-sender calendar booking link. A sender with no URL of its own inherits the
// global scheduling link (shown as "using global default"); operators can set a
// custom link or reset back to the global one. Fetched lazily — this only
// mounts once the row is expanded.
function SenderBooking({ accountId, globalBookingUrl }) {
  const { data: config, isLoading } = useSenderBooking(accountId);
  const save = useSetSenderBooking(accountId);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');

  const current = config?.booking_url || '';
  const usingGlobal = !current;

  const startEdit = () => {
    setValue(current);
    setEditing(true);
  };

  const submit = (e) => {
    e.preventDefault();
    save.mutate(
      { booking_url: value.trim() },
      { onSuccess: () => setEditing(false) }
    );
  };

  const resetToGlobal = () => {
    // Clearing the URL is what "reset to global" means server-side.
    save.mutate(
      { booking_url: '' },
      { onSuccess: () => { setEditing(false); setValue(''); } }
    );
  };

  return (
    <div className="border-t border-gray-100 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            <Calendar className="h-3.5 w-3.5" />
            Booking link
          </h3>
          {isLoading ? (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </p>
          ) : usingGlobal ? (
            <p className="mt-1 text-sm text-gray-500">
              Using global default
              {globalBookingUrl ? (
                <>
                  {' — '}
                  <a
                    href={globalBookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-blue-600 hover:underline"
                  >
                    {globalBookingUrl}
                  </a>
                </>
              ) : (
                <span className="text-gray-400"> (no global link set)</span>
              )}
            </p>
          ) : (
            <a
              href={current}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 break-all text-sm text-blue-600 hover:underline"
            >
              {current}
              <ExternalLink className="h-3 w-3 flex-shrink-0" />
            </a>
          )}
        </div>

        {!editing && (
          <div className="flex flex-shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={startEdit}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              <Pencil className="h-3 w-3" />
              {usingGlobal ? 'Set custom' : 'Edit'}
            </button>
            {!usingGlobal && (
              <button
                type="button"
                onClick={resetToGlobal}
                disabled={save.isPending}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                <RotateCcw className="h-3 w-3" />
                Reset to global
              </button>
            )}
          </div>
        )}
      </div>

      {editing && (
        <form onSubmit={submit} className="mt-2.5 space-y-2">
          <input
            type="url"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="https://calendly.com/you/intro"
            aria-label="Custom booking URL"
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <p className="text-[11px] text-gray-400">
            Must be an https link on a recognised scheduler (Calendly, Cal.com, HubSpot, …). Leave
            empty and save to fall back to the global default.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={save.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {save.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// Compact inline warm-up chip in the row subtitle. States: warming (ramp day +
// cap), graduated (fully warmed), paused (held).
function WarmupBadge({ warmup }) {
  if (warmup.status === 'graduated') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700 ring-1 ring-inset ring-green-200">
        <GraduationCap className="h-3 w-3" />
        Warmed up
      </span>
    );
  }
  if (warmup.status === 'paused') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 ring-1 ring-inset ring-gray-200">
        <Flame className="h-3 w-3" />
        Warm-up paused
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
      <Flame className="h-3 w-3" />
      Warming · day {warmup.current_day}
    </span>
  );
}

// Today's warm-up usage against the ramped daily cap, as a labelled bar. Shown
// only for still-warming accounts (the cap is what constrains their sending).
function WarmupProgress({ warmup }) {
  const limit = Math.max(1, warmup.daily_limit || 0);
  const used = Math.max(0, warmup.used_today || 0);
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const atCap = used >= limit;
  return (
    <div className="px-4 pb-3">
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="flex items-center gap-1 font-medium text-amber-700">
          <Flame className="h-3 w-3" />
          Warm-up day {warmup.current_day}
          {warmup.status === 'paused' && ' (paused)'}
        </span>
        <span className={cn('tabular-nums', atCap ? 'font-semibold text-amber-700' : 'text-gray-500')}>
          {used}/{limit} sent today
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-amber-100">
        <div
          className={cn('h-full rounded-full', atCap ? 'bg-amber-500' : 'bg-amber-400')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Metric({ label, value, danger, muted }) {
  return (
    <div className="text-right">
      <div
        className={cn(
          'text-sm font-semibold tabular-nums',
          danger ? 'text-red-600' : muted ? 'text-gray-400' : 'text-gray-900'
        )}
      >
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
    </div>
  );
}

function TrendArrow({ delta }) {
  if (delta == null || delta === 0) {
    return <Minus className="h-3.5 w-3.5 text-gray-300" aria-label="No change" />;
  }
  const up = delta > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={cn('flex items-center gap-0.5 text-xs font-medium', up ? 'text-green-600' : 'text-red-600')}>
      <Icon className="h-3.5 w-3.5" />
      {fmtRepDelta(delta)}
    </span>
  );
}

// The 30-day reputation trend. Answers "is this recovering or sliding?" — a
// single score can't. Bounce/complaint history rides alongside as context.
function SenderTrend({ points, status }) {
  if (!points || points.length < 2) {
    return (
      <div className="border-t border-gray-100 bg-gray-50/70 px-4 py-6 text-sm text-gray-400">
        Not enough history yet to trend — Dialtone needs at least two assessments of this account.
        The line fills in as it re-scores over the coming days.
      </div>
    );
  }

  const data = points.map((p) => ({
    // Short date label for the axis; full timestamp kept for the tooltip.
    date: new Date(p.captured_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    reputation: p.reputation_score,
    bounce: Number((p.bounce_rate_7d * 100).toFixed(2)),
    complaint: Number((p.complaint_rate_7d * 100).toFixed(2)),
  }));
  const meta = statusMeta(status);

  return (
    <div className="space-y-4 border-t border-gray-100 bg-gray-50/70 px-4 py-4">
      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          Reputation · last {points.length} assessment{points.length === 1 ? '' : 's'}
        </h3>
        <div className="mt-2 h-40">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              {/* The critical floor — below this the account goes critical. */}
              <ReferenceLine y={THRESHOLDS.minReputation} stroke="#f87171" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="reputation" stroke="#4338ca" strokeWidth={2} dot={false} name="Reputation" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          Bounce &amp; complaint rate (%)
        </h3>
        <div className="mt-2 h-32">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <ReferenceLine y={THRESHOLDS.bounceRate * 100} stroke="#fb923c" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="bounce" stroke="#ea580c" strokeWidth={2} dot={false} name="Bounce %" />
              <Line type="monotone" dataKey="complaint" stroke="#dc2626" strokeWidth={2} dot={false} name="Complaint %" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <p className="text-xs text-gray-400">
        Currently <span className={cn('font-medium', meta.tone.split(' ')[1])}>{meta.label}</span> — {meta.blurb}
      </p>
    </div>
  );
}

// What the colours mean and where the pause lines sit. The /senders payload
// doesn't ship thresholds, so the page states them explicitly.
function ThresholdLegend() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">How senders are scored</h2>
      <p className="mt-0.5 text-xs text-gray-500">
        Reputation is 0–100 from the last 7 days of sends. An account is throttled — its daily cap
        cut so volume shifts to healthier mailboxes — once it crosses a line.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <LegendCard title="Bounce rate" body={`Throttles above ${fmtPct(THRESHOLDS.bounceRate)}. Warned from ${fmtPct(THRESHOLDS.bounceRate * 0.8)}.`} />
        <LegendCard title="Complaint rate" body={`Throttles above ${fmtPct(THRESHOLDS.complaintRate)}. Warned from ${fmtPct(THRESHOLDS.complaintRate * 0.8)}.`} />
        <LegendCard title="Reputation" body={`Watch under 80, throttled under 60, critical under ${THRESHOLDS.minReputation}.`} />
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
        {['healthy', 'watch', 'throttled', 'critical'].map((k) => {
          const m = statusMeta(k);
          return (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className={cn('h-2 w-2 rounded-full', m.dot)} />
              {m.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function LegendCard({ title, body }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-3">
      <h4 className="flex items-center gap-1 text-xs font-semibold text-gray-700">
        <CheckCircle2 className="h-3.5 w-3.5 text-gray-400" />
        {title}
      </h4>
      <p className="mt-1 text-[11px] leading-relaxed text-gray-500">{body}</p>
    </div>
  );
}
