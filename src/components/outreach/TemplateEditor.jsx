import { useState, useRef } from 'react';
import { Eye, ExternalLink, Plus, X, ChevronDown } from 'lucide-react';
import FormatToolbar from './FormatToolbar';
import PreviewModal from './PreviewModal';
import {
  useCreateTemplate,
  useUpdateTemplate,
  usePreviewTemplate,
} from '../../hooks/useEmailTemplates';
import { MERGE_FIELDS, DEMO_LINK } from '../../lib/mockData';

function MergeFieldPicker({ onInsert }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100"
      >
        Insert Field
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {MERGE_FIELDS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => { onInsert(f.value); setOpen(false); }}
              className="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-gray-50"
            >
              <span className="font-medium text-gray-700">{f.label}</span>
              <span className="font-mono text-gray-400">{f.value}</span>
            </button>
          ))}
          <div className="border-t border-gray-100 mt-1 pt-1">
            <button
              type="button"
              onClick={() => { onInsert(DEMO_LINK); setOpen(false); }}
              className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-xs font-medium text-emerald-700 hover:bg-emerald-50"
            >
              <ExternalLink className="h-3 w-3" />
              Demo Link
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TemplateEditor({ template, onClose }) {
  const isEdit = Boolean(template) && Boolean(template.id);
  const [name, setName] = useState(template?.name || '');
  const [subject, setSubject] = useState(template?.subject || '');
  const [body, setBody] = useState(template?.body || '');
  const [activeField, setActiveField] = useState('body');
  const subjectRef = useRef(null);
  const bodyRef = useRef(null);

  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const preview = usePreviewTemplate();
  const [previewOpen, setPreviewOpen] = useState(false);

  const insert = (token) => {
    const ref = activeField === 'subject' ? subjectRef : bodyRef;
    const setter = activeField === 'subject' ? setSubject : setBody;
    const value = activeField === 'subject' ? subject : body;
    const el = ref.current;
    if (el && el.selectionStart != null) {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      setter(value.slice(0, start) + token + value.slice(end));
      requestAnimationFrame(() => {
        el.focus();
        el.selectionStart = el.selectionEnd = start + token.length;
      });
    } else {
      setter(value + token);
    }
  };

  const handlePreview = () => {
    setPreviewOpen(true);
    preview.mutate({ subject, body });
  };

  const handleSave = () => {
    if (!name.trim() || !subject.trim() || !body.trim()) return;
    const data = { name: name.trim(), subject, body };
    if (isEdit) {
      updateTemplate.mutate({ id: template.id, data }, { onSuccess: onClose });
    } else {
      createTemplate.mutate(data, { onSuccess: onClose });
    }
  };

  const saving = createTemplate.isPending || updateTemplate.isPending;
  const valid = name.trim() && subject.trim() && body.trim();

  return (
    <div className="rounded-xl border border-blue-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          {isEdit ? 'Edit Template' : 'New Template'}
        </h2>
        <button type="button" onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Template Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Professional Outreach"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">Subject *</label>
            <span className="text-xs text-gray-400">{subject.length} chars</span>
          </div>
          <input
            ref={subjectRef}
            type="text"
            value={subject}
            onFocus={() => setActiveField('subject')}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Real-time press monitoring for {{company}}"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">Body *</label>
            <span className="text-xs text-gray-400">{body.length} chars</span>
          </div>
          <FormatToolbar textareaRef={bodyRef} value={body} onChange={(v) => { setBody(v); setActiveField('body'); }} />
          <textarea
            ref={bodyRef}
            value={body}
            onFocus={() => setActiveField('body')}
            onChange={(e) => setBody(e.target.value)}
            rows={12}
            placeholder="<p>Hi {{first_name}},</p>\n\n<p>I wanted to reach out about...</p>"
            className="w-full rounded-b-lg rounded-t-none border border-gray-300 px-3 py-2 font-mono text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-col gap-2 rounded-lg bg-gray-50 p-3">
          <div className="flex items-center gap-2">
            <MergeFieldPicker onInsert={insert} />
            <button
              type="button"
              onClick={() => insert(DEMO_LINK)}
              className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
            >
              <ExternalLink className="h-3 w-3" />
              Insert demo link
            </button>
          </div>
          <p className="text-xs text-gray-400">
            Fields are merged from each contact when previewing or sending. Demo link: {DEMO_LINK}
          </p>
        </div>

        <div className="flex flex-col gap-3 border-t border-gray-200 pt-4 sm:flex-row sm:justify-between">
          <button
            type="button"
            onClick={handlePreview}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Eye className="h-4 w-4" />
            Preview
          </button>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!valid || saving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-600 disabled:opacity-50"
            >
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Template'}
            </button>
          </div>
        </div>
      </div>

      <PreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        loading={preview.isPending}
        subject={preview.data?.subject}
        body={preview.data?.body}
        templateId={isEdit ? template.id : undefined}
        templateName={name}
        contextLabel="sample contact"
      />
    </div>
  );
}
