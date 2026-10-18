import { AlertTriangle, Send } from 'lucide-react';

const PROBLEM = {
  disconnected: 'disconnected — reconnect it in Settings before anything can send',
  sending_off: 'sending is turned off for this mailbox in Settings',
};

/**
 * "From: Name <email> · Gmail". A sent email shows the address it actually
 * went out from; anything else shows the campaign's mailbox, with a warning
 * when that mailbox can't send right now.
 */
export default function SenderLine({ sender, sentFrom, className = '' }) {
  if (sentFrom) {
    return (
      <p className={`flex items-center gap-1.5 text-sm text-gray-700 ${className}`} data-testid="sender-line">
        <Send className="h-4 w-4 flex-shrink-0 text-indigo-500" />
        <span className="font-medium">Sent from</span>
        <span className="truncate font-semibold text-gray-900">{sentFrom}</span>
      </p>
    );
  }
  if (!sender) {
    return (
      <p className={`flex items-center gap-1.5 text-sm text-amber-700 ${className}`} data-testid="sender-line">
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        No sending account is set for this campaign.
      </p>
    );
  }
  return (
    <div className={className} data-testid="sender-line">
      <p className="flex flex-wrap items-center gap-1.5 text-sm text-gray-700">
        <Send className="h-4 w-4 flex-shrink-0 text-indigo-500" />
        <span className="font-medium">From</span>
        <span className="font-semibold text-gray-900">
          {sender.display_name ? `${sender.display_name} <${sender.email}>` : sender.email}
        </span>
        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">
          {sender.kind === 'smtp' ? 'SMTP' : 'Gmail'}
        </span>
      </p>
      {!sender.ready && (
        <p className="mt-1 flex items-center gap-1 text-xs text-amber-700">
          <AlertTriangle className="h-3.5 w-3.5" />
          This mailbox is {PROBLEM[sender.problem] || 'unavailable'}.
        </p>
      )}
    </div>
  );
}
