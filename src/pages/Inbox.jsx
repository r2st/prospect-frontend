import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail, MailOpen, Inbox as InboxIcon, Send, ArrowUpRight, ArrowDownLeft,
  CheckCircle2, MousePointerClick, Reply, MessageSquare, Search, RefreshCw,
  Building2, ArrowRight, Clock, Archive, ArchiveRestore, Flame, Calendar,
  Sparkles, X, ChevronLeft, ChevronDown,
  AlertTriangle, Keyboard, AlarmClock, Tag, Plus, Trash2, User, Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import EmptyState from '../components/EmptyState';
import SafeHtml from '../components/SafeHtml';
import Avatar from '../components/Avatar';
import RichTextComposer from '../components/RichTextComposer';
import UndoToast from '../components/UndoToast';
import { InboxSkeleton, ThreadDetailSkeleton } from '../components/Skeleton';
import {
  useEmailInbox, useSendReply, useTriggerSync,
  useMarkThreadRead, useArchiveThread, useBulkThreadAction, useThreadIntelligence,
  useSnoozeThread, useInboxLabels, useLabelMutations, useThreadLabel,
} from '../hooks/useEmailHistory';
import { useEmailTemplates, useEmailSignatures } from '../hooks/useEmailTemplates';
import { useConnectedAccounts } from '../hooks/useConnectedAccounts';
import { useInboxDrafts } from '../hooks/useInboxDrafts';
import { accountOptionLabel, accountsFromThreads, combineAccounts } from '../lib/inboxAccounts';
import { timeAgo, cn } from '../lib/utils';
import {
  fullTimestamp, senderDisplay, counterpartyEmail, threadStatus,
  messageAccountEmail, threadAccountEmail,
} from '../lib/inboxUi';
import {
  labelChipClasses, labelDotClass, snoozePresets, formatSnoozeUntil,
  LABEL_COLOR_TOKENS,
} from '../lib/inboxExtras';

const STATUS_CONFIG = {
  sent:      { icon: CheckCircle2,      colors: 'bg-blue-50 text-blue-700' },
  delivered: { icon: CheckCircle2,      colors: 'bg-blue-50 text-blue-700' },
  opened:    { icon: MailOpen,          colors: 'bg-green-50 text-green-700' },
  clicked:   { icon: MousePointerClick, colors: 'bg-purple-50 text-purple-700' },
  replied:   { icon: Reply,             colors: 'bg-teal-50 text-teal-700' },
  received:  { icon: Mail,              colors: 'bg-amber-50 text-amber-700' },
  bounced:   { icon: AlertTriangle,     colors: 'bg-red-50 text-red-700' },
};

// reply_classification → chip label + color. Mirrors the classifier's
// top-level categories (see backend EmailReply.reply_classification).
const CLASSIFICATION_CONFIG = {
  interested:     { label: 'Interested',     colors: 'bg-green-50 text-green-700 ring-green-600/20' },
  not_interested: { label: 'Not interested', colors: 'bg-gray-100 text-gray-600 ring-gray-500/20' },
  unsubscribe:    { label: 'Unsubscribe',    colors: 'bg-red-50 text-red-700 ring-red-600/20' },
  referral:       { label: 'Referral',       colors: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20' },
  ooo:            { label: 'Out of office',  colors: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  unknown:        { label: 'Unknown',        colors: 'bg-gray-100 text-gray-500 ring-gray-500/20' },
};

// The four views people use daily are always visible; the rest sit behind
// "More" so the toolbar stays one row.
const FILTER_OPTIONS = [
  { value: 'all',         label: 'All',          icon: InboxIcon },
  { value: 'received',    label: 'Received',     icon: ArrowDownLeft },
  { value: 'sent',        label: 'Sent',         icon: ArrowUpRight },
  { value: 'needs_reply', label: 'Needs Reply',  icon: Clock },
];

const MORE_FILTER_OPTIONS = [
  { value: 'opened',      label: 'Opened',       icon: MailOpen },
  { value: 'priority',    label: 'Priority',     icon: Flame },
  { value: 'snoozed',     label: 'Snoozed',      icon: AlarmClock },
  { value: 'archived',    label: 'Archived',     icon: Archive },
];

const SHORTCUTS = [
  { keys: 'j / k', desc: 'Next / previous conversation' },
  { keys: 'e',     desc: 'Archive open conversation' },
  { keys: 'h',     desc: 'Snooze open conversation (tomorrow)' },
  { keys: 'r',     desc: 'Reply (focus composer)' },
  { keys: '⌘ / Ctrl + Enter', desc: 'Send reply' },
  { keys: '/',     desc: 'Focus search' },
  { keys: 'Esc',   desc: 'Close conversation' },
];

// Escape user text and wrap it as HTML paragraphs for the rich composer.
function textToHtml(text) {
  const esc = String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<p>${esc.replace(/\n/g, '<br/>')}</p>`;
}

// True when composer HTML actually carries content (not just <br>/<p> chrome).
function htmlHasContent(html) {
  return !!String(html || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
}

function showUndoToast(message, onUndo) {
  toast((t) => (
    <UndoToast message={message} onUndo={onUndo} onDismiss={() => toast.dismiss(t.id)} />
  ));
}

function StatusBadge({ status }) {
  if (!status) return null;
  const cfg = STATUS_CONFIG[status];
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', cfg.colors)}>
      <Icon className="h-3 w-3" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function ClassificationChip({ classification }) {
  if (!classification) return null;
  const cfg = CLASSIFICATION_CONFIG[classification] || CLASSIFICATION_CONFIG.unknown;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        cfg.colors
      )}
      title={`Reply classified: ${cfg.label}`}
    >
      {cfg.label}
    </span>
  );
}

// Thread-level status pill (P1-7): Needs attention / Replied / Bounced.
function ThreadStatusPill({ thread }) {
  const status = threadStatus(thread);
  if (!status) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
        status.colors
      )}
    >
      {status.label}
    </span>
  );
}

// ─── Labels ───────────────────────────────────────────────────────────────────

function LabelChip({ label, onRemove }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
        labelChipClasses(label.color)
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', labelDotClass(label.color))} />
      {label.name}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(label); }}
          aria-label={`Remove label ${label.name}`}
          className="ml-0.5 rounded-full hover:bg-black/10"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  );
}

// Small controlled dropdown with click-outside + Escape close. Renders a
// trigger and, when open, a floating panel.
function Dropdown({ trigger, children, align = 'right', panelClass, title }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      {trigger({ open, toggle: () => setOpen((v) => !v), close: () => setOpen(false) })}
      {open && (
        <div
          className={cn(
            'absolute z-20 mt-1 min-w-[13rem] rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg',
            align === 'right' ? 'right-0' : 'left-0',
            panelClass
          )}
          role="menu"
        >
          {title && (
            <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              {title}
            </div>
          )}
          {typeof children === 'function' ? children({ close: () => setOpen(false) }) : children}
        </div>
      )}
    </div>
  );
}

// Snooze picker — presets + un-snooze. `onSnooze` receives an ISO string.
function SnoozeMenu({ thread, onSnooze, onUnsnooze, buttonClass, iconOnly }) {
  const isSnoozed = !!thread.snoozed_until;
  const presets = snoozePresets();
  return (
    <Dropdown
      title="Snooze until"
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); toggle(); }}
          title={isSnoozed ? 'Snoozed — change or wake' : 'Snooze'}
          className={buttonClass}
        >
          <AlarmClock className={cn('h-4 w-4', isSnoozed && 'text-amber-500')} />
          {!iconOnly && <span className="ml-1.5">Snooze</span>}
        </button>
      )}
    >
      {({ close }) => (
        <div className="space-y-0.5">
          {presets.map((p) => (
            <button
              key={p.key}
              type="button"
              role="menuitem"
              onClick={(e) => { e.stopPropagation(); onSnooze(p.date.toISOString()); close(); }}
              className="flex w-full items-center justify-between gap-4 rounded-lg px-2.5 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              <span className="font-medium">{p.label}</span>
              <span className="text-[11px] text-gray-400">{p.sub}</span>
            </button>
          ))}
          {isSnoozed && (
            <>
              <div className="my-1 border-t border-gray-100" />
              <button
                type="button"
                role="menuitem"
                onClick={(e) => { e.stopPropagation(); onUnsnooze(); close(); }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm font-medium text-indigo-600 hover:bg-indigo-50"
              >
                <ArchiveRestore className="h-3.5 w-3.5" /> Wake now
              </button>
            </>
          )}
        </div>
      )}
    </Dropdown>
  );
}

// Label picker — toggle existing labels on a thread + quick-create.
function LabelMenu({ thread, labels, onToggle, onCreate, buttonClass, iconOnly }) {
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('indigo');
  const attachedIds = new Set((thread.labels || []).map((l) => String(l.id)));

  const submitCreate = (close) => {
    const name = newName.trim();
    if (!name) return;
    onCreate(name, newColor);
    setNewName('');
    close?.();
  };

  return (
    <Dropdown
      title="Labels"
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); toggle(); }}
          title="Labels"
          className={buttonClass}
        >
          <Tag className="h-4 w-4" />
          {!iconOnly && <span className="ml-1.5">Label</span>}
        </button>
      )}
    >
      {({ close }) => (
        <div className="space-y-0.5">
          {labels.length === 0 && (
            <p className="px-2.5 py-1 text-xs text-gray-400">No labels yet — create one below.</p>
          )}
          <div className="max-h-52 overflow-y-auto">
            {labels.map((label) => {
              const on = attachedIds.has(String(label.id));
              return (
                <button
                  key={label.id}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={on}
                  onClick={(e) => { e.stopPropagation(); onToggle(label, !on); }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  <span className={cn('h-2.5 w-2.5 rounded-full', labelDotClass(label.color))} />
                  <span className="flex-1 truncate">{label.name}</span>
                  {on && <Check className="h-3.5 w-3.5 text-indigo-600" />}
                </button>
              );
            })}
          </div>
          <div className="mt-1 border-t border-gray-100 pt-2">
            <div className="flex items-center gap-1.5 px-1">
              <div className="flex gap-1">
                {LABEL_COLOR_TOKENS.slice(0, 6).map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Colour ${c}`}
                    onClick={(e) => { e.stopPropagation(); setNewColor(c); }}
                    className={cn(
                      'h-4 w-4 rounded-full ring-2 ring-offset-1',
                      labelDotClass(c),
                      newColor === c ? 'ring-gray-400' : 'ring-transparent'
                    )}
                  />
                ))}
              </div>
            </div>
            <div className="mt-1.5 flex items-center gap-1 px-1">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') { e.preventDefault(); submitCreate(close); }
                }}
                placeholder="New label…"
                aria-label="New label name"
                className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); submitCreate(close); }}
                aria-label="Create label"
                className="rounded-md bg-indigo-500 p-1.5 text-white hover:bg-indigo-600"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </Dropdown>
  );
}

// ─── Thread list row (left rail) ──────────────────────────────────────────────

function ThreadRow({
  thread, active, checked, onSelect, onToggleCheck, onArchive, onSnooze, onUnsnooze,
}) {
  const threadId = thread.gmail_thread_id;
  const displaySubject = thread.subject || '(No subject)';
  const messageCount = thread.messages?.length || 0;
  const lastMsg = thread.messages?.[thread.messages.length - 1];
  const isArchived = thread.is_archived;
  const isSnoozed = !!thread.snoozed_until;
  const labels = thread.labels || [];
  const person = lastMsg ? senderDisplay(lastMsg) : (thread.lead_name || '');
  const personEmail = lastMsg ? counterpartyEmail(lastMsg) : '';
  const accountEmail = threadAccountEmail(thread);

  return (
    <div
      className={cn(
        'group relative flex items-start gap-2.5 rounded-xl border px-3 py-3 transition-colors',
        active
          ? 'border-indigo-300 bg-indigo-50/60 ring-1 ring-indigo-200'
          : checked
            ? 'border-indigo-200 bg-indigo-50/30'
            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggleCheck(threadId)}
        aria-label={`Select thread ${displaySubject}`}
        className="mt-1 h-4 w-4 flex-shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
      />

      <Avatar name={person} email={personEmail} size="md" className="mt-0.5" />

      <button
        type="button"
        onClick={() => onSelect(thread)}
        className="flex min-w-0 flex-1 flex-col text-left"
      >
        <div className="flex items-center gap-1.5">
          {thread.has_unread && (
            <span className="h-2 w-2 flex-shrink-0 rounded-full bg-indigo-500" title="Unread" />
          )}
          {thread.priority && (
            <Flame className="h-3.5 w-3.5 flex-shrink-0 text-orange-500" title="Priority lead" />
          )}
          <span className={cn(
            'truncate text-sm',
            thread.has_unread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'
          )}>
            {person || displaySubject}
          </span>
          <span
            className="ml-auto flex-shrink-0 text-[11px] text-gray-400"
            title={fullTimestamp(thread.last_activity)}
          >
            {timeAgo(thread.last_activity)}
          </span>
        </div>

        <div className="mt-0.5 flex items-center gap-1.5">
          <span className={cn(
            'truncate text-xs',
            thread.has_unread ? 'font-medium text-gray-700' : 'text-gray-500'
          )}>
            {displaySubject}
          </span>
          {messageCount > 1 && (
            <span className="inline-flex flex-shrink-0 items-center gap-0.5 text-[11px] text-gray-400">
              <MessageSquare className="h-3 w-3" />
              {messageCount}
            </span>
          )}
        </div>

        {lastMsg?.snippet && (
          <p className="mt-1 line-clamp-1 text-xs text-gray-500">{lastMsg.snippet}</p>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <ThreadStatusPill thread={thread} />
          <ClassificationChip classification={thread.classification} />
          {isSnoozed && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20"
              title={`Snoozed until ${fullTimestamp(thread.snoozed_until)}`}
            >
              <AlarmClock className="h-3 w-3" />
              {formatSnoozeUntil(thread.snoozed_until)}
            </span>
          )}
          {labels.map((label) => <LabelChip key={label.id} label={label} />)}
          {accountEmail && (
            <span
              className="inline-flex min-w-0 items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 ring-1 ring-inset ring-indigo-600/20"
              title={`Mailbox: ${accountEmail}`}
            >
              <Mail className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{accountEmail}</span>
            </span>
          )}
          {thread.lead_name && (
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
              <Building2 className="h-3 w-3" />
              {thread.lead_name}
            </span>
          )}
        </div>
      </button>

      {/* Hover quick actions */}
      <div className="flex flex-shrink-0 items-center gap-0.5 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
        <SnoozeMenu
          thread={thread}
          onSnooze={(iso) => onSnooze(thread, iso)}
          onUnsnooze={() => onUnsnooze(thread)}
          iconOnly
          buttonClass="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        />
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onArchive(thread); }}
          title={isArchived ? 'Unarchive' : 'Archive'}
          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          {isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

// ─── Conversation message bubble (detail pane) ────────────────────────────────

function MessageBubble({ message }) {
  const isSent = message.direction === 'sent';
  const person = senderDisplay(message);
  const email = counterpartyEmail(message);
  const accountEmail = messageAccountEmail(message);
  const htmlBody = message.body_html || null;

  return (
    <div className={cn('flex gap-2.5', isSent && 'flex-row-reverse')}>
      <Avatar name={person} email={email} size="sm" className="mt-1" />
      <div className={cn('flex min-w-0 max-w-[85%] flex-col', isSent && 'items-end')}>
        <div className={cn('flex flex-wrap items-center gap-2', isSent && 'flex-row-reverse')}>
          <span className="text-sm font-medium text-gray-900">{person}</span>
          <time
            className="text-[11px] text-gray-400"
            title={fullTimestamp(message.timestamp)}
          >
            {timeAgo(message.timestamp)}
          </time>
          {isSent && message.status && <StatusBadge status={message.status} />}
          {!isSent && <ClassificationChip classification={message.reply_classification} />}
        </div>
        {accountEmail && (
          <p className="mt-0.5 text-[11px] text-gray-500">
            {isSent ? 'From' : 'To'} <span className="font-medium text-gray-700">{accountEmail}</span>
          </p>
        )}
        <div className={cn(
          'mt-1 overflow-hidden rounded-2xl px-3.5 py-2.5 text-sm text-gray-800',
          isSent ? 'rounded-tr-sm bg-indigo-50' : 'rounded-tl-sm bg-gray-100'
        )}>
          {htmlBody ? (
            <SafeHtml html={htmlBody} className="prose prose-sm max-w-none break-words" />
          ) : message.body_text ? (
            <div className="whitespace-pre-wrap break-words">{message.body_text}</div>
          ) : (
            <p className="italic text-gray-400">No message body</p>
          )}
        </div>
        {(message.opened_at || message.clicked_at) && (
          <div className={cn('mt-1 flex gap-3 text-[11px] text-gray-400', isSent && 'flex-row-reverse')}>
            {message.opened_at && <span>Opened {timeAgo(message.opened_at)}</span>}
            {message.clicked_at && <span>Clicked {timeAgo(message.clicked_at)}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Reply composer (rich text) ──────────────────────────────────────────────

function ReplyComposer({ thread, drafts, composerRef }) {
  const threadId = thread.gmail_thread_id;
  const saved = drafts.getDraft(threadId);
  const [html, setHtml] = useState(saved?.html || '');
  const [text, setText] = useState(saved?.text || '');
  const sendReply = useSendReply();
  const { data: templates } = useEmailTemplates();
  const { data: signatures } = useEmailSignatures();
  const intel = useThreadIntelligence(threadId, { enabled: false });
  const [aiLoading, setAiLoading] = useState(false);

  const lastMessage = thread.messages?.[thread.messages.length - 1];

  // Persist the draft on every edit so switching threads / reloading keeps it.
  const persist = useCallback((next) => {
    drafts.setDraft(threadId, {
      html: next.html ?? html,
      text: next.text ?? text,
    });
  }, [drafts, threadId, html, text]);

  const handleComposerChange = ({ html: h, text: t }) => {
    setHtml(h);
    setText(t);
    persist({ html: h, text: t });
  };

  // Append template / signature HTML into the composer.
  const appendHtml = (fragment) => {
    const next = html && htmlHasContent(html) ? `${html}${fragment}` : fragment;
    setHtml(next);
    // Keep a plain-text mirror so the draft/send validation sees content too.
    const combinedText = `${text ? `${text}\n` : ''}${fragment.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}`;
    setText(combinedText);
    persist({ html: next, text: combinedText });
  };

  const handleTemplate = (e) => {
    const id = e.target.value;
    e.target.value = '';
    if (!id) return;
    const tmpl = (templates || []).find((t) => String(t.id) === id);
    if (!tmpl) return;
    appendHtml(tmpl.body || '');
    toast.success('Template inserted');
  };

  const handleSignature = (e) => {
    const id = e.target.value;
    e.target.value = '';
    if (!id) return;
    const sig = (signatures || []).find((s) => String(s.id) === id);
    if (!sig?.content_html) return;
    appendHtml(sig.content_html);
    toast.success('Signature added');
  };

  const applySuggestion = useCallback((bodyText) => {
    const asHtml = textToHtml(bodyText);
    setHtml(asHtml);
    setText(bodyText);
    drafts.setDraft(threadId, { html: asHtml, text: bodyText });
  }, [drafts, threadId]);

  const handleAiDraft = async () => {
    setAiLoading(true);
    try {
      let data = intel.data;
      if (!data) {
        const res = await intel.refetch();
        data = res.data;
      }
      const draft = data?.next_message?.body;
      if (draft) {
        applySuggestion(draft);
        toast.success('AI draft ready');
      } else {
        toast.error('No AI draft available for this thread');
      }
    } catch {
      toast.error('Failed to generate AI draft');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSend = (e) => {
    e?.preventDefault?.();
    const trimmed = (text || '').trim();
    if (!trimmed || !lastMessage) return;
    const bodyHtml = htmlHasContent(html) ? html : textToHtml(trimmed);
    sendReply.mutate(
      { emailId: lastMessage.id, data: { body_html: bodyHtml, body_text: trimmed } },
      {
        onSuccess: () => {
          setHtml('');
          setText('');
          drafts.clearDraft(threadId);
          toast.success('Reply sent');
        },
        onError: (err) => toast.error(err?.message || 'Failed to send reply'),
      }
    );
  };

  if (!lastMessage) return null;

  // Replies thread under the original subject, so there is no subject field:
  // just the body, with the insert tools on the same row as Send.
  const toolSelect =
    'max-w-[9rem] rounded-md border-0 bg-transparent py-1 pl-1 pr-6 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500';

  return (
    <form onSubmit={handleSend} className="border-t border-gray-200 bg-white p-3">
      <RichTextComposer
        ref={composerRef}
        value={html}
        onChange={handleComposerChange}
        onSend={handleSend}
        ariaLabel="Reply body"
        placeholder="Write your reply…"
      />

      <div className="mt-2 flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={handleAiDraft}
          disabled={aiLoading}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
        >
          {aiLoading ? (
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-b-2 border-indigo-500" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          AI draft
        </button>
        {(templates || []).length > 0 && (
          <select aria-label="Insert template" onChange={handleTemplate} defaultValue="" className={toolSelect}>
            <option value="">Template…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
        {(signatures || []).length > 0 && (
          <select aria-label="Insert signature" onChange={handleSignature} defaultValue="" className={toolSelect}>
            <option value="">Signature…</option>
            {signatures.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
        <span className="ml-auto hidden text-[11px] text-gray-400 sm:inline">⌘/Ctrl + Enter</span>
        <button
          type="submit"
          disabled={sendReply.isPending || !(text || '').trim()}
          className="ml-2 inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-600 disabled:opacity-50"
        >
          {sendReply.isPending ? (
            <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Send
        </button>
      </div>
    </form>
  );
}

// ─── Contact details sidebar (detail pane, right column) ──────────────────────

function ContactSidebar({ thread, labels, onToggleLabel, onCreateLabel }) {
  const navigate = useNavigate();
  const messages = thread.messages || [];
  // The counterparty is whoever we're corresponding with — take it from the
  // most recent inbound message, else the latest message.
  const inbound = [...messages].reverse().find((m) => m.direction === 'received');
  const ref = inbound || messages[messages.length - 1];
  const name = ref ? senderDisplay(ref) : (thread.lead_name || 'Unknown');
  const email = ref ? counterpartyEmail(ref) : '';
  const contactId = ref?.contact_id;
  const firstActivity = messages[0]?.timestamp;
  const attached = thread.labels || [];

  return (
    <aside className="hidden w-72 flex-shrink-0 flex-col overflow-y-auto border-l border-gray-200 bg-white p-4 xl:flex">
      <div className="flex flex-col items-center text-center">
        <Avatar name={name} email={email} size="lg" />
        <p className="mt-2 text-sm font-semibold text-gray-900">{name}</p>
        {email && <p className="truncate text-xs text-gray-500">{email}</p>}
      </div>

      <div className="mt-4 space-y-3 text-sm">
        {thread.lead_name && (
          <button
            type="button"
            onClick={() => thread.lead_id && navigate(`/companies/${thread.lead_id}`)}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-left',
              thread.lead_id && 'hover:border-indigo-300 hover:bg-indigo-50/40'
            )}
          >
            <Building2 className="h-4 w-4 flex-shrink-0 text-gray-400" />
            <span className="min-w-0 flex-1 truncate text-gray-700">{thread.lead_name}</span>
            {thread.lead_id && <ArrowRight className="h-3.5 w-3.5 text-gray-400" />}
          </button>
        )}

        <dl className="space-y-2 rounded-lg border border-gray-200 px-3 py-2.5 text-xs">
          {threadAccountEmail(thread) && (
            <div className="flex items-center justify-between gap-2">
              <dt className="flex-shrink-0 text-gray-400">Mailbox</dt>
              <dd className="truncate font-medium text-gray-700" title={threadAccountEmail(thread)}>
                {threadAccountEmail(thread)}
              </dd>
            </div>
          )}
          <div className="flex items-center justify-between">
            <dt className="text-gray-400">Messages</dt>
            <dd className="font-medium text-gray-700">{messages.length}</dd>
          </div>
          {thread.classification && (
            <div className="flex items-center justify-between gap-2">
              <dt className="text-gray-400">Intent</dt>
              <dd><ClassificationChip classification={thread.classification} /></dd>
            </div>
          )}
          {firstActivity && (
            <div className="flex items-center justify-between">
              <dt className="text-gray-400">First contact</dt>
              <dd className="text-gray-600" title={fullTimestamp(firstActivity)}>{timeAgo(firstActivity)}</dd>
            </div>
          )}
          <div className="flex items-center justify-between">
            <dt className="text-gray-400">Last activity</dt>
            <dd className="text-gray-600" title={fullTimestamp(thread.last_activity)}>{timeAgo(thread.last_activity)}</dd>
          </div>
        </dl>

        {contactId && (
          <button
            type="button"
            onClick={() => navigate(`/contacts/${contactId}`)}
            className="flex w-full items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-left text-gray-700 hover:border-indigo-300 hover:bg-indigo-50/40"
          >
            <User className="h-4 w-4 flex-shrink-0 text-gray-400" />
            <span className="flex-1">View contact</span>
            <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
          </button>
        )}

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Labels</span>
            <LabelMenu
              thread={thread}
              labels={labels}
              onToggle={onToggleLabel}
              onCreate={onCreateLabel}
              iconOnly
              buttonClass="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {attached.length === 0 ? (
              <span className="text-xs text-gray-400">None</span>
            ) : (
              attached.map((label) => (
                <LabelChip
                  key={label.id}
                  label={label}
                  onRemove={(l) => onToggleLabel(l, false)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

// ─── Thread detail pane ──────────────────────────────────────────────────────

function ThreadDetail({
  thread, drafts, composerRef, onArchive, onMarkUnread, onClose,
  onSnooze, onUnsnooze, labels, onToggleLabel, onCreateLabel,
}) {
  const navigate = useNavigate();
  const displaySubject = thread.subject || '(No subject)';
  const isArchived = thread.is_archived;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex items-start gap-2 border-b border-gray-200 px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          title="Back to list"
          className="-ml-1 rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 lg:hidden"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold text-gray-900">{displaySubject}</h2>
            <ThreadStatusPill thread={thread} />
            <ClassificationChip classification={thread.classification} />
          </div>
          {thread.lead_name && (
            <button
              type="button"
              onClick={() => thread.lead_id && navigate(`/companies/${thread.lead_id}`)}
              className={cn(
                'mt-0.5 inline-flex items-center gap-1 text-xs text-gray-500',
                thread.lead_id && 'hover:text-indigo-600'
              )}
            >
              <Building2 className="h-3 w-3" />
              {thread.lead_name}
              {thread.lead_id && <ArrowRight className="h-3 w-3" />}
            </button>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          <LabelMenu
            thread={thread}
            labels={labels}
            onToggle={onToggleLabel}
            onCreate={onCreateLabel}
            iconOnly
            buttonClass="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          />
          <SnoozeMenu
            thread={thread}
            onSnooze={(iso) => onSnooze(thread, iso)}
            onUnsnooze={() => onUnsnooze(thread)}
            iconOnly
            buttonClass="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          />
          <button
            type="button"
            onClick={() => onMarkUnread(thread)}
            title="Mark unread"
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <Mail className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onArchive(thread)}
            title={isArchived ? 'Unarchive' : 'Archive'}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            {isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Conversation + contact sidebar */}
      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-gray-50/50 p-4">
          {thread.messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
        </div>
        <ContactSidebar
          thread={thread}
          labels={labels}
          onToggleLabel={onToggleLabel}
          onCreateLabel={onCreateLabel}
        />
      </div>

      {/* Composer */}
      <ReplyComposer
        thread={thread}
        drafts={drafts}
        composerRef={composerRef}
      />
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Inbox() {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [labelFilter, setLabelFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [page, setPage] = useState(1);
  const [checked, setChecked] = useState(() => new Set());
  const [selectedId, setSelectedId] = useState(null);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const drafts = useInboxDrafts();
  const { accounts: connectedAccounts } = useConnectedAccounts();
  const snooze = useSnoozeThread();
  const { data: labels = [] } = useInboxLabels();
  const { create: createLabelMut } = useLabelMutations();
  const threadLabel = useThreadLabel();
  // Accounts learned from the mail itself, accumulated across fetches so the
  // switcher's options never shrink when the user narrows to one account (which
  // would otherwise make every *other* option vanish and trap them). Keyed by
  // lowercased address.
  const [discoveredAccounts, setDiscoveredAccounts] = useState(() => new Map());
  const bulkAction = useBulkThreadAction();
  const markRead = useMarkThreadRead();
  const archive = useArchiveThread();
  const searchRef = useRef(null);
  const composerRef = useRef(null);

  const params = useMemo(() => {
    const p = { page, per_page: 20, filter };
    if (search) p.search = search;
    if (accountEmail) p.account_email = accountEmail;
    if (labelFilter) p.label_id = labelFilter;
    if (dateFrom) p.date_from = `${dateFrom}T00:00:00`;
    if (dateTo) p.date_to = `${dateTo}T23:59:59`;
    return p;
  }, [page, filter, search, accountEmail, labelFilter, dateFrom, dateTo]);

  const { data, isLoading, error, refetch } = useEmailInbox(params);
  const triggerSync = useTriggerSync();

  // Learn any new account identities from the mail this fetch returned and
  // remember them. This is what makes the switcher appear even when the
  // /gmail/accounts + /smtp/accounts endpoints come back empty for the session
  // — as long as the user has mail, they can filter it by account.
  useEffect(() => {
    const found = accountsFromThreads(data?.threads);
    if (!found.length) return;
    setDiscoveredAccounts((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const acct of found) {
        const key = acct.email.toLowerCase();
        if (!next.has(key)) {
          next.set(key, acct);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [data]);

  // The switcher's full option list: endpoint-sourced accounts unioned with
  // everything learned from the mail, de-duplicated by address.
  const accounts = useMemo(
    () => combineAccounts(connectedAccounts, [...discoveredAccounts.values()]),
    [connectedAccounts, discoveredAccounts]
  );

  const threads = data?.threads || [];
  const moreFilter = MORE_FILTER_OPTIONS.find((o) => o.value === filter) || null;
  const hasDateFilter = Boolean(dateFrom || dateTo);
  const totalThreads = data?.total || 0;
  const totalPages = Math.ceil(totalThreads / 20);
  const selectedThread = threads.find((t) => t.gmail_thread_id === selectedId) || null;

  const selectThread = useCallback((thread) => {
    setSelectedId(thread.gmail_thread_id);
    if (thread.has_unread) {
      markRead.mutate({ threadId: thread.gmail_thread_id, read: true });
    }
  }, [markRead]);

  const archiveWithUndo = useCallback((thread) => {
    const id = thread.gmail_thread_id;
    const wasArchived = thread.is_archived;
    archive.mutate(
      { threadId: id, archived: !wasArchived },
      {
        onSuccess: () => {
          if (selectedId === id) setSelectedId(null);
          showUndoToast(wasArchived ? 'Unarchived' : 'Archived', () => {
            archive.mutate({ threadId: id, archived: wasArchived });
          });
        },
        onError: () => toast.error('Failed to update thread'),
      }
    );
  }, [archive, selectedId]);

  const markUnread = useCallback((thread) => {
    markRead.mutate(
      { threadId: thread.gmail_thread_id, read: false },
      { onSuccess: () => toast.success('Marked unread') }
    );
  }, [markRead]);

  const snoozeThread = useCallback((thread, isoUntil) => {
    const id = thread.gmail_thread_id;
    snooze.mutate(
      { threadId: id, snoozedUntil: isoUntil },
      {
        onSuccess: () => {
          if (selectedId === id) setSelectedId(null);
          showUndoToast(`Snoozed until ${formatSnoozeUntil(isoUntil)}`, () => {
            snooze.mutate({ threadId: id, snoozedUntil: null });
          });
        },
        onError: () => toast.error('Failed to snooze thread'),
      }
    );
  }, [snooze, selectedId]);

  const unsnoozeThread = useCallback((thread) => {
    snooze.mutate(
      { threadId: thread.gmail_thread_id, snoozedUntil: null },
      {
        onSuccess: () => toast.success('Woke up'),
        onError: () => toast.error('Failed to wake thread'),
      }
    );
  }, [snooze]);

  const toggleLabel = useCallback((thread, label, attached) => {
    threadLabel.mutate(
      { threadId: thread.gmail_thread_id, labelId: label.id, attached },
      { onError: () => toast.error('Failed to update label') }
    );
  }, [threadLabel]);

  const createAndAttachLabel = useCallback((thread, name, color) => {
    createLabelMut.mutate(
      { name, color },
      {
        onSuccess: (label) => {
          if (label?.id) {
            threadLabel.mutate({ threadId: thread.gmail_thread_id, labelId: label.id, attached: true });
          }
          toast.success(`Label "${name}" created`);
        },
        onError: (err) => toast.error(err?.response?.data?.detail || 'Failed to create label'),
      }
    );
  }, [createLabelMut, threadLabel]);

  const handleSync = useCallback(() => {
    triggerSync.mutate(undefined, {
      onSuccess: (result) => { toast.success(`Synced ${result.synced || 0} new emails`); refetch(); },
      onError: () => toast.error('Sync failed'),
    });
  }, [triggerSync, refetch]);

  const handleSearch = useCallback((e) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }, [searchInput]);

  const handleFilterChange = useCallback((val) => {
    setFilter(val);
    setPage(1);
    setChecked(new Set());
    setSelectedId(null);
  }, []);

  const handleAccountChange = useCallback((e) => {
    setAccountEmail(e.target.value);
    setPage(1);
    setSelectedId(null);
  }, []);

  const handleLabelFilter = useCallback((labelId) => {
    setLabelFilter((cur) => (cur === labelId ? '' : labelId));
    setPage(1);
    setSelectedId(null);
  }, []);

  const toggleCheck = useCallback((threadId) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(threadId)) next.delete(threadId);
      else next.add(threadId);
      return next;
    });
  }, []);

  const allOnPageChecked = threads.length > 0 && threads.every((t) => checked.has(t.gmail_thread_id));
  const toggleCheckAll = useCallback(() => {
    setChecked((prev) => {
      if (threads.length > 0 && threads.every((t) => prev.has(t.gmail_thread_id))) return new Set();
      return new Set(threads.map((t) => t.gmail_thread_id));
    });
  }, [threads]);

  const runBulk = useCallback((action) => {
    const ids = [...checked];
    if (ids.length === 0) return;
    bulkAction.mutate(
      { action, threadIds: ids },
      {
        onSuccess: () => {
          setChecked(new Set());
          const undoAction = action === 'archive' ? 'archive' : 'read';
          showUndoToast(
            action === 'archive' ? `Archived ${ids.length}` : `Marked ${ids.length} read`,
            () => bulkAction.mutate({ action: undoAction, threadIds: ids, value: false })
          );
        },
        onError: () => toast.error('Bulk action failed'),
      }
    );
  }, [checked, bulkAction]);

  const runBulkSnooze = useCallback(() => {
    const ids = [...checked];
    if (ids.length === 0) return;
    const until = snoozePresets()[1].date.toISOString(); // tomorrow 9am
    bulkAction.mutate(
      { action: 'snooze', threadIds: ids, value: until },
      {
        onSuccess: () => {
          setChecked(new Set());
          showUndoToast(`Snoozed ${ids.length}`, () =>
            bulkAction.mutate({ action: 'snooze', threadIds: ids, value: null })
          );
        },
        onError: () => toast.error('Bulk snooze failed'),
      }
    );
  }, [checked, bulkAction]);

  // Keyboard shortcuts (P1-4). Refs keep the handler fresh without re-binding.
  const kb = useRef({});
  kb.current = {
    threads, selectedId, selectThread, archiveWithUndo, selectedThread,
    toggleCheck, snoozeThread,
  };
  useEffect(() => {
    const onKey = (e) => {
      const s = kb.current;
      const el = e.target;
      const typing = el && (
        el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' ||
        el.isContentEditable
      );
      if (e.key === 'Escape') {
        setSelectedId(null);
        setShowShortcuts(false);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (e.key === '?') { setShowShortcuts((v) => !v); return; }

      const list = s.threads;
      if (!list.length) return;
      const idx = list.findIndex((t) => t.gmail_thread_id === s.selectedId);

      if (e.key === 'j') {
        e.preventDefault();
        const next = list[Math.min(list.length - 1, idx < 0 ? 0 : idx + 1)];
        if (next) s.selectThread(next);
      } else if (e.key === 'k') {
        e.preventDefault();
        const prev = list[Math.max(0, idx < 0 ? 0 : idx - 1)];
        if (prev) s.selectThread(prev);
      } else if (e.key === 'e' && s.selectedThread) {
        e.preventDefault();
        s.archiveWithUndo(s.selectedThread);
      } else if (e.key === 'h' && s.selectedThread) {
        e.preventDefault();
        s.snoozeThread(s.selectedThread, snoozePresets()[1].date.toISOString());
      } else if (e.key === 'r' && s.selectedThread) {
        e.preventDefault();
        composerRef.current?.focus();
      } else if (e.key === 'x' && s.selectedThread) {
        e.preventDefault();
        s.toggleCheck(s.selectedThread.gmail_thread_id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inbox</h1>
          <p className="mt-1 text-sm text-gray-500">All email conversations across your leads</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowShortcuts((v) => !v)}
            title="Keyboard shortcuts"
            aria-label="Keyboard shortcuts"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50"
          >
            <Keyboard className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleSync}
            disabled={triggerSync.isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', triggerSync.isPending && 'animate-spin')} />
            {triggerSync.isPending ? 'Syncing...' : 'Sync emails'}
          </button>
        </div>
      </div>

      {showShortcuts && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-800">
            <Keyboard className="h-4 w-4 text-gray-400" /> Keyboard shortcuts
          </div>
          <ul className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {SHORTCUTS.map((s) => (
              <li key={s.keys} className="flex items-center justify-between gap-4 text-sm">
                <span className="text-gray-600">{s.desc}</span>
                <kbd className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[11px] font-medium text-gray-500">{s.keys}</kbd>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Toolbar: views on the left; search, mailbox and date on the right. */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="flex flex-wrap items-center gap-1">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleFilterChange(opt.value)}
              aria-pressed={filter === opt.value}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                filter === opt.value
                  ? 'bg-indigo-500 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              {opt.label}
            </button>
          ))}
          <Dropdown
            align="left"
            trigger={({ open, toggle }) => (
              <button
                type="button"
                onClick={toggle}
                aria-haspopup="menu"
                aria-expanded={open}
                className={cn(
                  'inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  moreFilter
                    ? 'bg-indigo-500 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                {moreFilter ? moreFilter.label : 'More'}
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            )}
          >
            {({ close }) => MORE_FILTER_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="menuitem"
                  onClick={() => { handleFilterChange(opt.value); close(); }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm',
                    filter === opt.value ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'
                  )}
                >
                  <Icon className="h-3.5 w-3.5 text-gray-400" />
                  {opt.label}
                </button>
              );
            })}
          </Dropdown>
        </div>

        <div className="flex flex-1 flex-wrap items-center gap-2 lg:justify-end">
          <form onSubmit={handleSearch} className="relative min-w-[12rem] flex-1 lg:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search mail…"
              aria-label="Search mail"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-1.5 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </form>
          {accounts.length > 0 && (
            <select
              id="inbox-account-filter"
              value={accountEmail}
              onChange={handleAccountChange}
              aria-label="Filter inbox by email account"
              className="max-w-[11rem] rounded-lg border border-gray-300 bg-white py-1.5 pl-2.5 pr-7 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">All accounts</option>
              {accounts.map((a) => (
                <option key={a.id ?? a.email} value={a.email}>{accountOptionLabel(a)}</option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => setShowDateFilter((v) => !v)}
            aria-expanded={showDateFilter || hasDateFilter}
            title="Filter by date"
            aria-label="Filter by date"
            className={cn(
              'rounded-lg border p-2 transition-colors',
              hasDateFilter
                ? 'border-indigo-300 bg-indigo-50 text-indigo-600'
                : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'
            )}
          >
            <Calendar className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Date range — tucked away until asked for, and kept open while set so
          an active range is never invisible. */}
      {(showDateFilter || hasDateFilter) && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-gray-500">From</span>
          <input
            type="date"
            aria-label="From date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none"
          />
          <span className="text-gray-500">to</span>
          <input
            type="date"
            aria-label="To date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none"
          />
          {hasDateFilter && (
            <button
              type="button"
              onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); setShowDateFilter(false); }}
              className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700"
            >
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>
      )}

      {/* Label filter chips */}
      {labels.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600">
            <Tag className="h-4 w-4 text-gray-400" /> Labels
          </span>
          {labels.map((label) => {
            const on = labelFilter === String(label.id);
            return (
              <button
                key={label.id}
                type="button"
                onClick={() => handleLabelFilter(String(label.id))}
                aria-pressed={on}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset transition',
                  on ? labelChipClasses(label.color) : 'bg-white text-gray-500 ring-gray-200 hover:bg-gray-50'
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', labelDotClass(label.color))} />
                {label.name}
                {typeof label.thread_count === 'number' && label.thread_count > 0 && (
                  <span className="text-[10px] text-gray-400">{label.thread_count}</span>
                )}
              </button>
            );
          })}
          {labelFilter && (
            <button
              type="button"
              onClick={() => handleLabelFilter(labelFilter)}
              className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700"
            >
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>
      )}

      {/* Bulk action bar */}
      {checked.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2.5">
          <span className="text-sm font-medium text-indigo-800">{checked.size} selected</span>
          <button
            type="button"
            onClick={() => runBulk('read')}
            disabled={bulkAction.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <MailOpen className="h-3.5 w-3.5" /> Mark read
          </button>
          <button
            type="button"
            onClick={() => runBulk('archive')}
            disabled={bulkAction.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Archive className="h-3.5 w-3.5" /> Archive
          </button>
          <button
            type="button"
            onClick={() => runBulkSnooze()}
            disabled={bulkAction.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <AlarmClock className="h-3.5 w-3.5" /> Snooze to tomorrow
          </button>
          <button
            type="button"
            onClick={() => setChecked(new Set())}
            className="ml-auto text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
        </div>
      )}

      {/* Two-pane body */}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-8 text-center">
          <p className="text-sm text-red-700">
            Failed to load inbox{error.message ? `: ${error.message}` : '.'}
          </p>
        </div>
      ) : (
        <div className="flex gap-4 lg:h-[calc(100vh-15rem)] lg:min-h-[34rem]">
          {/* Left rail: thread list */}
          <div className={cn(
            'flex w-full flex-col lg:w-[22rem] xl:w-[24rem]',
            selectedId ? 'hidden lg:flex' : 'flex'
          )}>
            {isLoading ? (
              <InboxSkeleton />
            ) : threads.length === 0 ? (
              <EmptyState
                icon={InboxIcon}
                title="No email threads"
                description={
                  search
                    ? 'No threads match your search. Try different keywords.'
                    : filter === 'archived'
                      ? 'No archived threads yet.'
                      : accountEmail
                        ? 'No threads for this account. Try "All accounts" or another mailbox.'
                        : filter !== 'all'
                          ? 'No threads match this filter.'
                          : 'Email conversations will appear here once synced from Gmail.'
                }
          action={{ label: 'Connect an email account', href: '/settings' }}
        />
            ) : (
              <>
                <div className="mb-2 flex items-center gap-2 px-1">
                  <input
                    type="checkbox"
                    checked={allOnPageChecked}
                    onChange={toggleCheckAll}
                    aria-label="Select all threads on this page"
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs text-gray-500">Select all on page</span>
                  <span className="ml-auto text-xs text-gray-400">{totalThreads} total</span>
                </div>
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
                  {threads.map((thread) => (
                    <ThreadRow
                      key={thread.gmail_thread_id}
                      thread={thread}
                      active={thread.gmail_thread_id === selectedId}
                      checked={checked.has(thread.gmail_thread_id)}
                      onSelect={selectThread}
                      onToggleCheck={toggleCheck}
                      onArchive={archiveWithUndo}
                      onSnooze={snoozeThread}
                      onUnsnooze={unsnoozeThread}
                    />
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="mt-2 flex items-center justify-between border-t border-gray-200 pt-2 text-xs text-gray-500">
                    <span>Page {page} of {totalPages}</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPage(Math.max(1, page - 1))}
                        disabled={page <= 1}
                        className="rounded-md border border-gray-300 bg-white px-2 py-1 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={() => setPage(Math.min(totalPages, page + 1))}
                        disabled={page >= totalPages}
                        className="rounded-md border border-gray-300 bg-white px-2 py-1 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right pane: detail */}
          <div className={cn(
            'min-w-0 flex-1 rounded-xl border border-gray-200 bg-white shadow-sm',
            selectedId ? 'flex' : 'hidden lg:flex'
          )}>
            {isLoading && selectedId ? (
              <ThreadDetailSkeleton />
            ) : selectedThread ? (
              <ThreadDetail
                key={selectedThread.gmail_thread_id}
                thread={selectedThread}
                drafts={drafts}
                composerRef={composerRef}
                onArchive={archiveWithUndo}
                onMarkUnread={markUnread}
                onClose={() => setSelectedId(null)}
                onSnooze={snoozeThread}
                onUnsnooze={unsnoozeThread}
                labels={labels}
                onToggleLabel={(label, attached) => toggleLabel(selectedThread, label, attached)}
                onCreateLabel={(name, color) => createAndAttachLabel(selectedThread, name, color)}
              />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50">
                  <MessageSquare className="h-7 w-7 text-indigo-400" />
                </div>
                <h3 className="text-sm font-semibold text-gray-800">Select a conversation</h3>
                <p className="mt-1 max-w-xs text-sm text-gray-500">
                  Choose a thread from the list to read it and reply. Press{' '}
                  <kbd className="rounded border border-gray-200 bg-gray-50 px-1 text-[11px]">j</kbd>{' '}
                  /{' '}
                  <kbd className="rounded border border-gray-200 bg-gray-50 px-1 text-[11px]">k</kbd>{' '}
                  to navigate.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
