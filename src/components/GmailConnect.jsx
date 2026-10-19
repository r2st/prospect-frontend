import { useState } from 'react';
import {
  Mail, Server, Check, Star, Plus, Trash2, AlertTriangle, ShieldCheck,
  ToggleLeft, ToggleRight, RefreshCw, Send, Pencil, Loader2,
} from 'lucide-react';
import {
  useGmailStatus,
  useConnectGmail,
  useSetActiveGmail,
  useDisconnectGmail,
  usePurgeGmail,
  useToggleSending,
} from '../hooks/useGmail';
import {
  useSmtpAccounts,
  useDeleteSmtp,
  useSetActiveSmtp,
  useToggleSmtpSending,
  useTestSend,
} from '../hooks/useSmtp';
import SmtpAccountModal from './SmtpAccountModal';

// One unified row that renders either a Gmail or an SMTP sender account.
function AccountRow({
  account, kind, busy, testingId,
  onSetActive, onDisconnect, onPurge, onToggleSending, onTest, onEdit,
}) {
  const errored = account.status === 'error';
  const Icon = kind === 'smtp' ? Server : Mail;
  const iconWrap = kind === 'smtp' ? 'bg-indigo-50' : 'bg-blue-50';
  const iconColor = kind === 'smtp' ? 'text-indigo-600' : 'text-blue-600';
  const lastUsed = account.last_used_at
    ? new Date(account.last_used_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : 'Never';
  const isTesting = testingId === account.id;

  return (
    <div className="rounded-lg border border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${iconWrap}`}>
            <Icon className={`h-4 w-4 ${iconColor}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-gray-900">{account.email}</span>
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                {kind === 'smtp' ? 'SMTP' : 'Gmail'}
              </span>
              {account.is_active && !errored && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  <Star className="h-3 w-3 fill-green-500 text-green-500" />
                  Primary
                </span>
              )}
              {errored && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                  <AlertTriangle className="h-3 w-3" />
                  {kind === 'smtp' ? 'Connection error' : 'Reconnect'}
                </span>
              )}
            </div>
            {account.display_name && (
              <p className="truncate text-xs text-gray-500">{account.display_name}</p>
            )}
            {kind === 'smtp' && (
              <p className="truncate text-xs text-gray-400">{account.host}:{account.port}</p>
            )}
            {errored && account.last_error && (
              <p className="mt-0.5 truncate text-xs text-red-500" title={account.last_error}>{account.last_error}</p>
            )}
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {!account.is_active && !errored && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onSetActive(account.id)}
              className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Make primary
            </button>
          )}
          {kind === 'smtp' && (
            <button
              type="button"
              disabled={busy}
              aria-label={`Edit ${account.email}`}
              title="Edit settings"
              onClick={() => onEdit(account)}
              className="inline-flex items-center rounded-md px-2 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 disabled:opacity-50"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {kind === 'gmail' && onPurge && (
            <button
              type="button"
              disabled={busy}
              aria-label={`Delete all emails and remove ${account.email}`}
              title="Delete all synced emails and remove account"
              onClick={() => {
                if (window.confirm(
                  `⚠️ This will permanently delete ALL synced emails for ${account.email} and remove the account.\n\nThis cannot be undone. Continue?`
                )) {
                  onPurge(account.id);
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clean & Remove
            </button>
          )}
          {!(kind === 'gmail' && onPurge) && (
            <button
              type="button"
              disabled={busy}
              aria-label={`Disconnect ${account.email}`}
              title={`Remove ${account.email}`}
              onClick={() => {
                if (window.confirm(`Remove ${account.email}? Outreach will no longer send from this address.`)) {
                  onDisconnect(account.id);
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Sending toggle + test + stats row */}
      <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={busy || errored}
            onClick={() => onToggleSending(account.id, !account.sending_enabled)}
            className="flex items-center gap-1.5 text-xs disabled:opacity-50"
            title={account.sending_enabled ? 'Disable sending from this account' : 'Enable sending from this account'}
          >
            {account.sending_enabled ? (
              <ToggleRight className="h-5 w-5 text-green-500" />
            ) : (
              <ToggleLeft className="h-5 w-5 text-gray-400" />
            )}
            <span className={account.sending_enabled ? 'font-medium text-green-700' : 'text-gray-500'}>
              {account.sending_enabled ? 'Sending enabled' : 'Sending disabled'}
            </span>
          </button>
          <button
            type="button"
            disabled={busy || isTesting}
            onClick={() => onTest(kind, account.id)}
            className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            title={`Send a test email to ${account.email}`}
          >
            {isTesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            {isTesting ? 'Sending…' : 'Test'}
          </button>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span>Sent today: {account.daily_send_count || 0}</span>
          <span>Last used: {lastUsed}</span>
        </div>
      </div>
    </div>
  );
}

export default function GmailConnect() {
  const { data: status, isLoading: gmailLoading } = useGmailStatus();
  const { data: smtpAccounts, isLoading: smtpLoading } = useSmtpAccounts();
  const connect = useConnectGmail();
  const setActiveGmail = useSetActiveGmail();
  const disconnectGmail = useDisconnectGmail();
  const purgeGmail = usePurgeGmail();
  const toggleGmailSending = useToggleSending();

  const setActiveSmtp = useSetActiveSmtp();
  const deleteSmtp = useDeleteSmtp();
  const toggleSmtpSending = useToggleSmtpSending();
  const testSend = useTestSend();

  const [modalOpen, setModalOpen] = useState(false);
  const [editAccount, setEditAccount] = useState(null);

  const isLoading = gmailLoading || smtpLoading;
  const gmailAccounts = status?.accounts || [];
  const smtp = smtpAccounts || [];
  const configured = status?.configured;

  const totalAccounts = gmailAccounts.length + smtp.length;
  const connected = totalAccounts > 0;
  const sendingCount =
    (status?.sending_enabled_count || 0) +
    smtp.filter((a) => a.sending_enabled && a.status === 'connected').length;

  const busy =
    connect.isPending || setActiveGmail.isPending || disconnectGmail.isPending || purgeGmail.isPending || toggleGmailSending.isPending ||
    setActiveSmtp.isPending || deleteSmtp.isPending || toggleSmtpSending.isPending;

  const testingId = testSend.isPending ? testSend.variables?.id : null;
  const handleTest = (kind, id) => testSend.mutate({ kind, id });
  const handleEdit = (account) => { setEditAccount(account); setModalOpen(true); };
  const handleAdd = () => { setEditAccount(null); setModalOpen(true); };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
            <Mail className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Email Accounts</h2>
            <p className="text-sm text-gray-500">
              Connect Gmail or any SMTP account for outreach — multiple senders rotate automatically
            </p>
          </div>
        </div>
        {!isLoading && (
          <div className="flex items-center gap-3">
            {sendingCount > 1 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                <RefreshCw className="h-3 w-3" />
                Rotating {sendingCount} accounts
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1.5 text-sm font-medium ${connected ? 'text-green-600' : 'text-gray-500'}`}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-300'}`} />
              {connected ? `${totalAccounts} connected` : 'Not connected'}
            </span>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Info banner */}
          <div className="flex items-start gap-2 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">
            <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p>
              {sendingCount > 1 ? (
                <>Emails rotate across your {sendingCount} sending-enabled accounts using round-robin to
                  distribute volume and improve deliverability.</>
              ) : connected ? (
                <>Sending through a connected account uses that mailbox's authentication (SPF/DKIM/DMARC).
                  Add more accounts to enable automatic sender rotation.</>
              ) : (
                <>Connect a Gmail account or add an SMTP account so outreach lands in the inbox.
                  Until then, email is sent from{' '}
                  <span className="font-medium">{status?.fallback_sender}</span>.</>
              )}
            </p>
          </div>

          {gmailAccounts.map((acct) => (
            <AccountRow
              key={acct.id}
              account={acct}
              kind="gmail"
              busy={busy}
              testingId={testingId}
              onSetActive={setActiveGmail.mutate}
              onDisconnect={disconnectGmail.mutate}
              onPurge={purgeGmail.mutate}
              onToggleSending={(id, enabled) => toggleGmailSending.mutate({ id, enabled })}
              onTest={handleTest}
            />
          ))}

          {smtp.map((acct) => (
            <AccountRow
              key={acct.id}
              account={acct}
              kind="smtp"
              busy={busy}
              testingId={testingId}
              onSetActive={setActiveSmtp.mutate}
              onDisconnect={deleteSmtp.mutate}
              onToggleSending={(id, enabled) => toggleSmtpSending.mutate({ id, enabled })}
              onTest={handleTest}
              onEdit={handleEdit}
            />
          ))}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy || !configured}
              onClick={() => connect.mutate()}
              title={!configured ? 'Google OAuth not configured on the server — use Add SMTP account instead' : undefined}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {connected ? <Plus className="h-4 w-4" /> : <Check className="h-4 w-4" />}
              {connect.isPending ? 'Connecting…' : 'Connect Gmail'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleAdd}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
            >
              <Server className="h-4 w-4" />
              Add SMTP account
            </button>
          </div>

          {!configured && (
            <p className="text-xs text-gray-400">
              Gmail one-click connect needs <code>GOOGLE_CLIENT_ID</code>/<code>GOOGLE_CLIENT_SECRET</code> on the
              server. You can still add any Gmail, Outlook, or custom mailbox via <strong>Add SMTP account</strong>.
            </p>
          )}
        </div>
      )}

      <SmtpAccountModal open={modalOpen} onClose={() => setModalOpen(false)} account={editAccount} />
    </div>
  );
}
