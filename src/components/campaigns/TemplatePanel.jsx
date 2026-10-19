import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, FileText, RefreshCw } from 'lucide-react';
import TemplateChoice from './TemplateChoice';
import { MergeFieldList } from '../MergeFieldText';
import { useRedraftCampaign, useUpdateCampaign } from '../../hooks/useCampaigns';
import { useEmailTemplates } from '../../hooks/useEmailTemplates';

/**
 * Which email template a running campaign drafts from — the same templates as
 * Outreach → Templates. Changing it only affects new drafts, so it offers to
 * rewrite the unapproved ones. Key it on the saved template so a save resets it.
 *
 * Starts as one line (which template, which mode) so the drafts list below it
 * stays above the fold; "Change" opens the picker.
 */
export default function TemplatePanel({ campaign, draftsPending = 0 }) {
  const initial = {
    template_id: campaign.template_id || '',
    template_mode: campaign.template_mode || 'ai',
  };
  const [choice, setChoice] = useState(initial);
  const [open, setOpen] = useState(false);
  const update = useUpdateCampaign(campaign.id);
  const redraft = useRedraftCampaign(campaign.id);
  const { data: templates = [] } = useEmailTemplates();
  const current = templates.find((t) => t.id === campaign.template_id);
  const changed = choice.template_id !== initial.template_id || choice.template_mode !== initial.template_mode;

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm" aria-label="Default email template">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
        <h2 className="flex flex-shrink-0 items-center gap-2 text-sm font-semibold text-gray-900">
          <FileText className="h-4 w-4 text-indigo-500" /> Template
        </h2>
        <p className="min-w-0 flex-1 truncate text-sm text-gray-600" data-testid="template-current">
          {campaign.template_id && current
            ? `Drafting from “${current.name}” — ${campaign.template_mode === 'template' ? 'exactly as written' : 'personalised by AI'}`
            : 'The AI writes each email'}
        </p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="template-panel-body"
          className="inline-flex flex-shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
        >
          {open ? 'Done' : 'Change'}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {open && (
        <div id="template-panel-body" className="border-t border-gray-100 px-4 pb-4 pt-3">
          {campaign.template_id && current && (
            <MergeFieldList subject={current.subject} body={current.body} className="mb-3" />
          )}
          <TemplateChoice
            templateId={choice.template_id}
            mode={choice.template_mode}
            onChange={(patch) => setChoice((prev) => ({ ...prev, ...patch }))}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!changed || update.isPending}
              onClick={() => update.mutate({ settings: choice })}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {update.isPending ? 'Saving…' : 'Use this for new drafts'}
            </button>
            {draftsPending > 0 && !changed && (
              <button
                type="button"
                disabled={redraft.isPending}
                onClick={() => redraft.mutate()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Re-draft {draftsPending} unapproved email{draftsPending === 1 ? '' : 's'}
              </button>
            )}
            <Link to="/outreach?tab=templates" className="ml-auto text-xs font-medium text-indigo-600 hover:underline">
              Manage templates
            </Link>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            To switch one email to another template, open its preview. A draft can also become a template there (“Save as template”) — it appears in Outreach → Templates straight away.
          </p>
        </div>
      )}
    </section>
  );
}
