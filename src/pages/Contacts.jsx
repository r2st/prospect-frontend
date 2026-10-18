import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  CreditCard,
  Mail,
  Phone,
  Linkedin,
  Building2,
  MapPin,
  Users,
  ScanLine,
  ArrowUpDown,
  LayoutGrid,
  Trash2,
  Briefcase,
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Check,
  UserPlus,
  Filter,
  Table,
  MoreHorizontal,
  Pencil,
  Send,
  Eye,
  ChevronDown,
  Tag,
  Ban,
  Megaphone,
} from 'lucide-react';
import toast from 'react-hot-toast';
import EmptyState from '../components/EmptyState';
import MetricCard from '../components/MetricCard';
import ContactDetailModal from '../components/ContactDetailModal';
import {
  useBulkSuppress,
  useBulkTag,
  useContactFacets,
  useContactTags,
  useContacts,
  useDeleteContact,
  useQuickAddContact,
} from '../hooks/useContacts';
import { contactsApi, queryClient } from '../api/client';
import { useAddContactsToCampaign, useCampaigns } from '../hooks/useCampaigns';
import { getInitials, cn, formatDate, timeAgo, contactPhones } from '../lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Friendly label + styling for a contact's source. */
function sourceMeta(source) {
  const s = (source || '').toLowerCase();
  if (/card|scan/.test(s)) {
    return { label: 'Scanned Card', className: 'bg-blue-50 text-blue-700 ring-blue-200', icon: CreditCard };
  }
  const labels = {
    manual: 'Manual',
    csv_import: 'CSV Import',
    web_scrape: 'Web Scrape',
    referral: 'Referral',
    linkedin: 'LinkedIn',
    apollo: 'Apollo',
    quick_add: 'Quick Add',
  };
  const label = labels[s] || (source ? source.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Other');
  return { label, className: 'bg-gray-100 text-gray-600 ring-gray-200', icon: Briefcase };
}

/** Maps the old client-side sort keys to server-side field + direction. */
const SORTS = {
  recent: { label: 'Recently added', sortBy: 'created_at', sortDir: 'desc' },
  name: { label: 'Name (A-Z)', sortBy: 'first_name', sortDir: 'asc' },
  company: { label: 'Company (A-Z)', sortBy: 'company_name', sortDir: 'asc' },
};

function fullName(c) {
  return [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || c.email || 'Unknown';
}

// ─── CSV export helper ────────────────────────────────────────────────────────
function downloadCsv(filename, headers, rows) {
  const escape = (val) => {
    const str = Array.isArray(val) ? val.join('; ') : val == null ? '' : String(val);
    return `"${str.replace(/"/g, '""')}"`;
  };
  const csv = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const CONTACT_EXPORT_COLS = [
  ['First Name', (c) => c.first_name],
  ['Last Name', (c) => c.last_name],
  ['Email', (c) => c.email],
  ['Phone', (c) => c.phone],
  ['Title', (c) => c.title],
  ['Company', (c) => c.company],
  ['City', (c) => c.city],
  ['State', (c) => c.state],
  ['Country', (c) => c.country],
  ['LinkedIn', (c) => c.linkedin_url],
  ['Source', (c) => c.source],
  ['Created', (c) => c.created_at],
];

/** Avatar color based on name hash. */
function nameColor(name) {
  const colors = [
    'bg-blue-100 text-blue-600',
    'bg-green-100 text-green-600',
    'bg-purple-100 text-purple-600',
    'bg-amber-100 text-amber-600',
    'bg-rose-100 text-rose-600',
    'bg-cyan-100 text-cyan-600',
    'bg-indigo-100 text-indigo-600',
    'bg-teal-100 text-teal-600',
  ];
  let hash = 0;
  for (const ch of (name || '')) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
  return colors[Math.abs(hash) % colors.length];
}

/** Source filter options for the advanced filter panel. */
const SOURCE_OPTIONS = [
  { value: 'all', label: 'All Sources' },
  { value: 'manual', label: 'Manual' },
  { value: 'csv_import', label: 'CSV Import' },
  { value: 'web_scrape', label: 'Web Scrape' },
  { value: 'card_scan', label: 'Card Scan' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'apollo', label: 'Apollo' },
  { value: 'quick_add', label: 'Quick Add' },
];

/** Genuine vs test contact-group chips shown above the toolbar. */
const GROUP_CHIPS = [
  { value: 'all', label: 'All Contacts', activeClass: 'border-blue-400 bg-blue-50 text-blue-700' },
  { value: 'genuine', label: 'Genuine', activeClass: 'border-emerald-400 bg-emerald-50 text-emerald-700' },
  { value: 'test', label: 'Test', activeClass: 'border-amber-400 bg-amber-50 text-amber-700' },
];

/** Status filter options. */
const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'subscribed', label: 'Subscribed' },
  { value: 'unsubscribed', label: 'Unsubscribed' },
  { value: 'no_email', label: 'No Email' },
];

// ─── Contact Card (for card view toggle) ──────────────────────────────────────
function ContactCard({ contact, highlighted, onDelete, onOpen, selected, onSelect }) {
  const meta = sourceMeta(contact.source);
  const name = fullName(contact);
  const location = [contact.city, contact.industry_segment].filter(Boolean).join(' · ');
  const phones = contactPhones(contact);

  return (
    <div
      onClick={() => onOpen(contact)}
      className={cn(
        'group relative flex cursor-pointer flex-col rounded-xl border bg-white p-4 shadow-sm transition-all hover:border-blue-300 hover:shadow-md',
        highlighted ? 'border-blue-400 ring-2 ring-blue-200' : 'border-gray-200',
        selected && 'border-blue-400 bg-blue-50/40 ring-2 ring-blue-200'
      )}
    >
      {/* Selection checkbox */}
      <label
        className="absolute left-3 top-3 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(contact.id, e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
      </label>

      {/* Source badge */}
      <span
        className={cn(
          'absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1',
          meta.className
        )}
      >
        <meta.icon className="h-3 w-3" />
        {meta.label}
      </span>

      {/* Identity */}
      <div className="flex items-start gap-3 pl-5 pr-24">
        <div className={cn('flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold', nameColor(name))}>
          {getInitials(contact.first_name, contact.last_name)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">{name}</p>
          {contact.title && <p className="truncate text-xs text-gray-500">{contact.title}</p>}
        </div>
      </div>

      {/* Company */}
      {contact.company && (
        <div className="mt-3 flex items-center gap-2 text-sm text-gray-700">
          <Building2 className="h-4 w-4 flex-shrink-0 text-gray-400" />
          {contact.company_id ? (
            <Link to={`/companies/${contact.company_id}`} onClick={(e) => e.stopPropagation()} className="truncate font-medium text-blue-600 hover:text-blue-700">
              {contact.company}
            </Link>
          ) : (
            <span className="truncate">{contact.company}</span>
          )}
        </div>
      )}

      {location && (
        <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
          <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
          <span className="truncate">{location}</span>
        </div>
      )}

      {/* Contact details */}
      <div className="mt-3 space-y-1.5 border-t border-gray-100 pt-3">
        {contact.email ? (
          <a
            href={`mailto:${contact.email}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 text-xs text-gray-600 hover:text-blue-600"
          >
            <Mail className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
            <span className="truncate">{contact.email}</span>
          </a>
        ) : (
          <div className="flex items-center gap-2 text-xs text-gray-300">
            <Mail className="h-3.5 w-3.5 flex-shrink-0" />
            <span>No email</span>
          </div>
        )}
        {phones.map((p, i) => (
          <a
            key={i}
            href={`tel:${p.number}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 text-xs text-gray-600 hover:text-blue-600"
          >
            <Phone className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
            <span className="truncate">{p.number}</span>
            {p.label && <span className="flex-shrink-0 text-gray-400">&middot; {p.label}</span>}
          </a>
        ))}
        {contact.linkedin_url && (
          <a
            href={contact.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 text-xs text-gray-600 hover:text-blue-600"
          >
            <Linkedin className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
            <span className="truncate">LinkedIn profile</span>
          </a>
        )}
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2.5">
        <span className="text-[11px] text-gray-400" title={contact.created_at ? formatDate(contact.created_at) : ''}>
          {contact.created_at ? `Added ${timeAgo(contact.created_at)}` : ''}
        </span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(contact); }}
          className="rounded-md p-1 text-gray-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
          title="Delete contact"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Quick Add Form ───────────────────────────────────────────────────────────
function QuickAddForm({ onClose }) {
  const quickAdd = useQuickAddContact();
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    company_name: '',
    title: '',
  });

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.first_name.trim() && !form.email.trim()) {
      toast.error('Please enter at least a first name or email');
      return;
    }
    quickAdd.mutate(form, {
      onSuccess: () => {
        setForm({ first_name: '', last_name: '', email: '', phone: '', company_name: '', title: '' });
        onClose();
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">Quick Add Contact</h3>
        <button type="button" onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <input type="text" placeholder="First name *" value={form.first_name} onChange={set('first_name')} className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        <input type="text" placeholder="Last name" value={form.last_name} onChange={set('last_name')} className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        <input type="email" placeholder="Email" value={form.email} onChange={set('email')} className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        <input type="tel" placeholder="Phone" value={form.phone} onChange={set('phone')} className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        <input type="text" placeholder="Company name" value={form.company_name} onChange={set('company_name')} className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        <input type="text" placeholder="Title / Role" value={form.title} onChange={set('title')} className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
        <button type="submit" disabled={quickAdd.isPending} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50">
          <Check className="h-3.5 w-3.5" />
          {quickAdd.isPending ? 'Adding...' : 'Add Contact'}
        </button>
      </div>
    </form>
  );
}

// ─── Hunter verification ──────────────────────────────────────────────────────
// Only "deliverable" is ever sent by a campaign; the rest explain why not.
const VERIFICATION_BADGES = {
  deliverable: { label: 'Deliverable', className: 'bg-green-50 text-green-700' },
  risky: { label: 'Risky', className: 'bg-amber-50 text-amber-700' },
  undeliverable: { label: 'Undeliverable', className: 'bg-red-50 text-red-700' },
  unknown: { label: 'Unknown', className: 'bg-gray-100 text-gray-600' },
};

export function VerificationBadge({ result }) {
  const badge = VERIFICATION_BADGES[result];
  if (!badge) return null;
  return (
    <span
      className={cn('ml-1.5 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium', badge.className)}
      title="Hunter email verification"
    >
      {badge.label}
    </span>
  );
}

// ─── Categories (the contact database grouped, with counts) ───────────────────
export function CategoryChips({ facets, filters, setFilters }) {
  if (!facets?.verification?.length) return null;
  const chip = (active) => cn(
    'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
    active ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
  );
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Contact categories">
      <span className="text-xs font-medium text-gray-500">Email verification:</span>
      <button type="button" className={chip(!filters.verification)} onClick={() => setFilters((p) => ({ ...p, verification: '' }))}>
        All <span className="text-gray-400">{facets.total}</span>
      </button>
      {facets.verification.map((v) => (
        <button
          key={v.value}
          type="button"
          className={chip(filters.verification === v.value)}
          onClick={() => setFilters((p) => ({ ...p, verification: p.verification === v.value ? '' : v.value }))}
        >
          {v.label} <span className="text-gray-400">{v.count}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Add to campaign ──────────────────────────────────────────────────────────
export function AddToCampaignModal({ contactIds, onClose, onDone }) {
  const { data: campaigns = [], isLoading } = useCampaigns();
  const open = campaigns.filter((c) => c.status === 'active' || c.status === 'paused');
  const [campaignId, setCampaignId] = useState('');
  const add = useAddContactsToCampaign();
  const chosen = campaignId || open[0]?.id || '';

  const submit = async () => {
    if (!chosen) return;
    await add.mutateAsync({ campaignId: chosen, contactIds });
    onDone?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-label="Add to campaign">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-semibold text-gray-900">
          Add {contactIds.length} contact{contactIds.length === 1 ? '' : 's'} to a campaign
        </h3>
        <p className="mt-1 text-sm text-gray-600">
          Each address is verified with Hunter first; only deliverable ones are ever sent. Anyone already in a campaign, unsubscribed or on your own domain is skipped, and you&apos;ll see why.
        </p>
        {isLoading ? (
          <div className="mt-4 h-9 animate-pulse rounded bg-gray-100" />
        ) : open.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">No active campaigns yet — create one first.</p>
        ) : (
          <label className="mt-4 block text-xs font-medium text-gray-500">
            Campaign
            <select
              value={chosen}
              onChange={(e) => setCampaignId(e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700"
            >
              {open.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.status === 'paused' ? ' (paused)' : ''}</option>
              ))}
            </select>
          </label>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!chosen || add.isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {add.isPending ? 'Adding…' : 'Add to campaign'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Bulk Action Bar ──────────────────────────────────────────────────────────
function BulkActionBar({ selectedIds, items, onDeselect, onDelete, onExport, onTag, onSuppress, onAddToCampaign }) {
  if (selectedIds.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-40 w-[calc(100%-2rem)] max-w-fit -translate-x-1/2 sm:w-auto lg:left-[calc(50%+7.5rem)]">
      <div className="flex items-center gap-2 overflow-x-auto rounded-xl border border-gray-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur-sm sm:gap-3 sm:px-5">
        <span className="flex-shrink-0 text-sm font-semibold text-gray-700">
          {selectedIds.length} selected
        </span>

        <div className="h-5 w-px flex-shrink-0 bg-gray-200" />

        <button
          type="button"
          onClick={onExport}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </button>

        <button
          type="button"
          onClick={onAddToCampaign}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
        >
          <Megaphone className="h-3.5 w-3.5" />
          Add to campaign
        </button>

        <button
          type="button"
          onClick={onTag}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Tag className="h-3.5 w-3.5" />
          Tag
        </button>

        {/* Amber, not red: suppression is reversible (the flag lifts), unlike
            Delete next to it — but it stops live sequences, so it shouldn't
            read as neutral either. */}
        <button
          type="button"
          onClick={onSuppress}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100"
        >
          <Ban className="h-3.5 w-3.5" />
          Suppress
        </button>

        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>

        <div className="h-5 w-px flex-shrink-0 bg-gray-200" />

        <button
          type="button"
          onClick={onDeselect}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <X className="h-3.5 w-3.5" />
          Deselect
        </button>
      </div>
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────
function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;

  const pages = [];
  const addPage = (n) => { if (!pages.includes(n) && n >= 1 && n <= totalPages) pages.push(n); };
  addPage(1);
  for (let i = Math.max(2, page - 2); i <= Math.min(totalPages - 1, page + 2); i++) addPage(i);
  addPage(totalPages);
  pages.sort((a, b) => a - b);

  const numbered = [];
  for (let i = 0; i < pages.length; i++) {
    if (i > 0 && pages[i] - pages[i - 1] > 1) numbered.push('...');
    numbered.push(pages[i]);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-700">
          Showing <span className="font-medium">{((page - 1) * pageSize) + 1}</span> to{' '}
          <span className="font-medium">{Math.min(page * pageSize, total)}</span> of{' '}
          <span className="font-medium">{total}</span>
        </span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="h-8 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value={25}>25 / page</option>
          <option value={50}>50 / page</option>
          <option value={100}>100 / page</option>
        </select>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </button>

        {numbered.map((item, i) =>
          item === '...' ? (
            <span key={`ellipsis-${i}`} className="px-2 text-sm text-gray-400">&hellip;</span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              className={cn(
                'min-w-[2rem] rounded-md px-2.5 py-1.5 text-sm font-medium',
                item === page
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              )}
            >
              {item}
            </button>
          )
        )}

        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Actions Dropdown ─────────────────────────────────────────────────────────
function ActionsDropdown({ contact, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen(false); onEdit(contact); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Pencil className="h-3.5 w-3.5 text-gray-400" />
            Edit
          </button>
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              onClick={(e) => e.stopPropagation()}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Send className="h-3.5 w-3.5 text-gray-400" />
              Email
            </a>
          )}
          {contact.company_id && (
            <Link
              to={`/companies/${contact.company_id}`}
              onClick={(e) => e.stopPropagation()}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Eye className="h-3.5 w-3.5 text-gray-400" />
              View Company
            </Link>
          )}
          <div className="my-1 border-t border-gray-100" />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete(contact); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Advanced Filters Panel ───────────────────────────────────────────────────
function FilterPanel({ filters, setFilters, onClear, allTags = [], onToggleTag, facets }) {
  const hasFilters =
    filters.source !== 'all' || filters.status !== 'all' || filters.city ||
    filters.companyName || filters.tags.length > 0 ||
    filters.suppressed !== 'all' || filters.bounced !== 'all' ||
    filters.verification || filters.industry || filters.campaignId;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Filters</h3>
        {hasFilters && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            Clear all filters
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Source dropdown */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Source</label>
          <select
            value={filters.source}
            onChange={(e) => setFilters((p) => ({ ...p, source: e.target.value }))}
            className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {SOURCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        {/* Status dropdown */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Status</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
            className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        {/* City input */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">City / Location</label>
          <input
            type="text"
            placeholder="Filter by city..."
            value={filters.city}
            onChange={(e) => setFilters((p) => ({ ...p, city: e.target.value }))}
            className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        {/* Company name input */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Company Name</label>
          <input
            type="text"
            placeholder="Filter by company..."
            value={filters.companyName}
            onChange={(e) => setFilters((p) => ({ ...p, companyName: e.target.value }))}
            className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        {/* Suppression — the hard do-not-email gate. Worth its own filter
            because "who did we take out of circulation" is a question you ask
            after a bad list, and it isn't answerable from the status dropdown
            (which conflates unsubscribes with missing addresses). */}
        <div>
          <label htmlFor="filter-suppressed" className="mb-1 block text-xs font-medium text-gray-500">
            Suppressed
          </label>
          <select
            id="filter-suppressed"
            value={filters.suppressed}
            onChange={(e) => setFilters((p) => ({ ...p, suppressed: e.target.value }))}
            className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">Any</option>
            <option value="yes">Suppressed only</option>
            <option value="no">Not suppressed</option>
          </select>
        </div>
        <div>
          <label htmlFor="filter-bounced" className="mb-1 block text-xs font-medium text-gray-500">
            Bounced
          </label>
          <select
            id="filter-bounced"
            value={filters.bounced}
            onChange={(e) => setFilters((p) => ({ ...p, bounced: e.target.value }))}
            className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">Any</option>
            <option value="yes">Has bounced</option>
            <option value="no">Never bounced</option>
          </select>
        </div>
        <div>
          <label htmlFor="filter-verification" className="mb-1 block text-xs font-medium text-gray-500">
            Email verification
          </label>
          <select
            id="filter-verification"
            value={filters.verification}
            onChange={(e) => setFilters((p) => ({ ...p, verification: e.target.value }))}
            className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Any</option>
            <option value="deliverable">Deliverable</option>
            <option value="risky">Risky (catch-all)</option>
            <option value="undeliverable">Undeliverable</option>
            <option value="unknown">Unknown</option>
            <option value="unverified">Not verified</option>
          </select>
        </div>
        <div>
          <label htmlFor="filter-industry" className="mb-1 block text-xs font-medium text-gray-500">
            Industry
          </label>
          <select
            id="filter-industry"
            value={filters.industry}
            onChange={(e) => setFilters((p) => ({ ...p, industry: e.target.value }))}
            className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Any</option>
            {(facets?.industry || []).map((f) => (
              <option key={f.value} value={f.value}>{f.label} ({f.count})</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-campaign" className="mb-1 block text-xs font-medium text-gray-500">
            Campaign
          </label>
          <select
            id="filter-campaign"
            value={filters.campaignId}
            onChange={(e) => setFilters((p) => ({ ...p, campaignId: e.target.value }))}
            className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Any</option>
            {(facets?.campaign || []).map((f) => (
              <option key={f.value} value={f.value}>{f.label} ({f.count})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tags. Rendered as toggles rather than a multi-select because the
          counts are the point — a tag on 2 contacts and a tag on 2,000 need to
          look different before you click one. */}
      {allTags.length > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-3">
          <div className="mb-2 flex items-center gap-3">
            {/* A group of toggle buttons, not a form control — <p> rather than
                <label>, which would have nothing to point at. */}
            <p className="text-xs font-medium text-gray-500">Tags</p>
            {filters.tags.length > 1 && (
              <div className="flex items-center gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setFilters((p) => ({ ...p, tagMatch: 'all' }))}
                  className={cn(
                    'rounded px-1.5 py-0.5',
                    filters.tagMatch === 'all' ? 'bg-blue-100 text-blue-700' : 'text-gray-400 hover:text-gray-600',
                  )}
                >
                  match all
                </button>
                <button
                  type="button"
                  onClick={() => setFilters((p) => ({ ...p, tagMatch: 'any' }))}
                  className={cn(
                    'rounded px-1.5 py-0.5',
                    filters.tagMatch === 'any' ? 'bg-blue-100 text-blue-700' : 'text-gray-400 hover:text-gray-600',
                  )}
                >
                  match any
                </button>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {allTags.map(({ tag, count }) => {
              const active = filters.tags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onToggleTag?.(tag)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition',
                    active
                      ? 'bg-blue-600 text-white ring-blue-600'
                      : 'bg-white text-gray-600 ring-gray-200 hover:bg-gray-50',
                  )}
                >
                  {tag}
                  <span className={cn('tabular-nums', active ? 'text-blue-100' : 'text-gray-400')}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Contact Detail Slide-Over Panel ──────────────────────────────────────────
function ContactSlideOver({ contact, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Small delay for enter animation
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 transition-opacity duration-300',
          visible ? 'bg-black/30' : 'bg-black/0'
        )}
        onClick={handleClose}
      />
      {/* Panel */}
      <div
        className={cn(
          'relative w-full max-w-2xl transform bg-white shadow-xl transition-transform duration-300 ease-in-out overflow-y-auto',
          visible ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Close button */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-6 py-3">
          <h2 className="text-sm font-semibold text-gray-500">Contact Details</h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {/* Reuse ContactDetailModal content inside the slide-over */}
        <ContactDetailModal
          contactId={contact.id}
          initial={contact}
          onClose={handleClose}
          embedded
        />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Contacts() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');

  // View mode: table (default) or card
  const [viewMode, setViewMode] = useState('table');

  // Pagination + search + sort state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recent');
  const [detailContact, setDetailContact] = useState(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  // Advanced filters state
  const [filters, setFilters] = useState({
    source: 'all',
    status: 'all',
    city: '',
    companyName: '',
    // Tag / compliance filters are resolved server-side (see useContacts): a
    // client-side pass would only ever search the page already loaded, so
    // "everyone tagged X" would quietly mean "…among these 50 rows".
    tags: [],
    tagMatch: 'all',
    suppressed: 'all',   // 'all' | 'yes' | 'no'
    bounced: 'all',      // 'all' | 'yes' | 'no'
    // Server-side, from the contact facets.
    verification: '',    // Hunter verdict, or 'unverified'
    industry: '',
    campaignId: '',
  });
  const [addToCampaign, setAddToCampaign] = useState(false);

  // Genuine vs test contact group — quick-access chips above the toolbar.
  const [group, setGroup] = useState('all');

  // Inline editing state
  const [editingCell, setEditingCell] = useState(null); // { contactId, field }
  const [editValue, setEditValue] = useState('');
  const editInputRef = useRef(null);

  // Debounced search: wait 300ms after the user stops typing
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset page to 1 when search/sort/filter changes
  useEffect(() => { setPage(1); }, [search, sort, filters, pageSize, group]);

  // Focus input when inline editing starts
  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCell]);

  // Build query params for server-side pagination/search/sort/filter
  const sortMeta = SORTS[sort] || SORTS.recent;
  const { data: contactsData, isLoading, isError } = useContacts({
    page,
    pageSize,
    search,
    sortBy: sortMeta.sortBy,
    sortDir: sortMeta.sortDir,
    status: filters.status !== 'all' ? filters.status : undefined,
    source: filters.source !== 'all' ? filters.source : undefined,
    city: filters.city.trim() || undefined,
    companyName: filters.companyName.trim() || undefined,
    group: group !== 'all' ? group : undefined,
    tags: filters.tags,
    tagMatch: filters.tagMatch,
    suppressed: filters.suppressed === 'all' ? undefined : filters.suppressed === 'yes',
    hasBounced: filters.bounced === 'all' ? undefined : filters.bounced === 'yes',
    verification: filters.verification || undefined,
    industry: filters.industry || undefined,
    campaignId: filters.campaignId || undefined,
  });
  const { data: facets } = useContactFacets();

  const deleteContact = useDeleteContact();
  const { data: allTags = [] } = useContactTags();
  const bulkTag = useBulkTag();
  const bulkSuppress = useBulkSuppress();

  const toggleTagFilter = (tag) => {
    setFilters((p) => ({
      ...p,
      tags: p.tags.includes(tag) ? p.tags.filter((t) => t !== tag) : [...p.tags, tag],
    }));
  };

  const handleBulkTag = async () => {
    const raw = window.prompt(
      'Tag the selected contacts with (comma-separated):\n\n' +
      'Prefix a tag with "-" to remove it instead.',
    );
    if (!raw) return;
    const entries = raw.split(',').map((t) => t.trim()).filter(Boolean);
    const add = entries.filter((t) => !t.startsWith('-'));
    const remove = entries.filter((t) => t.startsWith('-')).map((t) => t.slice(1).trim());
    if (!add.length && !remove.length) return;
    await bulkTag.mutateAsync({ contactIds: selectedIds, add, remove });
    setSelectedIds([]);
  };

  const handleBulkSuppress = async () => {
    // Suppression stops live sequences and is the gate every send path reads,
    // so it gets an explicit confirmation naming both consequences rather than
    // a silent bulk write.
    const ok = window.confirm(
      `Suppress ${selectedIds.length} contact${selectedIds.length === 1 ? '' : 's'}?\n\n` +
      'They will never be emailed again, and any sequences they are currently ' +
      'in will be stopped.',
    );
    if (!ok) return;
    await bulkSuppress.mutateAsync({
      contactIds: selectedIds,
      suppressed: true,
      reason: 'bulk suppression from contacts view',
    });
    setSelectedIds([]);
  };

  const items = contactsData?.items || [];
  const total = contactsData?.total ?? items.length;

  // Client-side filtering (source, status, city, company name)
  const filtered = useMemo(() => {
    let result = items;

    // Source filter
    if (filters.source !== 'all') {
      result = result.filter((c) => {
        const s = (c.source || '').toLowerCase();
        if (filters.source === 'card_scan') return /card|scan/.test(s);
        return s === filters.source;
      });
    }

    // Status filter
    if (filters.status !== 'all') {
      result = result.filter((c) => {
        if (filters.status === 'subscribed') return c.email && !c.unsubscribed;
        if (filters.status === 'unsubscribed') return c.unsubscribed;
        if (filters.status === 'no_email') return !c.email;
        return true;
      });
    }

    // City filter
    if (filters.city.trim()) {
      const cityLower = filters.city.toLowerCase().trim();
      result = result.filter((c) =>
        (c.city || '').toLowerCase().includes(cityLower) ||
        (c.state || '').toLowerCase().includes(cityLower) ||
        (c.country || '').toLowerCase().includes(cityLower)
      );
    }

    // Company name filter
    if (filters.companyName.trim()) {
      const compLower = filters.companyName.toLowerCase().trim();
      result = result.filter((c) =>
        (c.company || '').toLowerCase().includes(compLower)
      );
    }

    return result;
  }, [items, filters]);

  // Stats computed from current page
  const stats = useMemo(() => {
    const scanned = filtered.filter((c) => /card|scan/.test((c.source || '').toLowerCase())).length;
    const companies = new Set(filtered.map((c) => c.company_id).filter(Boolean)).size;
    return { total, scanned, companies };
  }, [filtered, total]);

  const handleDelete = (contact) => {
    if (window.confirm(`Delete ${fullName(contact)}? This cannot be undone.`)) {
      deleteContact.mutate({ id: contact.id, companyId: contact.company_id });
      setSelectedIds((prev) => prev.filter((id) => id !== contact.id));
    }
  };

  // ─── Inline editing ─────────────────────────────────────────────────────
  const startInlineEdit = (contactId, field, currentValue) => {
    setEditingCell({ contactId, field });
    setEditValue(currentValue || '');
  };

  const saveInlineEdit = async () => {
    if (!editingCell) return;
    const { contactId, field } = editingCell;
    try {
      await contactsApi.update(contactId, { [field]: editValue });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Updated');
    } catch {
      toast.error('Failed to update');
    }
    setEditingCell(null);
  };

  const cancelInlineEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const handleInlineKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveInlineEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelInlineEdit();
    }
  };

  // ─── Selection ──────────────────────────────────────────────────────────
  const handleSelect = (id, checked) => {
    setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((sid) => sid !== id)
    );
  };

  const allOnPageSelected = filtered.length > 0 && filtered.every((c) => selectedIds.includes(c.id));
  const someOnPageSelected = filtered.some((c) => selectedIds.includes(c.id));

  const handleSelectAllOnPage = (checked) => {
    if (checked) {
      const pageIds = filtered.map((c) => c.id);
      setSelectedIds((prev) => [...new Set([...prev, ...pageIds])]);
    } else {
      const pageIdSet = new Set(filtered.map((c) => c.id));
      setSelectedIds((prev) => prev.filter((id) => !pageIdSet.has(id)));
    }
  };

  const handleBulkExport = () => {
    const idSet = new Set(selectedIds.map(String));
    const list = filtered.filter((c) => idSet.has(String(c.id)));
    if (list.length === 0) return;
    downloadCsv(
      'prospect-contacts-selected.csv',
      CONTACT_EXPORT_COLS.map(([h]) => h),
      list.map((c) => CONTACT_EXPORT_COLS.map(([, f]) => f(c)))
    );
    toast.success(`Exported ${list.length} contacts`);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedIds.length} selected contact${selectedIds.length === 1 ? '' : 's'}? This cannot be undone.`)) return;
    const promises = selectedIds.map((id) => deleteContact.mutateAsync({ id }));
    await Promise.allSettled(promises);
    toast.success(`Deleted ${selectedIds.length} contacts`);
    setSelectedIds([]);
  };

  const clearFilters = () => {
    setFilters({
      source: 'all', status: 'all', city: '', companyName: '',
      tags: [], tagMatch: 'all', suppressed: 'all', bounced: 'all',
      verification: '', industry: '', campaignId: '',
    });
  };

  const activeFilterCount = [
    filters.source !== 'all',
    filters.status !== 'all',
    !!filters.city.trim(),
    !!filters.companyName.trim(),
    filters.suppressed !== 'all',
    filters.bounced !== 'all',
    !!filters.verification,
    !!filters.industry,
    !!filters.campaignId,
  ].filter(Boolean).length + filters.tags.length;

  // ─── Inline edit cell renderer ──────────────────────────────────────────
  const renderEditableCell = (contact, field, displayValue) => {
    const isEditing = editingCell?.contactId === contact.id && editingCell?.field === field;
    if (isEditing) {
      return (
        <input
          ref={editInputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={saveInlineEdit}
          onKeyDown={handleInlineKeyDown}
          className="w-full rounded border border-blue-400 bg-white px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
          onClick={(e) => e.stopPropagation()}
        />
      );
    }
    return (
      <span
        className="cursor-text rounded px-1 py-0.5 hover:bg-gray-100"
        onDoubleClick={(e) => {
          e.stopPropagation();
          startInlineEdit(contact.id, field, displayValue);
        }}
        title="Double-click to edit"
      >
        {displayValue || <span className="text-gray-300">--</span>}
      </span>
    );
  };

  // ─── Status dot ─────────────────────────────────────────────────────────
  const statusDot = (contact) => {
    if (contact.unsubscribed) {
      return <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-400" title="Unsubscribed" />;
    }
    if (contact.email) {
      return <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-400" title="Subscribed" />;
    }
    return <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-300" title="No email" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-3">
            <Users className="h-7 w-7 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          </div>
          <p className="ml-10 text-sm text-gray-500">
            Everyone you've scanned or added — searchable and organized in one place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowQuickAdd((v) => !v)}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium shadow-sm transition',
              showQuickAdd
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            )}
          >
            <UserPlus className="h-4 w-4" />
            Quick Add
          </button>
          <Link
            to="/scan"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
          >
            <ScanLine className="h-4 w-4" />
            Scan a Card
          </Link>
        </div>
      </div>

      {/* Quick Add Form */}
      {showQuickAdd && <QuickAddForm onClose={() => setShowQuickAdd(false)} />}

      {/* Summary metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard title="Total Contacts" value={stats.total} icon={Users} color="blue" />
        <MetricCard title="Scanned Cards" value={stats.scanned} icon={CreditCard} color="teal" />
        <MetricCard title="Companies" value={stats.companies} icon={Building2} color="indigo" />
      </div>

      {/* Group filter chips: genuine vs test contacts */}
      <div className="flex flex-wrap items-center gap-2">
        {GROUP_CHIPS.map((chip) => {
          const active = group === chip.value;
          return (
            <button
              key={chip.value}
              type="button"
              onClick={() => setGroup(chip.value)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                active
                  ? chip.activeClass
                  : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
              )}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:flex-1" style={{ minWidth: '200px', maxWidth: '420px' }}>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, company, email, phone..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Filter toggle */}
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
            showFilters || activeFilterCount > 0
              ? 'border-blue-300 bg-blue-50 text-blue-700'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
          )}
        >
          <Filter className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Sort */}
        <div className="relative">
          <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="h-10 appearance-none rounded-lg border border-gray-300 bg-white pl-9 pr-8 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {Object.entries(SORTS).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {/* View toggle: Table / Card */}
        <div className="inline-flex overflow-hidden rounded-lg border border-gray-300">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors',
              viewMode === 'table' ? 'bg-blue-50 text-blue-700' : 'bg-white text-gray-600 hover:bg-gray-50'
            )}
          >
            <Table className="h-4 w-4" />
            Table
          </button>
          <button
            type="button"
            onClick={() => setViewMode('card')}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors',
              viewMode === 'card' ? 'bg-blue-50 text-blue-700' : 'bg-white text-gray-600 hover:bg-gray-50'
            )}
          >
            <LayoutGrid className="h-4 w-4" />
            Cards
          </button>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <FilterPanel
          filters={filters}
          setFilters={setFilters}
          onClear={clearFilters}
          allTags={allTags}
          onToggleTag={toggleTagFilter}
          facets={facets}
        />
      )}

      <CategoryChips facets={facets} filters={filters} setFilters={setFilters} />

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
        </div>
      ) : isError ? (
        <EmptyState
          icon={Users}
          title="Failed to load contacts"
          description="There was an error loading your contacts. Please try again."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title={total === 0 ? 'No contacts yet' : 'No matches'}
          description={
            total === 0
              ? 'Scan a business card or import contacts to get started.'
              : 'Try a different search term or filter.'
          }
          action={total === 0 ? { label: 'Import Contacts', onClick: () => navigate('/import') } : undefined}
        />
      ) : viewMode === 'table' ? (
        /* ─── TABLE VIEW ─────────────────────────────────────────────── */
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="sticky top-0 z-10 bg-gray-50">
                <tr>
                  {/* Select all */}
                  <th className="w-12 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      ref={(el) => { if (el) el.indeterminate = someOnPageSelected && !allOnPageSelected; }}
                      onChange={(e) => handleSelectAllOnPage(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Contact
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Company
                  </th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 lg:table-cell">
                    Title
                  </th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 md:table-cell">
                    Source
                  </th>
                  <th className="w-12 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 xl:table-cell">
                    Updated
                  </th>
                  <th className="w-12 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((contact, idx) => {
                  const name = fullName(contact);
                  const meta = sourceMeta(contact.source);
                  const isSelected = selectedIds.includes(contact.id);
                  const isHighlighted = String(contact.id) === highlightId;

                  return (
                    <tr
                      key={contact.id}
                      onClick={() => setDetailContact(contact)}
                      className={cn(
                        'cursor-pointer transition-colors',
                        idx % 2 === 1 && 'bg-gray-50/30',
                        isSelected && 'bg-blue-50/60',
                        isHighlighted && 'bg-blue-50 ring-1 ring-inset ring-blue-200',
                        'hover:bg-blue-50/40'
                      )}
                    >
                      {/* Checkbox */}
                      <td className="w-12 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleSelect(contact.id, e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>

                      {/* Contact: avatar + name + email */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold', nameColor(name))}>
                            {getInitials(contact.first_name, contact.last_name)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-900">
                              {renderEditableCell(contact, 'first_name', name)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {renderEditableCell(contact, 'email', contact.email)}
                              <VerificationBadge result={contact.email_verification_result} />
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Company */}
                      <td className="px-4 py-3 text-sm">
                        {contact.company_id ? (
                          <Link
                            to={`/companies/${contact.company_id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-medium text-blue-600 hover:text-blue-700"
                          >
                            {contact.company || '--'}
                          </Link>
                        ) : (
                          <span className="text-gray-600">{contact.company || <span className="text-gray-300">--</span>}</span>
                        )}
                      </td>

                      {/* Title */}
                      <td className="hidden px-4 py-3 text-sm text-gray-600 lg:table-cell">
                        {renderEditableCell(contact, 'title', contact.title)}
                      </td>

                      {/* Source badge */}
                      <td className="hidden px-4 py-3 md:table-cell" onClick={(e) => e.stopPropagation()}>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1',
                            meta.className
                          )}
                        >
                          <meta.icon className="h-3 w-3" />
                          {meta.label}
                        </span>
                      </td>

                      {/* Status dot */}
                      <td className="w-12 px-4 py-3 text-center">
                        {statusDot(contact)}
                      </td>

                      {/* Updated */}
                      <td className="hidden px-4 py-3 text-xs text-gray-400 xl:table-cell" title={contact.updated_at ? formatDate(contact.updated_at) : ''}>
                        {contact.updated_at ? timeAgo(contact.updated_at) : contact.created_at ? timeAgo(contact.created_at) : '--'}
                      </td>

                      {/* Actions dropdown */}
                      <td className="w-12 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <ActionsDropdown
                          contact={contact}
                          onEdit={(c) => setDetailContact(c)}
                          onDelete={handleDelete}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Select all banner */}
          {allOnPageSelected && filtered.length > 0 && (
            <div className="border-t border-gray-100 bg-blue-50/50 px-4 py-2 text-center text-sm text-blue-700">
              All {filtered.length} contacts on this page are selected.
              {total > filtered.length && (
                <button
                  type="button"
                  onClick={() => {
                    // Select all visible contacts
                    const allIds = filtered.map((c) => c.id);
                    setSelectedIds(allIds);
                  }}
                  className="ml-2 font-semibold underline hover:no-underline"
                >
                  Select all {total} contacts
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ─── CARD VIEW ──────────────────────────────────────────────── */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <ContactCard
              key={c.id}
              contact={c}
              highlighted={String(c.id) === highlightId}
              onDelete={handleDelete}
              onOpen={setDetailContact}
              selected={selectedIds.includes(c.id)}
              onSelect={handleSelect}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && !isError && filtered.length > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        />
      )}

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedIds={selectedIds}
        items={filtered}
        onDeselect={() => setSelectedIds([])}
        onExport={handleBulkExport}
        onDelete={handleBulkDelete}
        onTag={handleBulkTag}
        onSuppress={handleBulkSuppress}
        onAddToCampaign={() => setAddToCampaign(true)}
      />

      {addToCampaign && (
        <AddToCampaignModal
          contactIds={selectedIds}
          onClose={() => setAddToCampaign(false)}
          onDone={() => setSelectedIds([])}
        />
      )}

      {/* Contact Detail Slide-Over */}
      {detailContact && (
        <ContactSlideOver
          contact={detailContact}
          onClose={() => setDetailContact(null)}
        />
      )}
    </div>
  );
}
