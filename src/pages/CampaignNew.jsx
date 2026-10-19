import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  FileText,
  Loader2,
  Pencil,
  Rocket,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import {
  useDiscoveryDocument,
  useDiscoveryDocuments,
  useUploadDocuments,
  errMsg,
} from '../hooks/useDiscoveryDocuments';
import {
  useCampaign,
  useCampaignActions,
  useCampaignSenders,
  useCreateCampaign,
  useUpdateCampaign,
} from '../hooks/useCampaigns';
import TemplateChoice from '../components/campaigns/TemplateChoice';
import { useEmailTemplates } from '../hooks/useEmailTemplates';
import { isIcpEmpty, normalizeIcp } from '../lib/campaigns';
import { cn, formatDate } from '../lib/utils';
import ErrorBoundary from '../components/ErrorBoundary';
import Skeleton from '../components/Skeleton';
import TagInput from '../components/campaigns/TagInput';

const WIZARD_STEPS = ['Documents', 'Ideal customer', 'Settings', 'Launch'];
const ACCEPT = '.csv,.tsv,.xlsx,.pdf,.docx,.txt';
const SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];

function Stepper({ current }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm" aria-label="Campaign setup progress">
      {WIZARD_STEPS.map((label, i) => (
        <li key={label} className="flex items-center gap-2" aria-current={i === current ? 'step' : undefined}>
          <span
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
              i < current && 'bg-green-500 text-white',
              i === current && 'bg-indigo-600 text-white',
              i > current && 'bg-gray-200 text-gray-500'
            )}
          >
            {i < current ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
          </span>
          <span className={cn(i === current ? 'font-medium text-gray-900' : 'text-gray-500')}>{label}</span>
          {i < WIZARD_STEPS.length - 1 && <span className="mx-1 hidden h-px w-6 bg-gray-300 sm:block" />}
        </li>
      ))}
    </ol>
  );
}

function StepFooter({ onBack, onNext, nextLabel = 'Next', nextDisabled, pending, nextIcon: NextIcon = ArrowRight, extra = null }) {
  return (
    <div className="flex flex-col-reverse gap-2 border-t border-gray-200 pt-4 sm:flex-row sm:justify-between">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      ) : (
        <span />
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        {extra}
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled || pending}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {nextLabel}
          {!pending && <NextIcon className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function FileIcon({ name = '' }) {
  const cls = 'mt-0.5 h-5 w-5 flex-shrink-0 text-gray-400';
  return /\.(csv|tsv|xlsx)$/i.test(name) ? <FileSpreadsheet className={cls} /> : <FileText className={cls} />;
}

// What the AI read out of one document: a few of the companies it found.
function DocumentPreview({ id }) {
  const { data: doc, isLoading, error } = useDiscoveryDocument(id);
  if (isLoading) return <Skeleton className="h-16" />;
  if (error) return <p className="text-xs text-red-600">{errMsg(error, 'Couldn’t load the preview')}</p>;
  if (!doc) return null;
  const candidates = doc.candidates || [];
  if (doc.status === 'parsing') return <p className="text-xs text-gray-500">Still analysing — the preview appears when it’s done.</p>;
  if (!candidates.length) return <p className="text-xs text-gray-500">No companies were found in this file; its text still informs the profile.</p>;
  return (
    <div className="text-xs text-gray-600" data-testid={`doc-preview-${id}`}>
      <p className="font-medium text-gray-700">
        {candidates.length} compan{candidates.length === 1 ? 'y' : 'ies'} found, e.g.
      </p>
      <ul className="mt-1 space-y-0.5">
        {candidates.slice(0, 5).map((c) => (
          <li key={c.id} className="truncate">
            {c.name}
            {c.industry && <span className="text-gray-400"> · {c.industry}</span>}
            {c.country && <span className="text-gray-400"> · {c.country}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DocumentCard({ doc, selected, onToggle, locked }) {
  const [open, setOpen] = useState(false);
  const parsing = doc.status === 'parsing';
  const failed = doc.status === 'failed';
  return (
    <li
      className={cn(
        'rounded-xl border bg-white p-3 shadow-sm transition-colors',
        selected ? 'border-indigo-400 ring-1 ring-indigo-400' : 'border-gray-200'
      )}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          disabled={locked || failed}
          onChange={onToggle}
          aria-label={`Use ${doc.filename}`}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600"
        />
        <FileIcon name={doc.filename} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-900">{doc.filename}</p>
          <p className="text-xs text-gray-500">
            {parsing ? (
              <span className="inline-flex items-center gap-1 text-blue-600">
                <Loader2 className="h-3 w-3 animate-spin" /> Analysing…
              </span>
            ) : failed ? (
              <span className="text-red-600">Couldn&apos;t be analysed</span>
            ) : (
              <>
                {doc.candidate_count ?? 0} companies · uploaded {formatDate(doc.created_at)}
              </>
            )}
          </p>
        </div>
        {!failed && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={`${open ? 'Hide' : 'Show'} preview of ${doc.filename}`}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        )}
      </div>
      {open && (
        <div className="ml-7 mt-2 border-t border-gray-100 pt-2">
          <DocumentPreview id={doc.id} />
        </div>
      )}
    </li>
  );
}

// The connected Gmail / SMTP mailboxes a campaign can send from. Empty value =
// "your own first mailbox", which is what the server picks when none is sent.
export function SenderSelect({ id = 'campaign-sender', value, onChange }) {
  const { data: senders = [], isLoading } = useCampaignSenders();
  if (isLoading) return <div className="h-9 max-w-md animate-pulse rounded-lg bg-gray-100" />;
  if (!senders.length) {
    return (
      <p className="text-sm text-amber-700">
        No sending account is connected. Connect Gmail or add an SMTP account in Settings first.
      </p>
    );
  }
  const current = value || senders[0].id;
  return (
    <select
      id={id}
      value={current}
      onChange={(e) => onChange(e.target.value)}
      className="mt-1 w-full max-w-md rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
    >
      {senders.map((a) => (
        <option key={a.id} value={a.id}>
          {a.email} · {a.kind === 'smtp' ? 'SMTP' : 'Gmail'}{a.mine ? '' : ' (teammate)'}
        </option>
      ))}
    </select>
  );
}

function DocumentsStep({ initialSelected, campaign, onCreated }) {
  const { data: docs = [], isLoading } = useDiscoveryDocuments();
  const locked = Boolean(campaign);
  const [selected, setSelected] = useState(() => new Set(campaign ? campaign.document_ids : initialSelected));
  const [name, setName] = useState(campaign?.name || '');
  const [sender, setSender] = useState('');
  const { data: senders = [] } = useCampaignSenders();
  const [uploadError, setUploadError] = useState(null);
  const inputRef = useRef(null);
  const upload = useUploadDocuments();
  const create = useCreateCampaign();
  // null = untouched: the org's default template, which the server also picks.
  const [templatePick, setTemplatePick] = useState(null);
  const { data: templates = [] } = useEmailTemplates();
  const orgDefault = templates.find((t) => t.is_default && !t.is_archived);
  const template =
    templatePick ?? (orgDefault ? { template_id: orgDefault.id, template_mode: 'ai_template' } : { template_id: '', template_mode: 'ai' });

  const chosen = docs.filter((d) => selected.has(d.id));
  const stillParsing = chosen.some((d) => d.status === 'parsing');
  const defaultName = chosen[0] ? `Outreach — ${chosen[0].filename.replace(/\.[^.]+$/, '')}` : '';

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const onFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploadError(null);
    upload.mutate(
      { files },
      {
        onSuccess: (res) => {
          const added = (res?.documents ?? res?.accepted ?? []).map((d) => d.id).filter(Boolean);
          setSelected((prev) => new Set([...prev, ...added]));
          const rejected = res?.rejected ?? [];
          if (rejected.length) {
            setUploadError(rejected.map((r) => `${r.filename}: ${r.error || r.reason || 'rejected'}`).join('; '));
          }
        },
        onError: (e) => setUploadError(errMsg(e, 'Upload failed')),
      }
    );
  };

  const next = () => {
    if (locked) return onCreated(campaign.id);
    const sender_account_id = sender || senders[0]?.id;
    create.mutate(
      {
        name: name.trim() || defaultName || 'Untitled campaign',
        document_ids: [...selected],
        ...(sender_account_id ? { sender_account_id } : {}),
        // Sent with the create so the first drafts — written straight away — use it.
        ...(templatePick ? { settings: templatePick } : {}),
      },
      { onSuccess: (c) => onCreated(c.id) }
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">What are you selling?</h2>
        <p className="mt-1 text-sm text-gray-500">
          Pick the documents that describe your offer — a pitch deck, one-pager, price list or a list of past customers.
          Autopilot reads them to work out who to contact.
        </p>
      </div>

      {locked && (
        <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
          This campaign has already analysed its documents. To use different ones,{' '}
          <Link to="/campaigns/new" className="font-medium text-indigo-600 underline">
            start a new campaign
          </Link>
          .
        </p>
      )}

      {isLoading ? (
        <div className="space-y-2" data-testid="docs-skeleton">
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
      ) : docs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
          No documents uploaded yet. Upload one below to get started.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2" aria-label="Uploaded documents">
          {docs.map((d) => (
            <DocumentCard key={d.id} doc={d} selected={selected.has(d.id)} onToggle={() => toggle(d.id)} locked={locked} />
          ))}
        </ul>
      )}

      {!locked && (
        <div
          className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 px-4 py-6 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onFiles(e.dataTransfer.files);
          }}
        >
          <UploadCloud className="h-8 w-8 text-gray-300" />
          <p className="mt-2 text-sm text-gray-600">
            Drop files here or{' '}
            <button type="button" onClick={() => inputRef.current?.click()} className="font-medium text-indigo-600 hover:underline">
              browse
            </button>
          </p>
          <p className="text-xs text-gray-400">CSV, TSV, XLSX, PDF, DOCX or TXT · up to 10 MB each</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            data-testid="campaign-upload"
            onChange={(e) => {
              onFiles(e.target.files);
              e.target.value = '';
            }}
          />
          {upload.isPending && (
            <p className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600">
              <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
            </p>
          )}
          {uploadError && <p className="mt-2 text-xs text-red-600">{uploadError}</p>}
        </div>
      )}

      {!locked && (
        <div className="max-w-md">
          <label htmlFor="campaign-name" className="block text-sm font-medium text-gray-700">
            Campaign name
          </label>
          <input
            id="campaign-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={defaultName || 'e.g. Q4 manufacturing push'}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <label htmlFor="campaign-sender" className="mt-4 block text-sm font-medium text-gray-700">
            Send from
          </label>
          <SenderSelect value={sender} onChange={setSender} />
          <div className="mt-4">
            <TemplateChoice
              templateId={template.template_id}
              mode={template.template_mode}
              onChange={(patch) => setTemplatePick({ ...template, ...patch })}
            />
          </div>
        </div>
      )}

      {stillParsing && (
        <p className="text-xs text-gray-500">Waiting for the selected documents to finish analysing…</p>
      )}

      <StepFooter
        onNext={next}
        nextDisabled={!selected.size || stillParsing}
        pending={create.isPending}
        nextLabel={locked ? 'Next' : 'Analyze documents'}
        nextIcon={locked ? ArrowRight : Sparkles}
      />
    </div>
  );
}

function IcpStep({ campaign, onBack, onNext, onSkipToLaunch }) {
  const [icp, setIcp] = useState(() => normalizeIcp(campaign.icp));
  const update = useUpdateCampaign(campaign.id);
  const set = (key) => (value) => setIcp((prev) => ({ ...prev, [key]: value }));
  const empty = isIcpEmpty(icp);
  const save = (onSuccess) =>
    update.mutate(
      {
        icp: { ...icp, value_props: icp.value_props.map((v) => v.trim()).filter(Boolean) },
        baseIcp: campaign.icp_json,
      },
      { onSuccess }
    );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Your ideal customer</h2>
        <p className="mt-1 text-sm text-gray-500">
          {isIcpEmpty(campaign.icp)
            ? 'Autopilot couldn’t draw a profile from these documents. Describe who you want to reach and it will search for them.'
            : 'This is who Autopilot thinks your documents are aimed at. Adjust anything that’s off — it searches for companies that match.'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TagInput
          id="icp-industries"
          label="Target industries"
          value={icp.industries}
          onChange={set('industries')}
          placeholder="e.g. CNC machining, packaging"
        />
        <div>
          <label htmlFor="icp-size" className="block text-sm font-medium text-gray-700">
            Company size (employees)
          </label>
          <input
            id="icp-size"
            list="icp-size-options"
            value={icp.company_size}
            onChange={(e) => set('company_size')(e.target.value)}
            placeholder="e.g. 51-200"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <datalist id="icp-size-options">
            {SIZES.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <TagInput
          id="icp-geo"
          label="Geography"
          value={icp.geographies}
          onChange={set('geographies')}
          placeholder="e.g. Germany, Ontario"
        />
        <TagInput
          id="icp-titles"
          label="Decision-maker titles"
          value={icp.titles}
          onChange={set('titles')}
          placeholder="e.g. Head of Operations, Plant Manager"
        />
      </div>
      <div>
        <label htmlFor="icp-value-props" className="block text-sm font-medium text-gray-700">
          Value propositions
        </label>
        <p className="text-xs text-gray-500">One per line. Emails lead with these.</p>
        <textarea
          id="icp-value-props"
          rows={4}
          value={icp.value_props.join('\n')}
          onChange={(e) => set('value_props')(e.target.value.split('\n'))}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <StepFooter
        onBack={onBack}
        onNext={() => save(onNext)}
        nextDisabled={empty}
        pending={update.isPending}
        extra={
          // The sending step's defaults (sender, template, a warm-up-safe daily
          // limit, review before send) were already chosen when the campaign
          // was created, so most people only ever clicked Next through it.
          onSkipToLaunch && !empty ? (
            <button
              type="button"
              onClick={() => save(onSkipToLaunch)}
              disabled={update.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              Use recommended settings
            </button>
          ) : null
        }
      />
    </div>
  );
}

function Toggle({ id, label, description, checked, onChange }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 p-3">
      <div>
        <label htmlFor={id} className="text-sm font-medium text-gray-900">
          {label}
        </label>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors',
          checked ? 'bg-indigo-600' : 'bg-gray-200'
        )}
      >
        <span
          className={cn(
            'inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          )}
        />
      </button>
    </div>
  );
}

function SettingsStep({ campaign, onBack, onNext }) {
  const [s, setS] = useState(campaign.settings);
  const update = useUpdateCampaign(campaign.id);
  const set = (key) => (value) => setS((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Sending settings</h2>
        <p className="mt-1 text-sm text-gray-500">
          Start low while your domain warms up — you can raise the limit later.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="daily-limit" className="text-sm font-medium text-gray-700">
            Daily send limit
          </label>
          <span className="text-sm font-semibold text-indigo-700" data-testid="daily-limit-value">
            {s.daily_limit} emails/day
          </span>
        </div>
        <input
          id="daily-limit"
          type="range"
          min={5}
          max={100}
          step={5}
          value={s.daily_limit}
          onChange={(e) => set('daily_limit')(Number(e.target.value))}
          className="mt-2 w-full accent-indigo-600"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>5</span>
          <span>100</span>
        </div>
      </div>

      <div>
        <label htmlFor="settings-sender" className="text-sm font-medium text-gray-700">Send from</label>
        <SenderSelect id="settings-sender" value={s.sender_account_id} onChange={set('sender_account_id')} />
      </div>

      <TemplateChoice
        templateId={s.template_id}
        mode={s.template_mode}
        onChange={(patch) => setS((prev) => ({ ...prev, ...patch }))}
      />

      <div className="space-y-2">
        <Toggle
          id="attach-documents"
          label="Attach campaign documents"
          description={
            campaign.attachments?.length
              ? `Every email carries ${campaign.attachments.join(', ')}. Attachments in a first email can lower inbox placement; turn off to send text only.`
              : 'Attach the campaign’s PDF or Word documents to every email. Attachments in a first email can lower inbox placement.'
          }
          checked={s.attach_documents}
          onChange={set('attach_documents')}
        />
        <Toggle
          id="review-before-send"
          label="Review before send"
          description="Each email waits as a draft until you approve it. Recommended for a new campaign."
          checked={s.review_before_send}
          onChange={set('review_before_send')}
        />
      </div>

      <StepFooter
        onBack={onBack}
        onNext={() => update.mutate({ settings: s }, { onSuccess: onNext })}
        pending={update.isPending}
      />
    </div>
  );
}

function SummaryRow({ label, children, onEdit }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <dt className="text-xs font-medium uppercase tracking-wider text-gray-400">{label}</dt>
        <dd className="mt-1 text-sm text-gray-900">{children}</dd>
      </div>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${label}`}
          className="inline-flex flex-shrink-0 items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
        >
          <Pencil className="h-3 w-3" /> Edit
        </button>
      )}
    </div>
  );
}

const joinOr = (list, fallback = 'Any') => (list.length ? list.join(', ') : fallback);

function LaunchStep({ campaign, onBack, goTo, onLaunched }) {
  const actions = useCampaignActions(campaign.id);
  const { icp, settings } = campaign;
  const { data: templates = [] } = useEmailTemplates();
  const template = settings.template_id ? templates.find((t) => t.id === settings.template_id) : null;
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Ready to launch</h2>
        <p className="mt-1 text-sm text-gray-500">Check everything once more. You can pause or stop the campaign at any time.</p>
      </div>

      <dl className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white px-4">
        <SummaryRow label="Campaign">{campaign.name}</SummaryRow>
        <SummaryRow label="Documents" onEdit={() => goTo(0)}>
          {campaign.documents.map((d) => d.filename).filter(Boolean).join(', ') || `${campaign.documents.length} document(s)`}
        </SummaryRow>
        <SummaryRow label="Ideal customer" onEdit={() => goTo(1)}>
          <ul className="space-y-0.5">
            <li>
              <span className="text-gray-500">Industries:</span> {joinOr(icp.industries)}
            </li>
            <li>
              <span className="text-gray-500">Size:</span> {icp.company_size || 'Any'}
            </li>
            <li>
              <span className="text-gray-500">Geography:</span> {joinOr(icp.geographies)}
            </li>
            <li>
              <span className="text-gray-500">Titles:</span> {joinOr(icp.titles)}
            </li>
            {icp.value_props.length > 0 && (
              <li>
                <span className="text-gray-500">Value props:</span> {icp.value_props.join(' · ')}
              </li>
            )}
          </ul>
        </SummaryRow>
        <SummaryRow label="Sending" onEdit={() => goTo(2)}>
          Up to {settings.daily_limit} emails/day.{' '}
          {settings.review_before_send
            ? 'You approve each email, and it goes out as soon as you do.'
            : 'Emails send automatically.'}
        </SummaryRow>
        <SummaryRow label="Email template" onEdit={() => goTo(2)}>
          <span data-testid="launch-template">
            {template
              ? `${template.name} — ${settings.template_mode === 'template' ? 'exactly as written' : 'personalised by AI'}`
              : 'None — the AI writes each email'}
          </span>
        </SummaryRow>
      </dl>

      {!settings.review_before_send && (
        <p className="flex items-start gap-2 rounded-lg bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          Review before send is off, so Autopilot will email prospects without asking you first.
        </p>
      )}

      <StepFooter
        onBack={onBack}
        onNext={() => actions.start({}, { onSuccess: onLaunched })}
        pending={actions.isUpdating}
        nextLabel="Start Campaign"
        nextIcon={Rocket}
      />
    </div>
  );
}

function StepFallback({ reset }) {
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
      <p className="font-medium text-red-800">This step hit an unexpected error.</p>
      <p className="mt-1">Anything you saved is kept.</p>
      <button type="button" onClick={reset} className="mt-2 font-medium underline">
        Try again
      </button>
    </div>
  );
}

export default function CampaignNew() {
  // The campaign id and step live in the URL so a reload — or leaving while the
  // documents are analysed — comes back to the same place.
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const campaignId = params.get('id');
  const requested = Number(params.get('step') || 0);
  const initialDocs = useMemo(() => (params.get('docs') || '').split(',').filter(Boolean), [params]);
  const { data: campaign, isLoading, error } = useCampaign(campaignId);

  // Without a campaign only the first step makes sense.
  const step = campaignId ? Math.min(Math.max(requested, 0), WIZARD_STEPS.length - 1) : 0;
  const goTo = (n, id = campaignId) => {
    const next = new URLSearchParams();
    if (id) next.set('id', id);
    if (n) next.set('step', String(n));
    setParams(next);
  };
  const analyzing = campaign?.status === 'analyzing';

  // Already launched — the dashboard is the place for it.
  if (campaign && ['active', 'paused', 'stopped', 'completed'].includes(campaign.status)) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
        <p className="text-sm text-gray-700">This campaign has already been launched.</p>
        <Link to={`/campaigns/${campaign.id}`} className="mt-2 inline-block text-sm font-medium text-indigo-600 underline">
          Open its dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link to="/campaigns" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> All campaigns
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">New Autopilot campaign</h1>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <Stepper current={step} />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <ErrorBoundary resetKey={`${campaignId}:${step}`} fallback={({ reset }) => <StepFallback reset={reset} />}>
          {campaignId && error && (
            <div role="alert" className="flex items-start gap-3 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
              <div>
                <p className="font-medium text-red-800">Couldn&apos;t load this campaign</p>
                <p className="mt-1">{errMsg(error, 'It may have been deleted.')}</p>
                <Link to="/campaigns/new" className="mt-2 inline-block font-medium underline">
                  Start over
                </Link>
              </div>
            </div>
          )}

          {campaignId && isLoading && (
            <div className="space-y-3" data-testid="wizard-skeleton">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-24" />
            </div>
          )}

          {step === 0 && (!campaignId || campaign) && (
            <DocumentsStep
              key={campaign?.id || 'new'}
              initialSelected={initialDocs}
              campaign={campaign}
              onCreated={(id) => goTo(1, id)}
            />
          )}

          {step > 0 && campaign && analyzing && (
            <div className="flex flex-col items-center justify-center py-12 text-center" data-testid="icp-analyzing">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              <p className="mt-3 text-sm font-medium text-gray-900">Reading your documents…</p>
              <p className="mt-1 max-w-sm text-xs text-gray-500">
                Autopilot is working out your ideal customer. This usually takes under a minute — you can leave and
                come back from Campaigns.
              </p>
            </div>
          )}

          {step === 1 && campaign && !analyzing && (
            <IcpStep
              key={campaign.id}
              campaign={campaign}
              onBack={() => goTo(0)}
              onNext={() => goTo(2)}
              onSkipToLaunch={() => goTo(3)}
            />
          )}
          {step === 2 && campaign && !analyzing && (
            <SettingsStep key={campaign.id} campaign={campaign} onBack={() => goTo(1)} onNext={() => goTo(3)} />
          )}
          {step === 3 && campaign && !analyzing && (
            <LaunchStep
              campaign={campaign}
              onBack={() => goTo(2)}
              goTo={goTo}
              onLaunched={() => navigate(`/campaigns/${campaign.id}`)}
            />
          )}
        </ErrorBoundary>
      </div>
    </div>
  );
}
