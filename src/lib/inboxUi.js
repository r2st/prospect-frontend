// Presentation helpers for the Inbox. Kept separate from the generic utils so
// the inbox's status/sender/timestamp logic is unit-testable in isolation.

// Full, absolute timestamp for hover titles (e.g. "Jul 22, 2026, 3:14 PM").
// Complements the relative `timeAgo` label shown inline.
export function fullTimestamp(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return '';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Best display name for a message's counterparty. For a sent message that's the
// recipient; for a received one it's the sender. Falls back to the email, then
// the email's local-part.
export function senderDisplay(message) {
  if (!message) return 'Unknown';
  const isSent = message.direction === 'sent';
  const name = message.contact_name;
  const email = isSent ? message.to_email : message.from_email;
  if (name && name.trim()) return name.trim();
  if (email && email.trim()) return email.trim();
  return 'Unknown';
}

// The email address to seed an avatar / show as the secondary identity line.
export function counterpartyEmail(message) {
  if (!message) return '';
  return (message.direction === 'sent' ? message.to_email : message.from_email) || '';
}

// Which of *our* connected mailboxes a message belongs to — the account it was
// sent from, or received on. The backend tags every message with it; the
// header addresses are the fallback (``from`` on a send, ``to`` on a reply).
export function messageAccountEmail(message) {
  if (!message) return '';
  return (
    message.gmail_account_email
    || (message.direction === 'sent' ? message.from_email : message.to_email)
    || ''
  );
}

// The mailbox a thread lives in. With several connected senders, two threads to
// the same prospect are otherwise indistinguishable in the list. Latest message
// wins, matching the row's other "last message" fields.
export function threadAccountEmail(thread) {
  const messages = thread?.messages || [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const email = messageAccountEmail(messages[i]);
    if (email) return email;
  }
  return '';
}

/**
 * Derive a single thread-level status for the list pill. Order of precedence:
 *   bounced  → a send in the thread bounced (deliverability problem)
 *   attention → the latest message is an unanswered inbound (needs a reply)
 *   replied  → we sent the latest message
 *   null     → nothing worth flagging
 */
export function threadStatus(thread) {
  const messages = thread?.messages || [];
  if (messages.length === 0) return null;

  const anyBounced = messages.some(
    (m) => (m.status || '').toLowerCase() === 'bounced'
  );
  if (anyBounced) {
    return { key: 'bounced', label: 'Bounced', colors: 'bg-red-50 text-red-700 ring-red-600/20' };
  }

  const last = messages[messages.length - 1];
  if (last.direction === 'received') {
    return { key: 'attention', label: 'Needs attention', colors: 'bg-amber-50 text-amber-700 ring-amber-600/20' };
  }
  if (last.direction === 'sent') {
    return { key: 'replied', label: 'Replied', colors: 'bg-teal-50 text-teal-700 ring-teal-600/20' };
  }
  return null;
}

// Count of unread threads in a page of inbox results — used for the in-page
// summary and as a fallback badge source.
export function unreadThreadCount(threads) {
  return (threads || []).filter((t) => t.has_unread).length;
}
