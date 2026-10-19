import { useEffect, useState } from 'react';
import { Loader2, Send, ShieldCheck, X } from 'lucide-react';
import { useCampaignProspects } from '../../hooks/useCampaigns';
import { emailVerification } from '../../lib/campaigns';
import { UnsubscribeFooter } from './EmailPreviewModal';
import SenderLine from './SenderLine';

// Who a hand-written email can go to: anyone in the campaign not yet mailed.
const COMPOSABLE = ['queued', 'draft', 'approved'];

const field =
  'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

const recipientLabel = (p) =>
  [p.contact_name || p.contact_email, p.company_domain || p.company_name].filter(Boolean).join(' at ');

/**
 * Write an email by hand and send it now — to the prospect it was opened from,
 * or to anyone in the campaign picked from the list. It replaces that
 * prospect's draft and goes through the same checks as every campaign email.
 */
export default function ComposeEmailModal({ campaignId, actions, prospect = null, sender = null, onClose }) {
  // Opened from the header there is no prospect yet: offer everyone eligible.
  const { data } = useCampaignProspects(prospect ? null : campaignId, { page: 1, pageSize: 100 });
  const options = prospect ? [prospect] : (data?.items ?? []).filter((p) => COMPOSABLE.includes(p.status) && p.contact_email);
  const [pid, setPid] = useState(prospect?.id || '');
  const to = options.find((p) => p.id === pid) || null;
  const [subject, setSubject] = useState(prospect?.subject || '');
  const [body, setBody] = useState(prospect?.body || '');

  // Picking someone with a draft starts from it; their own words, not a blank.
  const pick = (id) => {
    setPid(id);
    const p = options.find((x) => x.id === id);
    if (p && !subject.trim() && !body.trim()) {
      setSubject(p.subject || '');
      setBody(p.body || '');
    }
  };

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const verification = to ? emailVerification(to) : null;
  const valid = to && subject.trim() && body.trim();
  const submit = (e) => {
    e.preventDefault();
    if (!valid) return;
    actions.composeSend(to.id, { subject: subject.trim(), body: body.trim() }, recipientLabel(to), {
      onSuccess: (r) => { if (r?.outcome === 'sent' || r?.outcome === 'held') onClose(); },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-label="Write an email"
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h3 className="text-base font-semibold text-gray-900">Write an email</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto px-5 py-4">
          <SenderLine sender={sender} />
          <label className="block text-xs font-medium text-gray-600">
            To
            {prospect ? (
              <p className="mt-1 text-sm text-gray-900">
                {recipientLabel(prospect)} <span className="text-gray-500">&lt;{prospect.contact_email}&gt;</span>
              </p>
            ) : (
              <select value={pid} onChange={(e) => pick(e.target.value)} className={`${field} bg-white`} aria-label="Recipient">
                <option value="">{data ? (options.length ? 'Choose a prospect…' : 'No one left to email in this campaign') : 'Loading…'}</option>
                {options.map((p) => (
                  <option key={p.id} value={p.id}>
                    {recipientLabel(p)} — {p.contact_email}
                  </option>
                ))}
              </select>
            )}
          </label>
          {verification && verification.key !== 'verified' && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" role="status">
              {verification.label}: only verified addresses are sent. This one will wait until it is verified.
            </p>
          )}
          <label className="block text-xs font-medium text-gray-600">
            Subject
            <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} className={field} />
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Message
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={9}
              maxLength={4000}
              className={`${field} font-sans`}
              placeholder={'Hi Ana,\n\n…'}
            />
          </label>
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Added when sent</p>
            <UnsubscribeFooter />
          </div>
          <p className="flex items-start gap-1.5 text-xs text-gray-500">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-green-600" />
            Sent as plain text with a one-click unsubscribe header, only to verified addresses, never twice to the
            same person. Each mailbox sends at most one email every 45 seconds and 30 an hour, within its warm-up limit.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!valid || actions.isComposeSending}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {actions.isComposeSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {actions.isComposeSending ? 'Sending…' : 'Send now'}
          </button>
        </div>
      </form>
    </div>
  );
}
