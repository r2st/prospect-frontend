import { useState, useMemo } from 'react';
import {
  Mail, MailOpen, Send, ArrowUpRight, ArrowDownLeft,
  ChevronDown, ChevronRight, CheckCircle2, MousePointerClick,
  Reply, MessageSquare,
} from 'lucide-react';
import toast from 'react-hot-toast';
import EmptyState from './EmptyState';
import SafeHtml from './SafeHtml';
import { useLeadEmails, useSendReply } from '../hooks/useEmailHistory';
import { formatDate, timeAgo, cn } from '../lib/utils';

const STATUS_CONFIG = {
  sent:      { icon: CheckCircle2,      colors: 'bg-blue-50 text-blue-700' },
  delivered: { icon: CheckCircle2,      colors: 'bg-blue-50 text-blue-700' },
  opened:   { icon: MailOpen,           colors: 'bg-green-50 text-green-700' },
  clicked:  { icon: MousePointerClick,  colors: 'bg-purple-50 text-purple-700' },
  replied:  { icon: Reply,              colors: 'bg-teal-50 text-teal-700' },
  received: { icon: Mail,               colors: 'bg-amber-50 text-amber-700' },
};

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

function MessageItem({ message }) {
  const [expanded, setExpanded] = useState(false);
  const isSent = message.direction === 'sent';

  const htmlBody = message.body_html || null;

  return (
    <div className="border-t border-gray-100 py-3 first:border-t-0">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-3 text-left"
      >
        <div className={cn(
          'mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full',
          isSent ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
        )}>
          {isSent
            ? <ArrowUpRight className="h-4 w-4" />
            : <ArrowDownLeft className="h-4 w-4" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-900">
              {message.contact_name || (isSent ? message.from_email : message.from_email)}
            </span>
            <span className="text-xs text-gray-400">
              {isSent ? `to ${message.to_email}` : `from ${message.from_email}`}
            </span>
          </div>

          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-400">{timeAgo(message.timestamp)}</span>
            {isSent && message.status && <StatusBadge status={message.status} />}
            {!message.is_read && !isSent && (
              <span className="inline-block h-2 w-2 rounded-full bg-blue-500" title="Unread" />
            )}
          </div>

          {!expanded && message.snippet && (
            <p className="mt-1 line-clamp-2 text-sm text-gray-500">{message.snippet}</p>
          )}
        </div>

        <ChevronDown className={cn(
          'mt-1 h-4 w-4 flex-shrink-0 text-gray-400 transition-transform',
          expanded && 'rotate-180'
        )} />
      </button>

      {expanded && (
        <div className="ml-10 mt-2">
          {message.subject && (
            <p className="mb-2 text-sm font-medium text-gray-700">
              Subject: {message.subject}
            </p>
          )}
          {htmlBody ? (
            <SafeHtml
              html={htmlBody}
              className="prose prose-sm max-w-none rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700"
            />
          ) : message.body_text ? (
            <div className="whitespace-pre-wrap rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700">
              {message.body_text}
            </div>
          ) : (
            <p className="text-sm italic text-gray-400">No message body</p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-gray-400">
            <span>{formatDate(message.timestamp)}</span>
            {message.opened_at && <span>Opened {timeAgo(message.opened_at)}</span>}
            {message.clicked_at && <span>Clicked {timeAgo(message.clicked_at)}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function ReplyCompose({ threadMessages, onSent }) {
  const [body, setBody] = useState('');
  const sendReply = useSendReply();

  const lastMessage = threadMessages[threadMessages.length - 1];
  if (!lastMessage) return null;

  const handleSend = (e) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;

    sendReply.mutate(
      {
        emailId: lastMessage.id,
        data: {
          body_html: `<p>${trimmed.replace(/\n/g, '<br/>')}</p>`,
          body_text: trimmed,
        },
      },
      {
        onSuccess: () => {
          setBody('');
          toast.success('Reply sent');
          onSent?.();
        },
        onError: (err) => {
          toast.error(err?.message || 'Failed to send reply');
        },
      }
    );
  };

  return (
    <form onSubmit={handleSend} className="mt-3 border-t border-gray-100 pt-3">
      <div className="flex items-center gap-2 mb-2">
        <Reply className="h-4 w-4 text-gray-400" />
        <span className="text-xs font-medium text-gray-500">Reply</span>
      </div>
      <textarea
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your reply..."
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <div className="mt-2 flex justify-end">
        <button
          type="submit"
          disabled={sendReply.isPending || !body.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-600 disabled:opacity-50"
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

function ThreadCard({ thread }) {
  const [expanded, setExpanded] = useState(false);
  const messageCount = thread.messages?.length || 0;
  const subject = thread.subject || '(No subject)';

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        {expanded
          ? <ChevronDown className="h-5 w-5 flex-shrink-0 text-gray-400" />
          : <ChevronRight className="h-5 w-5 flex-shrink-0 text-gray-400" />}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {thread.has_unread && (
              <span className="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" title="Unread messages" />
            )}
            <span className={cn(
              'truncate text-sm',
              thread.has_unread ? 'font-semibold text-gray-900' : 'font-medium text-gray-800'
            )}>
              {subject}
            </span>
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-3">
          <span className="inline-flex items-center gap-1 text-xs text-gray-400">
            <MessageSquare className="h-3 w-3" />
            {messageCount}
          </span>
          <span className="text-xs text-gray-400">{timeAgo(thread.last_activity)}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4">
          {thread.messages.map((msg) => (
            <MessageItem key={msg.id} message={msg} />
          ))}
          <ReplyCompose threadMessages={thread.messages} />
        </div>
      )}
    </div>
  );
}

export default function EmailsTab({ companyId }) {
  const { data, isLoading, error } = useLeadEmails(companyId);

  const threads = useMemo(() => {
    if (!data?.threads) return [];
    return [...data.threads].sort(
      (a, b) => new Date(b.last_activity) - new Date(a.last_activity)
    );
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-center">
        <p className="text-sm text-red-700">
          Failed to load emails{error.message ? `: ${error.message}` : '.'}
        </p>
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <EmptyState
        icon={Mail}
        title="No email conversations"
        description="Email threads with this company's contacts will appear here once synced."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-500">
          {threads.length} {threads.length === 1 ? 'thread' : 'threads'}
          {data?.total_messages != null && (
            <span className="ml-1 text-gray-400">
              ({data.total_messages} {data.total_messages === 1 ? 'message' : 'messages'})
            </span>
          )}
        </h3>
      </div>

      <div className="space-y-2">
        {threads.map((thread) => (
          <ThreadCard key={thread.gmail_thread_id} thread={thread} />
        ))}
      </div>
    </div>
  );
}
