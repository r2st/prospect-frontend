import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Check,
  Clock,
  Eye,
  FileText,
  Mail,
  MessageSquareReply,
  Pause,
  Play,
  ShieldCheck,
  SkipForward,
  Square,
  Trash2,
  Users,
} from 'lucide-react';
import { useCampaign, useCampaignActions, useCampaignProspects, isNotAvailable } from '../hooks/useCampaigns';
import { errMsg } from '../hooks/useDiscoveryDocuments';
import { EMAIL_ORIGIN, PROSPECT_STATUS, canPause, canResume, canStop, emailVerification, formatPercent } from '../lib/campaigns';
import { cn, formatDate, formatNumber } from '../lib/utils';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import ErrorBoundary from '../components/ErrorBoundary';
import MetricCard from '../components/MetricCard';
import Skeleton from '../components/Skeleton';
import EmailPreviewModal from '../components/campaigns/EmailPreviewModal';
import { CampaignStatusBadge, ProspectStatusBadge } from '../components/campaigns/StatusBadge';

const PAGE_SIZE = 25;
const FILTERS = [{ key: '', label: 'All' }, ...Object.entries(PROSPECT_STATUS).map(([key, m]) => ({ key, label: m.label }))];

function SectionFallback({ reset }) {
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">
      This section hit an unexpected error.{' '}
      <button type="button" onClick={reset} className="font-medium underline">
        Try again
      </button>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" data-testid="campaign-skeleton" aria-busy="true">
      <Skeleton className="h-7 w-64" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

function DailyChart({ data }) {
  const rows = data.map((d) => ({
    ...d,
    label: d.date ? new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
  }));
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-sm font-semibold text-gray-900">Daily activity</h2>
      <p className="text-xs text-gray-500">Emails sent per day</p>
      {rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500" data-testid="chart-empty">
          No emails sent yet. Bars appear here after the first send window.
        </p>
      ) : (
        <div className="mt-4 h-56" data-testid="daily-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 0, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip formatter={(v) => [v, 'Sent']} cursor={{ fill: '#eef2ff' }} />
              <Bar dataKey="sent" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function VerificationBadge({ p }) {
  const v = emailVerification(p);
  if (!v) return null;
  const origin = EMAIL_ORIGIN[p.email_origin];
  return (
    <span
      className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium', v.className)}
      title={origin ? `${origin}. Only verified addresses are sent.` : 'Only verified addresses are sent.'}
      data-testid="email-verification"
    >
      {v.label}
    </span>
  );
}

function ProspectEmail({ p }) {
  if (!p.contact_email) return null;
  const origin = EMAIL_ORIGIN[p.email_origin];
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
      <span className="truncate">{p.contact_email}</span>
      <VerificationBadge p={p} />
      {origin && <span className="text-[11px] text-gray-400">· {origin}</span>}
    </span>
  );
}

function ProspectActions({ p, busy, onApprove, onSkip, onPreview }) {
  const label = p.contact_name || p.company_name;
  return (
    <div className="flex items-center justify-end gap-1">
      {p.status === 'draft' && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onApprove(p)}
          aria-label={`Approve email to ${label}`}
          className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" />
          Approve
        </button>
      )}
      {(p.status === 'draft' || p.status === 'queued') && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onSkip(p)}
          aria-label={`Skip ${label}`}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
        >
          <SkipForward className="h-3.5 w-3.5" />
          Skip
        </button>
      )}
      <button
        type="button"
        onClick={() => onPreview(p)}
        aria-label={`Preview email to ${label}`}
        className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
      >
        <Eye className="h-4 w-4" />
      </button>
    </div>
  );
}

function ProspectTable({ campaignId, actions }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [previewing, setPreviewing] = useState(null);
  const { data, isLoading, error, isFetching } = useCampaignProspects(campaignId, { page, pageSize: PAGE_SIZE, status });
  const items = data?.items ?? [];
  const pages = data?.pages ?? 1;

  const approve = (p) => actions.approve(p.id, { onSuccess: () => setPreviewing(null) });
  const skip = (p) => actions.skip(p.id, { onSuccess: () => setPreviewing(null) });
  const busyFor = (p) => actions.pendingProspect === p.id;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Prospects</h2>
          {data && <p className="text-xs text-gray-500">{formatNumber(data.total)} total</p>}
        </div>
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1" role="group" aria-label="Filter by email status">
          {FILTERS.map((f) => (
            <button
              key={f.key || 'all'}
              type="button"
              aria-pressed={status === f.key}
              onClick={() => {
                setStatus(f.key);
                setPage(1);
              }}
              className={cn(
                'flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium',
                status === f.key ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="space-y-3 p-4" data-testid="prospects-skeleton">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8" />
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="p-4 text-sm text-red-700">
          {errMsg(error, 'Couldn’t load prospects.')}
        </p>
      )}

      {!isLoading && !error && items.length === 0 && (
        <EmptyState
          icon={Users}
          title={status ? `No ${PROSPECT_STATUS[status]?.label.toLowerCase()} prospects` : 'No prospects yet'}
          description={
            status
              ? 'Try another filter.'
              : 'Autopilot is searching for companies that match your ideal customer profile. They’ll appear here as they’re found.'
          }
        />
      )}

      {!isLoading && !error && items.length > 0 && (
        <>
          {/* Phones: stacked rows. */}
          <ul className="divide-y divide-gray-100 sm:hidden">
            {items.map((p) => (
              <li key={p.id} className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">{p.company_name}</p>
                    <p className="truncate text-xs text-gray-500">
                      {p.contact_name || 'No contact yet'}
                      {p.contact_title && ` · ${p.contact_title}`}
                    </p>
                    <ProspectEmail p={p} />
                  </div>
                  <ProspectStatusBadge status={p.status} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{p.sent_at ? `Sent ${formatDate(p.sent_at)}` : 'Not sent'}</span>
                  <ProspectActions p={p} busy={busyFor(p)} onApprove={approve} onSkip={skip} onPreview={setPreviewing} />
                </div>
              </li>
            ))}
          </ul>

          <div className={cn('hidden overflow-x-auto sm:block', isFetching && 'opacity-70')}>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Company', 'Contact', 'Email Status', 'Sent Date'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      {h}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50" data-testid="prospect-row">
                    <td className="px-4 py-3">
                      {p.company_id ? (
                        <Link to={`/companies/${p.company_id}`} className="text-sm font-medium text-gray-900 hover:text-indigo-600">
                          {p.company_name}
                        </Link>
                      ) : (
                        <p className="text-sm font-medium text-gray-900">{p.company_name}</p>
                      )}
                      {p.company_domain && <p className="text-xs text-gray-500">{p.company_domain}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-900">{p.contact_name || '—'}</p>
                      {p.contact_title && <p className="text-xs text-gray-500">{p.contact_title}</p>}
                      <ProspectEmail p={p} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <ProspectStatusBadge status={p.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{formatDate(p.sent_at)}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <ProspectActions p={p} busy={busyFor(p)} onApprove={approve} onSkip={skip} onPreview={setPreviewing} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-sm">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((n) => n - 1)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-xs text-gray-500">
                Page {page} of {pages}
              </span>
              <button
                type="button"
                disabled={page >= pages}
                onClick={() => setPage((n) => n + 1)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      <EmailPreviewModal
        prospect={previewing}
        onClose={() => setPreviewing(null)}
        onApprove={approve}
        onSkip={skip}
        busy={previewing ? busyFor(previewing) : false}
      />
    </div>
  );
}

export default function CampaignDashboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: campaign, isLoading, error, refetch } = useCampaign(id);
  const actions = useCampaignActions(id);
  const [confirm, setConfirm] = useState(null); // 'stop' | 'delete'

  if (isLoading) return <DashboardSkeleton />;

  if (error || !campaign) {
    return (
      <div className="space-y-4">
        <Link to="/campaigns" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> All campaigns
        </Link>
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
          <div>
            <p className="font-medium text-red-800">
              {isNotAvailable(error) ? 'Campaign not found' : 'Couldn’t load this campaign'}
            </p>
            <p className="mt-1">
              {isNotAvailable(error) ? 'It may have been deleted.' : errMsg(error, 'Please try again.')}
            </p>
            {!isNotAvailable(error) && (
              <button type="button" onClick={() => refetch()} className="mt-2 font-medium underline">
                Retry
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const { status, metrics } = campaign;
  // Not launched yet — the wizard is where it gets finished.
  const unlaunched = ['draft', 'analyzing', 'ready'].includes(status);
  const busy = actions.isUpdating;

  return (
    <div className="space-y-6">
      <Link to="/campaigns" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> All campaigns
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="truncate text-2xl font-bold text-gray-900">{campaign.name}</h1>
            <CampaignStatusBadge status={status} />
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
            {campaign.documents.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" />
                {campaign.documents.map((d) => d.filename).filter(Boolean).join(', ') ||
                  `${campaign.documents.length} document(s)`}
              </span>
            )}
            <span>
              Up to {campaign.settings.daily_limit}/day · {campaign.settings.send_window_start}–
              {campaign.settings.send_window_end}
              {campaign.settings.send_on_weekends ? ' incl. weekends' : ' weekdays'}
            </span>
            {campaign.created_at && <span>Created {formatDate(campaign.created_at)}</span>}
          </p>
        </div>

        <div className="flex flex-shrink-0 flex-wrap gap-2">
          {unlaunched && (
            <button
              type="button"
              onClick={() => navigate(`/campaigns/new?id=${campaign.id}`)}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
            >
              <Play className="h-4 w-4" />
              Finish setup
            </button>
          )}
          {canPause(status) && (
            <button
              type="button"
              disabled={busy}
              onClick={() => actions.pause()}
              className="inline-flex items-center gap-2 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-2 text-sm font-medium text-yellow-800 hover:bg-yellow-100 disabled:opacity-50"
            >
              <Pause className="h-4 w-4" />
              {actions.pendingStatus === 'paused' ? 'Pausing…' : 'Pause'}
            </button>
          )}
          {canResume(status) && (
            <button
              type="button"
              disabled={busy}
              onClick={() => actions.resume()}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              {actions.pendingStatus === 'active' ? 'Resuming…' : 'Resume'}
            </button>
          )}
          {canStop(status) && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirm('stop')}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              <Square className="h-4 w-4" />
              Stop
            </button>
          )}
          {!canStop(status) && (
            <button
              type="button"
              disabled={actions.isDeleting}
              onClick={() => setConfirm('delete')}
              aria-label="Delete campaign"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {status === 'active' && campaign.settings.review_before_send && metrics.drafts_pending > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-800">
          <Mail className="mt-0.5 h-5 w-5 flex-shrink-0 text-indigo-500" />
          <p>
            <span className="font-medium">{metrics.drafts_pending} draft(s) waiting for your review.</span> Nothing is sent
            until you approve it — filter the table below by Draft.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard title="Total Prospects" value={formatNumber(metrics.total_prospects)} icon={Users} color="indigo" />
        <MetricCard title="Emails Sent" value={formatNumber(metrics.emails_sent)} icon={Mail} color="blue" />
        <MetricCard
          title="Replies"
          value={formatNumber(metrics.replies)}
          subtitle={metrics.emails_sent ? `${formatPercent(metrics.replies / metrics.emails_sent)} reply rate` : undefined}
          icon={MessageSquareReply}
          color="green"
        />
        <MetricCard
          title="Bounce Rate"
          value={formatPercent(metrics.bounce_rate)}
          subtitle={metrics.bounced ? `${formatNumber(metrics.bounced)} bounced` : undefined}
          icon={AlertTriangle}
          color={metrics.bounce_rate > 0.05 ? 'red' : 'orange'}
        />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-900">Discovery &amp; send queue</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" data-testid="discovery-metrics">
          <MetricCard
            title="Companies Discovered"
            value={formatNumber(metrics.companies_discovered)}
            subtitle={
              metrics.companies_without_email
                ? `${formatNumber(metrics.companies_without_email)} without an email yet`
                : undefined
            }
            icon={Building2}
            color="purple"
          />
          <MetricCard
            title="Queued to Send"
            value={formatNumber(metrics.queued_to_send)}
            subtitle="Drafted and approved"
            icon={Clock}
            color="teal"
          />
          <MetricCard
            title="Verified Emails"
            value={formatNumber(metrics.pending_verified)}
            subtitle="Cleared to send"
            icon={ShieldCheck}
            color="green"
          />
          <MetricCard
            title="Awaiting Verification"
            value={formatNumber(metrics.pending_unverified)}
            subtitle="Held until Hunter verifies"
            icon={AlertTriangle}
            color="yellow"
          />
        </div>
      </div>

      <ErrorBoundary resetKey={`${id}:chart`} fallback={({ reset }) => <SectionFallback reset={reset} />}>
        <DailyChart data={campaign.daily} />
      </ErrorBoundary>

      <ErrorBoundary resetKey={`${id}:prospects`} fallback={({ reset }) => <SectionFallback reset={reset} />}>
        <ProspectTable campaignId={id} actions={actions} />
      </ErrorBoundary>

      <ConfirmDialog
        open={confirm === 'stop'}
        title="Stop this campaign?"
        message="Autopilot stops finding prospects and sending emails for good. Emails already sent aren’t affected. To take a break instead, use Pause."
        confirmLabel="Stop campaign"
        onCancel={() => setConfirm(null)}
        onConfirm={() => actions.stop({ onSettled: () => setConfirm(null) })}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        title="Delete this campaign?"
        message="The campaign and its prospect list are removed. Companies and contacts it added to Prospect stay."
        confirmLabel="Delete campaign"
        onCancel={() => setConfirm(null)}
        onConfirm={() =>
          actions.remove({
            onSuccess: () => navigate('/campaigns'),
            onSettled: () => setConfirm(null),
          })
        }
      />
    </div>
  );
}
