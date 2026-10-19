import { useMemo, useState } from 'react';
import { ArrowLeft, Eye, RefreshCw, Save, Send, Sparkles, Users } from 'lucide-react';
import {
  isGeminiKeyRequired,
  useDraftEmails,
  usePreviewEmails,
  useSendEmails,
} from '../../hooks/useDiscoveryDocuments';
import { usePersistedState } from '../../lib/persistedState';
import ConfirmDialog from '../ConfirmDialog';
import Skeleton from '../Skeleton';
import FollowUpStatus from './FollowUpStatus';
import GeminiKeyBanner from './GeminiKeyBanner';

const TONES = ['professional', 'friendly', 'conversational', 'urgent', 'empathetic'];
// Approved cadence: follow-ups on business days 3 and 7 (each delay counts
// from the previous email, so 3 then 4); a third follow-up, if added, at +7.
const DEFAULT_DELAYS = [3, 4, 7];
const MERGE_HINT = '{{ first_name }}, {{ company_name }}, {{ title }}, {{ industry }}, {{ city }}';

const inputCls =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

function recipientsOf(doc) {
  const out = [];
  for (const c of doc.candidates || []) {
    for (const p of c.contacts || []) {
      if (p.imported_contact_id && p.email) {
        out.push({
          id: p.imported_contact_id,
          name: [p.first_name, p.last_name].filter(Boolean).join(' '),
          email: p.email,
          company: c.name,
        });
      }
    }
  }
  // The same person can appear under two candidates; keep one row each.
  return [...new Map(out.map((r) => [r.id, r])).values()];
}

const EMPTY_DRAFT = { brief: '', tone: 'professional', followUps: 2, steps: [], excluded: [] };

export default function DocumentOutreach({ doc, onBack }) {
  const recipients = useMemo(() => recipientsOf(doc), [doc]);
  // The whole draft is saved per document, so leaving mid-edit loses nothing.
  // Recipients are stored as who's *left out*, so people imported later start ticked.
  const [draftState, setDraftState, clearDraft] = usePersistedState(
    `prospect.discovery.outreach.${doc.id}`,
    EMPTY_DRAFT
  );
  const { brief, tone, followUps, steps } = { ...EMPTY_DRAFT, ...draftState };
  const patchDraft = (patch) =>
    setDraftState((prev) => ({ ...EMPTY_DRAFT, ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) }));
  const setBrief = (v) => patchDraft({ brief: v });
  const setTone = (v) => patchDraft({ tone: v });
  const setFollowUps = (v) => patchDraft({ followUps: v });
  const setSteps = (fn) =>
    patchDraft((prev) => ({ steps: typeof fn === 'function' ? fn(prev?.steps || []) : fn }));
  const excluded = new Set(draftState?.excluded || []);
  const selected = new Set(recipients.filter((r) => !excluded.has(r.id)).map((r) => r.id));
  const setSelected = (next) =>
    patchDraft({ excluded: recipients.filter((r) => !next.has(r.id)).map((r) => r.id) });
  const [previewFor, setPreviewFor] = useState(recipients[0]?.id || '');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sent, setSent] = useState(null);

  const draft = useDraftEmails(doc.id);
  const preview = usePreviewEmails(doc.id);
  const send = useSendEmails(doc.id);

  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const runDraft = () =>
    draft.mutate(
      { brief, tone, follow_ups: followUps },
      {
        onSuccess: (res) => {
          const drafted = res.steps.map((s, i) => ({ ...s, delay_days: i === 0 ? 0 : s.delay_days ?? DEFAULT_DELAYS[i - 1] }));
          setSteps(drafted);
          preview.reset();
          // Show straight away how it reads for a real recipient.
          if (previewFor) {
            preview.mutate({
              steps: drafted.map((s, i) => ({ subject: s.subject, body: s.body, delay_days: i === 0 ? 0 : Number(s.delay_days) || 1 })),
              contact_id: previewFor,
            });
          }
        },
      }
    );

  const updateStep = (i, patch) => {
    setSteps((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
    preview.reset();
  };
  const removeStep = (i) => {
    setSteps((prev) => prev.filter((_, j) => j !== i));
    preview.reset();
  };
  const addFollowUp = () =>
    setSteps((prev) => [
      ...prev,
      { subject: `Re: ${prev[0]?.subject || ''}`, body: 'Hi {{ first_name }},\n\n', delay_days: DEFAULT_DELAYS[prev.length - 1] ?? 7 },
    ]);

  const payloadSteps = steps.map((s, i) => ({
    subject: s.subject,
    body: s.body,
    delay_days: i === 0 ? 0 : Number(s.delay_days) || 1,
  }));
  const stepsValid = steps.length > 0 && steps.every((s) => s.subject.trim() && s.body.trim());
  const recipientIds = recipients.filter((r) => selected.has(r.id)).map((r) => r.id);

  // Cumulative business day each step goes out on, for display.
  const dayOf = (i) => steps.slice(1, i + 1).reduce((n, s) => n + (Number(s.delay_days) || 0), 0);

  if (sent || doc.sequence_id) {
    const sendResult = sent && {
      ...sent,
      skipped: (sent.skipped || []).map((sk) => ({
        ...sk,
        email: recipients.find((r) => r.id === sk.contact_id)?.email,
      })),
    };
    return <FollowUpStatus docId={doc.id} sendResult={sendResult} />;
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to review
      </button>

      {isGeminiKeyRequired(draft.error) && <GeminiKeyBanner />}

      {/* Recipients */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            Recipients <span className="font-normal text-gray-500">({recipientIds.length} of {recipients.length})</span>
          </h3>
          <button
            type="button"
            onClick={() =>
              setSelected(recipientIds.length === recipients.length ? new Set() : new Set(recipients.map((r) => r.id)))
            }
            className="text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            {recipientIds.length === recipients.length ? 'Clear all' : 'Select all'}
          </button>
        </div>
        {recipients.length === 0 ? (
          <div className="flex flex-col items-center rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center">
            <Users className="h-8 w-8 text-gray-300" />
            <p className="mt-2 text-sm font-medium text-gray-900">No one to email yet</p>
            <p className="mt-1 text-sm text-gray-500">Import at least one person with an email address first.</p>
            <button
              type="button"
              onClick={onBack}
              className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Back to review
            </button>
          </div>
        ) : (
          <ul className="max-h-56 space-y-1 overflow-y-auto">
            {recipients.map((r) => (
              <li key={r.id}>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="font-medium">{r.name || r.email}</span>
                  <span className="text-gray-500">{r.name ? r.email : ''}</span>
                  <span className="text-gray-400">· {r.company}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Brief */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">What are you offering?</h3>
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={4}
          maxLength={2000}
          className={inputCls}
          placeholder="e.g. We build quick-change stamping dies that cut changeover from 2 hours to 10 minutes. Goal: book a 15-minute call."
        />
        <div className="mt-3 flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="outreach-tone" className="mb-1 block text-xs font-medium text-gray-600">Tone</label>
            <select id="outreach-tone" value={tone} onChange={(e) => setTone(e.target.value)} className={inputCls}>
              {TONES.map((t) => (
                <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="outreach-followups" className="mb-1 block text-xs font-medium text-gray-600">Follow-ups</label>
            <select id="outreach-followups" value={followUps} onChange={(e) => setFollowUps(Number(e.target.value))} className={inputCls}>
              {[0, 1, 2, 3].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={runDraft}
            disabled={brief.trim().length < 10 || draft.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-purple-700 disabled:opacity-50"
          >
            {draft.isPending ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : steps.length ? (
              <RefreshCw className="h-4 w-4" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {steps.length ? 'Redraft with AI' : 'Draft with AI'}
          </button>
        </div>
      </div>

      {draft.isPending && steps.length === 0 && (
        <div className="space-y-4" data-testid="draft-skeleton" aria-label="Drafting emails">
          {[0, 1].map((i) => (
            <div key={i} className="space-y-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
          ))}
          <p className="text-center text-xs text-gray-500">Writing your emails — usually 10–20 seconds…</p>
        </div>
      )}

      {/* Steps */}
      {steps.length > 0 && (
        <div className="space-y-4">
          <p className="flex flex-wrap items-center gap-1 text-xs text-gray-500">
            <Save className="h-3.5 w-3.5" />
            Edits save automatically. This exact copy is what gets sent. Merge fields: {MERGE_HINT}. An unsubscribe
            link is added automatically.
          </p>
          {steps.map((s, i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-gray-900">
                  {i === 0 ? 'First email' : `Follow-up ${i}`}
                  <span className="ml-2 font-normal text-gray-500">
                    {i === 0 ? '· sends first' : `· business day ${dayOf(i)}, if no reply`}
                  </span>
                </h4>
                {i > 0 && (
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <label htmlFor={`delay-${i}`}>Business days after previous email</label>
                    <input
                      id={`delay-${i}`}
                      type="number"
                      min={1}
                      max={60}
                      value={s.delay_days}
                      onChange={(e) => updateStep(i, { delay_days: e.target.value })}
                      className="w-16 rounded-lg border border-gray-300 px-2 py-1 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeStep(i)}
                      className="ml-2 text-xs font-medium text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
              <input
                type="text"
                value={s.subject}
                maxLength={300}
                onChange={(e) => updateStep(i, { subject: e.target.value })}
                className={`${inputCls} mb-2`}
                aria-label={`Subject for email ${i + 1}`}
              />
              <textarea
                value={s.body}
                rows={7}
                onChange={(e) => updateStep(i, { body: e.target.value })}
                className={`${inputCls} font-mono`}
                aria-label={`Body for email ${i + 1}`}
              />
            </div>
          ))}
          {steps.length < 4 && (
            <button
              type="button"
              onClick={addFollowUp}
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              + Add follow-up
            </button>
          )}

          {/* Preview */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[16rem] flex-1">
                <label htmlFor="outreach-preview-for" className="mb-1 block text-xs font-medium text-gray-600">Preview as</label>
                <select id="outreach-preview-for" value={previewFor} onChange={(e) => setPreviewFor(e.target.value)} className={inputCls}>
                  {recipients.map((r) => (
                    <option key={r.id} value={r.id}>{r.name || r.email} — {r.company}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                disabled={!stepsValid || !previewFor || preview.isPending}
                onClick={() => preview.mutate({ steps: payloadSteps, contact_id: previewFor })}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <Eye className="h-4 w-4" />
                Preview
              </button>
            </div>
            {!preview.data && !preview.isPending && (
              <p className="mt-3 text-xs text-gray-500">See exactly what a recipient will get, with merge fields filled in.</p>
            )}
            {preview.isPending && (
              <div className="mt-4 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-20 w-full" />
              </div>
            )}
            {preview.data && !preview.isPending && (
              <div className="mt-4 space-y-3">
                <p className="text-xs text-gray-500">To: {preview.data.to_email}</p>
                {preview.data.steps.map((p) => (
                  <div key={p.step_number} className="rounded-lg bg-gray-50 p-4">
                    <p className="text-sm font-semibold text-gray-900">{p.subject}</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{p.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={!stepsValid || !recipientIds.length || send.isPending}
              onClick={() => setConfirmOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-600 disabled:opacity-50"
            >
              {send.isPending ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send to {recipientIds.length} contact{recipientIds.length === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        variant="primary"
        title={`Send to ${recipientIds.length} contact${recipientIds.length === 1 ? '' : 's'}?`}
        message={`This creates a sequence: the first email goes out through your sending queue${
          steps.length > 1 ? `, then ${steps.length - 1} follow-up(s) on business days, stopping when someone replies` : ''
        }. Do-not-contact and unsubscribed addresses are skipped automatically.`}
        confirmLabel="Send"
        onConfirm={() => {
          setConfirmOpen(false);
          send.mutate(
            { contact_ids: recipientIds, steps: payloadSteps, tone },
            {
              onSuccess: (res) => {
                clearDraft();
                setSent(res);
              },
            }
          );
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
