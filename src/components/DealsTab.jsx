import { useState } from 'react';
import { Plus, Pencil, Trash2, DollarSign } from 'lucide-react';
import EmptyState from './EmptyState';
import DealModal from './DealModal';
import { useCompanyDeals, useCreateDeal, useUpdateDeal, useDeleteDeal } from '../hooks/useDeals';
import { DEAL_STATUSES, DEAL_STATUS_LABELS, DEAL_STATUS_COLORS } from '../lib/constants';
import { formatCurrency, formatDate, cn } from '../lib/utils';

// Won/pending/lost summary strip above the deals table.
function PipelineMini({ deals }) {
  const totals = { won: 0, pending: 0, lost: 0 };
  for (const d of deals) {
    if (totals[d.status] != null) totals[d.status] += Number(d.value) || 0;
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {DEAL_STATUSES.map((s) => {
        const palette = DEAL_STATUS_COLORS[s];
        const count = deals.filter((d) => d.status === s).length;
        return (
          <div key={s} className={cn('rounded-lg border p-3', palette.border, palette.bg)}>
            <p className={cn('text-xs font-semibold uppercase tracking-wider', palette.text)}>{DEAL_STATUS_LABELS[s]}</p>
            <p className="mt-1 text-lg font-bold text-gray-900">{formatCurrency(totals[s], { compact: true })}</p>
            <p className="text-xs text-gray-500">{count} deal{count === 1 ? '' : 's'}</p>
          </div>
        );
      })}
    </div>
  );
}

export default function DealsTab({ companyId }) {
  const { data: deals = [], isLoading } = useCompanyDeals(companyId);
  const createDeal = useCreateDeal();
  const updateDeal = useUpdateDeal();
  const deleteDeal = useDeleteDeal();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const openAdd = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (d) => { setEditing(d); setModalOpen(true); };

  const handleSubmit = (payload) => {
    if (editing) updateDeal.mutate({ id: editing.id, data: payload }, { onSuccess: () => setModalOpen(false) });
    else createDeal.mutate(payload, { onSuccess: () => setModalOpen(false) });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Deals</h3>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-600"
        >
          <Plus className="h-4 w-4" />
          Add Deal
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600" />
        </div>
      ) : deals.length === 0 ? (
        <EmptyState
          icon={DollarSign}
          title="No deals yet"
          description="Track revenue opportunities for this client by adding a deal."
          action={{ label: 'Add Deal', onClick: openAdd }}
        />
      ) : (
        <>
          <PipelineMini deals={deals} />

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Title</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Value</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Close Date</th>
                  <th className="w-20 px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {deals.map((d) => {
                  const palette = DEAL_STATUS_COLORS[d.status] || DEAL_STATUS_COLORS.pending;
                  return (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{d.title}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">{formatCurrency(d.value)}</td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', palette.bg, palette.text)}>
                          {DEAL_STATUS_LABELS[d.status] || d.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{d.close_date ? formatDate(d.close_date) : '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" onClick={() => openEdit(d)} title="Edit" className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => deleteDeal.mutate(d.id)} title="Delete" className="rounded-md p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <DealModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        deal={editing}
        companyId={companyId}
        saving={createDeal.isPending || updateDeal.isPending}
      />
    </div>
  );
}
