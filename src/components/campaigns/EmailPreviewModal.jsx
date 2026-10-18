import { useEffect, useState } from 'react';
import { BookmarkPlus, Check, Mail, Paperclip, SkipForward, X } from 'lucide-react';
import { useSaveDraftAsTemplate } from '../../hooks/useCampaigns';
import SafeHtml from '../SafeHtml';
import { EMAIL_BODY_CLASSES, prepareEmailHtml } from '../outreach/PreviewModal';
import { ProspectStatusBadge } from './StatusBadge';

// Save this draft as a reusable email template; the prospect's name, company and
// title become merge fields. Optionally draft the rest of the campaign from it.
export function SaveTemplateForm({ campaignId, prospect, onSaved }) {
  const [name, setName] = useState('');
  const [use, setUse] = useState('');
  const save = useSaveDraftAsTemplate(campaignId);
  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    await save.mutateAsync({ prospectId: prospect.id, name: name.trim(), ...(use ? { use_for_campaign: use } : {}) });
    onSaved?.();
  };
  return (
    <form onSubmit={submit} className="mt-4 space-y-2 rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
      <label className="block text-xs font-medium text-gray-600">
        Template name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. SRE intro"
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-xs font-medium text-gray-600">
        For the rest of this campaign
        <select value={use} onChange={(e) => setUse(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
          <option value="">Just save it (keep drafting as now)</option>
          <option value="ai_template">Draft from it, personalised by AI</option>
          <option value="template">Draft from it, exactly as written</option>
        </select>
      </label>
      <p className="text-xs text-gray-500">The prospect&apos;s name, company and title become merge fields. Edit it any time in Email Templates.</p>
      <div className="flex justify-end">
        <button type="submit" disabled={!name.trim() || save.isPending}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
          {save.isPending ? 'Saving…' : 'Save template'}
        </button>
      </div>
    </form>
  );
}

// The generated email for one prospect, as it will be (or was) sent. Drafts can
// be approved or skipped from here without going back to the table.
export default function EmailPreviewModal({ prospect, onClose, onApprove, onSkip, busy, attachments = [], campaignId }) {
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!prospect) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prospect, onClose]);

  if (!prospect) return null;
  const isDraft = prospect.status === 'draft';
  const canSkip = isDraft || prospect.status === 'queued';
  const hasEmail = Boolean(prospect.subject || prospect.body);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-preview-title"
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
          <div className="min-w-0">
            <h3 id="email-preview-title" className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <Mail className="h-5 w-5 text-indigo-500" />
              Email preview
            </h3>
            <p className="mt-0.5 truncate text-sm text-gray-500">
              To {prospect.contact_name || 'contact'}
              {prospect.contact_email && <> &lt;{prospect.contact_email}&gt;</>} · {prospect.company_name}
            </p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <ProspectStatusBadge status={prospect.status} />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {hasEmail ? (
            <>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Subject</p>
              <p className="mt-1 text-sm font-medium text-gray-900" data-testid="preview-subject">
                {prospect.subject || '(no subject)'}
              </p>
              <p className="mt-4 text-xs font-medium uppercase tracking-wider text-gray-400">Body</p>
              <SafeHtml
                html={prepareEmailHtml(prospect.body)}
                className={`${EMAIL_BODY_CLASSES} mt-1 rounded-lg border border-gray-100 bg-gray-50 p-4`}
                data-testid="preview-body"
              />
              {attachments.length > 0 && (
                <div className="mt-3" data-testid="preview-attachments">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Attachments</p>
                  <ul className="mt-1 flex flex-wrap gap-2">
                    {attachments.map((name) => (
                      <li key={name} className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700">
                        <Paperclip className="h-3 w-3 text-gray-400" />
                        {name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {campaignId && (saving ? (
                <SaveTemplateForm campaignId={campaignId} prospect={prospect} onSaved={() => setSaving(false)} />
              ) : (
                <button type="button" onClick={() => setSaving(true)}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:underline">
                  <BookmarkPlus className="h-4 w-4" />
                  Save as template
                </button>
              ))}
            </>
          ) : (
            <p className="py-8 text-center text-sm text-gray-500">
              No email has been written for this prospect yet. Autopilot drafts it shortly before the send window.
            </p>
          )}
        </div>

        {(isDraft || canSkip) && (
          <div className="flex flex-col-reverse gap-2 border-t border-gray-200 px-5 py-3 sm:flex-row sm:justify-end">
            {canSkip && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onSkip(prospect)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <SkipForward className="h-4 w-4" />
                Skip prospect
              </button>
            )}
            {isDraft && hasEmail && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onApprove(prospect)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                Approve &amp; queue
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
