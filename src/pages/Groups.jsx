import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Folder,
  FolderPlus,
  Plus,
  Pencil,
  Trash2,
  Users,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  Wand2,
  Building2,
  MapPin,
  GitBranch,
  Download,
  ArrowRightLeft,
  Zap,
  ToggleLeft,
  ToggleRight,
  Clock,
  MessageSquare,
  LayoutGrid,
  Table as TableIcon,
  ExternalLink,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import EmptyState from '../components/EmptyState';
import {
  useGroups,
  useCreateGroup,
  useUpdateGroup,
  useDeleteGroup,
  useAddGroupMembers,
  useRemoveGroupMembers,
  useAutoGroupByIndustry,
  useAutoGroupByCountry,
  useAutoGroupByStage,
} from '../hooks/useGroups';
import { useCompanies } from '../hooks/useCompanies';
import { STAGE_COLORS, STAGE_LABELS } from '../lib/constants';
import { cn } from '../lib/utils';

const PRESET_COLORS = [
  { value: '#3b82f6', label: 'Blue' },
  { value: '#22c55e', label: 'Green' },
  { value: '#f97316', label: 'Orange' },
  { value: '#a855f7', label: 'Purple' },
  { value: '#ef4444', label: 'Red' },
  { value: '#14b8a6', label: 'Teal' },
];

// ── Smart Group helpers ──────────────────────────────────────────────────────

const SMART_FILTER_OPTIONS = [
  { value: 'industry', label: 'Industry' },
  { value: 'country', label: 'Country' },
  { value: 'stage', label: 'Stage' },
];

function parseSmartPrefix(description) {
  if (!description) return null;
  const match = description.match(/^\[SMART:(\w+)=([^\]]+)\]\s*/);
  if (!match) return null;
  return { field: match[1], value: match[2], rest: description.slice(match[0].length) };
}

function buildSmartDescription(isSmartGroup, smartField, smartValue, rawDescription) {
  if (!isSmartGroup) return rawDescription;
  return `[SMART:${smartField}=${smartValue}] ${rawDescription}`;
}

// ── CSV Export helper ────────────────────────────────────────────────────────

function exportGroupCSV(group) {
  const rows = [['Name', 'Domain', 'Industry', 'Stage']];
  (group.companies || []).forEach((c) => {
    rows.push([c.name || '', c.domain || '', c.industry || '', c.stage || '']);
  });
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${group.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_members.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Group Comparison Chart ───────────────────────────────────────────────────

function GroupComparisonChart({ groups }) {
  const [open, setOpen] = useState(true);

  const data = useMemo(
    () => groups.map((g) => ({ name: g.name, members: g.member_count || 0, color: g.color || '#3b82f6' })),
    [groups]
  );

  if (groups.length < 2) return null;

  return (
    <div className="mb-6 rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-3 text-left"
      >
        <span className="text-sm font-semibold text-gray-700">Group Comparison</span>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>
      {open && (
        <div className="px-5 pb-4" style={{ height: Math.max(groups.length * 40 + 40, 120) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
              <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value) => [`${value} members`, 'Members']}
                contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
              />
              <Bar dataKey="members" radius={[0, 4, 4, 0]} barSize={20}>
                {data.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function SkeletonCards({ count = 3 }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="animate-pulse rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-4 w-4 rounded-full bg-gray-200" />
            <div className="h-4 w-32 rounded bg-gray-200" />
          </div>
          <div className="h-3 w-48 rounded bg-gray-100 mb-4" />
          <div className="h-3 w-20 rounded bg-gray-100" />
        </div>
      ))}
    </div>
  );
}

// ── New / Edit Group Modal ────────────────────────────────────────────────────

function GroupFormModal({ group, onClose, onCreate, onUpdate }) {
  const existingSmart = group ? parseSmartPrefix(group.description) : null;
  const [name, setName] = useState(group?.name || '');
  const [description, setDescription] = useState(existingSmart ? existingSmart.rest : (group?.description || ''));
  const [color, setColor] = useState(group?.color || '#3b82f6');
  const [isSmartGroup, setIsSmartGroup] = useState(!!existingSmart);
  const [smartField, setSmartField] = useState(existingSmart?.field || 'industry');
  const [smartValue, setSmartValue] = useState(existingSmart?.value || '');
  const isEdit = !!group;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const finalDescription = buildSmartDescription(isSmartGroup && smartValue.trim(), smartField, smartValue.trim(), description);
    if (isEdit) {
      onUpdate({ id: group.id, data: { name: name.trim(), description: finalDescription, color } });
    } else {
      onCreate({ name: name.trim(), description: finalDescription, color });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">{isEdit ? 'Edit Group' : 'New Group'}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="e.g. Automotive Targets"
              autoFocus
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Optional description..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
            <div className="flex gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={cn(
                    'h-8 w-8 rounded-full border-2 transition-all',
                    color === c.value ? 'border-gray-900 scale-110' : 'border-transparent hover:scale-105'
                  )}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}
            </div>
          </div>
          {/* Smart Group toggle */}
          <div className="rounded-lg border border-gray-200 p-3 space-y-3">
            <button
              type="button"
              onClick={() => setIsSmartGroup(!isSmartGroup)}
              className="flex items-center gap-2 text-sm font-medium text-gray-700 w-full text-left"
            >
              {isSmartGroup ? (
                <ToggleRight className="h-5 w-5 text-blue-500" />
              ) : (
                <ToggleLeft className="h-5 w-5 text-gray-400" />
              )}
              <Zap className={cn('h-4 w-4', isSmartGroup ? 'text-amber-500' : 'text-gray-400')} />
              Smart Group
              <span className="text-xs font-normal text-gray-400 ml-auto">Auto-filter members</span>
            </button>
            {isSmartGroup && (
              <div className="flex gap-2">
                <select
                  value={smartField}
                  onChange={(e) => setSmartField(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {SMART_FILTER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={smartValue}
                  onChange={(e) => setSmartValue(e.target.value)}
                  placeholder={`e.g. ${smartField === 'industry' ? 'Manufacturing' : smartField === 'country' ? 'US' : 'Lead'}`}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-600 disabled:opacity-50"
            >
              {isEdit ? 'Save Changes' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Add Companies Modal ───────────────────────────────────────────────────────

function AddCompaniesModal({ group, onClose, onAdd }) {
  const { data: companiesData } = useCompanies({ page_size: 500 });
  const companies = companiesData?.items || [];
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());

  const existingIds = useMemo(() => new Set((group.companies || []).map((c) => c.id)), [group]);

  const filtered = useMemo(() => {
    const available = companies.filter((c) => !existingIds.has(c.id));
    if (!search.trim()) return available;
    const q = search.toLowerCase();
    return available.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.domain?.toLowerCase().includes(q) ||
        c.industry?.toLowerCase().includes(q)
    );
  }, [companies, existingIds, search]);

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = () => {
    if (selected.size === 0) return;
    onAdd({ groupId: group.id, companyIds: [...selected] });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl flex flex-col" style={{ maxHeight: '80vh' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Add Companies to "{group.name}"</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-4 pt-3 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search companies..."
              className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-2" style={{ minHeight: '200px' }}>
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">
              {companies.length === 0 ? 'No companies found.' : 'All companies are already in this group.'}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filtered.map((c) => (
                <li key={c.id}>
                  <label className="flex items-center gap-3 py-2.5 cursor-pointer hover:bg-gray-50 rounded-lg px-2 -mx-2">
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={() => toggleSelect(c.id)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium text-gray-900">{c.name}</span>
                      {c.industry && <span className="ml-2 text-xs text-gray-500">{c.industry}</span>}
                    </div>
                    {c.domain && <span className="text-xs text-gray-400 truncate max-w-[120px]">{c.domain}</span>}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
          <span className="text-sm text-gray-500">{selected.size} selected</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={selected.size === 0}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-600 disabled:opacity-50"
            >
              Add Selected ({selected.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Group Card ────────────────────────────────────────────────────────────────

function MoveToGroupDropdown({ company, currentGroupId, allGroups, onMove }) {
  const [open, setOpen] = useState(false);
  const otherGroups = (allGroups || []).filter((g) => g.id !== currentGroupId);

  if (otherGroups.length === 0) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="rounded p-1 text-gray-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all"
        title="Move to another group"
      >
        <ArrowRightLeft className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-gray-200 bg-white shadow-lg py-1">
          <div className="px-2 py-1 text-[10px] font-medium text-gray-400 uppercase tracking-wide">Move to...</div>
          {otherGroups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMove(company, currentGroupId, g.id);
                setOpen(false);
              }}
              className="flex items-center gap-2 w-full px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              <span className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: g.color || '#3b82f6' }} />
              <span className="truncate">{g.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function GroupCard({ group, onEdit, onDelete, onAddCompanies, onRemoveMember, allGroups, onMoveMember }) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const smartInfo = parseSmartPrefix(group.description);
  const displayDescription = smartInfo ? smartInfo.rest : group.description;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="inline-block h-3.5 w-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: group.color || '#3b82f6' }} />
            <h3 className="text-base font-semibold text-gray-900 truncate">{group.name}</h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              <Users className="h-3 w-3" />
              {group.member_count}
            </span>
            {smartInfo && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-700" title={`Smart filter: ${smartInfo.field}=${smartInfo.value}`}>
                <Zap className="h-3 w-3" />
                Smart
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => exportGroupCSV(group)}
              className="rounded-md p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
              title="Export CSV"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onEdit(group)}
              className="rounded-md p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              title="Edit group"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(group.id)}
              className="rounded-md p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Delete group"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Description */}
        {displayDescription && (
          <p className="mt-1.5 text-sm text-gray-500 line-clamp-2">{displayDescription}</p>
        )}

        {/* Actions */}
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onAddCompanies(group)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Companies
          </button>
          {group.member_count > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {expanded ? 'Hide' : 'Show'} members
            </button>
          )}
        </div>
      </div>

      {/* Expandable member list */}
      {expanded && group.companies && group.companies.length > 0 && (
        <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-3">
          <ul className="space-y-1.5">
            {group.companies.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 group">
                <button
                  type="button"
                  onClick={() => navigate(`/companies/${c.id}`)}
                  className="flex items-center gap-2 min-w-0 text-left hover:text-blue-600 transition-colors"
                >
                  <Building2 className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-700 truncate group-hover:text-blue-600">{c.name}</span>
                  {c.stage && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-500 flex-shrink-0">{c.stage}</span>
                  )}
                </button>
                <div className="flex items-center gap-0.5">
                  <MoveToGroupDropdown
                    company={c}
                    currentGroupId={group.id}
                    allGroups={allGroups}
                    onMove={onMoveMember}
                  />
                  <button
                    type="button"
                    onClick={() => onRemoveMember({ groupId: group.id, companyIds: [c.id] })}
                    className="rounded p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    title="Remove from group"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recent Activity placeholder */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 py-3">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Clock className="h-3.5 w-3.5" />
            <span className="font-medium text-gray-500">Recent Activity</span>
          </div>
          <p className="mt-1.5 text-xs text-gray-400 flex items-center gap-1.5">
            <MessageSquare className="h-3 w-3" />
            No recent activity tracked
          </p>
        </div>
      )}
    </div>
  );
}

// ── Group Detail Table (table view) ───────────────────────────────────────────

function StageBadge({ stage }) {
  if (!stage) return <span className="text-gray-300">--</span>;
  const c = STAGE_COLORS[stage];
  const label = STAGE_LABELS[stage] || stage;
  if (!c) {
    return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">{label}</span>;
  }
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', c.bg, c.text)}>{label}</span>
  );
}

function GroupDetailSection({ group, onEdit, onDelete, onAddCompanies, onRemoveMember }) {
  const navigate = useNavigate();
  const smartInfo = parseSmartPrefix(group.description);
  const displayDescription = smartInfo ? smartInfo.rest : group.description;
  const companies = group.companies || [];

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Section header */}
      <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="inline-block h-3.5 w-3.5 flex-shrink-0 rounded-full" style={{ backgroundColor: group.color || '#3b82f6' }} />
            <h3 className="truncate text-base font-semibold text-gray-900">{group.name}</h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              <Users className="h-3 w-3" />
              {group.member_count}
            </span>
            {smartInfo && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700" title={`Smart filter: ${smartInfo.field}=${smartInfo.value}`}>
                <Zap className="h-3 w-3" />
                Smart
              </span>
            )}
          </div>
          {displayDescription && <p className="mt-1 text-sm text-gray-500">{displayDescription}</p>}
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          <button type="button" onClick={() => onAddCompanies(group)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50" title="Add companies">
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
          <button type="button" onClick={() => exportGroupCSV(group)} className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-green-50 hover:text-green-600" title="Export CSV">
            <Download className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => onEdit(group)} className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600" title="Edit group">
            <Pencil className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => onDelete(group.id)} className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600" title="Delete group">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Company table */}
      {companies.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-gray-400">No companies in this group yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Company</th>
                <th className="hidden px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 md:table-cell">Industry</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Stage</th>
                <th className="hidden px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 lg:table-cell">Location</th>
                <th className="hidden px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500 sm:table-cell">Contacts</th>
                <th className="hidden px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500 sm:table-cell">Score</th>
                <th className="w-20 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {companies.map((c) => {
                const location = [c.city, c.state, c.country].filter(Boolean).join(', ');
                return (
                  <tr key={c.id} className="group transition-colors hover:bg-blue-50/30">
                    <td className="px-4 py-2.5">
                      <button type="button" onClick={() => navigate(`/companies/${c.id}`)} className="flex items-center gap-2 text-left">
                        <Building2 className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-gray-900 group-hover:text-blue-600">{c.name}</span>
                          {c.domain && <span className="block truncate text-xs text-gray-400">{c.domain}</span>}
                        </span>
                      </button>
                    </td>
                    <td className="hidden px-4 py-2.5 text-sm text-gray-700 md:table-cell">
                      {c.industry || <span className="text-gray-300">--</span>}
                    </td>
                    <td className="px-4 py-2.5"><StageBadge stage={c.stage} /></td>
                    <td className="hidden px-4 py-2.5 text-sm text-gray-600 lg:table-cell">
                      {location || <span className="text-gray-300">--</span>}
                    </td>
                    <td className="hidden px-4 py-2.5 text-right text-sm text-gray-700 sm:table-cell">
                      {c.contact_count != null ? c.contact_count : <span className="text-gray-300">--</span>}
                    </td>
                    <td className="hidden px-4 py-2.5 text-right text-sm text-gray-700 sm:table-cell">
                      {c.score != null ? c.score : <span className="text-gray-300">--</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-0.5">
                        <button type="button" onClick={() => navigate(`/companies/${c.id}`)} className="rounded p-1.5 text-gray-300 transition-colors hover:bg-blue-50 hover:text-blue-600" title="Open company">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => onRemoveMember({ groupId: group.id, companyIds: [c.id] })} className="rounded p-1.5 text-gray-300 transition-all hover:bg-red-50 hover:text-red-500" title="Remove from group">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Groups() {
  const { data: groups, isLoading } = useGroups();
  const createGroup = useCreateGroup();
  const updateGroup = useUpdateGroup();
  const deleteGroup = useDeleteGroup();
  const addMembers = useAddGroupMembers();
  const removeMembers = useRemoveGroupMembers();
  const autoGroup = useAutoGroupByIndustry();
  const autoGroupCountry = useAutoGroupByCountry();
  const autoGroupStage = useAutoGroupByStage();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [addCompaniesGroup, setAddCompaniesGroup] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' (graph + cards) | 'table' (detailed)

  const handleDelete = (id) => {
    if (window.confirm('Delete this group? Companies will not be deleted.')) {
      deleteGroup.mutate(id);
    }
  };

  const filteredGroups = useMemo(() => {
    if (!groups) return [];
    if (!searchFilter.trim()) return groups;
    const q = searchFilter.toLowerCase();
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.description?.toLowerCase().includes(q)
    );
  }, [groups, searchFilter]);

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Folder className="h-7 w-7 text-blue-500" />
              Company Groups
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Organize companies into named groups for targeted outreach
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => autoGroup.mutate()}
              disabled={autoGroup.isPending}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <Wand2 className="h-4 w-4" />
              {autoGroup.isPending ? 'Grouping...' : 'Group by Industry'}
            </button>
            <button
              type="button"
              onClick={() => autoGroupCountry.mutate()}
              disabled={autoGroupCountry.isPending}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <MapPin className="h-4 w-4" />
              {autoGroupCountry.isPending ? 'Grouping...' : 'Group by Country'}
            </button>
            <button
              type="button"
              onClick={() => autoGroupStage.mutate()}
              disabled={autoGroupStage.isPending}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <GitBranch className="h-4 w-4" />
              {autoGroupStage.isPending ? 'Grouping...' : 'Group by Stage'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-600 transition-colors"
            >
              <FolderPlus className="h-4 w-4" />
              New Group
            </button>
          </div>
        </div>

        {/* Search bar + view toggle */}
        {groups && groups.length > 0 && (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter groups..."
                className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="inline-flex flex-shrink-0 items-center rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  viewMode === 'cards' ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Graph
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  viewMode === 'table' ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                <TableIcon className="h-3.5 w-3.5" />
                Details
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <SkeletonCards />
      ) : !groups || groups.length === 0 ? (
        <EmptyState
          icon={Folder}
          title="No groups yet"
          description="Create groups to organize companies by industry, campaign, or any criteria."
          action={{ label: 'Create First Group', onClick: () => setShowCreateModal(true) }}
        />
      ) : filteredGroups.length === 0 ? (
        <div className="text-center py-12">
          <Search className="mx-auto h-10 w-10 text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">No groups match "{searchFilter}"</p>
        </div>
      ) : viewMode === 'table' ? (
        <div className="space-y-4">
          {filteredGroups.map((group) => (
            <GroupDetailSection
              key={group.id}
              group={group}
              onEdit={(g) => setEditingGroup(g)}
              onDelete={handleDelete}
              onAddCompanies={(g) => setAddCompaniesGroup(g)}
              onRemoveMember={({ groupId, companyIds }) => removeMembers.mutate({ groupId, companyIds })}
            />
          ))}
        </div>
      ) : (
        <>
          <GroupComparisonChart groups={filteredGroups} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredGroups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                allGroups={groups}
                onEdit={(g) => setEditingGroup(g)}
                onDelete={handleDelete}
                onAddCompanies={(g) => setAddCompaniesGroup(g)}
                onRemoveMember={({ groupId, companyIds }) => removeMembers.mutate({ groupId, companyIds })}
                onMoveMember={(company, fromGroupId, toGroupId) => {
                  removeMembers.mutate({ groupId: fromGroupId, companyIds: [company.id] });
                  addMembers.mutate({ groupId: toGroupId, companyIds: [company.id] });
                }}
              />
            ))}
          </div>
        </>
      )}

      {/* Modals */}
      {showCreateModal && (
        <GroupFormModal
          onClose={() => setShowCreateModal(false)}
          onCreate={(data) => createGroup.mutate(data)}
          onUpdate={() => {}}
        />
      )}
      {editingGroup && (
        <GroupFormModal
          group={editingGroup}
          onClose={() => setEditingGroup(null)}
          onCreate={() => {}}
          onUpdate={({ id, data }) => updateGroup.mutate({ id, data })}
        />
      )}
      {addCompaniesGroup && (
        <AddCompaniesModal
          group={addCompaniesGroup}
          onClose={() => setAddCompaniesGroup(null)}
          onAdd={({ groupId, companyIds }) => addMembers.mutate({ groupId, companyIds })}
        />
      )}
    </div>
  );
}
