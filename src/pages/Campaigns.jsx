import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AlertTriangle, FileText, Plus, Rocket, Trash2 } from 'lucide-react';
import { useCampaigns, useDeleteCampaign, isNotAvailable } from '../hooks/useCampaigns';
import { errMsg } from '../hooks/useDiscoveryDocuments';
import { formatDate, formatNumber } from '../lib/utils';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import Skeleton from '../components/Skeleton';
import { CampaignStatusBadge } from '../components/campaigns/StatusBadge';

function ListSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm" data-testid="campaigns-skeleton" aria-busy="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-3">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="ml-auto h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

function docLabel(c) {
  const n = c.documents.length;
  if (!n) return '—';
  const first = c.documents[0]?.filename;
  if (n === 1) return first || '1 document';
  return first ? `${first} +${n - 1}` : `${n} documents`;
}

function DeleteButton({ campaign, busy, onClick }) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={(e) => {
        // Rows and cards navigate on click; deleting must not open the campaign.
        e.preventDefault();
        e.stopPropagation();
        onClick(campaign);
      }}
      aria-label={`Delete ${campaign.name}`}
      title="Delete campaign"
      className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

export default function Campaigns() {
  const navigate = useNavigate();
  const { data: campaigns = [], isLoading, error, refetch } = useCampaigns();
  const open = (id) => navigate(`/campaigns/${id}`);
  const newCampaign = () => navigate('/campaigns/new');
  const { remove, deletingId } = useDeleteCampaign();
  const [confirming, setConfirming] = useState(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Autopilot Campaigns</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Give Autopilot a document about what you sell. It builds an ideal customer profile, finds matching
            companies and decision-makers, and emails them within the limits you set.
          </p>
        </div>
        <button
          type="button"
          onClick={newCampaign}
          className="inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          New Campaign
        </button>
      </div>

      {isLoading && <ListSkeleton />}

      {error && isNotAvailable(error) && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <EmptyState
            icon={Rocket}
            title="Autopilot campaigns are coming soon"
            description="This server doesn’t have Autopilot Outreach switched on yet. Check back shortly."
          />
        </div>
      )}

      {error && !isNotAvailable(error) && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
          <div>
            <p className="font-medium text-red-800">Couldn&apos;t load campaigns</p>
            <p className="mt-1">{errMsg(error, 'Please try again.')}</p>
            <button type="button" onClick={() => refetch()} className="mt-2 font-medium underline">
              Retry
            </button>
          </div>
        </div>
      )}

      {!isLoading && !error && campaigns.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <EmptyState
            icon={Rocket}
            title="No campaigns yet"
            description="Start one from a pitch deck, one-pager or price list — Autopilot works out who to contact from it."
            action={{ label: 'New Campaign', onClick: newCampaign }}
          />
        </div>
      )}

      {!isLoading && !error && campaigns.length > 0 && (
        <>
          {/* Phones: one card per campaign. */}
          <ul className="space-y-3 sm:hidden" aria-label="Campaigns">
            {campaigns.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/campaigns/${c.id}`}
                  className="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-indigo-200"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-gray-900">{c.name}</p>
                    <div className="flex flex-shrink-0 items-center gap-1">
                      <CampaignStatusBadge status={c.status} />
                      <DeleteButton campaign={c} busy={deletingId === c.id} onClick={setConfirming} />
                    </div>
                  </div>
                  <p className="mt-1 flex items-center gap-1 truncate text-xs text-gray-500">
                    <FileText className="h-3 w-3 flex-shrink-0" />
                    {docLabel(c)}
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{formatNumber(c.metrics.total_prospects)}</p>
                      <p className="text-[11px] text-gray-500">Prospects</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{formatNumber(c.metrics.emails_sent)}</p>
                      <p className="text-[11px] text-gray-500">Sent</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{formatDate(c.created_at)}</p>
                      <p className="text-[11px] text-gray-500">Created</p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm sm:block">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Name', 'Status', 'Documents', 'Prospects Found', 'Emails Sent', 'Created'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      {h}
                    </th>
                  ))}
                  <th className="px-4 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {campaigns.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => open(c.id)}
                    className="cursor-pointer hover:bg-gray-50"
                    data-testid="campaign-row"
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/campaigns/${c.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-sm font-medium text-gray-900 hover:text-indigo-600"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <CampaignStatusBadge status={c.status} />
                    </td>
                    <td className="max-w-[16rem] truncate px-4 py-3 text-sm text-gray-600">{docLabel(c)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">{formatNumber(c.metrics.total_prospects)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">{formatNumber(c.metrics.emails_sent)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{formatDate(c.created_at)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <DeleteButton campaign={c} busy={deletingId === c.id} onClick={setConfirming} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ConfirmDialog
        open={Boolean(confirming)}
        title={`Delete “${confirming?.name ?? ''}”?`}
        message="Autopilot stops searching and sending for this campaign, and drafts not yet sent are discarded. Emails already sent stay on record, so those people are never emailed again by another campaign."
        confirmLabel="Delete campaign"
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          const id = confirming.id;
          setConfirming(null);
          remove(id);
        }}
      />
    </div>
  );
}
