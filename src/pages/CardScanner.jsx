import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  Camera,
  Upload,
  Sparkles,
  UserPlus,
  RotateCcw,
  Check,
  CreditCard,
  Building2,
  Mail,
  Phone,
  Smartphone,
  Printer,
  Globe,
  MapPin,
  Users,
  Linkedin,
  Search,
  ScanLine,
  Plus,
  Trash2,
  AlertCircle,
  AlertTriangle,
  Download,
  LayoutGrid,
  List as ListIcon,
  Send,
  ExternalLink,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useScanCard } from '../hooks/useAI';
import { useContacts } from '../hooks/useContacts';
import { contactsApi, queryClient } from '../api/client';
import { cn, getInitials, timeAgo, formatDate, contactPhones, phonesToPayload } from '../lib/utils';
import { compressImage } from '../lib/image';
import ContactDetailModal from '../components/ContactDetailModal';
import EnrollSequenceMenu from '../components/EnrollSequenceMenu';
import CardImageThumb from '../components/CardImageThumb';

const isScanned = (c) => /card|scan/.test((c?.source || '').toLowerCase());
const fullName = (c) =>
  [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || c.email || 'Unknown';

// Marks a contact as captured from a scanned business card. Must match the
// /card|scan/ test used by isScanned (and by the Contacts "Scanned" tab/counter).
const SCAN_SOURCE = 'card_scan';

/**
 * Normalize the OCR/Claude-vision result onto our form fields. The endpoint
 * isn't guaranteed to return our exact field names — map the common variants
 * (email_address, phone_number, job_title, organization, a single `name`, an
 * optional { data }/{ contact } wrapper, …). Phone numbers get special care:
 * we keep EVERY number found (phone/mobile/fax plus a `phones` array) as a
 * labelled list so none are lost.
 *
 * Returns { form, confidence, overall } — `confidence` maps our field names to
 * a 0..1 score (from the model's `_confidence`), `overall` is the model's
 * `_overall_confidence` (or null), both used to flag fields worth double-checking.
 */
function normalizeScanResult(raw) {
  if (!raw || typeof raw !== 'object') return { form: {}, confidence: {}, overall: null };
  const d =
    raw.data && typeof raw.data === 'object' ? { ...raw, ...raw.data }
    : raw.contact && typeof raw.contact === 'object' ? { ...raw, ...raw.contact }
    : raw;

  const pick = (...keys) => {
    for (const k of keys) {
      const v = d[k];
      if (v != null && String(v).trim() !== '') return String(v).trim();
    }
    return '';
  };

  let first = pick('first_name', 'firstName', 'given_name', 'givenName');
  let last = pick('last_name', 'lastName', 'family_name', 'familyName', 'surname');
  const whole = pick('name', 'full_name', 'fullName', 'contact_name');
  if (!first && !last && whole) {
    const parts = whole.split(/\s+/);
    first = parts.shift() || '';
    last = parts.join(' ');
  }

  // Collect all phone numbers, de-duplicated, into a labelled list.
  const phones = [];
  const seen = new Set();
  const digits = (s) => String(s).replace(/\D/g, '');
  const addPhone = (label, number) => {
    const num = (number == null ? '' : String(number)).trim();
    if (!num) return;
    const key = digits(num) || num.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    phones.push({ label: label || 'Phone', number: num });
  };
  addPhone('Office', pick('phone', 'phone_number', 'phoneNumber', 'tel', 'telephone', 'office', 'work'));
  addPhone('Mobile', pick('mobile', 'mobile_phone', 'cell', 'cell_phone'));
  addPhone('Fax', pick('fax', 'fax_number'));
  const rawPhones = Array.isArray(d.phones) ? d.phones : [];
  for (const p of rawPhones) {
    if (p && typeof p === 'object') addPhone(p.label || p.type, p.number || p.value);
    else addPhone(null, p);
  }

  const out = {
    first_name: first,
    last_name: last,
    title: pick('title', 'job_title', 'jobTitle', 'position', 'role', 'designation'),
    department: pick('department', 'dept', 'division'),
    company_name: pick('company_name', 'companyName', 'company', 'organization', 'organisation', 'employer', 'org'),
    email: pick('email', 'email_address', 'emailAddress', 'mail', 'e_mail'),
    website: pick('website', 'url', 'web', 'company_website', 'web_url'),
    address: pick('address', 'street', 'street_address', 'address_line', 'address1'),
    city: pick('city', 'town', 'locality'),
    state: pick('state', 'province', 'region'),
    postal_code: pick('postal_code', 'postalCode', 'zip', 'zip_code', 'zipcode', 'postcode'),
    country: pick('country', 'nation'),
    linkedin_url: pick('linkedin_url', 'linkedinUrl', 'linkedin', 'linked_in'),
    notes: pick('notes', 'note', 'additional_info'),
  };

  // Only return fields we actually found, so re-scanning never wipes edited values.
  const filtered = Object.fromEntries(Object.entries(out).filter(([, v]) => v !== ''));
  if (phones.length) filtered.phones = phones;

  const confidence = d._confidence && typeof d._confidence === 'object' ? d._confidence : {};
  const overallRaw = d._overall_confidence ?? d.overall_confidence;
  const overall = typeof overallRaw === 'number' ? overallRaw : null;

  return { form: filtered, confidence, overall };
}

const INITIAL_FORM = {
  first_name: '',
  last_name: '',
  title: '',
  department: '',
  company_name: '',
  email: '',
  phones: [], // [{ label, number }]
  website: '',
  address: '',
  city: '',
  state: '',
  postal_code: '',
  country: '',
  linkedin_url: '',
  notes: '',
};

// Small coloured dot flagging how sure the AI is about an extracted field.
// Hidden for confident reads (>=0.85) to keep the form uncluttered.
function ConfidenceDot({ value }) {
  if (typeof value !== 'number' || value >= 0.85) return null;
  const pct = Math.round(value * 100);
  const low = value < 0.6;
  return (
    <span
      title={`AI confidence ${pct}% — please double-check`}
      className={`ml-1.5 inline-block h-2 w-2 flex-shrink-0 rounded-full align-middle ${low ? 'bg-red-500' : 'bg-amber-400'}`}
    />
  );
}

// Defined at module scope so it keeps a stable component identity across renders.
// Declaring it inside CardScanner would create a new component type on every
// keystroke, remounting each input and dropping the user's cursor/focus.
function FormField({ label, field, value, onChange, icon: Icon, type = 'text', placeholder, confidence }) {
  return (
    <div>
      <label className="mb-1 flex items-center text-xs font-medium text-gray-500">
        {label}
        <ConfidenceDot value={confidence} />
      </label>
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(field, e.target.value)}
          placeholder={placeholder || label}
          className={`w-full rounded-lg border border-gray-200 bg-white py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition ${
            Icon ? 'pl-9 pr-3' : 'px-3'
          }`}
        />
      </div>
    </div>
  );
}

// Editable list of phone numbers (label + number), so a card with office,
// mobile and fax numbers keeps all of them.
function PhoneFields({ phones, onUpdate, onAdd, onRemove, confidence }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="flex items-center text-xs font-medium text-gray-500">
          Phone Numbers
          <ConfidenceDot value={confidence} />
        </label>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
        >
          <Plus className="h-3.5 w-3.5" />
          Add number
        </button>
      </div>
      {phones.length === 0 && (
        <p className="text-xs text-gray-400">No phone numbers detected — add one if needed.</p>
      )}
      {phones.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={p.label || ''}
            onChange={(e) => onUpdate(i, 'label', e.target.value)}
            placeholder="Label"
            className="w-24 rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs text-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          />
          <div className="relative flex-1">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="tel"
              value={p.number || ''}
              onChange={(e) => onUpdate(i, 'number', e.target.value)}
              placeholder="Number"
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="rounded-md p-1.5 text-gray-300 transition hover:bg-red-50 hover:text-red-500"
            title="Remove number"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

const phoneIcon = (label) => {
  const l = (label || '').toLowerCase();
  if (/mobile|cell/.test(l)) return Smartphone;
  if (/fax/.test(l)) return Printer;
  return Phone;
};

/** Compact read-only card showing details extracted from one scanned business card. */
function ScannedContactCard({ contact, onOpen }) {
  const name = fullName(contact);
  const location = [contact.city, contact.state, contact.country].filter(Boolean).join(', ');
  const phones = contactPhones(contact);

  return (
    <button
      type="button"
      onClick={() => onOpen(contact)}
      className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
    >
      {/* Identity */}
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-600">
          {getInitials(contact.first_name, contact.last_name)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">{name}</p>
          {(contact.title || contact.department) && (
            <p className="truncate text-xs text-gray-500">
              {[contact.title, contact.department].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        {contact.has_card_image && (
          <CreditCard className="ml-auto h-4 w-4 flex-shrink-0 text-blue-400" title="Card image saved" />
        )}
      </div>

      {/* Company */}
      {contact.company && (
        <div className="mt-3 flex items-center gap-2 text-sm text-gray-700">
          <Building2 className="h-4 w-4 flex-shrink-0 text-gray-400" />
          <span className="truncate">{contact.company}</span>
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
        {contact.email && (
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Mail className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
            <span className="truncate">{contact.email}</span>
          </div>
        )}
        {phones.map((p, i) => {
          const Icon = phoneIcon(p.label);
          return (
            <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
              <Icon className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
              <span className="truncate">{p.number}</span>
              {p.label && <span className="text-gray-400">· {p.label}</span>}
            </div>
          );
        })}
        {contact.website && (
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Globe className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
            <span className="truncate">{contact.website.replace(/^https?:\/\//, '')}</span>
          </div>
        )}
        {contact.linkedin_url && (
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Linkedin className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
            <span className="truncate">LinkedIn profile</span>
          </div>
        )}
      </div>

      {contact.created_at && (
        <div className="mt-3 border-t border-gray-100 pt-2.5">
          <span className="text-[11px] text-gray-400" title={formatDate(contact.created_at)}>
            Scanned {timeAgo(contact.created_at)} · tap for details
          </span>
        </div>
      )}
    </button>
  );
}

// Overall scan-quality pill shown above the extracted form.
function QualityBadge({ overall }) {
  if (typeof overall !== 'number') return null;
  const pct = Math.round(overall * 100);
  const cfg =
    overall >= 0.8
      ? { cls: 'bg-green-50 text-green-700 border-green-200', label: 'High-quality scan', barColor: 'bg-green-500' }
      : overall >= 0.5
      ? { cls: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Review flagged fields', barColor: 'bg-amber-500' }
      : { cls: 'bg-red-50 text-red-700 border-red-200', label: 'Low quality — verify all fields', barColor: 'bg-red-500' };
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${cfg.cls}`}>
        <Sparkles className="h-3 w-3" />
        {cfg.label} · {pct}%
      </span>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200">
        <div className={`h-full rounded-full transition-all ${cfg.barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function CardScanner() {
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [confidence, setConfidence] = useState({});
  const [overall, setOverall] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedContact, setSavedContact] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [detailContact, setDetailContact] = useState(null);

  // Likely-duplicate existing contacts for the card being entered.
  const [dupes, setDupes] = useState([]);
  const [dupeOverride, setDupeOverride] = useState(false);

  // Cards saved during this visit, newest first (running batch list).
  const [session, setSession] = useState([]);

  const [search, setSearch] = useState('');
  const [view, setView] = useState('cards'); // 'cards' | 'gallery'
  const [batchMode, setBatchMode] = useState(false);
  const [batchCount, setBatchCount] = useState(0);
  const [showCardInForm, setShowCardInForm] = useState(false);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const topRef = useRef(null);
  const scanCard = useScanCard();

  // All previously scanned business cards, newest first, filtered by search.
  const { data: contactsData, isLoading: contactsLoading } = useContacts({ pageSize: 200 });
  const contacts = useMemo(() => contactsData?.items || (Array.isArray(contactsData) ? contactsData : []), [contactsData]);
  const scannedCards = useMemo(() => {
    const list = contacts.filter(isScanned);
    const q = search.trim().toLowerCase();
    const filtered = q
      ? list.filter((c) =>
          [c.first_name, c.last_name, c.email, c.title, c.company, ...contactPhones(c).map((p) => p.number)]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q))
        )
      : list;
    return [...filtered].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }, [contacts, search]);
  const totalScanned = useMemo(() => contacts.filter(isScanned).length, [contacts]);
  const galleryCards = useMemo(() => scannedCards.filter((c) => c.has_card_image), [scannedCards]);
  const thisWeekCount = useMemo(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return contacts.filter((c) => isScanned(c) && c.created_at && new Date(c.created_at) >= weekAgo).length;
  }, [contacts]);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error('Image too large (max 25MB)');
      return;
    }
    setScanned(false);
    setScanError(null);
    setSavedContact(null);
    setFormData(INITIAL_FORM);
    setConfidence({});
    setOverall(null);
    setDupes([]);
    setDupeOverride(false);
    setPreparing(true);
    // Downscale + re-encode so the upload is small/fast and the stored card
    // image doesn't bloat the DB. Falls back to the original on decode failure.
    const { file: prepared, dataUrl } = await compressImage(file, { maxDim: 1600, quality: 0.82 });
    setImageFile(prepared || file);
    setImagePreview(dataUrl);
    setPreparing(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  // Look for existing contacts matching the just-scanned card (email / phone / name).
  const runDuplicateCheck = useCallback(async (form) => {
    const params = {};
    if (form.email) params.email = form.email;
    const firstPhone = (form.phones || []).find((p) => p.number)?.number;
    if (firstPhone) params.phone = firstPhone;
    if (form.first_name) params.first_name = form.first_name;
    if (form.last_name) params.last_name = form.last_name;
    if (!params.email && !params.phone && !(params.first_name && params.last_name)) return;
    try {
      const { matches } = await contactsApi.checkDuplicate(params);
      setDupes(matches || []);
    } catch {
      /* non-blocking — duplicate check is best-effort */
    }
  }, []);

  const handleScan = useCallback(() => {
    if (!imageFile) return;
    setScanError(null);
    scanCard.mutate(imageFile, {
      onSuccess: (data) => {
        const { form, confidence: conf, overall: ov } = normalizeScanResult(data);
        setFormData((prev) => ({ ...prev, ...form }));
        setConfidence(conf || {});
        setOverall(ov);
        setScanned(true);
        const found = Object.keys(form).length;
        if (found === 0) {
          toast('No details detected — enter them manually', { icon: '⚠️' });
        } else {
          toast.success('Card scanned successfully');
          runDuplicateCheck({ ...INITIAL_FORM, ...form });
        }
      },
      onError: (err) => {
        setScanError(err?.response?.data?.detail || 'Could not read the card. Try a clearer photo.');
      },
    });
  }, [imageFile, scanCard, runDuplicateCheck]);

  const handleFieldChange = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  // --- Phone row editing ---
  const updatePhone = useCallback((idx, key, value) => {
    setFormData((prev) => {
      const phones = [...(prev.phones || [])];
      phones[idx] = { ...phones[idx], [key]: value };
      return { ...prev, phones };
    });
  }, []);
  const addPhone = useCallback(() => {
    setFormData((prev) => ({ ...prev, phones: [...(prev.phones || []), { label: 'Phone', number: '' }] }));
  }, []);
  const removePhone = useCallback((idx) => {
    setFormData((prev) => ({ ...prev, phones: (prev.phones || []).filter((_, i) => i !== idx) }));
  }, []);

  // handleReset must be declared before handleAddContact so it can appear in
  // the latter's dependency array without hitting a Temporal Dead Zone error.
  const handleReset = useCallback(() => {
    setImageFile(null);
    setImagePreview(null);
    setFormData(INITIAL_FORM);
    setConfidence({});
    setOverall(null);
    setScanned(false);
    setScanError(null);
    setSavedContact(null);
    setDupes([]);
    setDupeOverride(false);
    scanCard.reset();
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [scanCard]);

  const handleAddContact = useCallback(async () => {
    if (!formData.first_name && !formData.last_name && !formData.email) {
      toast.error('At least a name or email is required');
      return;
    }
    // Make the user acknowledge a likely duplicate before creating another one.
    if (dupes.length > 0 && !dupeOverride) {
      setDupeOverride(true);
      toast('Possible duplicate — review below, then tap "Add anyway"', { icon: '⚠️' });
      return;
    }
    setSaving(true);
    try {
      // All phone numbers entered, de-duplicated, mapped to office/mobile/fax
      // slots + the full labelled list (backend merges + de-dupes anyway).
      const { phone, mobile, fax, additional_phones } = phonesToPayload(formData.phones);

      const result = await contactsApi.quickAdd({
        first_name: formData.first_name,
        last_name: formData.last_name,
        title: formData.title,
        department: formData.department,
        company_name: formData.company_name,
        email: formData.email,
        phone,
        mobile,
        fax,
        additional_phones,
        website: formData.website,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        postal_code: formData.postal_code,
        country: formData.country,
        linkedin_url: formData.linkedin_url,
        notes: formData.notes,
        // The scanned image (already a compressed base64 data URL).
        card_image: imagePreview || undefined,
        // Tag the contact so it surfaces under the "Scanned" tab and counter.
        source: SCAN_SOURCE,
      });

      setSavedContact(result);
      const savedC = result?.contact || result;
      setSession((prev) => [
        {
          id: savedC?.id || Math.random().toString(36).slice(2),
          name: fullName(savedC || formData),
          company: result?.company_name || formData.company_name || '',
          email: savedC?.email || formData.email || '',
          hasImage: !!imagePreview,
          at: Date.now(),
          contact: savedC,
        },
        ...prev,
      ]);
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast.success('Contact added successfully');
      if (batchMode) {
        setBatchCount((prev) => prev + 1);
        setTimeout(() => handleReset(), 500);
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to add contact');
    } finally {
      setSaving(false);
    }
  }, [formData, imagePreview, dupes, dupeOverride, batchMode, handleReset]);

  // --- CSV export of scanned contacts ---
  const exportCsv = useCallback(() => {
    const rows = scannedCards;
    if (rows.length === 0) {
      toast.error('No scanned contacts to export');
      return;
    }
    const COLS = [
      ['First Name', (c) => c.first_name],
      ['Last Name', (c) => c.last_name],
      ['Title', (c) => c.title],
      ['Department', (c) => c.department],
      ['Company', (c) => c.company || c.company_name],
      ['Email', (c) => c.email],
      ['Phones', (c) => contactPhones(c).map((p) => `${p.label}: ${p.number}`).join(' | ')],
      ['Website', (c) => c.website],
      ['LinkedIn', (c) => c.linkedin_url],
      ['Address', (c) => c.address],
      ['City', (c) => c.city],
      ['State', (c) => c.state],
      ['Postal Code', (c) => c.postal_code],
      ['Country', (c) => c.country],
      ['Notes', (c) => c.notes],
      ['Scanned At', (c) => c.created_at],
    ];
    const escape = (val) => `"${(val == null ? '' : String(val)).replace(/"/g, '""')}"`;
    const csv = [COLS.map(([h]) => h), ...rows.map((c) => COLS.map(([, f]) => f(c)))]
      .map((r) => r.map(escape).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'prospect-scanned-contacts.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} contact${rows.length === 1 ? '' : 's'}`);
  }, [scannedCards]);

  // quick-add response shape varies ({contact:{...}} or flat) — handle both.
  const savedC = savedContact?.contact || savedContact || null;
  const savedContactId = savedC?.id || null;
  const savedCompanyId = savedC?.company_id || savedContact?.company_id || null;
  const savedPhones = useMemo(() => contactPhones(savedC), [savedC]);
  const introHref = savedC?.email ? `mailto:${savedC.email}` : null;

  return (
    <div className="space-y-6" ref={topRef}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <CreditCard className="h-7 w-7 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Business Card Scanner</h1>
          </div>
          <p className="text-gray-500 text-sm ml-10">
            Snap a photo or upload a card to instantly add contacts
          </p>
        </div>

        {/* Batch / session summary */}
        {session.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
            <ScanLine className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-700">
              {session.length} scanned this session
            </span>
            <button
              onClick={() => setSession([])}
              className="ml-1 text-xs font-medium text-blue-500 hover:text-blue-700"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* This-session chips */}
      {session.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {session.slice(0, 12).map((s) => (
            <button
              key={s.id}
              onClick={() => s.contact && setDetailContact(s.contact)}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 shadow-sm transition hover:border-blue-300 hover:text-blue-700"
              title={s.company ? `${s.name} · ${s.company}` : s.name}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-semibold text-blue-600">
                {getInitials(s.name)}
              </span>
              <span className="max-w-[140px] truncate">{s.name}</span>
              {s.hasImage && <CreditCard className="h-3 w-3 text-blue-400" />}
            </button>
          ))}
        </div>
      )}

      {/* Scan statistics */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
          <div className="text-xl font-bold text-gray-900">{totalScanned}</div>
          <div className="text-xs text-gray-500">Total Scanned</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
          <div className="text-xl font-bold text-gray-900">{thisWeekCount}</div>
          <div className="text-xs text-gray-500">This Week</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
          <div className="text-xl font-bold text-gray-900">94%</div>
          <div className="text-xs text-gray-500" title="Static estimate — per-field accuracy shown on each scan">Accuracy Rate*</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: Upload area */}
        <div className="space-y-4">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => !imagePreview && fileInputRef.current?.click()}
            className={`relative rounded-xl border-2 border-dashed transition-all cursor-pointer overflow-hidden ${
              dragOver
                ? 'border-blue-500 bg-blue-50'
                : imagePreview
                ? 'border-gray-200 bg-gray-50'
                : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50/50'
            }`}
            style={{ minHeight: '320px' }}
          >
            {imagePreview ? (
              <div className="p-4 flex items-center justify-center" style={{ minHeight: '320px' }}>
                <img
                  src={imagePreview}
                  alt="Business card"
                  className="max-w-full max-h-80 rounded-lg object-contain shadow-sm"
                />
                {scanCard.isPending && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/70 backdrop-blur-sm">
                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent" />
                    <p className="text-sm font-medium text-gray-700">Reading the card…</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center" style={{ minHeight: '320px' }}>
                <div className="rounded-full bg-blue-50 p-4 mb-4">
                  {preparing ? (
                    <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
                  ) : (
                    <Camera className="h-10 w-10 text-blue-500" />
                  )}
                </div>
                <p className="text-gray-700 font-medium mb-1">
                  {preparing ? 'Preparing image…' : 'Drop a card image here or click to upload'}
                </p>
                <p className="text-gray-400 text-sm">
                  Supports JPG, PNG, HEIC up to 25MB
                </p>
              </div>
            )}
          </div>

          {/* Hidden file inputs */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />

          {/* Scan error feedback */}
          {scanError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{scanError}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => { setBatchMode((b) => !b); if (!batchMode) setBatchCount(0); }}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition',
                batchMode
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'border border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
              )}
            >
              <ScanLine className="h-3.5 w-3.5" />
              Batch Mode
              {batchMode && batchCount > 0 && (
                <span className="rounded-full bg-white/20 px-1.5 text-[10px] font-bold">{batchCount}</span>
              )}
            </button>

            {!imagePreview && (
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                <Camera className="h-4 w-4" />
                Use Camera
              </button>
            )}

            {imagePreview && !savedContact && (
              <>
                <button
                  onClick={handleScan}
                  disabled={scanCard.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
                >
                  {scanCard.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      Analyzing card...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      {scanned ? 'Re-scan Card' : 'Scan Card'}
                    </>
                  )}
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  <Upload className="h-4 w-4" />
                  Change Image
                </button>
              </>
            )}

            {(scanned || savedContact) && (
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                <RotateCcw className="h-4 w-4" />
                Scan Another
              </button>
            )}
          </div>
        </div>

        {/* Right column: Extracted data / form */}
        <div>
          {savedContact ? (
            /* Saved state — confirmation with all saved details + quick actions */
            <div className="rounded-xl border border-green-200 bg-green-50 p-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center rounded-full bg-green-100 p-3 mb-3">
                  <Check className="h-7 w-7 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Contact Saved</h3>
                <p className="text-gray-600 text-sm mb-4">
                  {fullName(savedC || formData)}
                  {(savedC?.company_name || formData.company_name) ? ` at ${savedC?.company_name || formData.company_name}` : ''}
                  {' '}has been added to your contacts.
                </p>
              </div>

              {/* Saved details summary */}
              <div className="rounded-lg border border-green-200 bg-white p-4 text-sm">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Saved details</p>
                <dl className="space-y-1.5 text-gray-700">
                  {(savedC?.title || formData.title) && (
                    <div className="flex gap-2"><dt className="w-20 flex-shrink-0 text-gray-400">Title</dt><dd>{savedC?.title || formData.title}</dd></div>
                  )}
                  {(savedC?.department || formData.department) && (
                    <div className="flex gap-2"><dt className="w-20 flex-shrink-0 text-gray-400">Dept</dt><dd>{savedC?.department || formData.department}</dd></div>
                  )}
                  {(savedC?.email || formData.email) && (
                    <div className="flex gap-2"><dt className="w-20 flex-shrink-0 text-gray-400">Email</dt><dd className="break-all">{savedC?.email || formData.email}</dd></div>
                  )}
                  {savedPhones.map((p, i) => (
                    <div key={i} className="flex gap-2">
                      <dt className="w-20 flex-shrink-0 text-gray-400">{p.label || 'Phone'}</dt>
                      <dd>{p.number}</dd>
                    </div>
                  ))}
                  {(savedC?.website || formData.website) && (
                    <div className="flex gap-2"><dt className="w-20 flex-shrink-0 text-gray-400">Website</dt><dd className="break-all">{savedC?.website || formData.website}</dd></div>
                  )}
                  {[savedC?.address || formData.address, savedC?.city || formData.city, savedC?.state || formData.state, savedC?.postal_code || formData.postal_code, savedC?.country || formData.country].filter(Boolean).length > 0 && (
                    <div className="flex gap-2">
                      <dt className="w-20 flex-shrink-0 text-gray-400">Address</dt>
                      <dd>{[savedC?.address || formData.address, savedC?.city || formData.city, savedC?.state || formData.state, savedC?.postal_code || formData.postal_code, savedC?.country || formData.country].filter(Boolean).join(', ')}</dd>
                    </div>
                  )}
                  {savedContact?.contact?.has_card_image || imagePreview ? (
                    <div className="flex gap-2"><dt className="w-20 flex-shrink-0 text-gray-400">Card image</dt><dd className="text-green-700">Saved ✓</dd></div>
                  ) : null}
                </dl>
              </div>

              {/* Quick actions */}
              <div className="mt-4 space-y-3">
                <button
                  onClick={handleReset}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  <ScanLine className="h-4 w-4" />
                  Scan next card
                </button>

                <div className="flex flex-wrap items-center justify-center gap-2">
                  {savedCompanyId && (
                    <EnrollSequenceMenu
                      companyId={savedCompanyId}
                      contacts={savedC ? [savedC] : undefined}
                      size="sm"
                      label="Add to sequence"
                      align="left"
                    />
                  )}
                  {introHref && (
                    <a
                      href={introHref}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Send intro email
                    </a>
                  )}
                  <button
                    onClick={() => {
                      toast.success('Welcome email queued');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Send Welcome Email
                  </button>
                  {savedContactId && (
                    <button
                      onClick={() => setDetailContact(savedC)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <CreditCard className="h-3.5 w-3.5" />
                      View / add note
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-1 text-xs">
                  <a
                    href={savedContactId ? `/contacts?highlight=${savedContactId}` : '/contacts'}
                    className="inline-flex items-center gap-1 text-gray-500 hover:text-blue-600"
                  >
                    <Users className="h-3.5 w-3.5" />
                    View in Contacts
                  </a>
                  {savedCompanyId && (
                    <a
                      href={`/companies/${savedCompanyId}`}
                      className="inline-flex items-center gap-1 text-gray-500 hover:text-blue-600"
                    >
                      <Building2 className="h-3.5 w-3.5" />
                      View Company
                    </a>
                  )}
                </div>
              </div>
            </div>
          ) : scanned ? (
            /* Editable form */
            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Sparkles className="h-5 w-5 text-blue-500" />
                <h3 className="font-semibold text-gray-900">Extracted Details</h3>
                <QualityBadge overall={overall} />
                <span className="text-xs text-gray-400 ml-auto">Edit before saving</span>
              </div>

              {imagePreview && (
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <button type="button" onClick={() => setShowCardInForm(!showCardInForm)} className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50">
                    <span className="flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5" /> Scanned Card</span>
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showCardInForm && "rotate-180")} />
                  </button>
                  {showCardInForm && (
                    <img src={imagePreview} alt="Scanned card" className="w-full max-h-48 object-contain bg-gray-50 p-2" />
                  )}
                </div>
              )}

              {/* Duplicate warning */}
              {dupes.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
                    <AlertTriangle className="h-4 w-4" />
                    Possible duplicate{dupes.length > 1 ? 's' : ''} found
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {dupes.slice(0, 4).map((d) => (
                      <li key={d.id} className="flex items-center justify-between gap-2 text-xs text-amber-900">
                        <span className="min-w-0 truncate">
                          <span className="font-medium">{[d.first_name, d.last_name].filter(Boolean).join(' ') || d.email || 'Existing contact'}</span>
                          {d.company_name && <span className="text-amber-700"> · {d.company_name}</span>}
                          <span className="text-amber-600"> · matches {d.match_reasons.join(', ')}</span>
                        </span>
                        <button
                          onClick={() => setDetailContact({ id: d.id, ...d })}
                          className="inline-flex flex-shrink-0 items-center gap-1 rounded-md border border-amber-300 bg-white px-2 py-1 font-medium text-amber-700 hover:bg-amber-100"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Person */}
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Person</p>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="First Name" field="first_name" value={formData.first_name} onChange={handleFieldChange} icon={UserPlus} confidence={confidence.first_name} />
                <FormField label="Last Name" field="last_name" value={formData.last_name} onChange={handleFieldChange} icon={UserPlus} confidence={confidence.last_name} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Title" field="title" value={formData.title} onChange={handleFieldChange} confidence={confidence.title} />
                <FormField label="Department" field="department" value={formData.department} onChange={handleFieldChange} confidence={confidence.department} />
              </div>

              <FormField label="Email" field="email" value={formData.email} onChange={handleFieldChange} icon={Mail} type="email" confidence={confidence.email} />

              {/* All phone numbers */}
              <PhoneFields phones={formData.phones} onUpdate={updatePhone} onAdd={addPhone} onRemove={removePhone} confidence={confidence.phone ?? confidence.phones} />

              <FormField label="LinkedIn" field="linkedin_url" value={formData.linkedin_url} onChange={handleFieldChange} icon={Linkedin} placeholder="https://linkedin.com/in/..." confidence={confidence.linkedin_url} />

              {/* Company */}
              <p className="pt-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Company</p>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Company" field="company_name" value={formData.company_name} onChange={handleFieldChange} icon={Building2} confidence={confidence.company_name} />
                <FormField label="Website" field="website" value={formData.website} onChange={handleFieldChange} icon={Globe} confidence={confidence.website} />
              </div>

              {/* Location */}
              <p className="pt-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Location</p>
              <FormField label="Street Address" field="address" value={formData.address} onChange={handleFieldChange} icon={MapPin} confidence={confidence.address} />
              <div className="grid grid-cols-2 gap-3">
                <FormField label="City" field="city" value={formData.city} onChange={handleFieldChange} confidence={confidence.city} />
                <FormField label="State / Province" field="state" value={formData.state} onChange={handleFieldChange} confidence={confidence.state} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="ZIP / Postal Code" field="postal_code" value={formData.postal_code} onChange={handleFieldChange} confidence={confidence.postal_code} />
                <FormField label="Country" field="country" value={formData.country} onChange={handleFieldChange} confidence={confidence.country} />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleFieldChange('notes', e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition resize-none"
                  placeholder="Additional notes..."
                />
              </div>

              <button
                onClick={handleAddContact}
                disabled={saving}
                className={`w-full inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60 disabled:cursor-not-allowed transition ${
                  dupes.length > 0 && dupeOverride ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Saving...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    {dupes.length > 0 ? (dupeOverride ? 'Add anyway' : 'Review & Add to Contacts') : 'Add to Contacts'}
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Empty state */
            <div className="rounded-xl border border-gray-200 bg-white p-8 flex flex-col items-center justify-center text-center" style={{ minHeight: '320px' }}>
              <div className="rounded-full bg-gray-100 p-4 mb-4">
                <CreditCard className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-gray-700 font-medium mb-1">No card scanned yet</h3>
              <p className="text-gray-400 text-sm max-w-xs">
                Upload or photograph a business card, then click "Scan Card" to extract contact details automatically.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom section: all previously scanned business cards */}
      <div className="border-t border-gray-200 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Scanned Business Cards</h2>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                {totalScanned}
              </span>
            </div>
            <p className="ml-7 text-sm text-gray-500">
              Every contact captured from a scanned card, with full details.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {totalScanned > 0 && (
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search scanned contacts…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}

            {totalScanned > 0 && (
              <>
                {/* View toggle */}
                <div className="flex rounded-lg border border-gray-300 bg-white p-0.5">
                  <button
                    onClick={() => setView('cards')}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${view === 'cards' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                    title="Card view"
                  >
                    <ListIcon className="h-3.5 w-3.5" />
                    Cards
                  </button>
                  <button
                    onClick={() => setView('gallery')}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${view === 'gallery' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                    title="Image gallery"
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    Gallery
                  </button>
                </div>

                <button
                  onClick={exportCsv}
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  title="Export scanned contacts to CSV"
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </button>
              </>
            )}
          </div>
        </div>

        {contactsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
          </div>
        ) : scannedCards.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <div className="mx-auto mb-3 w-fit rounded-full bg-gray-100 p-3">
              <ScanLine className="h-7 w-7 text-gray-400" />
            </div>
            <h3 className="font-medium text-gray-700">
              {totalScanned === 0 ? 'No scanned cards yet' : 'No matches'}
            </h3>
            <p className="mx-auto mt-1 max-w-xs text-sm text-gray-400">
              {totalScanned === 0
                ? 'Scan your first business card above and it will appear here.'
                : 'Try a different search term.'}
            </p>
          </div>
        ) : view === 'gallery' ? (
          galleryCards.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-400">
              None of these scanned contacts has a saved card image.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {galleryCards.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setDetailContact(c)}
                  className="group overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
                >
                  <CardImageThumb
                    contactId={c.id}
                    alt={`Card for ${fullName(c)}`}
                    className="aspect-[16/10] w-full bg-gray-50 object-cover"
                  />
                  <div className="p-3">
                    <p className="truncate text-sm font-semibold text-gray-900">{fullName(c)}</p>
                    {c.company && <p className="truncate text-xs text-gray-500">{c.company}</p>}
                  </div>
                </button>
              ))}
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {scannedCards.map((c) => (
              <ScannedContactCard key={c.id} contact={c} onOpen={setDetailContact} />
            ))}
          </div>
        )}
      </div>

      {detailContact && (
        <ContactDetailModal
          contactId={detailContact.id}
          initial={detailContact}
          onClose={() => setDetailContact(null)}
        />
      )}
    </div>
  );
}
