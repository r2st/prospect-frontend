import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Loader2,
  Mail,
  Rocket,
  Sparkles,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import {
  useDeleteDocument,
  useDiscoveryAiStatus,
  useDiscoveryDocument,
  useDiscoveryDocuments,
  useUploadDocument,
  useUploadDocuments,
  errMsg,
  hasDiscoveryAiKey,
} from '../../hooks/useDiscoveryDocuments';
import { cn, formatDate } from '../../lib/utils';
import { splitUploadProgress } from '../../lib/uploadProgress';
import ConfirmDialog from '../ConfirmDialog';
import ErrorBoundary from '../ErrorBoundary';
import Skeleton from '../Skeleton';
import DocumentReview from './DocumentReview';
import DocumentOutreach from './DocumentOutreach';
import GeminiKeyBanner from './GeminiKeyBanner';

const ACCEPT = '.csv,.tsv,.xlsx,.pdf,.docx,.txt';
const ACCEPTED_EXT = ACCEPT.split(',');
const TYPE_LIST = 'CSV, TSV, XLSX, PDF, DOCX or TXT';
const MAX_MB = 10;
const MAX_FILES = 10; // matches the backend's MAX_BATCH_FILES

const STEPS = ['Upload', 'Review & import', 'Draft emails', 'Send & follow up'];

function Stepper({ current }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm">
      {STEPS.map((label, i) => (
        <li key={label} className="flex items-center gap-2">
          <span
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
              i < current && 'bg-green-500 text-white',
              i === current && 'bg-blue-500 text-white',
              i > current && 'bg-gray-200 text-gray-500'
            )}
          >
            {i < current ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
          </span>
          <span className={cn(i === current ? 'font-medium text-gray-900' : 'text-gray-500')}>{label}</span>
          {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-gray-300" />}
        </li>
      ))}
    </ol>
  );
}

// Files picked together go up in one request; each row tracks its own upload
// and then its analysis. A single file keeps the old flow and opens straight away.
function UploadZone({ onUploaded, disabled }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [batch, setBatch] = useState(null); // [{ key, name, progress, docId, error }]
  const upload = useUploadDocument();
  const uploadMany = useUploadDocuments();
  const { data: docs = [] } = useDiscoveryDocuments();

  const [single, setSingle] = useState(null); // { name, progress } while one file uploads

  // Checked here so a wrong file fails instantly with a reason, rather than
  // after the upload round-trip.
  const problemWith = (file) => {
    const dot = file.name.lastIndexOf('.');
    const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : '';
    if (!ACCEPTED_EXT.includes(ext)) return `Not a supported file type — use ${TYPE_LIST}`;
    if (file.size === 0) return 'This file is empty';
    if (file.size > MAX_MB * 1024 * 1024) return `Larger than ${MAX_MB} MB`;
    return null;
  };

  const handleFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setLocalError(null);
    if (files.length > MAX_FILES) {
      setLocalError(`Upload at most ${MAX_FILES} files at a time.`);
      return;
    }
    if (files.length === 1) {
      const problem = problemWith(files[0]);
      if (problem) {
        setLocalError(`${files[0].name}: ${problem}.`);
        return;
      }
      setBatch(null);
      setSingle({ name: files[0].name, progress: 0 });
      upload.mutate(
        {
          file: files[0],
          onProgress: (loaded, total) =>
            setSingle((prev) => prev && { ...prev, progress: total ? loaded / total : 0 }),
        },
        {
          onSuccess: (doc) => onUploaded(doc.id),
          onError: (e) => setLocalError(`${files[0].name}: ${errMsg(e, 'Upload failed')}`),
          onSettled: () => setSingle(null),
        }
      );
      return;
    }

    const items = files.map((file, i) => ({
      key: `${i}:${file.name}`,
      name: file.name,
      progress: 0,
      docId: null,
      error: problemWith(file),
    }));
    setBatch(items);
    // Positions (in `items`) of the files actually sent.
    const sent = items.flatMap((item, i) => (item.error ? [] : [i]));
    if (!sent.length) return;
    const sentFiles = sent.map((i) => files[i]);
    const sizes = sentFiles.map((f) => f.size);

    const patchSent = (patchFor) =>
      setBatch((prev) => prev && prev.map((item, i) => {
        const j = sent.indexOf(i);
        return j < 0 ? item : { ...item, ...patchFor(j) };
      }));

    uploadMany.mutate(
      {
        files: sentFiles,
        onProgress: (loaded, total) => {
          const split = splitUploadProgress(sizes, loaded, total);
          patchSent((j) => ({ progress: split[j] }));
        },
      },
      {
        onSuccess: ({ documents, rejected = [] }) => {
          const rejectedAt = new Map(rejected.map((r) => [r.index, r.error]));
          let next = 0;
          patchSent((j) =>
            rejectedAt.has(j)
              ? { progress: 1, error: rejectedAt.get(j) }
              : { progress: 1, docId: documents[next++]?.id ?? null }
          );
        },
        onError: (e) => {
          const detail = e?.response?.data?.detail;
          const rejectedAt = new Map((detail?.rejected || []).map((r) => [r.index, r.error]));
          const fallback = errMsg(e, 'Upload failed');
          patchSent((j) => ({ error: rejectedAt.get(j) || fallback }));
        },
      }
    );
  };

  const busy = upload.isPending || uploadMany.isPending;
  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled && !busy) handleFiles(e.dataTransfer.files);
        }}
        data-testid="upload-zone"
        className={cn(
          'flex flex-col items-center justify-center rounded-xl border-2 border-dashed bg-white px-6 py-12 text-center transition-colors',
          dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300',
          disabled && 'opacity-60'
        )}
      >
        {busy ? (
          <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
        ) : (
          <UploadCloud className="h-10 w-10 text-gray-400" />
        )}
        <p className="mt-3 text-sm font-medium text-gray-900">
          {busy ? (single ? `Uploading ${single.name}…` : 'Uploading…') : 'Drop files here, or choose them'}
        </p>
        {single ? (
          <div
            className="mt-3 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-gray-100"
            role="progressbar"
            aria-label={`Upload progress for ${single.name}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(single.progress * 100)}
          >
            <div className="h-full bg-blue-500 transition-all" style={{ width: `${Math.round(single.progress * 100)}%` }} />
          </div>
        ) : (
          <p className="mt-1 text-xs text-gray-500">
            {TYPE_LIST} — up to {MAX_FILES} files, {MAX_MB} MB each. Scanned PDFs (images of text) aren&apos;t supported yet.
          </p>
        )}
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-600 disabled:opacity-50"
        >
          <FileText className="h-4 w-4" />
          Choose files
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          data-testid="upload-input"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
        {localError && <p role="alert" className="mt-3 text-sm text-red-600">{localError}</p>}
      </div>

      {batch && (
        <BatchProgress
          items={batch}
          docs={docs}
          onOpen={onUploaded}
          onClear={busy ? null : () => setBatch(null)}
        />
      )}
    </div>
  );
}

function BatchItemStatus({ item, doc }) {
  if (item.error) return <span className="text-red-600">{item.error}</span>;
  if (!item.docId) return <span>Uploading… {Math.round(item.progress * 100)}%</span>;
  if (!doc || doc.status === 'parsing') return <span>Analysing…</span>;
  if (doc.status === 'failed') return <span className="text-red-600">Couldn&apos;t analyse this file</span>;
  return <span>{doc.candidate_count} companies found</span>;
}

function BatchProgress({ items, docs, onOpen, onClear }) {
  const byId = new Map(docs.map((d) => [d.id, d]));
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">This upload</h3>
        {onClear && (
          <button type="button" onClick={onClear} className="text-xs font-medium text-gray-500 hover:text-gray-700">
            Clear
          </button>
        )}
      </div>
      <ul className="divide-y divide-gray-100">
        {items.map((item) => {
          const doc = item.docId ? byId.get(item.docId) : null;
          const ready = doc?.status === 'ready';
          const pct = item.error ? 100 : Math.round(item.progress * 100);
          return (
            <li key={item.key} className="px-4 py-3" data-testid="batch-item">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  {item.error || doc?.status === 'failed' ? (
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-500" />
                  ) : ready ? (
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-500" />
                  ) : (
                    <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-blue-500" />
                  )}
                  <p className="truncate text-sm font-medium text-gray-900">{item.name}</p>
                </div>
                {ready && (
                  <button
                    type="button"
                    onClick={() => onOpen(item.docId)}
                    className="flex-shrink-0 text-xs font-medium text-blue-600 hover:text-blue-700"
                    aria-label={`Open ${item.name}`}
                  >
                    Open
                  </button>
                )}
              </div>
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100"
                role="progressbar"
                aria-label={`Upload progress for ${item.name}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
              >
                <div
                  className={cn('h-full transition-all', item.error ? 'bg-red-400' : 'bg-blue-500')}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                <BatchItemStatus item={item} doc={doc} />
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RecentDocuments({ onOpen }) {
  const { data: docs = [] } = useDiscoveryDocuments();
  const remove = useDeleteDocument();
  const [confirmId, setConfirmId] = useState(null);
  if (!docs.length) return null;
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">Recent uploads</h3>
      </div>
      <ul className="divide-y divide-gray-100">
        {docs.map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <button type="button" onClick={() => onOpen(d.id, Boolean(d.sequence_id))} className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-medium text-gray-900 hover:text-blue-600">{d.filename}</p>
              <p className="text-xs text-gray-500">
                {formatDate(d.created_at)} ·{' '}
                {d.status === 'ready' && `${d.candidate_count} companies found`}
                {d.status === 'parsing' && 'Analysing…'}
                {d.status === 'failed' && <span className="text-red-600">Failed</span>}
                {d.sequence_id && ' · emails scheduled'}
              </p>
            </button>
            <button
              type="button"
              onClick={() => setConfirmId(d.id)}
              className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600"
              aria-label={`Delete ${d.filename}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={Boolean(confirmId)}
        title="Delete this upload?"
        message="The file and its extracted results are deleted. Companies and contacts you already imported stay, and any scheduled emails keep sending."
        confirmLabel="Delete"
        onConfirm={() => {
          remove.mutate(confirmId);
          setConfirmId(null);
        }}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  );
}

const GUIDE = [
  {
    Icon: UploadCloud,
    title: 'Upload',
    body: 'A trade-show attendee list, a spreadsheet export, a directory PDF — anything that names companies or people.',
  },
  {
    Icon: FileSpreadsheet,
    title: 'Review & import',
    body: 'AI lists every company and person it found. Tick the ones you want; duplicates merge into what you have.',
  },
  {
    Icon: Sparkles,
    title: 'Draft emails',
    body: 'Describe your offer in a sentence or two. AI writes a first email and follow-ups you can edit word for word.',
  },
  {
    Icon: Mail,
    title: 'Send & follow up',
    body: 'Emails go out through your sending queue. Follow-ups stop automatically when someone replies.',
  },
];

function HowItWorks() {
  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 sm:p-5" data-testid="how-it-works">
      <h3 className="text-sm font-semibold text-gray-900">How it works</h3>
      <ol className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {GUIDE.map(({ Icon, title, body }, i) => (
          <li key={title} className="rounded-lg bg-white p-3 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                {i + 1}
              </span>
              <Icon className="h-4 w-4 text-blue-600" />
              <p className="text-sm font-medium text-gray-900">{title}</p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-gray-600">{body}</p>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-gray-500">
        Tip: files with a website or email column give the best matches. Nothing is emailed until you press Send.
      </p>
    </div>
  );
}

function DocumentSkeleton() {
  return (
    <div className="space-y-3" data-testid="document-skeleton">
      <Skeleton className="h-5 w-56" />
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-3">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="ml-auto h-4 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

function StepFallback({ reset, onBack }) {
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
      <AlertTriangle className="mx-auto h-8 w-8 text-red-500" />
      <p className="mt-2 text-sm font-medium text-red-800">This step hit an unexpected error.</p>
      <p className="mt-1 text-sm text-red-700">Your upload and anything you imported are saved.</p>
      <div className="mt-3 flex justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            onBack();
          }}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Back to uploads
        </button>
      </div>
    </div>
  );
}

export default function DocumentDiscovery() {
  // The open document and step live in the URL (?doc=…&step=outreach), so
  // leaving Discovery and coming back — or reloading — resumes where you were.
  const [params, setParams] = useSearchParams();
  const docId = params.get('doc');
  const stage = params.get('step') === 'outreach' ? 'outreach' : 'review';
  const aiStatus = useDiscoveryAiStatus();
  const { data: docs = [], isLoading: docsLoading } = useDiscoveryDocuments();
  const { data: doc, error: docError, isLoading: docLoading } = useDiscoveryDocument(docId);

  const noKey = aiStatus.data && !hasDiscoveryAiKey(aiStatus.data);
  const go = (id, step) => {
    const next = new URLSearchParams(params);
    next.set('tab', 'document');
    if (id) next.set('doc', id);
    else next.delete('doc');
    if (id && step === 'outreach') next.set('step', 'outreach');
    else next.delete('step');
    setParams(next);
  };
  // A document that already sent opens on its follow-up status.
  const open = (id, sent = false) => go(id, sent ? 'outreach' : 'review');
  const reset = () => go(null);

  const hasImported = Boolean(
    doc?.candidates?.some((c) => c.contacts?.some((p) => p.imported_contact_id && p.email))
  );
  const current = !doc ? 0 : doc.sequence_id ? STEPS.length : stage === 'outreach' ? 2 : 1;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <Stepper current={current} />
      </div>

      {noKey && <GeminiKeyBanner />}

      {!docId && (
        <>
          {!docsLoading && docs.length === 0 && <HowItWorks />}
          <UploadZone onUploaded={open} disabled={noKey} />
          <RecentDocuments onOpen={open} />
        </>
      )}

      {docId && docError && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
          <div>
            <p className="font-medium text-red-800">Couldn&apos;t load this document</p>
            <p className="mt-1">{errMsg(docError, 'It may have been deleted.')}</p>
            <button type="button" onClick={reset} className="mt-2 font-medium underline">
              Back to uploads
            </button>
          </div>
        </div>
      )}

      {docId && !doc && !docError && docLoading && <DocumentSkeleton />}

      {docId && doc && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2 text-sm text-gray-700">
              <button
                type="button"
                onClick={reset}
                aria-label="Back to uploads"
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <FileText className="h-4 w-4 flex-shrink-0 text-gray-400" />
              <span className="truncate font-medium">{doc.filename}</span>
              {doc.status === 'ready' && (
                <span className="flex-shrink-0 text-gray-500">· {doc.candidate_count} companies found</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {doc.status === 'ready' && (
                <Link
                  to={`/campaigns/new?docs=${doc.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700"
                  title="Let Autopilot find more companies like these and email them for you"
                >
                  <Rocket className="h-3.5 w-3.5" />
                  Start Outreach Campaign
                </Link>
              )}
              <button
                type="button"
                onClick={reset}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Upload more files
              </button>
            </div>
          </div>

          {doc.status === 'parsing' && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white px-6 py-16 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="mt-3 text-sm font-medium text-gray-900">Finding companies and contacts…</p>
              <p className="mt-1 text-xs text-gray-500">
                Large PDFs can take a minute or two. You can leave this page — the analysis keeps running and this
                file will be waiting under Recent uploads.
              </p>
            </div>
          )}

          {doc.status === 'failed' && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
              <div className="text-sm text-red-800">
                <p className="font-medium">We couldn&apos;t analyse this file</p>
                <p className="mt-1">{doc.error}</p>
                <button type="button" onClick={reset} className="mt-2 font-medium underline">
                  Try a different file
                </button>
              </div>
            </div>
          )}

          <ErrorBoundary resetKey={`${docId}:${stage}`} fallback={({ reset: retry }) => <StepFallback reset={retry} onBack={reset} />}>
            {doc.status === 'ready' && stage === 'review' && (
              <DocumentReview
                key={doc.id}
                doc={doc}
                canContinue={hasImported}
                onContinue={() => go(doc.id, 'outreach')}
              />
            )}

            {doc.status === 'ready' && stage === 'outreach' && (
              <DocumentOutreach key={doc.id} doc={doc} onBack={() => go(doc.id, 'review')} />
            )}
          </ErrorBoundary>
        </div>
      )}
    </div>
  );
}
