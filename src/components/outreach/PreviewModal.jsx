import { useState, useRef, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { Eye, Pencil, Plus, X } from 'lucide-react';
import { useUpdateTemplate, useCreateTemplate } from '../../hooks/useEmailTemplates';
import FormatToolbar from './FormatToolbar';

export const EMAIL_BODY_STYLES = `
  .email-preview p { margin: 0 0 16px 0; line-height: 1.6; }
  .email-preview p:last-child { margin-bottom: 0; }
  .email-preview strong, .email-preview b { font-weight: 700; color: #111827; }
  .email-preview em, .email-preview i { font-style: italic; }
  .email-preview a { color: #2563eb; text-decoration: underline; }
  .email-preview a:hover { color: #1d4ed8; }
  .email-preview ul { list-style-type: disc; margin: 0 0 16px 0; padding-left: 24px; }
  .email-preview ol { list-style-type: decimal; margin: 0 0 16px 0; padding-left: 24px; }
  .email-preview li { margin: 0 0 8px 0; line-height: 1.5; }
  .email-preview li:last-child { margin-bottom: 0; }
  .email-preview h1 { font-size: 1.5rem; font-weight: 700; color: #111827; margin: 24px 0 12px 0; line-height: 1.3; }
  .email-preview h2 { font-size: 1.25rem; font-weight: 700; color: #111827; margin: 24px 0 12px 0; line-height: 1.3; }
  .email-preview h3 { font-size: 1.1rem; font-weight: 600; color: #111827; margin: 20px 0 10px 0; line-height: 1.3; }
  .email-preview h4 { font-size: 1rem; font-weight: 600; color: #111827; margin: 16px 0 8px 0; }
  .email-preview blockquote { border-left: 3px solid #d1d5db; padding-left: 16px; margin: 0 0 16px 0; color: #6b7280; font-style: italic; }
  .email-preview hr { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
  .email-preview br { display: block; content: ""; margin-top: 4px; }
  .email-preview table { border-collapse: collapse; width: 100%; margin: 0 0 16px 0; }
  .email-preview td, .email-preview th { border: 1px solid #e5e7eb; padding: 8px 12px; text-align: left; }
  .email-preview th { background: #f9fafb; font-weight: 600; }
  .email-preview img { max-width: 100%; height: auto; }
  .email-preview pre { background: #f3f4f6; padding: 12px; border-radius: 6px; overflow-x: auto; margin: 0 0 16px 0; font-size: 0.85em; }
  .email-preview code { background: #f3f4f6; padding: 2px 4px; border-radius: 3px; font-size: 0.9em; }
`;

export const EMAIL_BODY_CLASSES = `email-preview max-w-none text-sm leading-relaxed text-gray-700`;

/** Convert plain-text bodies to HTML with <br> tags so newlines render.
 *  If the body already contains block-level HTML, leave it alone. */
export function prepareEmailHtml(body) {
  if (!body) return '';
  if (/<(p|div|ul|ol|h[1-6]|table|br|hr)\b/i.test(body)) return body;
  return body.replace(/\n/g, '<br>');
}

// Inject styles into document head once to prevent duplicate style tags
let stylesInjected = false;
function ensureStyles() {
  if (stylesInjected) return;
  const style = document.createElement('style');
  style.setAttribute('data-email-preview', 'true');
  style.textContent = EMAIL_BODY_STYLES;
  document.head.appendChild(style);
  stylesInjected = true;
}

export default function PreviewModal({ open, onClose, loading, subject, body, contextLabel, templateId, templateName, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [saveName, setSaveName] = useState('');
  const bodyRef = useRef(null);
  const updateTemplate = useUpdateTemplate();
  const createTemplate = useCreateTemplate();

  // Inject styles once on mount
  useEffect(() => { ensureStyles(); }, []);

  // Sync when preview data loads
  useEffect(() => {
    if (subject) setEditSubject(subject);
    if (body) setEditBody(body);
    if (templateName) setSaveName(templateName);
  }, [subject, body, templateName]);

  // Reset edit mode when modal closes
  useEffect(() => {
    if (!open) setEditing(false);
  }, [open]);

  if (!open) return null;

  const saving = updateTemplate.isPending || createTemplate.isPending;

  const handleSave = () => {
    if (!templateId) return;
    updateTemplate.mutate(
      { id: templateId, data: { subject: editSubject, body: editBody } },
      { onSuccess: () => { setEditing(false); if (onSaved) onSaved(); } }
    );
  };

  const handleSaveAsNew = () => {
    const name = saveName.trim();
    if (!name) return;
    createTemplate.mutate(
      { name, subject: editSubject, body: editBody },
      { onSuccess: () => { setEditing(false); if (onSaved) onSaved(); onClose(); } }
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">
              {editing ? 'Edit & Preview' : 'Email Preview'}
            </h3>
            {contextLabel && !editing && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                {contextLabel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!loading && !editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
            )}
            {editing && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <Eye className="h-3.5 w-3.5" />
                Preview
              </button>
            )}
            <button type="button" onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600" />
            </div>
          ) : editing ? (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Subject</label>
                <input
                  type="text"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Body</label>
                <FormatToolbar textareaRef={bodyRef} value={editBody} onChange={setEditBody} />
                <textarea
                  ref={bodyRef}
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={10}
                  className="w-full rounded-b-lg rounded-t-none border border-gray-300 px-3 py-2 font-mono text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-gray-500">Live Preview</p>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="mb-2 text-sm font-semibold text-gray-900">{editSubject}</p>
                  <div
                    className={EMAIL_BODY_CLASSES}
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(prepareEmailHtml(editBody)) }}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-3 border-t border-gray-200 pt-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-gray-500">Save as new template (name)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={saveName}
                      onChange={(e) => setSaveName(e.target.value)}
                      placeholder="New template name..."
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleSaveAsNew}
                      disabled={!saveName.trim() || saving}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Save New
                    </button>
                  </div>
                </div>
                {templateId && (
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-600 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Update Template'}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="mb-4 border-b border-gray-100 pb-3">
                <p className="text-xs uppercase tracking-wide text-gray-400">Subject</p>
                <p className="mt-0.5 text-sm font-semibold text-gray-900">{subject}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <div
                  className={EMAIL_BODY_CLASSES}
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(prepareEmailHtml(body)) }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
