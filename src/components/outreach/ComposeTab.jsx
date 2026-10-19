import { useState, useMemo, useEffect } from 'react';
import {
  Mail,
  Plus,
  Send,
  Eye,
  Search,
  X,
  CheckCircle2,
  Users,
  UserPlus,
  Filter,
  TestTube,
  Calendar,
  Shuffle,
  GitBranch,
  Save,
  AlertCircle,
  ChevronDown,
  Wand2,
} from 'lucide-react';
import EmptyState from '../EmptyState';
import PreviewModal from './PreviewModal';
import {
  useEmailTemplates,
  usePreviewTemplate,
  useComposeEmail,
  useAllEmailSends,
  useSendTestEmail,
} from '../../hooks/useEmailTemplates';
import { useSequences, useEnrollBatch } from '../../hooks/useOutreach';
import { useContacts, useQuickAddContact } from '../../hooks/useContacts';
import { useGmailStatus } from '../../hooks/useGmail';
import { cn, timeAgo } from '../../lib/utils';
import { MERGE_FIELDS } from '../../lib/mockData';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

// ---- Quick Add Modal ----
function QuickAddModal({ open, onClose }) {
  const [companyName, setCompanyName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [title, setTitle] = useState('');
  const quickAdd = useQuickAddContact();

  const reset = () => {
    setCompanyName('');
    setFirstName('');
    setLastName('');
    setEmail('');
    setTitle('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!companyName.trim() || !email.trim()) return;
    quickAdd.mutate(
      {
        company_name: companyName.trim(),
        first_name: firstName.trim() || undefined,
        last_name: lastName.trim() || undefined,
        email: email.trim(),
        title: title.trim() || undefined,
      },
      { onSuccess: () => { reset(); onClose(); } }
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-gray-900">Quick Add Contact</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3 p-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Company Name *</label>
            <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Corp" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            <p className="mt-0.5 text-xs text-gray-400">If the company already exists, the contact will be added to it.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">First Name</label>
              <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Last Name</label>
              <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email *</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@acme.com" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VP of Marketing" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-3">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={!companyName.trim() || !email.trim() || quickAdd.isPending} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-600 disabled:opacity-50">
              <UserPlus className="h-4 w-4" />
              {quickAdd.isPending ? 'Adding...' : 'Add Contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---- Send Test Modal ----
function SendTestModal({ open, onClose, templateId, senderAccountId, defaultEmail }) {
  const [testEmail, setTestEmail] = useState(defaultEmail || '');
  const sendTest = useSendTestEmail();

  useEffect(() => {
    if (open && defaultEmail) setTestEmail(defaultEmail);
  }, [open, defaultEmail]);

  const handleSend = () => {
    if (!testEmail.trim() || !templateId) return;
    sendTest.mutate(
      { template_id: templateId, test_email: testEmail.trim(), sender_account_id: senderAccountId || undefined },
      { onSuccess: () => onClose() }
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <div className="flex items-center gap-2">
            <TestTube className="h-4 w-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-gray-900">Send Test Email</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 p-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Recipient Email</label>
            <input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="you@example.com" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            <p className="mt-1 text-xs text-gray-400">A test email will be sent using sample merge fields.</p>
          </div>
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-3">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="button" onClick={handleSend} disabled={!testEmail.trim() || sendTest.isPending} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-600 disabled:opacity-50">
              <Send className="h-4 w-4" />
              {sendTest.isPending ? 'Sending...' : 'Send Test'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Send Confirm Modal ----
function SendConfirmModal({ open, onClose, onConfirm, templateName, senderEmail, subjectLine, contactCount, scheduleMode, scheduledAt, abTestEnabled }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-gray-900">Confirm Email Send</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 p-5">
          <div className="space-y-2 rounded-lg bg-gray-50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Template</span>
              <span className="font-medium text-gray-900">{templateName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">From</span>
              <span className="font-medium text-gray-900">{senderEmail || 'Default sender'}</span>
            </div>
            {subjectLine && (
              <div className="flex justify-between">
                <span className="text-gray-500">Subject</span>
                <span className="max-w-[220px] truncate font-medium text-gray-900">{subjectLine}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Recipients</span>
              <span className="font-medium text-gray-900">{contactCount} contact{contactCount !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Delivery</span>
              <span className="font-medium text-gray-900">
                {scheduleMode === 'later' && scheduledAt
                  ? `Scheduled: ${new Date(scheduledAt).toLocaleString()}`
                  : 'Send immediately'}
              </span>
            </div>
            {abTestEnabled && (
              <div className="flex justify-between">
                <span className="text-gray-500">A/B Test</span>
                <span className="font-medium text-purple-700">Enabled (50/50 split)</span>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400">This action cannot be undone. Emails will be sent to all selected contacts.</p>
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-3">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="button" onClick={onConfirm} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-600">
              <Send className="h-4 w-4" />
              Confirm Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Draft helpers ----
const DRAFT_KEY = 'landline_outreach_draft';
function loadDraft() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY)) || null; } catch { return null; }
}
function saveDraft(data) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}
function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}

// ---- Main ----
export default function ComposeTab() {
  const { data: templates } = useEmailTemplates();
  const { data: contactsRaw, isLoading: contactsLoading } = useContacts({ pageSize: 200 });
  const contacts = useMemo(() => contactsRaw?.items || (Array.isArray(contactsRaw) ? contactsRaw : []), [contactsRaw]);
  const { data: sends } = useAllEmailSends();
  const { data: gmail } = useGmailStatus();
  const preview = usePreviewTemplate();
  const compose = useComposeEmail();

  const [templateId, setTemplateId] = useState('');
  const [senderId, setSenderId] = useState('');
  const [selected, setSelected] = useState({});
  const [search, setSearch] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [sendTestOpen, setSendTestOpen] = useState(false);
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false);
  const [abTestEnabled, setAbTestEnabled] = useState(false);
  const [subjectB, setSubjectB] = useState('');
  const [scheduleMode, setScheduleMode] = useState('now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [enrollSequenceOpen, setEnrollSequenceOpen] = useState(false);
  const [selectedSequenceId, setSelectedSequenceId] = useState('');
  const [sendError, setSendError] = useState('');
  const [mergeFieldOpen, setMergeFieldOpen] = useState(false);

  const { data: sequences } = useSequences();
  const enrollBatch = useEnrollBatch();

  // Restore draft on mount
  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      if (draft.templateId) setTemplateId(draft.templateId);
      if (draft.selected) setSelected(draft.selected);
      if (draft.abTestEnabled) setAbTestEnabled(draft.abTestEnabled);
      if (draft.subjectB) setSubjectB(draft.subjectB);
    }
  }, []);

  // Default-select the default template once templates load.
  useEffect(() => {
    if (!templateId && templates?.length) {
      const def = templates.find((t) => t.is_default) || templates[0];
      setTemplateId(def.id);
    }
  }, [templates, templateId]);

  useEffect(() => {
    if (!senderId && gmail?.active_account_id) {
      setSenderId(gmail.active_account_id);
    }
  }, [gmail, senderId]);

  const gmailAccounts = gmail?.accounts?.filter((a) => a.status === 'connected') || [];
  const sendingEnabledAccounts = gmailAccounts.filter((a) => a.sending_enabled);
  const fromEmail = senderId === 'rotate'
    ? null
    : senderId
      ? gmailAccounts.find((a) => a.id === senderId)?.email
      : gmail?.active_email;
  const sendingVia = fromEmail || gmail?.fallback_sender;

  const lastSentByContact = useMemo(() => {
    const map = {};
    (sends || []).forEach((s) => {
      if (!s.contact_id) return;
      const prev = map[String(s.contact_id)];
      if (!prev || new Date(s.sent_at) > new Date(prev)) map[String(s.contact_id)] = s.sent_at;
    });
    return map;
  }, [sends]);

  const withEmail = useMemo(() => (contacts || []).filter((c) => c.email), [contacts]);

  const uniqueIndustries = useMemo(
    () => [...new Set(withEmail.map((c) => c.industry_segment).filter(Boolean))].sort(),
    [withEmail]
  );
  const uniqueCompanies = useMemo(
    () => [...new Set(withEmail.map((c) => c.company).filter(Boolean))].sort(),
    [withEmail]
  );

  const filtered = useMemo(() => {
    let result = withEmail;
    if (industryFilter) result = result.filter((c) => c.industry_segment === industryFilter);
    if (companyFilter) result = result.filter((c) => c.company === companyFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter((c) =>
        [c.first_name, c.last_name, c.email, c.company, c.title]
          .filter(Boolean)
          .some((v) => v.toLowerCase().includes(q))
      );
    }
    return result;
  }, [withEmail, search, industryFilter, companyFilter]);

  const selectedIds = useMemo(() => Object.keys(selected).filter((id) => selected[id]), [selected]);
  const selectedContacts = useMemo(() => withEmail.filter((c) => selected[String(c.id)]), [withEmail, selected]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selected[String(c.id)]);

  const toggleAll = () => {
    const next = { ...selected };
    if (allFilteredSelected) {
      filtered.forEach((c) => delete next[String(c.id)]);
    } else {
      filtered.forEach((c) => { next[String(c.id)] = true; });
    }
    setSelected(next);
  };

  const handlePreview = () => {
    const sample = selectedContacts[0] || withEmail[0];
    setPreviewOpen(true);
    preview.mutate({ template_id: templateId, contact_id: sample?.id, contact: sample });
  };

  const handleSend = () => {
    setSendError('');
    if (!selectedIds.length) {
      setSendError('Select at least one contact to send to.');
      return;
    }
    if (!templateId) {
      setSendError('Select a template before sending.');
      return;
    }
    // Validate template has content
    const tmpl = (templates || []).find((t) => t.id === templateId);
    if (tmpl && (!tmpl.subject?.trim() || !tmpl.body?.trim())) {
      setSendError('Selected template has an empty subject or body. Edit the template first.');
      return;
    }
    setSendConfirmOpen(true);
  };

  const handleSendConfirmed = () => {
    setSendConfirmOpen(false);
    const payload = {
      contact_ids: selectedIds,
      template_id: templateId,
      sender_account_id: senderId === 'rotate' ? undefined : senderId || undefined,
      contacts: withEmail,
    };
    if (abTestEnabled && subjectB.trim()) payload.subject_b = subjectB.trim();
    if (scheduleMode === 'later' && scheduledAt) payload.scheduled_at = new Date(scheduledAt).toISOString();
    compose.mutate(payload, {
      onSuccess: () => {
        setSelected({});
        clearDraft();
      },
    });
  };

  const handleSaveDraft = () => {
    saveDraft({ templateId, selected, abTestEnabled, subjectB });
    toast.success('Draft saved');
  };

  const handleEnrollInSequence = () => {
    if (!selectedSequenceId || !selectedIds.length) return;
    enrollBatch.mutate(
      { sequenceId: selectedSequenceId, contactIds: selectedIds },
      { onSuccess: () => { setEnrollSequenceOpen(false); setSelected({}); } }
    );
  };

  const selectedTemplateName = (templates || []).find((t) => t.id === templateId)?.name || 'Selected template';
  const previewContact = selectedContacts[0] || withEmail[0];

  // Selection summary
  const selectionSummary = useMemo(() => {
    if (!selectedIds.length) return null;
    const companies = [...new Set(selectedContacts.map(c => c.company).filter(Boolean))];
    return {
      count: selectedIds.length,
      companies: companies.length,
      companyList: companies.slice(0, 3).join(', ') + (companies.length > 3 ? ` +${companies.length - 3} more` : ''),
    };
  }, [selectedIds, selectedContacts]);

  return (
    <div className="space-y-5">
      {/* Send validation error */}
      {sendError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {sendError}
          <button type="button" onClick={() => setSendError('')} className="ml-auto rounded p-0.5 hover:bg-red-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Controls */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        {/* From / sender */}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">From</label>
          {gmailAccounts.length > 0 ? (
            <>
              <select
                value={senderId}
                onChange={(e) => setSenderId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {sendingEnabledAccounts.length > 1 && (
                  <option value="rotate">Auto-rotate ({sendingEnabledAccounts.length} accounts)</option>
                )}
                {gmailAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.email}{a.is_active ? ' (primary)' : ''}{!a.sending_enabled ? ' (disabled)' : ''}{a.daily_send_count ? ` [${a.daily_send_count} sent today]` : ''}
                  </option>
                ))}
              </select>
              {(() => {
                const selectedAccount = senderId === 'rotate'
                  ? null
                  : gmailAccounts.find((a) => a.id === senderId) || gmailAccounts.find((a) => a.is_active);
                if (!selectedAccount) return null;
                const count = selectedAccount.daily_send_count || 0;
                const limit = 500;
                const dotColor = count > 450 ? 'bg-red-500' : count >= 300 ? 'bg-yellow-500' : 'bg-green-500';
                return (
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className={cn('inline-block h-2.5 w-2.5 rounded-full', dotColor)} />
                    <span className="text-xs text-gray-500">{count} / {limit} sent today</span>
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-200">
                      <div
                        className={cn('h-full rounded-full transition-all', count > 450 ? 'bg-red-500' : count >= 300 ? 'bg-yellow-500' : 'bg-green-500')}
                        style={{ width: `${Math.min((count / limit) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })()}
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              <Mail className="h-4 w-4 flex-shrink-0" />
              <span>Sending from <span className="font-medium">{sendingVia}</span> (shared).</span>
              <Link to="/settings" className="font-medium text-blue-600 hover:underline">Connect your Gmail</Link>
            </div>
          )}
          {gmailAccounts.length > 0 && (
            <div className="mt-1 flex items-center justify-between">
              <p className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {senderId === 'rotate'
                  ? `Emails will rotate across ${sendingEnabledAccounts.length} accounts for better deliverability.`
                  : 'Recipients will see this as the sender -- authenticated, inbox-safe.'}
              </p>
              <Link to="/settings" className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline">
                <Plus className="h-3 w-3" />
                Add account
              </Link>
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Template</label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {(templates || []).map((t) => (
                <option key={t.id} value={t.id}>{t.name}{t.is_default ? ' (default)' : ''}</option>
              ))}
            </select>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAbTestEnabled(!abTestEnabled)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  abTestEnabled ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                <Shuffle className="h-3 w-3" />
                A/B Test
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMergeFieldOpen(!mergeFieldOpen)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200"
                >
                  Insert Merge Field
                  <ChevronDown className="h-3 w-3" />
                </button>
                {mergeFieldOpen && (
                  <div className="absolute left-0 top-full z-20 mt-1 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                    {MERGE_FIELDS.map((f) => (
                      <button
                        key={f.value}
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(f.value);
                          toast.success(`Copied ${f.value} to clipboard`);
                          setMergeFieldOpen(false);
                        }}
                        className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                      >
                        <span className="text-gray-700">{f.label}</span>
                        <span className="font-mono text-xs text-gray-400">{f.value}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {abTestEnabled && (
              <div className="mt-2">
                <label className="mb-1 block text-xs font-medium text-gray-500">Variant B Subject</label>
                <input type="text" value={subjectB} onChange={(e) => setSubjectB(e.target.value)} placeholder="Alternative subject line for B variant..." className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500" />
                <p className="mt-1 text-xs text-gray-400">50% of contacts will receive this subject. The other 50% get the template's original subject.</p>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <button type="button" onClick={handlePreview} disabled={!templateId || !previewContact} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 sm:px-4">
              <Eye className="h-4 w-4" />
              Preview
            </button>
            <button type="button" onClick={() => setSendTestOpen(true)} disabled={!templateId} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 sm:px-4">
              <TestTube className="h-4 w-4" />
              Test
            </button>
            <button type="button" onClick={handleSaveDraft} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:px-4">
              <Save className="h-4 w-4" />
              Draft
            </button>
            <button
              type="button"
              onClick={() => toast('AI suggestions coming soon', { icon: '✨' })}
              className="inline-flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-sm font-medium text-purple-700 hover:bg-purple-100 sm:px-4"
              title="AI-powered email improvement suggestions"
            >
              <Wand2 className="h-4 w-4" />
              AI Improve
            </button>
            <select value={scheduleMode} onChange={(e) => setScheduleMode(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option value="now">Send Now</option>
              <option value="later">Schedule</option>
            </select>
            {scheduleMode === 'later' && (
              <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} min={new Date().toISOString().slice(0, 16)} className="rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            )}
            <button
              type="button"
              onClick={handleSend}
              disabled={!selectedIds.length || !templateId || compose.isPending || (scheduleMode === 'later' && !scheduledAt)}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-600 disabled:opacity-50"
            >
              {scheduleMode === 'later' ? <Calendar className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              {compose.isPending ? 'Sending...' : scheduleMode === 'later' ? `Schedule ${selectedIds.length}` : `Send to ${selectedIds.length}`}
            </button>
            <div className="relative">
              <button type="button" onClick={() => setEnrollSequenceOpen(!enrollSequenceOpen)} disabled={!selectedIds.length} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                <GitBranch className="h-4 w-4" />
                Enroll in Sequence
              </button>
              {enrollSequenceOpen && (
                <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
                  <label className="mb-1 block text-xs font-medium text-gray-500">Select Sequence</label>
                  <select value={selectedSequenceId} onChange={(e) => setSelectedSequenceId(e.target.value)} className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                    <option value="">Choose a sequence...</option>
                    {(sequences || []).filter(s => s.is_active).map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.step_count} steps)</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setEnrollSequenceOpen(false)} className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                    <button type="button" onClick={handleEnrollInSequence} disabled={!selectedSequenceId || enrollBatch.isPending} className="flex-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-600 disabled:opacity-50">
                      {enrollBatch.isPending ? 'Enrolling...' : `Enroll ${selectedIds.length}`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Selection summary */}
      {selectionSummary && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm">
          <Users className="h-4 w-4 text-blue-500" />
          <span className="font-medium text-blue-700">{selectionSummary.count} contact{selectionSummary.count !== 1 ? 's' : ''} selected</span>
          <span className="text-blue-600/70">across {selectionSummary.companies} compan{selectionSummary.companies !== 1 ? 'ies' : 'y'}</span>
          {selectionSummary.companyList && <span className="text-xs text-blue-500">({selectionSummary.companyList})</span>}
          <button type="button" onClick={() => setSelected({})} className="ml-auto text-xs font-medium text-blue-600 hover:text-blue-700">Clear all</button>
        </div>
      )}

      {/* Template word/character count */}
      {templateId && (() => {
        const tmpl = (templates || []).find(t => t.id === templateId);
        if (!tmpl?.body) return null;
        const plainText = tmpl.body.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
        const charCount = plainText.length;
        const wordCount = plainText.trim().split(/\s+/).filter(Boolean).length;
        return (
          <div className="flex items-center gap-4 rounded-lg border border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-500">
            <span>{wordCount} words</span>
            <span>{charCount} characters</span>
            {charCount > 5000 && <span className="text-amber-600 font-medium">Long email — consider shortening</span>}
          </div>
        );
      })()}

      {/* Contact selector */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-900">
            <Users className="h-4 w-4 text-gray-400" />
            Select Contacts
            <span className="text-xs font-normal text-gray-400">({selectedIds.length} selected / {withEmail.length} with email)</span>
            <button type="button" onClick={() => setQuickAddOpen(true)} className="inline-flex items-center gap-1 rounded-md bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100">
              <UserPlus className="h-3.5 w-3.5" />
              Quick Add
            </button>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search contacts..." className="w-full rounded-lg border border-gray-300 py-2 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
        </div>

        {(uniqueIndustries.length > 0 || uniqueCompanies.length > 0) && (
          <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-4 py-3">
            <Filter className="h-4 w-4 text-gray-400" />
            {uniqueIndustries.length > 0 && (
              <select value={industryFilter} onChange={(e) => setIndustryFilter(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                <option value="">All Industries</option>
                {uniqueIndustries.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
              </select>
            )}
            {uniqueCompanies.length > 0 && (
              <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                <option value="">All Companies</option>
                {uniqueCompanies.map((co) => <option key={co} value={co}>{co}</option>)}
              </select>
            )}
            {(industryFilter || companyFilter) && (
              <button type="button" onClick={() => { setIndustryFilter(''); setCompanyFilter(''); }} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100">
                <X className="h-3 w-3" />
                Clear filters
              </button>
            )}
          </div>
        )}

        {(industryFilter || companyFilter) && (
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-2">
            <span className="text-xs font-medium text-gray-500">Active filters:</span>
            {industryFilter && (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                Industry: {industryFilter}
                <button type="button" onClick={() => setIndustryFilter('')} className="ml-0.5 rounded-full p-0.5 hover:bg-indigo-200">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {companyFilter && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                Company: {companyFilter}
                <button type="button" onClick={() => setCompanyFilter('')} className="ml-0.5 rounded-full p-0.5 hover:bg-emerald-200">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
        )}

        {contactsLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState title="No contacts found" description="Try a different search." icon={Users}
          action={{ label: 'Import contacts', href: '/import' }}
        />
        ) : (
          <div className="max-h-[28rem] overflow-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="sticky top-0 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="w-10 px-4 py-2">
                    <input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                  </th>
                  <th className="px-4 py-2">Contact</th>
                  <th className="px-4 py-2">Company</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Last Emailed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((c) => {
                  const id = String(c.id);
                  const lastSent = lastSentByContact[id];
                  return (
                    <tr key={id} className={cn('cursor-pointer hover:bg-gray-50', selected[id] && 'bg-blue-50/50')} onClick={() => setSelected((s) => ({ ...s, [id]: !s[id] }))}>
                      <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={!!selected[id]} onChange={() => setSelected((s) => ({ ...s, [id]: !s[id] }))} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-gray-900">{[c.first_name, c.last_name].filter(Boolean).join(' ') || '--'}</div>
                        {c.title && <div className="text-xs text-gray-500">{c.title}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">{c.company || '--'}</td>
                      <td className="px-4 py-2.5 text-gray-600">{c.email}</td>
                      <td className="px-4 py-2.5">
                        {lastSent ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                            <CheckCircle2 className="h-3 w-3" />
                            {timeAgo(lastSent)}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">--</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        loading={preview.isPending}
        subject={preview.data?.subject}
        body={preview.data?.body}
        templateId={templateId}
        templateName={(templates || []).find((t) => t.id === templateId)?.name}
        contextLabel={previewContact ? [previewContact.first_name, previewContact.last_name].filter(Boolean).join(' ') : 'sample contact'}
      />

      <QuickAddModal open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />

      <SendTestModal
        open={sendTestOpen}
        onClose={() => setSendTestOpen(false)}
        templateId={templateId}
        senderAccountId={senderId}
        defaultEmail={fromEmail || ''}
      />

      <SendConfirmModal
        open={sendConfirmOpen}
        onClose={() => setSendConfirmOpen(false)}
        onConfirm={handleSendConfirmed}
        templateName={selectedTemplateName}
        senderEmail={senderId === 'rotate' ? `Auto-rotate (${sendingEnabledAccounts.length} accounts)` : sendingVia}
        subjectLine={(templates || []).find((t) => t.id === templateId)?.subject}
        contactCount={selectedIds.length}
        scheduleMode={scheduleMode}
        scheduledAt={scheduledAt}
        abTestEnabled={abTestEnabled}
      />
    </div>
  );
}
