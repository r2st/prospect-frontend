import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, RefreshCw } from 'lucide-react';
import TemplateChoice from './TemplateChoice';
import { MergeFieldList } from '../MergeFieldText';
import { useRedraftCampaign, useUpdateCampaign } from '../../hooks/useCampaigns';
import { useEmailTemplates } from '../../hooks/useEmailTemplates';

/**
 * Which email template a running campaign drafts from — the same templates as
 * Outreach → Templates. Changing it only affects new drafts, so it offers to
 * rewrite the unapproved ones. Key it on the saved template so a save resets it.
 */
export default function TemplatePanel({ campaign, draftsPending = 0 }) {
  const initial = {
    template_id: campaign.template_id || '',
    template_mode: campaign.template_mode || 'ai',
  };
  const [choice, setChoice] = useState(initial);
  const update = useUpdateCampaign(campaign.id);
  const redraft = useRedraftCampaign(campaign.id);
  const { data: templates = [] } = useEmailTemplates();
  const current = templates.find((t) => t.id === campaign.template_id);
  const changed = choice.template_id !== initial.template_id || choice.template_mode !== initial.template_mode;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm" aria-label="Email template">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <FileText className="h-4 w-4 text-indigo-500" /> Email template
          </h2>
          <p className="mt-0.5 text-xs text-gray-500" data-testid="template-current">
            {campaign.template_id && current
              ? `Drafting from “${current.name}” — ${campaign.template_mode === 'template' ? 'exactly as written' : 'personalised by AI'}`
              : 'The AI writes each email. Pick a template to use your own wording.'}
          </p>
          {campaign.template_id && current && (
            <MergeFieldList subject={current.subject} body={current.body} className="mt-1" />
          )}
        </div>
        <Link to="/outreach?tab=templates" className="text-xs font-medium text-indigo-600 hover:underline">
          Manage templates
        </Link>
      </div>
      <div className="mt-3">
        <TemplateChoice
          templateId={choice.template_id}
          mode={choice.template_mode}
          onChange={(patch) => setChoice((prev) => ({ ...prev, ...patch }))}
        />
      </div>
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
      </div>
      <p className="mt-2 text-xs text-gray-500">
        To switch one email to another template, open its preview. A draft can also become a template there (“Save as template”) — it appears in Outreach → Templates straight away.
      </p>
    </section>
  );
}
