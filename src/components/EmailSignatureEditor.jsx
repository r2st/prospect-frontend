import { useState, useRef } from 'react';
import DOMPurify from 'dompurify';
import {
  PenLine,
  Plus,
  Star,
  Pencil,
  Trash2,
  X,
  Eye,
  Bold,
  Italic,
  Link2,
  List,
  Minus,
  Loader2,
} from 'lucide-react';
import {
  useEmailSignatures,
  useCreateSignature,
  useUpdateSignature,
  useDeleteSignature,
  useSetDefaultSignature,
} from '../hooks/useEmailSignatures';
import { cn } from '../lib/utils';

// ─── Scoped styles for signature preview ──────────────────────────────────────

const SIGNATURE_PREVIEW_STYLES = `
  .sig-preview p { margin: 0.5rem 0; }
  .sig-preview a { color: #2563eb; text-decoration: underline; }
  .sig-preview strong { font-weight: 600; color: #111827; }
  .sig-preview em { font-style: italic; }
  .sig-preview ul { margin: 0.5rem 0; padding-left: 1.25rem; list-style-type: disc; }
  .sig-preview li { margin: 0.15rem 0; }
  .sig-preview hr { margin: 0.75rem 0; border: none; border-top: 1px solid #e5e7eb; }
  .sig-preview img { max-width: 100%; height: auto; }
`;

// ─── Mini format toolbar ──────────────────────────────────────────────────────

function FormatBar({ textareaRef, value, onChange }) {
  const wrap = (tag) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const selected = value.slice(start, end);
    let snippet;
    if (tag === 'a') {
      const url = selected.startsWith('http') ? selected : 'https://';
      const linkText = selected.startsWith('http') ? 'link text' : (selected || 'link text');
      snippet = `<a href="${url}">${linkText}</a>`;
    } else if (tag === 'ul') {
      snippet = selected
        ? `<ul>\n${selected.split('\n').map(l => `  <li>${l.trim()}</li>`).join('\n')}\n</ul>`
        : '<ul>\n  <li>Item</li>\n</ul>';
    } else if (tag === 'hr') {
      snippet = '\n<hr>\n';
    } else {
      snippet = `<${tag}>${selected || ''}</${tag}>`;
    }
    onChange(value.slice(0, start) + snippet + value.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = start;
      el.selectionEnd = start + snippet.length;
    });
  };

  return (
    <div className="flex items-center gap-0.5 rounded-t-lg border border-b-0 border-gray-300 bg-gray-50 px-2 py-1.5">
      <span className="mr-1.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">Format:</span>
      {[
        { icon: Bold, tag: 'strong', label: 'Bold' },
        { icon: Italic, tag: 'em', label: 'Italic' },
        { icon: Link2, tag: 'a', label: 'Link' },
        { icon: List, tag: 'ul', label: 'List' },
        { icon: Minus, tag: 'hr', label: 'Divider' },
      ].map((btn) => (
        <button
          key={btn.tag}
          type="button"
          title={btn.label}
          onClick={() => wrap(btn.tag)}
          className="rounded p-1.5 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
        >
          <btn.icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}

// ─── Signature form (create / edit) ──────────────────────────────────────────

function SignatureForm({ signature, onClose }) {
  const isEdit = Boolean(signature?.id);
  const [name, setName] = useState(signature?.name || '');
  const [content, setContent] = useState(signature?.content || '');
  const [showPreview, setShowPreview] = useState(false);
  const bodyRef = useRef(null);

  const createSig = useCreateSignature();
  const updateSig = useUpdateSignature();

  const saving = createSig.isPending || updateSig.isPending;
  const valid = name.trim() && content.trim();

  const handleSave = () => {
    if (!valid) return;
    if (isEdit) {
      updateSig.mutate(
        { id: signature.id, name: name.trim(), content },
        { onSuccess: onClose }
      );
    } else {
      createSig.mutate(
        { name: name.trim(), content },
        { onSuccess: onClose }
      );
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-blue-200 bg-blue-50/30 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          {isEdit ? 'Edit Signature' : 'New Signature'}
        </h3>
        <button type="button" onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Main signature"
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">Content (HTML) *</label>
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            <Eye className="h-3 w-3" />
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>
        </div>
        <FormatBar textareaRef={bodyRef} value={content} onChange={setContent} />
        <textarea
          ref={bodyRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={6}
          placeholder={'<p>Best regards,</p>\n<p><strong>Your Name</strong></p>\n<p>Title | Company</p>'}
          className="w-full rounded-b-lg rounded-t-none border border-gray-300 bg-white px-3 py-2 font-mono text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {showPreview && (
        <div>
          <p className="mb-1 text-xs font-medium text-gray-500">Live Preview</p>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <style>{SIGNATURE_PREVIEW_STYLES}</style>
            <div
              className="sig-preview text-sm leading-relaxed text-gray-700"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content || '') }}
            />
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 border-t border-gray-200 pt-3">
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
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-600 disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            isEdit ? 'Save Changes' : 'Create Signature'
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Signature row ──────────────────────────────────────────────────────────

function SignatureRow({ signature, onEdit }) {
  const setDefault = useSetDefaultSignature();
  const deleteSig = useDeleteSignature();

  const busy = setDefault.isPending || deleteSig.isPending;

  // Truncate HTML content to plain text for preview
  const previewText = (() => {
    const tmp = document.createElement('div');
    tmp.innerHTML = DOMPurify.sanitize(signature.content || '');
    const text = tmp.textContent || tmp.innerText || '';
    return text.length > 120 ? text.slice(0, 120) + '...' : text;
  })();

  return (
    <div className="rounded-lg border border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-gray-900">{signature.name}</span>
            {signature.is_default && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                Default
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-gray-500">{previewText}</p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          <button
            type="button"
            title={signature.is_default ? 'This is the default' : 'Set as default'}
            disabled={busy || signature.is_default}
            onClick={() => !signature.is_default && setDefault.mutate(signature.id)}
            className={cn(
              'rounded-md p-1.5',
              signature.is_default
                ? 'text-amber-500'
                : 'text-gray-300 hover:bg-amber-50 hover:text-amber-500'
            )}
          >
            <Star className={cn('h-4 w-4', signature.is_default && 'fill-amber-500')} />
          </button>
          <button
            type="button"
            title="Edit"
            disabled={busy}
            onClick={() => onEdit(signature)}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            title={signature.is_default ? 'Set another as default first' : 'Delete'}
            disabled={busy || signature.is_default}
            onClick={() => {
              if (signature.is_default) return;
              if (window.confirm(`Delete "${signature.name}"?`)) deleteSig.mutate(signature.id);
            }}
            className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:text-gray-300"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function EmailSignatureEditor() {
  const { data: signatures, isLoading } = useEmailSignatures();
  const [editing, setEditing] = useState(null); // null | 'new' | signature object

  const list = signatures || [];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100">
            <PenLine className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Email Signatures</h2>
            <p className="text-sm text-gray-500">
              Create and manage signatures appended to outreach emails
            </p>
          </div>
        </div>
        {!editing && !isLoading && (
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-600"
          >
            <Plus className="h-4 w-4" />
            Add Signature
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="space-y-3">
          {editing && (
            <SignatureForm
              signature={editing === 'new' ? null : editing}
              onClose={() => setEditing(null)}
            />
          )}

          {list.length > 0 ? (
            list.map((sig) => (
              <SignatureRow
                key={sig.id}
                signature={sig}
                onEdit={(s) => setEditing(s)}
              />
            ))
          ) : !editing ? (
            <div className="rounded-lg bg-gray-50 px-4 py-8 text-center">
              <PenLine className="mx-auto mb-2 h-8 w-8 text-gray-300" />
              <p className="text-sm font-medium text-gray-500">No signatures yet</p>
              <p className="mt-1 text-xs text-gray-400">
                Create a signature to automatically append to your outreach emails.
              </p>
              <button
                type="button"
                onClick={() => setEditing('new')}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-600"
              >
                <Plus className="h-3.5 w-3.5" />
                Create Signature
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
