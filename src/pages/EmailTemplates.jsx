import { useMemo, useRef, useState } from 'react';
import {
  FileText, Plus, Save, Trash2, Star, Eye, RefreshCw, X, Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import EmptyState from '../components/EmptyState';
import SafeHtml from '../components/SafeHtml';
import TemplateAttachments from '../components/TemplateAttachments';
import { emailApi } from '../api/client';
import {
  useCreateTemplate,
  useDeleteTemplate,
  useDeleteTemplateAttachment,
  useEmailTemplates,
  usePreviewTemplate,
  useSetDefaultTemplate,
  useUpdateTemplate,
  useUploadTemplateAttachment,
} from '../hooks/useEmailTemplates';
import { cn } from '../lib/utils';

/**
 * The merge fields a template may use.
 *
 * Hard-coded rather than derived from a preview response, because this list has
 * to be right *before* the first preview — someone writing a new template needs
 * to know what's available, and an empty palette until they click Preview is
 * the wrong way round. `sample` mirrors the server's SAMPLE_CONTEXT so what the
 * palette promises matches what an unbound preview actually renders.
 */
const MERGE_FIELDS = [
  { token: 'first_name', label: 'First name', sample: 'Jordan' },
  { token: 'last_name', label: 'Last name', sample: 'Avery' },
  { token: 'full_name', label: 'Full name', sample: 'Jordan Avery' },
  { token: 'company', label: 'Company', sample: 'Acme Precision Manufacturing' },
  { token: 'industry_segment', label: 'Industry', sample: 'CNC Machining' },
  { token: 'city', label: 'City', sample: 'Cleveland' },
  { token: 'contact_title', label: 'Job title', sample: 'VP of Operations' },
  { token: 'demo_link', label: 'Demo link', sample: 'a booking URL' },
];

const BLANK = { name: '', subject: '', body: '' };

/**
 * Merge fields a template references that the renderer doesn't know about.
 *
 * A typo'd `{{frist_name}}` renders as empty space, so the email goes out
 * reading "Hi ," and nothing anywhere says why. Catching it at edit time is the
 * only cheap moment.
 */
function unknownTokens(text) {
  const known = new Set(MERGE_FIELDS.map((f) => f.token));
  // Also allow the aliases the backend context carries.
  ['company_name', 'industry', 'title', 'greeting', 'booking_link'].forEach((t) => known.add(t));
  const found = [...String(text || '').matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)]
    .map((m) => m[1]);
  return [...new Set(found.filter((t) => !known.has(t)))];
}

function FieldPalette({ onInsert }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
        Merge fields
      </p>
      <div className="flex flex-wrap gap-1.5">
        {MERGE_FIELDS.map((f) => (
          <button
            key={f.token}
            type="button"
            onClick={() => onInsert(`{{${f.token}}}`)}
            title={`Renders as "${f.sample}"`}
            className="rounded-md border border-gray-200 bg-white px-2 py-1 font-mono text-[11px] text-gray-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
          >
            {`{{${f.token}}}`}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-gray-400">
        Click to insert at the cursor. A missing value renders empty — the
        preview on the right shows exactly what a recipient sees.
      </p>
    </div>
  );
}

export default function EmailTemplates() {
  const { data: templates = [], isLoading } = useEmailTemplates();
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();
  const setDefault = useSetDefaultTemplate();
  const preview = usePreviewTemplate();
  const uploadAttachment = useUploadTemplateAttachment();
  const deleteAttachment = useDeleteTemplateAttachment();

  // `null` means "nothing chosen yet" and resolves to the default template
  // below. Derived rather than synced into state by an effect: the list arrives
  // asynchronously, and an effect that writes the selection would render an
  // empty editor first and then flip, which reads as a flash of "no templates".
  const [selectedId, setSelectedId] = useState(null);
  // Only set once the user actually edits. Until then the editor shows the
  // selected template's own values, so a list that reloads can't strand a stale
  // draft on screen.
  const [draft, setDraft] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [rendered, setRendered] = useState(null);
  // Files picked for a template that doesn't exist yet. The upload endpoint
  // needs a template id, so these go up right after Create.
  const [pendingFiles, setPendingFiles] = useState([]);
  // Which textarea/input the cursor was last in, so a palette click inserts
  // where the writer was typing rather than always at the end of the body.
  const lastFocused = useRef('body');
  const subjectRef = useRef(null);
  const bodyRef = useRef(null);

  const list = useMemo(
    () => (Array.isArray(templates) ? templates : []),
    [templates],
  );

  // Land on the default template (or the first) so the page opens on something
  // rather than an empty pane.
  const isNew = selectedId === 'new';
  const selected = isNew
    ? null
    : list.find((t) => t.id === selectedId)
      || (selectedId === null ? (list.find((t) => t.is_default) || list[0] || null) : null);

  const activeId = isNew ? 'new' : selected?.id ?? null;
  const draftValue = draft ?? (selected
    ? { name: selected.name, subject: selected.subject, body: selected.body }
    : BLANK);

  const hasUnsaved = dirty || pendingFiles.length > 0;

  const selectTemplate = (template) => {
    setSelectedId(template.id);
    setDraft(null);
    setDirty(false);
    setRendered(null);
    setPendingFiles([]);
  };

  const startNew = () => {
    setSelectedId('new');
    setDraft(BLANK);
    setDirty(false);
    setRendered(null);
    setPendingFiles([]);
  };

  // A saved template takes files at once — they are independent of the text
  // fields, so there is nothing to wait for. A new one queues them.
  const addFiles = async (files) => {
    if (isNew) {
      setPendingFiles((p) => [...p, ...files]);
      return;
    }
    for (const file of files) {
      try {
        await uploadAttachment.mutateAsync({ templateId: activeId, file });
      } catch {
        // Toasted by the hook; keep going with the rest of the pick.
      }
    }
  };

  const removeSaved = async (att) => {
    if (!window.confirm(`Remove "${att.filename}" from this template?`)) return;
    try {
      await deleteAttachment.mutateAsync({ templateId: activeId, attachmentId: att.id });
    } catch {
      // Toasted by the hook.
    }
  };

  const download = async (att) => {
    try {
      const blob = await emailApi.downloadTemplateAttachment(activeId, att.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = att.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(`Couldn't download ${att.filename}`);
    }
  };

  const edit = (field) => (e) => {
    const value = e.target.value;
    setDraft((p) => ({ ...(p ?? draftValue), [field]: value }));
    setDirty(true);
  };

  const insert = (token) => {
    const which = lastFocused.current === 'subject' ? 'subject' : 'body';
    const el = which === 'subject' ? subjectRef.current : bodyRef.current;
    const value = draftValue[which] || '';
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    setDraft((p) => ({ ...(p ?? draftValue), [which]: next }));
    setDirty(true);
    // Put the caret after what was just inserted, so several clicks in a row
    // build up a line instead of stacking on the same spot.
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const runPreview = async () => {
    const result = await preview.mutateAsync({
      subject: draftValue.subject,
      body: draftValue.body,
    });
    setRendered(result);
  };

  const save = async () => {
    if (!draftValue.name.trim()) return toast.error('Give the template a name');
    if (!draftValue.subject.trim()) return toast.error('A template needs a subject');
    const payload = {
      name: draftValue.name.trim(),
      subject: draftValue.subject,
      body: draftValue.body,
    };
    if (isNew) {
      const created = await createTemplate.mutateAsync(payload);
      if (created?.id) {
        setSelectedId(created.id);
        for (const file of pendingFiles) {
          try {
            await uploadAttachment.mutateAsync({ templateId: created.id, file });
          } catch {
            // Toasted by the hook. The template exists; the file can be
            // re-added from the editor.
          }
        }
      }
      setPendingFiles([]);
    } else {
      // ``activeId``, not ``selectedId``: the page opens on the default
      // template without ever writing its id into state, and saving must not
      // then PUT to ``null``.
      await updateTemplate.mutateAsync({ id: activeId, data: payload });
    }
    setDraft(null);
    setDirty(false);
  };

  const remove = async () => {
    if (!selected) return;
    if (!window.confirm(`Delete "${selected.name}"? This cannot be undone.`)) return;
    await deleteTemplate.mutateAsync(selected.id);
    setSelectedId(null);
    setDraft(null);
    setDirty(false);
  };

  const typos = useMemo(
    () => [...new Set([...unknownTokens(draftValue.subject), ...unknownTokens(draftValue.body)])],
    [draftValue.subject, draftValue.body],
  );

  const saving = createTemplate.isPending || updateTemplate.isPending || uploadAttachment.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-gray-900">
            <FileText className="h-6 w-6 text-blue-600" />
            Email Templates
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Write once, merge per recipient. The preview renders with sample data
            so you see the email as it will arrive.
          </p>
        </div>
        <button
          type="button"
          onClick={startNew}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          New template
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Template list */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-gray-200 bg-white">
            {isLoading ? (
              <p className="px-4 py-6 text-sm text-gray-400">Loading…</p>
            ) : list.length === 0 && !isNew ? (
              <div className="p-4">
                <EmptyState
                  icon={FileText}
                  title="No templates yet"
                  description="Create one to reuse copy across sends."
                  action={{ label: 'Create your first template', onClick: startNew }}
                />
              </div>
            ) : (
              <ul>
                {isNew && (
                  <li className="border-b border-gray-100 bg-blue-50/60 px-4 py-2.5 text-sm font-medium text-blue-700">
                    New template
                  </li>
                )}
                {list.map((t) => (
                  <li key={t.id} className="border-b border-gray-50 last:border-0">
                    <button
                      type="button"
                      onClick={() => selectTemplate(t)}
                      className={cn(
                        'flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-gray-50',
                        t.id === activeId && 'bg-blue-50/60 font-medium text-blue-700',
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">{t.name}</span>
                      {t.is_default && (
                        <Star
                          className="h-3.5 w-3.5 flex-shrink-0 fill-amber-400 text-amber-400"
                          aria-label="Default template"
                        />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Editor */}
        <div className="space-y-4 lg:col-span-2">
          {!selected && !isNew ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">
              Pick a template on the left, or create a new one.
            </div>
          ) : (
            <>
              <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
                <div>
                  <label
                    htmlFor="tpl-name"
                    className="mb-1 block text-xs font-medium text-gray-500"
                  >
                    Name
                  </label>
                  <input
                    id="tpl-name"
                    value={draftValue.name}
                    onChange={edit('name')}
                    placeholder="First touch — machining"
                    className="h-9 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="tpl-subject"
                    className="mb-1 block text-xs font-medium text-gray-500"
                  >
                    Subject
                  </label>
                  <input
                    id="tpl-subject"
                    ref={subjectRef}
                    value={draftValue.subject}
                    onChange={edit('subject')}
                    onFocus={() => { lastFocused.current = 'subject'; }}
                    placeholder="quick question about {{company}}"
                    className="h-9 w-full rounded-lg border border-gray-300 px-3 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="tpl-body"
                    className="mb-1 block text-xs font-medium text-gray-500"
                  >
                    Body (HTML)
                  </label>
                  <textarea
                    id="tpl-body"
                    ref={bodyRef}
                    value={draftValue.body}
                    onChange={edit('body')}
                    onFocus={() => { lastFocused.current = 'body'; }}
                    rows={14}
                    placeholder="<p>Hi {{first_name}},</p>"
                    className="w-full rounded-lg border border-gray-300 p-3 font-mono text-sm leading-relaxed focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <FieldPalette onInsert={insert} />

                <TemplateAttachments
                  saved={isNew ? [] : (selected?.attachments || [])}
                  pending={isNew ? pendingFiles : []}
                  onAddFiles={addFiles}
                  onRemoveSaved={removeSaved}
                  onRemovePending={(i) => setPendingFiles((p) => p.filter((_, j) => j !== i))}
                  onDownload={download}
                  uploading={uploadAttachment.isPending}
                />

                {typos.length > 0 && (
                  // Not an error — the template still saves and sends. But an
                  // unknown field renders as nothing, so "Hi ," goes out and no
                  // log anywhere says why. This is the only cheap moment to
                  // catch it.
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <strong>Unknown merge field{typos.length > 1 ? 's' : ''}:</strong>{' '}
                    {typos.map((t) => `{{${t}}}`).join(', ')} — these render as empty
                    text. Check the spelling against the fields above.
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={save}
                  disabled={saving || !dirty}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Save className="h-4 w-4" />
                  {isNew ? 'Create' : 'Save changes'}
                </button>
                <button
                  type="button"
                  onClick={runPreview}
                  disabled={preview.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {preview.isPending
                    ? <RefreshCw className="h-4 w-4 animate-spin" />
                    : <Eye className="h-4 w-4" />}
                  Preview
                </button>
                {!isNew && selected && !selected.is_default && (
                  <button
                    type="button"
                    onClick={() => setDefault.mutate(selected.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <Star className="h-4 w-4" />
                    Make default
                  </button>
                )}
                {!isNew && selected && (
                  <button
                    type="button"
                    onClick={remove}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                )}
                {dirty && (
                  <span className="text-xs text-amber-600">Unsaved changes</span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Preview */}
        <div className="lg:col-span-1">
          <div className="sticky top-4 rounded-xl border border-gray-200 bg-white">
            <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
              <Eye className="h-4 w-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-900">Preview</h2>
              {rendered && (
                <button
                  type="button"
                  onClick={() => setRendered(null)}
                  aria-label="Clear preview"
                  className="ml-auto text-gray-300 hover:text-gray-500"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {rendered ? (
              <div className="p-4">
                <p className="mb-1 text-[11px] uppercase tracking-wider text-gray-400">
                  Subject
                </p>
                <p className="mb-4 text-sm font-medium text-gray-900">
                  {rendered.subject || <span className="text-gray-400">(empty)</span>}
                </p>
                <p className="mb-1 text-[11px] uppercase tracking-wider text-gray-400">
                  Body
                </p>
                {/* Rendered through SafeHtml: template bodies are HTML, and the
                    preview must show what arrives without letting it script
                    the console. */}
                <SafeHtml
                  html={rendered.body}
                  className="prose prose-sm max-w-none text-sm text-gray-700"
                />
                <p className="mt-4 flex items-start gap-1.5 border-t border-gray-100 pt-3 text-[11px] text-gray-400">
                  <Check className="mt-0.5 h-3 w-3 flex-shrink-0" />
                  Rendered with sample contact data. A real send merges the
                  recipient&apos;s own values and appends the unsubscribe footer.
                </p>
              </div>
            ) : (
              <p className="px-4 py-6 text-sm text-gray-400">
                Click Preview to render the template with sample data.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
