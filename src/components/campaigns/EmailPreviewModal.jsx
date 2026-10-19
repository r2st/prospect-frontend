import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BookmarkPlus, Check, Download, FileText, Loader2, Mail, Paperclip, RefreshCw, SkipForward, X } from 'lucide-react';
import { campaignsApi } from '../../api/client';
import { useRedraftProspect, useSaveDraftAsTemplate } from '../../hooks/useCampaigns';
import { useEmailTemplates } from '../../hooks/useEmailTemplates';
import { highlightMergeFields } from '../../lib/mergeFields';
import { UNSUBSCRIBE_FOOTER } from '../../lib/campaigns';
import { MergeFieldList, MergeFieldText } from '../MergeFieldText';
import PdfPreview from './PdfPreview';
import SenderLine from './SenderLine';

// One attachment, opened: a PDF renders in place, anything else downloads.
export function AttachmentViewer({ campaignId, name }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['campaigns', 'attachment', campaignId, name],
    queryFn: () => campaignsApi.attachment(campaignId, name),
    staleTime: 0,
    gcTime: 60000,
    retry: false,
  });
  if (isLoading) {
    return (
      <p className="mt-2 flex items-center text-sm text-gray-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading {name}…
      </p>
    );
  }
  if (isError || !data) return <p className="mt-2 text-sm text-red-600">Couldn&apos;t load {name}.</p>;
  if (data.type.startsWith('application/pdf') || name.toLowerCase().endsWith('.pdf')) {
    return <PdfPreview data={data.data} filename={name} />;
  }
  return <DownloadLink data={data.data} type={data.type} name={name} />;
}

function DownloadLink({ data, type, name }) {
  const [href, setHref] = useState(null);
  useEffect(() => {
    const url = URL.createObjectURL(new Blob([data], { type }));
    setHref(url);
    return () => URL.revokeObjectURL(url);
  }, [data, type]);
  return (
    <p className="mt-2 text-sm text-gray-600">
      No preview for this file type.{' '}
      {href && (
        <a href={href} download={name} className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:underline">
          <Download className="h-3.5 w-3.5" /> Download {name}
        </a>
      )}
    </p>
  );
}
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
    const t = await save.mutateAsync({ prospectId: prospect.id, name: name.trim(), ...(use ? { use_for_campaign: use } : {}) });
    onSaved?.(t);
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

// Rewrite this one draft from another template, or let the AI write it. The
// campaign's own template is left alone.
export function DraftTemplateSwitcher({ campaignId, prospect, templates }) {
  // Keyed on the draft's template by the caller, so a re-draft resets the choice.
  const [templateId, setTemplateId] = useState(prospect.template_id || '');
  const [mode, setMode] = useState('template');
  const redraft = useRedraftProspect(campaignId);
  const unchanged = templateId === (prospect.template_id || '') && mode === 'template';
  return (
    <div className="mt-4 rounded-lg border border-gray-200 p-3" data-testid="draft-template-switcher">
      <label htmlFor="draft-template" className="block text-xs font-medium text-gray-600">
        Re-draft this email from a template
      </label>
      <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
        <select
          id="draft-template"
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm sm:flex-1"
        >
          <option value="">None — the AI writes it</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <button
          type="button"
          disabled={redraft.isPending || (unchanged && Boolean(templateId))}
          onClick={() => redraft.mutate({ prospectId: prospect.id, template_id: templateId || null, template_mode: mode })}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {redraft.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {redraft.isPending ? 'Re-drafting…' : 'Re-draft'}
        </button>
      </div>
      {templateId && (
        <fieldset className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-700">
          <legend className="sr-only">How to use the template</legend>
          <label className="inline-flex items-center gap-1.5">
            <input type="radio" name="draft-template-mode" checked={mode === 'template'} onChange={() => setMode('template')} />
            Exactly as written
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input type="radio" name="draft-template-mode" checked={mode === 'ai_template'} onChange={() => setMode('ai_template')} />
            Personalised by AI
          </label>
        </fieldset>
      )}
      <p className="mt-1.5 text-xs text-gray-500">Only this email changes. A re-drafted email goes back to review.</p>
    </div>
  );
}

// Appended to every campaign email when it's sent, so the preview shows it as
// the recipient will. The link is a stand-in on purpose: a real one would
// unsubscribe the prospect if the reviewer clicked it.
export function UnsubscribeFooter() {
  return (
    <div className="mt-3 whitespace-pre-line border-t border-gray-200 pt-2 text-xs text-gray-500" data-testid="preview-unsubscribe">
      <p>
        {UNSUBSCRIBE_FOOTER.prompt}{' '}
        <span className="rounded bg-gray-200/70 px-1 font-mono text-[11px] text-gray-600" title="A personal unsubscribe link is added when the email is sent">
          [unsubscribe link]
        </span>
      </p>
      <p>{UNSUBSCRIBE_FOOTER.address}</p>
      <p>{UNSUBSCRIBE_FOOTER.poweredBy}</p>
    </div>
  );
}

// The template a draft came from, merge fields highlighted rather than filled.
function TemplateView({ template }) {
  return (
    <div data-testid="template-view">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Template subject</p>
      <p className="mt-1 text-sm font-medium text-gray-900" data-testid="template-subject">
        <MergeFieldText text={template.subject || '(no subject)'} />
      </p>
      <p className="mt-4 text-xs font-medium uppercase tracking-wider text-gray-400">Template body</p>
      <SafeHtml
        html={highlightMergeFields(prepareEmailHtml(template.body))}
        className={`${EMAIL_BODY_CLASSES} mt-1 rounded-lg border border-amber-100 bg-amber-50/30 p-4`}
        data-testid="template-body"
      />
      <MergeFieldList subject={template.subject} body={template.body} className="mt-2" />
    </div>
  );
}

// The generated email for one prospect, as it will be (or was) sent. Drafts can
// be approved or skipped from here without going back to the table.
export default function EmailPreviewModal({
  prospect, onClose, onApprove, onSkip, busy, attachments = [], campaignId, sender = null,
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);
  const [opened, setOpened] = useState(null);
  const [view, setView] = useState('draft');
  const { data: allTemplates = [] } = useEmailTemplates();
  const templates = Array.isArray(allTemplates) ? allTemplates.filter((t) => !t.is_archived) : [];
  // The caller keys this on the prospect, so switching prospects starts fresh.
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
  const template = prospect.template_id ? templates.find((t) => t.id === prospect.template_id) : null;
  const templateName = template?.name || prospect.template_name;
  const showingTemplate = view === 'template' && template;
  const canRedraft = Boolean(campaignId) && hasEmail && ['draft', 'approved'].includes(prospect.status);

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
          <SenderLine
            sender={sender}
            sentFrom={['sent', 'replied', 'bounced'].includes(prospect.status) ? prospect.sent_from : null}
            className="mb-4 rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2"
          />
          {hasEmail && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs text-gray-500" data-testid="draft-source">
                <FileText className="h-3.5 w-3.5 text-indigo-400" />
                {templateName ? <>Drafted from <b className="font-medium text-gray-700">“{templateName}”</b></> : 'Written by the AI — no template'}
              </p>
              {template && (
                <div className="inline-flex rounded-lg bg-gray-100 p-0.5 text-xs" role="group" aria-label="Show draft or template">
                  {[['draft', 'Draft'], ['template', 'Template']].map(([key, label]) => (
                    <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)}
                      className={`rounded-md px-2.5 py-1 font-medium ${view === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {hasEmail && showingTemplate ? (
            <TemplateView template={template} />
          ) : hasEmail ? (
            <>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Subject</p>
              <p className="mt-1 text-sm font-medium text-gray-900" data-testid="preview-subject">
                {prospect.subject || '(no subject)'}
              </p>
              <p className="mt-4 text-xs font-medium uppercase tracking-wider text-gray-400">Body</p>
              <div className="mt-1 rounded-lg border border-gray-100 bg-gray-50 p-4">
                <SafeHtml
                  html={prepareEmailHtml(prospect.body)}
                  className={EMAIL_BODY_CLASSES}
                  data-testid="preview-body"
                />
                <UnsubscribeFooter />
              </div>
              <p className="mt-1 text-[11px] text-gray-400">The footer is added to every email when it&apos;s sent.</p>
              {attachments.length > 0 && (
                <div className="mt-3" data-testid="preview-attachments">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Attachments</p>
                  <ul className="mt-1 flex flex-wrap gap-2">
                    {attachments.map((name) => (
                      <li key={name}>
                        <button
                          type="button"
                          onClick={() => setOpened(opened === name ? null : name)}
                          aria-pressed={opened === name}
                          aria-label={`${opened === name ? 'Hide' : 'Preview'} ${name}`}
                          disabled={!campaignId}
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${
                            opened === name ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <Paperclip className="h-3 w-3 text-gray-400" />
                          {name}
                          <span className="text-gray-400">· {opened === name ? 'Hide' : 'Preview'}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {opened && campaignId && <AttachmentViewer campaignId={campaignId} name={opened} />}
                </div>
              )}
              {canRedraft && templates.length > 0 && (
                <DraftTemplateSwitcher key={`${prospect.id}:${prospect.template_id || ''}`} campaignId={campaignId} prospect={prospect} templates={templates} />
              )}
              {saved && (
                <p className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800" data-testid="template-saved">
                  Saved as “{saved.name}”.{' '}
                  <Link to="/outreach?tab=templates" className="font-medium underline">Open in Outreach → Templates</Link>
                </p>
              )}
              {campaignId && !saved && (saving ? (
                <SaveTemplateForm campaignId={campaignId} prospect={prospect} onSaved={(t) => { setSaving(false); setSaved(t || null); }} />
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
