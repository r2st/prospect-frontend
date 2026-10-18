import { useEmailTemplates } from '../../hooks/useEmailTemplates';

// How drafts are written: by the AI, or from one of the org's email templates.
export default function TemplateChoice({ templateId, mode, onChange, id = 'campaign-template' }) {
  const { data: templates = [] } = useEmailTemplates();
  const usable = templates.filter((t) => !t.is_archived);
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-gray-700">Default email template</label>
      <p className="text-xs text-gray-500">
        Every new draft in this campaign is written from it. You can still switch one email to another template from its preview.
      </p>
      <select
        id={id}
        value={templateId || ''}
        onChange={(e) => onChange({ template_id: e.target.value, template_mode: e.target.value ? (mode === 'ai' ? 'ai_template' : mode) : 'ai' })}
        className="mt-1 w-full max-w-md rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
      >
        <option value="">None — the AI writes each email</option>
        {usable.map((t) => (
          <option key={t.id} value={t.id}>{t.name}{t.is_default ? ' (org default)' : ''}</option>
        ))}
      </select>
      {templateId && (
        <fieldset className="space-y-1">
          <legend className="sr-only">How to use the template</legend>
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input type="radio" name={`${id}-mode`} checked={mode === 'ai_template'}
              onChange={() => onChange({ template_id: templateId, template_mode: 'ai_template' })} />
            <span><b>Personalise with AI</b> — keeps your message and call to action, tailored to each prospect.</span>
          </label>
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input type="radio" name={`${id}-mode`} checked={mode === 'template'}
              onChange={() => onChange({ template_id: templateId, template_mode: 'template' })} />
            <span><b>Use exactly as written</b> — only the merge fields ({'{{first_name}}'}, {'{{company}}'}…) are filled in.</span>
          </label>
        </fieldset>
      )}
      {!usable.length && (
        <p className="text-xs text-gray-500">
          No templates yet — create one in <a href="/outreach?tab=templates" className="font-medium text-indigo-600 hover:underline">Outreach → Templates</a>.
        </p>
      )}
    </div>
  );
}
