import { useState, useEffect } from 'react';
import { X, Search, Building2 } from 'lucide-react';
import { DEAL_STATUSES, DEAL_STATUS_LABELS, DEAL_STAGES, DEAL_STAGE_LABELS, DEAL_STAGE_PROBABILITIES } from '../lib/constants';
import { useCompanies } from '../hooks/useCompanies';

// Add/edit deal modal. Pass `deal` to edit, omit to create.
// When `companyId` is not provided (Pipeline page), shows a company search/select.
export default function DealModal({ open, onClose, onSubmit, deal, companyId, saving }) {
  const [form, setForm] = useState({
    title: '', value: '', status: 'pending', deal_stage: 'qualification', close_date: '', notes: '',
  });
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [companySearch, setCompanySearch] = useState('');

  // Only fetch companies when we need the picker (no companyId prop and not editing)
  const needCompanyPicker = !companyId && !deal;
  const { data: companiesData } = useCompanies(
    needCompanyPicker && open ? { search: companySearch || undefined, page_size: 20 } : {}
  );
  const companies = companiesData?.items || companiesData || [];

  useEffect(() => {
    if (open) {
      setForm({
        title: deal?.title || '',
        value: deal?.value ?? '',
        status: deal?.status || 'pending',
        deal_stage: deal?.deal_stage || 'qualification',
        close_date: deal?.close_date ? String(deal.close_date).slice(0, 10) : '',
        notes: deal?.notes || '',
      });
      setSelectedCompanyId(deal?.company_id || companyId || null);
      setCompanySearch('');
    }
  }, [open, deal, companyId]);

  if (!open) return null;

  const effectiveCompanyId = companyId || selectedCompanyId;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    if (!effectiveCompanyId) return;
    const payload = {
      company_id: effectiveCompanyId,
      title: form.title.trim(),
      value: form.value === '' ? null : Number(form.value),
      status: form.status,
      deal_stage: form.deal_stage,
      close_date: form.close_date || null,
      notes: form.notes.trim() || null,
    };
    onSubmit(payload);
  };

  const selectedCompany = selectedCompanyId && Array.isArray(companies)
    ? companies.find(c => String(c.id) === String(selectedCompanyId))
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative flex max-h-[92vh] w-full max-w-md flex-col overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl sm:max-h-[90vh] sm:rounded-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{deal ? 'Edit Deal' : 'Add Deal'}</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Company selector (when no companyId prop) */}
          {needCompanyPicker && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Company *</label>
              {selectedCompanyId && selectedCompany ? (
                <div className="flex items-center justify-between rounded-lg border border-green-300 bg-green-50 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-gray-900">{selectedCompany.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedCompanyId(null)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={companySearch}
                      onChange={(e) => setCompanySearch(e.target.value)}
                      placeholder="Search companies..."
                      className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  {Array.isArray(companies) && companies.length > 0 && (
                    <div className="max-h-32 overflow-y-auto rounded-lg border border-gray-200">
                      {companies.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedCompanyId(c.id)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <Building2 className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                          <span className="truncate">{c.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Title *</label>
            <input
              type="text"
              required
              autoFocus={!!companyId}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Annual contract renewal"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Value (USD)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="25000"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {DEAL_STATUSES.map((s) => (
                  <option key={s} value={s}>{DEAL_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Pipeline Stage</label>
            <select
              value={form.deal_stage}
              onChange={(e) => setForm({ ...form, deal_stage: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {DEAL_STAGES.map((s) => (
                <option key={s} value={s}>{DEAL_STAGE_LABELS[s]} ({DEAL_STAGE_PROBABILITIES[s]}%)</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Close date</label>
            <input
              type="date"
              value={form.close_date}
              onChange={(e) => setForm({ ...form, close_date: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Any relevant notes..."
            />
          </div>
          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || (!effectiveCompanyId && !deal)}
              className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-600 disabled:opacity-50"
            >
              {deal ? 'Save Changes' : 'Add Deal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
