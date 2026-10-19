import { useMemo, useState } from 'react';
import {
  Activity, Mail, UserPlus, MessageSquareReply, AlertTriangle, Bell, Phone,
  Sparkles, TrendingUp, Calendar, ShieldCheck,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import EmptyState from '../components/EmptyState';
import MetricCard from '../components/MetricCard';
import SendingKillSwitch from '../components/SendingKillSwitch';
import { useDailySummary } from '../hooks/useReports';
import { cn } from '../lib/utils';

const RANGE_OPTIONS = [
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
];

function shortDate(d) {
  const dt = new Date(d);
  if (isNaN(dt)) return String(d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function longDate(d) {
  const dt = new Date(d);
  if (isNaN(dt)) return String(d);
  return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function pct(n) {
  return `${(Number(n || 0) * 100).toFixed(1)}%`;
}

function ChartCard({ title, icon: Icon, children }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-gray-900">
        {Icon && <Icon className="h-4 w-4 text-gray-400" />}
        {title}
      </h2>
      {children}
    </div>
  );
}

// Break the emails-by-sequence / by-stage maps into recharts-friendly rows.
function toRows(obj, keyName) {
  return Object.entries(obj || {}).map(([k, v]) => ({ [keyName]: k, count: v }));
}

export default function DailyActivity() {
  const [range, setRange] = useState(30);
  const { data, isLoading } = useDailySummary(range);
  const latest = data?.latest || null;
  const history = data?.history || [];

  // History comes newest-first; charts read best oldest→newest.
  const trend = useMemo(
    () =>
      [...history]
        .reverse()
        .map((h) => ({
          date: shortDate(h.date),
          emails: h.emails_sent || 0,
          replies: h.replies_received || 0,
          bounces: h.bounces_received || 0,
          leads: h.leads_discovered || 0,
          calls: h.calls_queued || 0,
        })),
    [history]
  );

  const m = latest?.metrics || {};
  const stageRows = toRows(m?.emails?.by_stage, 'stage').sort((a, b) => Number(a.stage) - Number(b.stage));
  const sequenceRows = toRows(m?.emails?.by_sequence, 'sequence');
  const deliver = m?.deliverability || {};
  const accounts = deliver?.accounts || [];

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 rounded bg-gray-200" />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-xl bg-gray-200" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Activity className="h-6 w-6 text-indigo-500" />
            Daily Activity
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            What Dialtone did — {latest ? longDate(latest.date) : 'no data yet'}
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRange(opt.value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                range === opt.value ? 'bg-indigo-500 text-white' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Global sending status + kill switch */}
      <SendingKillSwitch compact />

      {!latest ? (
        <EmptyState
          icon={Activity}
          title="No activity summaries yet"
          description="Autopilot's daily summary is generated automatically at 6 PM IST, or on first load once Autopilot starts taking actions."
        />
      ) : (
        <>
          {/* AI narrative */}
          <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-6 shadow-sm">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-indigo-700">
              <Sparkles className="h-4 w-4" />
              Autopilot's briefing
            </h2>
            <p className="text-sm leading-relaxed text-gray-700">{latest.narrative}</p>
          </div>

          {/* Headline metrics */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <MetricCard
              title="Emails sent"
              value={latest.emails_sent}
              icon={Mail}
              color="indigo"
              to="/dialtone?type=email_sent"
              linkLabel="Emails sent — view send activity"
            />
            <MetricCard
              title="Leads found"
              value={latest.leads_discovered}
              icon={UserPlus}
              color="blue"
              to="/prospecting"
              linkLabel="Leads found — view the prospecting queue"
            />
            <MetricCard
              title="Replies"
              value={latest.replies_received}
              icon={MessageSquareReply}
              color="green"
              to="/inbox"
              linkLabel="Replies — view the inbox"
            />
            <MetricCard
              title="Bounces"
              value={latest.bounces_received}
              icon={AlertTriangle}
              color="red"
              to="/dialtone?type=bounced"
              linkLabel="Bounces — view bounced sends"
            />
            <MetricCard
              title="Follow-ups"
              value={latest.follow_ups_created}
              icon={Bell}
              color="orange"
              to="/follow-ups"
              linkLabel="Follow-ups — view follow-ups"
            />
            <MetricCard
              title="Calls queued"
              value={latest.calls_queued}
              icon={Phone}
              color="teal"
              to="/calls"
              linkLabel="Calls queued — view the call queue"
            />
          </div>

          {/* Trend charts */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ChartCard title={`Send & engagement trend (last ${range} days)`} icon={TrendingUp}>
              {trend.length === 0 ? (
                <EmptyState icon={TrendingUp} title="Not enough history" description="Trends appear after a few days of activity." />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={trend} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="emails" stroke="#6366f1" strokeWidth={2} dot={false} name="Emails" />
                    <Line type="monotone" dataKey="replies" stroke="#22c55e" strokeWidth={2} dot={false} name="Replies" />
                    <Line type="monotone" dataKey="bounces" stroke="#ef4444" strokeWidth={2} dot={false} name="Bounces" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title={`Leads & calls trend (last ${range} days)`} icon={UserPlus}>
              {trend.length === 0 ? (
                <EmptyState icon={UserPlus} title="Not enough history" description="Trends appear after a few days of activity." />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={trend} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="leads" stroke="#3b82f6" strokeWidth={2} dot={false} name="Leads found" />
                    <Line type="monotone" dataKey="calls" stroke="#14b8a6" strokeWidth={2} dot={false} name="Calls queued" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          {/* Email breakdown + deliverability */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ChartCard title="Today's emails by sequence step" icon={Mail}>
              {stageRows.length === 0 ? (
                <EmptyState icon={Mail} title="No emails sent today" description="Sends broken out by sequence step will appear here."
          action={{ label: 'Start a campaign', href: '/outreach' }}
        />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={stageRows} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="stage" tick={{ fontSize: 12 }} tickFormatter={(s) => `Step ${s}`} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip labelFormatter={(s) => `Step ${s}`} />
                    <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} name="Emails" />
                  </BarChart>
                </ResponsiveContainer>
              )}
              {sequenceRows.length > 0 && (
                <div className="mt-4 space-y-1">
                  {sequenceRows.map((r) => (
                    <div key={r.sequence} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{r.sequence}</span>
                      <span className="font-medium text-gray-900">{r.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </ChartCard>

            <ChartCard title="Deliverability" icon={ShieldCheck}>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Bounce rate</p>
                  <p className="text-lg font-bold text-gray-900">{pct(deliver.bounce_rate_today)}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Reply rate</p>
                  <p className="text-lg font-bold text-gray-900">{pct(deliver.reply_rate_today)}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Avg reputation</p>
                  <p className="text-lg font-bold text-gray-900">
                    {deliver.avg_reputation != null ? `${deliver.avg_reputation}/100` : '—'}
                  </p>
                </div>
              </div>
              {accounts.length === 0 ? (
                <p className="mt-4 text-sm text-gray-400">No sending accounts assessed yet.</p>
              ) : (
                <div className="mt-4 space-y-2">
                  {accounts.map((a) => (
                    <div key={a.email} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-sm">
                      <span className="truncate text-gray-700">{a.email || 'unknown'}</span>
                      <span
                        className={cn(
                          'ml-2 rounded-full px-2 py-0.5 text-xs font-medium',
                          a.status === 'healthy' && 'bg-green-50 text-green-700',
                          a.status === 'watch' && 'bg-amber-50 text-amber-700',
                          (a.status === 'throttled' || a.status === 'critical') && 'bg-red-50 text-red-700',
                          !['healthy', 'watch', 'throttled', 'critical'].includes(a.status) && 'bg-gray-100 text-gray-500'
                        )}
                      >
                        {a.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </ChartCard>
          </div>

          {/* History table */}
          <ChartCard title="History" icon={Calendar}>
            {history.length === 0 ? (
              <EmptyState icon={Calendar} title="No history yet" description="Past daily summaries will be listed here." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                      <th className="py-2 pr-4 font-medium">Date</th>
                      <th className="py-2 pr-4 font-medium text-right">Emails</th>
                      <th className="py-2 pr-4 font-medium text-right">Leads</th>
                      <th className="py-2 pr-4 font-medium text-right">Replies</th>
                      <th className="py-2 pr-4 font-medium text-right">Bounces</th>
                      <th className="py-2 pr-4 font-medium text-right">Follow-ups</th>
                      <th className="py-2 font-medium text-right">Calls</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.date} className="border-b border-gray-50 last:border-0">
                        <td className="py-2 pr-4 font-medium text-gray-800">{shortDate(h.date)}</td>
                        <td className="py-2 pr-4 text-right text-gray-700">{h.emails_sent}</td>
                        <td className="py-2 pr-4 text-right text-gray-700">{h.leads_discovered}</td>
                        <td className="py-2 pr-4 text-right text-gray-700">{h.replies_received}</td>
                        <td className="py-2 pr-4 text-right text-gray-700">{h.bounces_received}</td>
                        <td className="py-2 pr-4 text-right text-gray-700">{h.follow_ups_created}</td>
                        <td className="py-2 text-right text-gray-700">{h.calls_queued}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ChartCard>
        </>
      )}
    </div>
  );
}
