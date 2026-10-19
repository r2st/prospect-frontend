import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  X,
  Mail,
  Phone,
  Globe,
  MapPin,
  Building2,
  Linkedin,
  CreditCard,
  Briefcase,
  StickyNote,
  Pencil,
  Check,
  Plus,
  Trash2,
} from 'lucide-react';
import { contactsApi, queryClient } from '../api/client';
import { getInitials, contactPhones, formatDate, phonesToPayload } from '../lib/utils';
import ContactSendTiming from './ContactSendTiming';
import ContactEngagement, { ContactTags } from './ContactEngagement';

const fullName = (c) =>
  [c?.first_name, c?.last_name].filter(Boolean).join(' ').trim() || c?.email || 'Unknown';

function Row({ icon: Icon, children }) {
  return (
    <div className="flex items-start gap-2.5 text-sm text-gray-700">
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', className = '' }) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium text-gray-500">{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </div>
  );
}

/**
 * Full detail view for a single contact. Fetches the contact by id so it gets
 * the heavy fields the list omits — most importantly the scanned card image
 * (returned as a base64 data URL) and the full address. `initial` is the
 * already-loaded list row, used as a placeholder until the detail arrives.
 *
 * Supports an inline Edit mode so any contact (including a scanned card) can be
 * corrected after the fact.
 */
export default function ContactDetailModal({ contactId, initial, onClose, embedded = false }) {
  useEffect(() => {
    if (embedded) return; // slide-over handles its own Escape key
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, embedded]);

  const { data: detail, isLoading } = useQuery({
    queryKey: ['contact', contactId],
    queryFn: () => contactsApi.getById(contactId),
    enabled: !!contactId,
  });

  // Merge: detail (authoritative) over the list row we already had.
  const c = { ...(initial || {}), ...(detail || {}) };

  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  useEffect(() => { if (!editingNotes) setNotesDraft(c.notes || ''); }, [c.notes, editingNotes]);

  // --- Full edit mode ---
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const startEdit = () => {
    setForm({
      first_name: c.first_name || '',
      last_name: c.last_name || '',
      title: c.title || '',
      department: c.department || '',
      email: c.email || '',
      phones: contactPhones(c),
      website: c.website || '',
      linkedin_url: c.linkedin_url || '',
      address: c.address || '',
      city: c.city || '',
      state: c.state || '',
      postal_code: c.postal_code || '',
      country: c.country || '',
      notes: c.notes || '',
    });
    setEditing(true);
  };
  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const setPhone = (i, k, v) =>
    setForm((p) => {
      const phones = [...p.phones];
      phones[i] = { ...phones[i], [k]: v };
      return { ...p, phones };
    });
  const addPhone = () => setForm((p) => ({ ...p, phones: [...p.phones, { label: 'Phone', number: '' }] }));
  const removePhone = (i) => setForm((p) => ({ ...p, phones: p.phones.filter((_, idx) => idx !== i) }));

  const saveEdit = useMutation({
    mutationFn: () => {
      const { phones, ...rest } = form;
      return contactsApi.update(contactId, { ...rest, ...phonesToPayload(phones) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact', contactId] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast.success('Contact updated');
      setEditing(false);
    },
    onError: (e) => toast.error(e?.response?.data?.detail || 'Failed to update contact'),
  });

  const saveNotes = useMutation({
    mutationFn: (notes) => contactsApi.update(contactId, { notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact', contactId] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Note saved');
      setEditingNotes(false);
    },
    onError: (e) => toast.error(e?.response?.data?.detail || 'Failed to save note'),
  });

  const phones = contactPhones(c);
  const location = [c.address, c.city, c.state, c.postal_code, c.country]
    .filter(Boolean)
    .join(', ');
  const companyName = c.company || c.company_name;

  // The inner content, shared between modal and embedded modes.
  const headerContent = (
    <div className={embedded ? 'flex items-start justify-between gap-3 border-b border-gray-100 bg-white px-6 py-4' : 'sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-gray-100 bg-white px-6 py-4'}>
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-base font-semibold text-blue-600">
          {getInitials(c.first_name, c.last_name)}
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold text-gray-900">{fullName(c)}</h2>
          <p className="truncate text-sm text-gray-500">
            {[c.title, c.department].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {!editing && (
          <button
            onClick={startEdit}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
        )}
        {!embedded && (
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );

  // When embedded inside a slide-over, render without the modal backdrop/centering wrapper.
  if (embedded) {
    return (
      <div>
        {headerContent}
        {editing ? (
          <div className="space-y-4 px-6 py-5">
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name" value={form.first_name} onChange={(v) => setField('first_name', v)} />
              <Field label="Last name" value={form.last_name} onChange={(v) => setField('last_name', v)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Title" value={form.title} onChange={(v) => setField('title', v)} />
              <Field label="Department" value={form.department} onChange={(v) => setField('department', v)} />
            </div>
            <Field label="Email" type="email" value={form.email} onChange={(v) => setField('email', v)} />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-gray-500">Phone numbers</label>
                <button type="button" onClick={addPhone} className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700">
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </div>
              {form.phones.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={p.label || ''} onChange={(e) => setPhone(i, 'label', e.target.value)} placeholder="Label" className="w-24 rounded-lg border border-gray-300 px-2 py-2 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  <input value={p.number || ''} onChange={(e) => setPhone(i, 'number', e.target.value)} placeholder="Number" className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  <button type="button" onClick={() => removePhone(i)} className="rounded-md p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Website" value={form.website} onChange={(v) => setField('website', v)} />
              <Field label="LinkedIn" value={form.linkedin_url} onChange={(v) => setField('linkedin_url', v)} />
            </div>
            <Field label="Street address" value={form.address} onChange={(v) => setField('address', v)} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="City" value={form.city} onChange={(v) => setField('city', v)} />
              <Field label="State / Province" value={form.state} onChange={(v) => setField('state', v)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="ZIP / Postal" value={form.postal_code} onChange={(v) => setField('postal_code', v)} />
              <Field label="Country" value={form.country} onChange={(v) => setField('country', v)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Notes</label>
              <textarea value={form.notes} onChange={(e) => setField('notes', e.target.value)} rows={2} className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setEditing(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={() => saveEdit.mutate()} disabled={saveEdit.isPending} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
                <Check className="h-4 w-4" />{saveEdit.isPending ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-4">
              {companyName && (<Row icon={Building2}>{c.company_id ? (<Link to={`/companies/${c.company_id}`} className="font-medium text-blue-600 hover:text-blue-700">{companyName}</Link>) : (<span className="font-medium text-gray-800">{companyName}</span>)}</Row>)}
              {c.email && (<Row icon={Mail}><a href={`mailto:${c.email}`} className="text-gray-700 hover:text-blue-600 break-all">{c.email}</a></Row>)}
              {phones.length > 0 && (<div className="space-y-1.5">{phones.map((p, i) => (<Row key={`${p.number}-${i}`} icon={Phone}><a href={`tel:${p.number}`} className="text-gray-700 hover:text-blue-600">{p.number}{p.label && <span className="ml-2 text-xs text-gray-400">{p.label}</span>}</a></Row>))}</div>)}
              {c.website && (<Row icon={Globe}><a href={c.website.startsWith('http') ? c.website : `https://${c.website}`} target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-blue-600 break-all">{c.website.replace(/^https?:\/\//, '')}</a></Row>)}
              {c.linkedin_url && (<Row icon={Linkedin}><a href={c.linkedin_url.startsWith('http') ? c.linkedin_url : `https://${c.linkedin_url}`} target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-blue-600">LinkedIn profile</a></Row>)}
              {location && (<Row icon={MapPin}><span className="text-gray-700">{location}</span></Row>)}
              {c.source && (<Row icon={/card|scan/.test(String(c.source).toLowerCase()) ? CreditCard : Briefcase}><span className="text-gray-600">{/card|scan/.test(String(c.source).toLowerCase()) ? 'Scanned card' : c.source}{c.created_at && ` · ${formatDate(c.created_at)}`}</span></Row>)}
              <div className="flex items-start gap-2.5 text-sm text-gray-700">
                <StickyNote className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                <div className="min-w-0 flex-1">
                  {editingNotes ? (
                    <div className="space-y-2">
                      <textarea value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} rows={3} autoFocus placeholder="Add a note..." className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => { setNotesDraft(c.notes || ''); setEditingNotes(false); }} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                        <button type="button" onClick={() => saveNotes.mutate(notesDraft)} disabled={saveNotes.isPending} className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-600 disabled:opacity-50"><Check className="h-3 w-3" />Save</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <span className="whitespace-pre-wrap text-gray-600">{c.notes || <span className="text-gray-400">No notes yet.</span>}</span>
                      <button type="button" onClick={() => setEditingNotes(true)} className="inline-flex flex-shrink-0 items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"><Pencil className="h-3 w-3" />{c.notes ? 'Edit' : 'Add'}</button>
                    </div>
                  )}
                </div>
              </div>
              <ContactSendTiming contactId={contactId} />
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Card Image</p>
              {isLoading ? (
                <div className="flex h-48 items-center justify-center rounded-lg border border-gray-200 bg-gray-50"><div className="h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600" /></div>
              ) : c.card_image ? (
                <a href={c.card_image} target="_blank" rel="noopener noreferrer"><img src={c.card_image} alt={`Business card for ${fullName(c)}`} className="w-full rounded-lg border border-gray-200 object-contain shadow-sm" /></a>
              ) : (
                <div className="flex h-48 flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-center text-sm text-gray-400"><CreditCard className="mb-2 h-6 w-6" />No card image saved</div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {headerContent}

        {editing ? (
          /* ---------- Edit mode ---------- */
          <div className="space-y-4 px-6 py-5">
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name" value={form.first_name} onChange={(v) => setField('first_name', v)} />
              <Field label="Last name" value={form.last_name} onChange={(v) => setField('last_name', v)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Title" value={form.title} onChange={(v) => setField('title', v)} />
              <Field label="Department" value={form.department} onChange={(v) => setField('department', v)} />
            </div>
            <Field label="Email" type="email" value={form.email} onChange={(v) => setField('email', v)} />

            {/* Phones */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-gray-500">Phone numbers</label>
                <button type="button" onClick={addPhone} className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700">
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </div>
              {form.phones.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={p.label || ''}
                    onChange={(e) => setPhone(i, 'label', e.target.value)}
                    placeholder="Label"
                    className="w-24 rounded-lg border border-gray-300 px-2 py-2 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    value={p.number || ''}
                    onChange={(e) => setPhone(i, 'number', e.target.value)}
                    placeholder="Number"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button type="button" onClick={() => removePhone(i)} className="rounded-md p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Website" value={form.website} onChange={(v) => setField('website', v)} />
              <Field label="LinkedIn" value={form.linkedin_url} onChange={(v) => setField('linkedin_url', v)} />
            </div>
            <Field label="Street address" value={form.address} onChange={(v) => setField('address', v)} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="City" value={form.city} onChange={(v) => setField('city', v)} />
              <Field label="State / Province" value={form.state} onChange={(v) => setField('state', v)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="ZIP / Postal" value={form.postal_code} onChange={(v) => setField('postal_code', v)} />
              <Field label="Country" value={form.country} onChange={(v) => setField('country', v)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                rows={2}
                className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setEditing(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => saveEdit.mutate()}
                disabled={saveEdit.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                <Check className="h-4 w-4" />
                {saveEdit.isPending ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        ) : (
          /* ---------- Read mode ---------- */
          <div className="grid grid-cols-1 gap-6 px-6 py-5 sm:grid-cols-2">
            {/* Left: details */}
            <div className="space-y-4">
              {companyName && (
                <Row icon={Building2}>
                  {c.company_id ? (
                    <Link to={`/companies/${c.company_id}`} className="font-medium text-blue-600 hover:text-blue-700">
                      {companyName}
                    </Link>
                  ) : (
                    <span className="font-medium text-gray-800">{companyName}</span>
                  )}
                </Row>
              )}

              {c.email && (
                <Row icon={Mail}>
                  <a href={`mailto:${c.email}`} className="text-gray-700 hover:text-blue-600 break-all">
                    {c.email}
                  </a>
                </Row>
              )}

              {/* All phone numbers */}
              {phones.length > 0 && (
                <div className="space-y-1.5">
                  {phones.map((p, i) => (
                    <Row key={`${p.number}-${i}`} icon={Phone}>
                      <a href={`tel:${p.number}`} className="text-gray-700 hover:text-blue-600">
                        {p.number}
                        {p.label && <span className="ml-2 text-xs text-gray-400">{p.label}</span>}
                      </a>
                    </Row>
                  ))}
                </div>
              )}

              {c.website && (
                <Row icon={Globe}>
                  <a
                    href={c.website.startsWith('http') ? c.website : `https://${c.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-700 hover:text-blue-600 break-all"
                  >
                    {c.website.replace(/^https?:\/\//, '')}
                  </a>
                </Row>
              )}

              {c.linkedin_url && (
                <Row icon={Linkedin}>
                  <a
                    href={c.linkedin_url.startsWith('http') ? c.linkedin_url : `https://${c.linkedin_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-700 hover:text-blue-600"
                  >
                    LinkedIn profile
                  </a>
                </Row>
              )}

              {location && (
                <Row icon={MapPin}>
                  <span className="text-gray-700">{location}</span>
                </Row>
              )}

              {c.source && (
                <Row icon={/card|scan/.test(String(c.source).toLowerCase()) ? CreditCard : Briefcase}>
                  <span className="text-gray-600">
                    {/card|scan/.test(String(c.source).toLowerCase()) ? 'Scanned card' : c.source}
                    {c.created_at && ` · ${formatDate(c.created_at)}`}
                  </span>
                </Row>
              )}

              {/* Notes — editable */}
              <div className="flex items-start gap-2.5 text-sm text-gray-700">
                <StickyNote className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                <div className="min-w-0 flex-1">
                  {editingNotes ? (
                    <div className="space-y-2">
                      <textarea
                        value={notesDraft}
                        onChange={(e) => setNotesDraft(e.target.value)}
                        rows={3}
                        autoFocus
                        placeholder="Add a note — how you met, what they need, next steps…"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => { setNotesDraft(c.notes || ''); setEditingNotes(false); }}
                          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => saveNotes.mutate(notesDraft)}
                          disabled={saveNotes.isPending}
                          className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-600 disabled:opacity-50"
                        >
                          <Check className="h-3 w-3" />
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <span className="whitespace-pre-wrap text-gray-600">
                        {c.notes || <span className="text-gray-400">No notes yet.</span>}
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditingNotes(true)}
                        className="inline-flex flex-shrink-0 items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                      >
                        <Pencil className="h-3 w-3" />
                        {c.notes ? 'Edit' : 'Add'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Operator labels — the segmentation the taxonomy columns can't
                  express ("people I met at IMTS"). */}
              <ContactTags contactId={contactId} tags={c.tags || []} />

              {/* What we've already sent them. It lives on the contact rather
                  than in a reporting page because it's what you read before
                  deciding what to send next. */}
              <ContactEngagement contactId={contactId} />

              {/* Smart Send-Time — when this contact is most likely to open. */}
              <ContactSendTiming contactId={contactId} />
            </div>

            {/* Right: scanned card image */}
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Card Image
              </p>
              {isLoading ? (
                <div className="flex h-48 items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
                  <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600" />
                </div>
              ) : c.card_image ? (
                <a href={c.card_image} target="_blank" rel="noopener noreferrer">
                  <img
                    src={c.card_image}
                    alt={`Business card for ${fullName(c)}`}
                    className="w-full rounded-lg border border-gray-200 object-contain shadow-sm"
                  />
                </a>
              ) : (
                <div className="flex h-48 flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-center text-sm text-gray-400">
                  <CreditCard className="mb-2 h-6 w-6" />
                  No card image saved
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
