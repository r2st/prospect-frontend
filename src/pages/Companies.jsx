import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  Plus,
  Download,
  Target,
  X,
  Filter,
  Trash2,
  FolderPlus,
  ArrowRightLeft,
  XCircle,
  Send,
  Tag,
  LayoutList,
  LayoutGrid,
  MapPin,
  Users,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Building2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import DataTable from '../components/DataTable';
import ScoreBadge from '../components/ScoreBadge';
import EmptyState from '../components/EmptyState';
import PrimaryContact from '../components/PrimaryContact';
import { useCompanies, useCreateCompany, useDeleteCompany } from '../hooks/useCompanies';
import { useGroups, useAddGroupMembers } from '../hooks/useGroups';
import { useSequences } from '../hooks/useOutreach';
import { pipelineApi, contactsApi, companiesApi, outreachApi, queryClient } from '../api/client';
import { STAGES, STAGE_LABELS, STAGE_COLORS, COUNTRIES, SOURCES, SOURCE_LABELS } from '../lib/constants';
import { formatNumber, formatDate, pickPrimaryContact, cn } from '../lib/utils';

function AddCompanyModal({ open, onClose, onCreate }) {
  const [form, setForm] = useState({
    name: '',
    domain: '',
    city: '',
    state: '',
    country: 'US',
    employees: '',
    industry: '',
    source: 'manual',
  });

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onCreate({
      ...form,
      employees: form.employees ? Number(form.employees) : null,
    });
    setForm({ name: '', domain: '', city: '', state: '', country: 'US', employees: '', industry: '', source: 'manual' });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl sm:max-h-[90vh] sm:rounded-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Add Company</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="col-span-1 sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Company Name *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Acme Corporation"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Domain</label>
              <input
                type="text"
                value={form.domain}
                onChange={(e) => setForm({ ...form, domain: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="acme.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Industry</label>
              <input
                type="text"
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Technology"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">City</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="San Francisco"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">State</label>
              <input
                type="text"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="CA"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Country</label>
              <select
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Employees</label>
              <input
                type="number"
                min="1"
                value={form.employees}
                onChange={(e) => setForm({ ...form, employees: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="100"
              />
            </div>
            <div className="col-span-1 sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Source</label>
              <select
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {SOURCES.map((s) => (
                  <option key={s} value={s}>{SOURCE_LABELS[s]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-600"
            >
              Add Company
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfirmModal({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', confirmColor = 'red' }) {
  if (!open) return null;
  const btnColors = {
    red: 'bg-red-600 hover:bg-red-700 text-white',
    blue: 'bg-indigo-600 hover:bg-indigo-600 text-white',
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="mt-2 text-sm text-gray-600">{message}</p>
        <div className="mt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { onConfirm(); onClose(); }}
            className={cn('rounded-lg px-4 py-2 text-sm font-medium shadow-sm', btnColors[confirmColor] || btnColors.red)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function BulkActionBar({ selectedIds, onDeselect, onStageChange, onAddToGroup, onEnroll, onTag, onScoreAll, onExport, onDelete, groups, sequences }) {
  const [stageDropdown, setStageDropdown] = useState(false);
  const [groupDropdown, setGroupDropdown] = useState(false);
  const [seqDropdown, setSeqDropdown] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [tagValue, setTagValue] = useState('');

  const closeAll = () => { setStageDropdown(false); setGroupDropdown(false); setSeqDropdown(false); setTagOpen(false); };

  const submitTag = () => {
    const t = tagValue.trim();
    if (!t) return;
    onTag(t);
    setTagValue('');
    setTagOpen(false);
  };

  if (selectedIds.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-40 w-[calc(100%-2rem)] max-w-fit -translate-x-1/2 sm:w-auto lg:left-[calc(50%+7.5rem)]">
      <div className="flex items-center gap-2 overflow-x-auto rounded-xl border border-gray-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur-sm sm:gap-3 sm:px-5">
        <span className="flex-shrink-0 text-sm font-semibold text-gray-700">
          {selectedIds.length} selected
        </span>

        <div className="h-5 w-px flex-shrink-0 bg-gray-200" />

        {/* Change Stage Dropdown */}
        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => { setStageDropdown(!stageDropdown); setGroupDropdown(false); }}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
            Change Stage
          </button>
          {stageDropdown && (
            <div className="absolute bottom-full left-0 mb-2 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              {STAGES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { onStageChange(s); setStageDropdown(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <span className={cn('h-2 w-2 rounded-full', STAGE_COLORS[s]?.bg)} />
                  {STAGE_LABELS[s]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Add to Group Dropdown */}
        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => { setGroupDropdown(!groupDropdown); setStageDropdown(false); setSeqDropdown(false); setTagOpen(false); }}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            Add to Group
          </button>
          {groupDropdown && (
            <div className="absolute bottom-full left-0 mb-2 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              {(groups || []).length === 0 ? (
                <p className="px-3 py-2 text-sm text-gray-400">No groups yet</p>
              ) : (
                (groups || []).map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => { onAddToGroup(g.id); setGroupDropdown(false); }}
                    className="flex w-full items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    {g.name}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Enroll in Sequence Dropdown */}
        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => { setSeqDropdown(!seqDropdown); setStageDropdown(false); setGroupDropdown(false); setTagOpen(false); }}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
          >
            <Send className="h-3.5 w-3.5" />
            Enroll
          </button>
          {seqDropdown && (
            <div className="absolute bottom-full left-0 mb-2 w-60 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              <p className="px-3 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wider text-gray-400">
                Enrolls each company's primary contact
              </p>
              {(sequences || []).length === 0 ? (
                <p className="px-3 py-2 text-sm text-gray-400">No sequences yet</p>
              ) : (
                (sequences || []).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { onEnroll(s.id); setSeqDropdown(false); }}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <span className="truncate">{s.name}</span>
                    <span className="text-xs text-gray-400">{s.steps?.length || 0} steps</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Add Tag */}
        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => { setTagOpen(!tagOpen); setStageDropdown(false); setGroupDropdown(false); setSeqDropdown(false); }}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Tag className="h-3.5 w-3.5" />
            Tag
          </button>
          {tagOpen && (
            <div className="absolute bottom-full left-0 mb-2 w-56 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
              <label className="mb-1 block px-1 text-[11px] font-medium uppercase tracking-wider text-gray-400">Add tag to selected</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  autoFocus
                  value={tagValue}
                  onChange={(e) => setTagValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitTag(); } }}
                  placeholder="e.g. priority"
                  className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={submitTag}
                  className="rounded-md bg-indigo-600 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-indigo-600"
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Score All */}
        <button
          type="button"
          onClick={onScoreAll}
          className="inline-flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-1.5 text-sm font-medium text-yellow-700 hover:bg-yellow-100"
        >
          <Target className="h-3.5 w-3.5" />
          Score
        </button>

        {/* Export selected */}
        <button
          type="button"
          onClick={onExport}
          className="inline-flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </button>

        {/* Delete */}
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete selected companies"
          title="Delete selected"
          className="inline-flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>

        <div className="h-5 w-px flex-shrink-0 bg-gray-200" />

        {/* Deselect All */}
        <button
          type="button"
          onClick={onDeselect}
          aria-label="Clear selection"
          title="Clear selection"
          className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-700"
        >
          <XCircle className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

const EMPTY_FILTERS = {
  stage: '',
  country: '',
  source: '',
  industry: '',
  scoreMin: '',
  scoreMax: '',
  enriched: '',
  has_contacts: false,
};

// Filters this page accepts from the URL, so a stat tile elsewhere in the app
// can link straight to the rows behind its number (e.g. Leads found →
// /companies?source=google_places).
function filtersFromParams(params) {
  return {
    ...EMPTY_FILTERS,
    stage: params.get('stage') || '',
    country: params.get('country') || '',
    source: params.get('source') || '',
    industry: params.get('industry') || '',
    scoreMin: params.get('scoreMin') || '',
    scoreMax: params.get('scoreMax') || '',
    enriched: params.get('enriched') || '',
    has_contacts: params.get('has_contacts') === 'true',
  };
}

function anyFilterSet(f) {
  return Object.entries(f).some(([k, v]) => (k === 'has_contacts' ? v === true : v !== ''));
}

export default function Companies() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const paramString = searchParams.toString();
  const [searchInput, setSearchInput] = useState(() => searchParams.get('q') || '');
  const [search, setSearch] = useState(() => searchParams.get('q') || '');
  const [showModal, setShowModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [bulkOperating, setBulkOperating] = useState(false);
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards' | 'byCity'
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [filters, setFilters] = useState(() => filtersFromParams(searchParams));
  // A filter arriving by link is invisible unless the panel is open — otherwise
  // the list just looks short for no reason.
  const [showFilters, setShowFilters] = useState(() => anyFilterSet(filtersFromParams(searchParams)));

  // Re-apply whenever the query string changes: navigating between two filtered
  // links (?source=apollo → ?source=google_places) reuses this component, so
  // seeding state at mount alone would leave the first filter stuck on screen.
  // Adjusted during render so the list never paints with the old filter first.
  const [appliedParams, setAppliedParams] = useState(paramString);
  if (appliedParams !== paramString) {
    setAppliedParams(paramString);
    const params = new URLSearchParams(paramString);
    const next = filtersFromParams(params);
    setFilters(next);
    setSearchInput(params.get('q') || '');
    setSearch(params.get('q') || '');
    setPage(1);
    if (anyFilterSet(next)) setShowFilters(true);
  }

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Server-side filters (supported by the company list endpoint).
  const serverFilters = {};
  if (search) serverFilters.search = search;
  if (filters.stage) serverFilters.stage = filters.stage;
  if (filters.country) serverFilters.country = filters.country;
  if (filters.industry) serverFilters.industry_segment = filters.industry;
  if (filters.enriched) serverFilters.enriched = filters.enriched;
  if (filters.source) serverFilters.source = filters.source;
  if (filters.has_contacts) serverFilters.has_contacts = true;
  serverFilters.page = page;
  serverFilters.page_size = pageSize;

  const { data: companiesData, isLoading, isError } = useCompanies(serverFilters);
  const allCompanies = companiesData?.items || [];
  const totalCompanies = companiesData?.total || 0;
  const createCompany = useCreateCompany();
  const deleteCompany = useDeleteCompany();
  const { data: groups } = useGroups();
  const { data: sequences } = useSequences();
  const addGroupMembers = useAddGroupMembers();

  // Score range is filtered client-side (the list endpoint doesn't support it),
  // so it only narrows the current page. Source is a server-side filter — doing
  // it here would have scoped "all Places leads" to whichever 50 rows loaded.
  const companies = useMemo(() => {
    const min = filters.scoreMin !== '' ? Number(filters.scoreMin) : null;
    const max = filters.scoreMax !== '' ? Number(filters.scoreMax) : null;
    return (allCompanies || []).filter((c) => {
      if (min != null && (c.score ?? -1) < min) return false;
      if (max != null && (c.score ?? 101) > max) return false;
      return true;
    });
  }, [allCompanies, filters.scoreMin, filters.scoreMax]);

  // Hash-based color for company initial avatars
  const AVATAR_COLORS = [
    { bg: 'bg-blue-100', text: 'text-blue-600' },
    { bg: 'bg-purple-100', text: 'text-purple-600' },
    { bg: 'bg-green-100', text: 'text-green-600' },
    { bg: 'bg-orange-100', text: 'text-orange-600' },
    { bg: 'bg-pink-100', text: 'text-pink-600' },
    { bg: 'bg-teal-100', text: 'text-teal-600' },
    { bg: 'bg-indigo-100', text: 'text-indigo-600' },
    { bg: 'bg-rose-100', text: 'text-rose-600' },
    { bg: 'bg-cyan-100', text: 'text-cyan-600' },
    { bg: 'bg-amber-100', text: 'text-amber-600' },
  ];
  const getAvatarColor = (name) => {
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  };

  // Industry breakdown summary (top 8 industries)
  const industryCounts = useMemo(() => {
    const counts = {};
    for (const c of companies) {
      const ind = c.industry || 'Other';
      counts[ind] = (counts[ind] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [companies]);

  // Industry pill colors
  const INDUSTRY_COLORS = [
    'bg-blue-100 text-blue-700',
    'bg-purple-100 text-purple-700',
    'bg-green-100 text-green-700',
    'bg-orange-100 text-orange-700',
    'bg-pink-100 text-pink-700',
    'bg-teal-100 text-teal-700',
    'bg-indigo-100 text-indigo-700',
    'bg-amber-100 text-amber-700',
  ];

  // City grouping for "byCity" view
  const [expandedCities, setExpandedCities] = useState({});
  const cityGroups = useMemo(() => {
    const groups = {};
    for (const c of companies) {
      const city = c.city || 'Unknown';
      if (!groups[city]) groups[city] = [];
      groups[city].push(c);
    }
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [companies]);

  const toggleCity = (city) => {
    setExpandedCities((prev) => ({ ...prev, [city]: !prev[city] }));
  };

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setPage(1);
  };

  // Also drop the params that seeded these filters, so a cleared view stays
  // cleared across a reload and the URL keeps matching what's on screen.
  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
    if (paramString) setSearchParams({}, { replace: true });
  };

  // Serialize rows to a CSV file and trigger a download. `value(row)` cells may
  // be arrays (e.g. tags) — those are joined with "; ".
  const downloadCsv = (filename, headers, rows) => {
    const escape = (val) => {
      const str = Array.isArray(val) ? val.join('; ') : val == null ? '' : String(val);
      return `"${str.replace(/"/g, '""')}"`;
    };
    const csv = [headers, ...rows].map((r) => r.map(escape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Full-field export — every column we have, not just the table's summary set.
  const FULL_EXPORT = [
    ['Name', (c) => c.name],
    ['Domain', (c) => c.domain],
    ['Website', (c) => c.website],
    ['Phone', (c) => c.phone],
    ['City', (c) => c.city],
    ['State', (c) => c.state],
    ['Country', (c) => c.country],
    ['Employees', (c) => c.employees],
    ['Industry', (c) => c.industry],
    ['NAICS', (c) => c.naics_code],
    ['Score', (c) => c.score],
    ['Stage', (c) => c.stage],
    ['Source', (c) => c.source],
    ['Tags', (c) => c.tags || []],
    ['Notes', (c) => c.notes],
    ['Created', (c) => c.created_at],
    ['Updated', (c) => c.updated_at],
  ];

  const exportRows = (list, filename) => {
    if (!list || list.length === 0) return;
    downloadCsv(filename, FULL_EXPORT.map(([h]) => h), list.map((c) => FULL_EXPORT.map(([, f]) => f(c))));
  };

  // Toolbar "Export CSV" — all currently-visible companies, all fields.
  const handleExportCSV = () => exportRows(companies, 'prospect-companies.csv');

  // Bulk "Export" — only the selected companies, all fields.
  const handleBulkExport = () => {
    const byId = new Set(selectedIds.map(String));
    const list = (companies || []).filter((c) => byId.has(String(c.id)));
    exportRows(list, 'prospect-companies-selected.csv');
  };

  const handleScoreAll = async () => {
    if (selectedIds.length === 0) return;
    setBulkOperating(true);
    const t = toast.loading(`Scoring ${selectedIds.length} companies...`);
    try {
      for (const id of selectedIds) {
        await companiesApi.score(id);
      }
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['top-leads'] });
      toast.success(`Scored ${selectedIds.length} companies`, { id: t });
      setSelectedIds([]);
    } catch {
      toast.error('Some scoring operations failed', { id: t });
    } finally {
      setBulkOperating(false);
    }
  };

  const handleBulkStageChange = async (stage) => {
    if (selectedIds.length === 0) return;
    setBulkOperating(true);
    try {
      const promises = selectedIds.map((id) =>
        pipelineApi.transitionStage(id, stage)
      );
      await Promise.allSettled(promises);
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
      toast.success(`Updated ${selectedIds.length} companies to ${STAGE_LABELS[stage]}`);
      setSelectedIds([]);
    } catch (err) {
      toast.error('Some stage updates failed');
    } finally {
      setBulkOperating(false);
    }
  };

  const handleBulkAddToGroup = async (groupId) => {
    if (selectedIds.length === 0) return;
    setBulkOperating(true);
    try {
      await addGroupMembers.mutateAsync({ groupId, companyIds: selectedIds });
      setSelectedIds([]);
    } catch {
      // error handled by mutation
    } finally {
      setBulkOperating(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setBulkOperating(true);
    try {
      const promises = selectedIds.map((id) => deleteCompany.mutateAsync(id));
      await Promise.allSettled(promises);
      toast.success(`Deleted ${selectedIds.length} companies`);
      setSelectedIds([]);
    } catch {
      toast.error('Some deletions failed');
    } finally {
      setBulkOperating(false);
    }
  };

  // Enroll each selected company's primary contact in a sequence. Companies
  // with no contact (nobody to email) are skipped; 409s = already enrolled.
  const handleBulkEnroll = async (sequenceId) => {
    if (selectedIds.length === 0) return;
    setBulkOperating(true);
    const t = toast.loading(`Enrolling ${selectedIds.length} companies…`);
    let enrolled = 0;
    let skipped = 0;
    let already = 0;
    try {
      await Promise.all(
        selectedIds.map(async (id) => {
          try {
            const contacts = await contactsApi.getByCompany(id);
            const list = Array.isArray(contacts) ? contacts : contacts?.items || [];
            const primary = pickPrimaryContact(list);
            if (!primary) { skipped += 1; return; }
            await outreachApi.enrollContact({ contact_id: primary.id, sequence_id: sequenceId });
            enrolled += 1;
          } catch (e) {
            if (e?.response?.status === 409) already += 1;
            else skipped += 1;
          }
        })
      );
      const parts = [`${enrolled} enrolled`];
      if (already) parts.push(`${already} already in sequence`);
      if (skipped) parts.push(`${skipped} skipped (no contact)`);
      toast.success(parts.join(', '), { id: t });
      queryClient.invalidateQueries({ queryKey: ['outreach-events'] });
      setSelectedIds([]);
    } catch {
      toast.error('Bulk enrollment failed', { id: t });
    } finally {
      setBulkOperating(false);
    }
  };

  // Append a tag to every selected company, preserving existing tags.
  const handleBulkTag = async (tag) => {
    if (selectedIds.length === 0) return;
    setBulkOperating(true);
    const byId = new Map((companies || []).map((c) => [String(c.id), c]));
    try {
      await Promise.allSettled(
        selectedIds.map((id) => {
          const c = byId.get(String(id));
          const current = Array.isArray(c?.tags) ? c.tags : [];
          if (current.includes(tag)) return Promise.resolve();
          return companiesApi.update(id, { tags: [...current, tag] });
        })
      );
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast.success(`Tagged ${selectedIds.length} companies "${tag}"`);
      setSelectedIds([]);
    } catch {
      toast.error('Some tags failed to apply');
    } finally {
      setBulkOperating(false);
    }
  };

  // Health indicator based on stage
  const getHealthIndicator = (stage) => {
    if (['customer', 'engaged', 'qualified'].includes(stage)) return { color: 'bg-green-500', label: 'Active' };
    if (['contacted', 'opportunity', 'researched'].includes(stage)) return { color: 'bg-yellow-500', label: 'Warm' };
    return { color: 'bg-gray-400', label: 'Cold' };
  };

  const columns = [
    {
      key: 'name',
      label: 'Company',
      render: (val, row) => (
        <span className="font-medium text-blue-600 hover:text-blue-700">{row.name}</span>
      ),
    },
    { key: 'domain', label: 'Domain' },
    {
      key: 'primary_contact',
      label: 'Contact',
      sortable: false,
      render: (val, row) => <PrimaryContact contact={row.primary_contact} showPhone />,
    },
    {
      key: 'city',
      label: 'Location',
      render: (val, row) => [row.city, row.state].filter(Boolean).join(', ') || '—',
    },
    {
      key: 'employees',
      label: 'Employees',
      render: (val) => val ? formatNumber(val) : '—',
    },
    {
      key: 'score',
      label: 'Score',
      render: (val) => val != null ? <ScoreBadge score={val} size="sm" /> : '—',
    },
    {
      key: 'stage',
      label: 'Stage',
      render: (val) => (
        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', STAGE_COLORS[val]?.bg, STAGE_COLORS[val]?.text)}>
          {STAGE_LABELS[val] || val}
        </span>
      ),
    },
    {
      key: 'source',
      label: 'Source',
      render: (val) => SOURCE_LABELS[val] || val || '—',
    },
    {
      key: 'enriched',
      label: 'Enriched',
      sortable: false,
      render: (val, row) => row.domain ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
          <Sparkles className="h-3 w-3" />
          Enriched
        </span>
      ) : (
        <span className="text-xs text-gray-400">Not enriched</span>
      ),
    },
    {
      key: 'health',
      label: 'Health',
      sortable: false,
      render: (val, row) => {
        const h = getHealthIndicator(row.stage);
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
            <span className={cn('h-2 w-2 rounded-full', h.color)} />
            {h.label}
          </span>
        );
      },
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (val) => val ? formatDate(val) : '—',
    },
  ];

  const hasActiveFilters = filters.stage || filters.country || filters.source || filters.industry || filters.scoreMin || filters.scoreMax || filters.enriched || filters.has_contacts;

  return (
    <div className="space-y-4">
      {/* Search & Actions Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:flex-1" style={{ minWidth: '200px', maxWidth: '400px' }}>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search companies..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
            showFilters || hasActiveFilters
              ? 'border-blue-300 bg-blue-50 text-blue-700'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
          )}
        >
          <Filter className="h-4 w-4" />
          Filters
        </button>

        <div className="inline-flex overflow-hidden rounded-lg border border-gray-300">
          <button onClick={() => setViewMode('table')} title="Table view" className={cn('px-3 py-2 text-sm', viewMode === 'table' ? 'bg-blue-50 text-blue-700' : 'bg-white text-gray-600')}>
            <LayoutList className="h-4 w-4" />
          </button>
          <button onClick={() => setViewMode('cards')} title="Card view" className={cn('px-3 py-2 text-sm', viewMode === 'cards' ? 'bg-blue-50 text-blue-700' : 'bg-white text-gray-600')}>
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button onClick={() => setViewMode('byCity')} title="Group by city" className={cn('px-3 py-2 text-sm', viewMode === 'byCity' ? 'bg-blue-50 text-blue-700' : 'bg-white text-gray-600')}>
            <Building2 className="h-4 w-4" />
          </button>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-600"
          >
            <Plus className="h-4 w-4" />
            Add Company
          </button>
        </div>
      </div>

      {/* Filter Row */}
      {showFilters && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Stage</label>
            <select
              value={filters.stage}
              onChange={(e) => handleFilterChange('stage', e.target.value)}
              className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Stages</option>
              {STAGES.map((s) => (
                <option key={s} value={s}>{STAGE_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Country</label>
            <select
              value={filters.country}
              onChange={(e) => handleFilterChange('country', e.target.value)}
              className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Countries</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Industry</label>
            <input
              type="text"
              placeholder="Filter industry..."
              value={filters.industry}
              onChange={(e) => handleFilterChange('industry', e.target.value)}
              className="h-9 w-40 rounded-md border border-gray-300 px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Source</label>
            <select
              value={filters.source}
              onChange={(e) => handleFilterChange('source', e.target.value)}
              className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Sources</option>
              {SOURCES.map((s) => (
                <option key={s} value={s}>{SOURCE_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Min Score</label>
            <input
              type="number"
              min="0"
              max="100"
              placeholder="0"
              value={filters.scoreMin}
              onChange={(e) => handleFilterChange('scoreMin', e.target.value)}
              className="h-9 w-20 rounded-md border border-gray-300 px-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Max Score</label>
            <input
              type="number"
              min="0"
              max="100"
              placeholder="100"
              value={filters.scoreMax}
              onChange={(e) => handleFilterChange('scoreMax', e.target.value)}
              className="h-9 w-20 rounded-md border border-gray-300 px-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Enrichment</label>
            <select
              value={filters.enriched}
              onChange={(e) => handleFilterChange('enriched', e.target.value)}
              className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All</option>
              <option value="enriched">Enriched</option>
              <option value="not_enriched">Not Enriched</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 h-9 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.has_contacts}
                onChange={(e) => handleFilterChange('has_contacts', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Has contacts</span>
            </label>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="h-9 text-sm text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Industry Breakdown Summary */}
      {!isLoading && !isError && companies.length > 0 && industryCounts.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider mr-1">Industries:</span>
          {industryCounts.map(([industry, count], i) => (
            <button
              key={industry}
              type="button"
              onClick={() => {
                if (filters.industry === industry) {
                  handleFilterChange('industry', '');
                } else {
                  handleFilterChange('industry', industry);
                  if (!showFilters) setShowFilters(true);
                }
              }}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                filters.industry === industry
                  ? 'ring-2 ring-blue-400 ring-offset-1'
                  : '',
                INDUSTRY_COLORS[i % INDUSTRY_COLORS.length]
              )}
            >
              {industry}
              <span className="opacity-70">{count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Data Table / Card View / City View */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : isError ? (
        <EmptyState
          title="Failed to load companies"
          description="There was an error loading the company list. Please try again."
        />
      ) : companies && companies.length === 0 ? (
        <EmptyState
          title="No companies found"
          description={search || hasActiveFilters ? 'Try adjusting your search or filters.' : 'Get started by adding your first company.'}
          action={!search && !hasActiveFilters ? { label: 'Add Company', onClick: () => setShowModal(true) } : undefined}
        />
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {companies.map((c) => {
            const health = getHealthIndicator(c.stage);
            const avatarColor = getAvatarColor(c.name);
            return (
              <div key={c.id} onClick={() => navigate(`/companies/${c.id}`)} className="cursor-pointer rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-blue-300 hover:shadow-md">
                <div className="flex items-start gap-3">
                  <div className={cn('flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold', avatarColor.bg, avatarColor.text)}>
                    {(c.name || '?')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gray-900">{c.name}</p>
                    {c.industry && <p className="text-xs text-gray-500">{c.industry}</p>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {c.domain ? (
                      <Sparkles className="h-3.5 w-3.5 text-green-500" title="Enriched" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5 text-gray-300" title="Not enriched" />
                    )}
                    {c.score != null && <ScoreBadge score={c.score} size="sm" />}
                  </div>
                </div>
                {c.primary_contact && (
                  <div className="mt-3">
                    <PrimaryContact contact={c.primary_contact} showPhone />
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
                  {c.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{c.city}</span>}
                  {c.contact_count > 0 && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{c.contact_count} contacts</span>}
                  {c.employees && <span>{formatNumber(c.employees)} employees</span>}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', STAGE_COLORS[c.stage]?.bg, STAGE_COLORS[c.stage]?.text)}>
                    {STAGE_LABELS[c.stage] || c.stage}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                    <span className={cn('h-2 w-2 rounded-full', health.color)} />
                    {health.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : viewMode === 'byCity' ? (
        <div className="space-y-2">
          {cityGroups.map(([city, cityCompanies]) => (
            <div key={city} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => toggleCity(city)}
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <span className="font-medium text-gray-900">{city}</span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{cityCompanies.length}</span>
                </div>
                {expandedCities[city] ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
              </button>
              {expandedCities[city] && (
                <div className="border-t border-gray-100 divide-y divide-gray-50">
                  {cityCompanies.map((c) => {
                    const avatarColor = getAvatarColor(c.name);
                    return (
                      <div
                        key={c.id}
                        onClick={() => navigate(`/companies/${c.id}`)}
                        className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50"
                      >
                        <div className={cn('flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold', avatarColor.bg, avatarColor.text)}>
                          {(c.name || '?')[0].toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                          <p className="text-xs text-gray-500">{c.industry || 'No industry'}</p>
                        </div>
                        {c.domain ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                            <Sparkles className="h-3 w-3" />
                            Enriched
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Not enriched</span>
                        )}
                        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', STAGE_COLORS[c.stage]?.bg, STAGE_COLORS[c.stage]?.text)}>
                          {STAGE_LABELS[c.stage] || c.stage}
                        </span>
                        {c.score != null && <ScoreBadge score={c.score} size="sm" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={companies || []}
          onRowClick={(row) => navigate(`/companies/${row.id}`)}
          selectable
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          emptyMessage="No companies match your criteria"
        />
      )}

      {/* Pagination */}
      {totalCompanies > pageSize && (
        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">
              Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, totalCompanies)} of {totalCompanies}
            </span>
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="h-8 rounded-md border border-gray-300 bg-white px-2 text-sm">
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
          </div>
          <div className="flex gap-1">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50">Previous</button>
            <button disabled={page * pageSize >= totalCompanies} onClick={() => setPage(p => p + 1)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50">Next</button>
          </div>
        </div>
      )}

      {/* Add Company Modal */}
      <AddCompanyModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onCreate={(data) => createCompany.mutate(data)}
      />

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedIds={selectedIds}
        onDeselect={() => setSelectedIds([])}
        onStageChange={handleBulkStageChange}
        onAddToGroup={handleBulkAddToGroup}
        onEnroll={handleBulkEnroll}
        onTag={handleBulkTag}
        onScoreAll={handleScoreAll}
        onExport={handleBulkExport}
        onDelete={() => setShowDeleteConfirm(true)}
        groups={groups}
        sequences={sequences}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleBulkDelete}
        title="Delete Companies"
        message={`Are you sure you want to delete ${selectedIds.length} selected ${selectedIds.length === 1 ? 'company' : 'companies'}? This action cannot be undone.`}
        confirmLabel="Delete"
        confirmColor="red"
      />
    </div>
  );
}
