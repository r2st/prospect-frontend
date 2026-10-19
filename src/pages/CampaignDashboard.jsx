import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Check,
  CheckCheck,
  Clock,
  Eye,
  FileText,
  Mail,
  MessageSquareReply,
  Pause,
  Pencil,
  Play,
  Search,
  ShieldCheck,
  SkipForward,
  Square,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  isNotAvailable,
  useCampaign,
  useCampaignActions,
  useCampaignProspects,
  useDiscoverMore,
  useUpdateCampaign,
} from '../hooks/useCampaigns';
import { errMsg } from '../hooks/useDiscoveryDocuments';
import {
  EMAIL_ORIGIN,
  PROSPECT_STATUS,
  canPause,
  canResume,
  canStop,
  emailVerification,
  formatPercent,
  sendWindowNotice,
} from '../lib/campaigns';
import { cn, formatDate, formatNumber } from '../lib/utils';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import ErrorBoundary from '../components/ErrorBoundary';
import MetricCard from '../components/MetricCard';
import Skeleton from '../components/Skeleton';
import EmailPreviewModal from '../components/campaigns/EmailPreviewModal';
import AddContactModal from '../components/campaigns/AddContactModal';
import ContactEditModal from '../components/campaigns/ContactEditModal';
import SenderLine from '../components/campaigns/SenderLine';
import TemplatePanel from '../components/campaigns/TemplatePanel';
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

const SENT = ['sending', 'sent', 'replied', 'bounced'];

// Approved emails don't go out outside the send window; say when they will.
function SendWindowBanner({ campaign }) {
  const update = useUpdateCampaign(campaign.id);
  const notice = sendWindowNotice(campaign);
  if (!notice) return null;
  const n = notice.waiting;
  return (
    <div role="status" data-testid="send-window-banner"
      className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Clock className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
        <p>
          <span className="font-medium">
            {n} approved email{n === 1 ? ' is' : 's are'} waiting for the send window
            {notice.opensAt ? ` — next opens ${notice.opensAt}` : ''}.
          </span>{' '}
          This campaign sends {notice.schedule}.
        </p>
      </div>
      {notice.canSendWeekends && (
        <button
          type="button"
          disabled={update.isPending}
          onClick={() => update.mutate({ send_on_weekends: true })}
          className="flex-shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
        >
          {update.isPending ? 'Saving…' : 'Send on weekends too'}
        </button>
      )}
    </div>
  );
}

// The quick-approve flow: how many drafts wait, and one click to approve every
// one with a verified address. Unverified drafts stay for a person to check.
function DraftsPendingBanner({ count, actions }) {
  if (!count) return null;
  return (
    <div role="status" data-testid="drafts-pending-banner"
      className="flex flex-col gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="inline-flex min-w-[2rem] items-center justify-center rounded-full bg-indigo-600 px-2 py-1 text-sm font-semibold text-white">
          {count}
        </span>
        <p>
          <span className="font-medium">draft{count === 1 ? '' : 's'} pending review.</span>{' '}
          Nothing is sent until approved. Approve all sends only verified addresses.
        </p>
      </div>
      <button
        type="button"
        disabled={actions.isBulkApproving}
        onClick={() => actions.bulkApprove({ verified_only: true })}
        className="inline-flex flex-shrink-0 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
      >
        <CheckCheck className="h-4 w-4" />
        {actions.isBulkApproving ? 'Approving…' : 'Approve all'}
      </button>
    </div>
  );
}

function SelectBox({ checked, indeterminate = false, onChange, label }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      ref={(el) => { if (el) el.indeterminate = indeterminate; }}
      onChange={onChange}
      aria-label={label}
      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
    />
  );
}

function ProspectActions({ p, busy, onApprove, onSkip, onPreview, onEditContact, onAddAtCompany }) {
  const label = p.contact_name || p.company_name;
  const editable = !SENT.includes(p.status);
  return (
    <div className="flex items-center justify-end gap-1">
      {editable && onEditContact && (
        <button
          type="button"
          onClick={() => onEditContact(p)}
          aria-label={p.contact_id ? `Edit contact ${label}` : `Add contact at ${p.company_name}`}
          title={p.contact_id ? 'Edit contact' : 'Add contact'}
          className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        >
          {p.contact_id ? <Pencil className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
        </button>
      )}
      {p.contact_id && onAddAtCompany && p.company_id && (
        <button
          type="button"
          onClick={() => onAddAtCompany(p)}
          aria-label={`Add another contact at ${p.company_name}`}
          title="Add another contact at this company"
          className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        >
          <Users className="h-4 w-4" />
        </button>
      )}
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

function ProspectTable({ campaignId, actions, attachments = [], sender = null, draftsPending = 0 }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  // Draft ids picked for "Approve selected". Only drafts can be picked.
  const [selected, setSelected] = useState(() => new Set());
  const [previewing, setPreviewing] = useState(null);
  const [editing, setEditing] = useState(null);
  const [addingAt, setAddingAt] = useState(null);
  const { data, isLoading, error, isFetching } = useCampaignProspects(campaignId, { page, pageSize: PAGE_SIZE, status });
  const items = data?.items ?? [];
  const pages = data?.pages ?? 1;

  const approve = (p) => actions.approve(p.id, { onSuccess: () => setPreviewing(null) });
  const skip = (p) => actions.skip(p.id, { onSuccess: () => setPreviewing(null) });
  const busyFor = (p) => actions.pendingProspect === p.id;

  const draftsOnPage = items.filter((p) => p.status === 'draft');
  // Drop ids that stopped being drafts (approved one by one, re-filtered away).
  const pickable = new Set(draftsOnPage.map((p) => p.id));
  const picked = [...selected].filter((pid) => pickable.has(pid));
  const allPicked = draftsOnPage.length > 0 && picked.length === draftsOnPage.length;
  const togglePick = (pid) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(pid)) next.delete(pid); else next.add(pid);
    return next;
  });
  const toggleAll = () => setSelected(allPicked ? new Set() : new Set(draftsOnPage.map((p) => p.id)));
  const approveSelected = () =>
    // An explicit pick is approved as picked, like the per-row button.
    actions.bulkApprove({ prospect_ids: picked, verified_only: false }, { onSuccess: () => setSelected(new Set()) });
  // The open preview follows refetches, so a re-draft or a save shows at once.
  const shown = previewing ? items.find((p) => p.id === previewing.id) || previewing : null;

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
                setSelected(new Set());
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

      {(picked.length > 0 || draftsPending > 0) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2.5 text-sm" data-testid="bulk-approve-bar">
          {picked.length > 0 ? (
            <>
              <span className="font-medium text-gray-900">{picked.length} selected</span>
              <button
                type="button"
                disabled={actions.isBulkApproving}
                onClick={approveSelected}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" />
                Approve selected
              </button>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="rounded-lg px-2 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-800"
              >
                Clear
              </button>
            </>
          ) : (
            <span className="text-gray-600">
              {draftsPending} draft{draftsPending === 1 ? '' : 's'} pending — tick rows to approve some, or
            </span>
          )}
          <button
            type="button"
            disabled={actions.isBulkApproving}
            onClick={() => actions.bulkApprove({ verified_only: true })}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50',
              picked.length > 0
                ? 'ml-auto border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            )}
            title="Approves every draft with a verified address; unverified ones stay as drafts"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Approve all drafts
          </button>
        </div>
      )}

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
                  {p.status === 'draft' && (
                    <span className="pt-0.5">
                      <SelectBox checked={selected.has(p.id)} onChange={() => togglePick(p.id)}
                        label={`Select ${p.contact_name || p.company_name}`} />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
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
                  <ProspectActions onEditContact={setEditing} onAddAtCompany={setAddingAt} p={p} busy={busyFor(p)} onApprove={approve} onSkip={skip} onPreview={setPreviewing} />
                </div>
              </li>
            ))}
          </ul>

          <div className={cn('hidden overflow-x-auto sm:block', isFetching && 'opacity-70')}>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-10 px-4 py-3">
                    {draftsOnPage.length > 0 && (
                      <SelectBox
                        checked={allPicked}
                        indeterminate={picked.length > 0 && !allPicked}
                        onChange={toggleAll}
                        label="Select all drafts on this page"
                      />
                    )}
                  </th>
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
                  <tr key={p.id} className={cn('hover:bg-gray-50', selected.has(p.id) && 'bg-indigo-50/50')} data-testid="prospect-row">
                    <td className="w-10 px-4 py-3">
                      {p.status === 'draft' && (
                        <SelectBox checked={selected.has(p.id)} onChange={() => togglePick(p.id)}
                          label={`Select ${p.contact_name || p.company_name}`} />
                      )}
                    </td>
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
                      <ProspectActions onEditContact={setEditing} onAddAtCompany={setAddingAt} p={p} busy={busyFor(p)} onApprove={approve} onSkip={skip} onPreview={setPreviewing} />
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
                onClick={() => { setPage((n) => n - 1); setSelected(new Set()); }}
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
                onClick={() => { setPage((n) => n + 1); setSelected(new Set()); }}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      <EmailPreviewModal
        key={shown?.id || 'closed'}
        prospect={shown}
        onClose={() => setPreviewing(null)}
        onApprove={approve}
        onSkip={skip}
        busy={shown ? busyFor(shown) : false}
        attachments={attachments}
        campaignId={campaignId}
        sender={sender}
      />
      {editing && <ContactEditModal campaignId={campaignId} prospect={editing} onClose={() => setEditing(null)} />}
      {addingAt && (
        <AddContactModal
          campaignId={campaignId}
          initial={{ company_name: addingAt.company_name, domain: addingAt.company_domain || '' }}
          onClose={() => setAddingAt(null)}
        />
      )}
    </div>
  );
}

export default function CampaignDashboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: campaign, isLoading, error, refetch } = useCampaign(id);
  const actions = useCampaignActions(id);
  const discover = useDiscoverMore(id);
  const [confirm, setConfirm] = useState(null); // 'stop' | 'delete'
  const [adding, setAdding] = useState(false);

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
          <SenderLine sender={campaign.sender || null} className="mt-1.5" />
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
            {campaign.documents.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" />
                {campaign.documents.map((d) => d.filename).filter(Boolean).join(', ') ||
                  `${campaign.documents.length} document(s)`}
              </span>
            )}
            <span>
              Up to {campaign.settings.daily_limit}/day after warm-up · sends on approval
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
          {status !== 'stopped' && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              <UserPlus className="h-4 w-4" />
              Add contact
            </button>
          )}
          {status === 'active' && (
            <button
              type="button"
              disabled={discover.isPending}
              onClick={() => discover.mutate()}
              className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-4 py-2 text-sm font-medium text-indigo-700 shadow-sm hover:bg-indigo-50 disabled:opacity-50"
            >
              <Search className="h-4 w-4" />
              {discover.isPending ? 'Starting…' : 'Find more prospects'}
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

      <SendWindowBanner campaign={campaign} />

      {status !== 'stopped' && <DraftsPendingBanner count={metrics.drafts_pending} actions={actions} />}

      <TemplatePanel key={`${campaign.template_id || ''}:${campaign.template_mode || ''}`} campaign={campaign} draftsPending={campaign.metrics?.drafts_pending || 0} />

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
        <ProspectTable campaignId={id} actions={actions} attachments={campaign.attachments || []}
          sender={campaign.sender || null} draftsPending={status === 'stopped' ? 0 : metrics.drafts_pending} />
      </ErrorBoundary>

      {adding && <AddContactModal campaignId={id} onClose={() => setAdding(false)} />}

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
