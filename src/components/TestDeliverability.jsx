import { useCallback, useEffect, useState } from 'react';
import { Send, Loader2, CheckCircle2, XCircle, AlertTriangle, MailCheck } from 'lucide-react';
import { api } from '../api/client';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';

/**
 * Test-send + deliverability card.
 *
 * Sends a fully-compliant test email through the configured sender (same footer,
 * unsubscribe headers, and plain-text alternative as real outreach), then shows
 * the sending domain's SPF / DKIM / DMARC posture so the operator can confirm
 * authentication passes before scaling.
 */
export default function TestDeliverability() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [auth, setAuth] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const loadAuth = useCallback(async () => {
    setCheckingAuth(true);
    try {
      const { data } = await api.get('/email/deliverability');
      setAuth(data);
    } catch {
      setAuth(null);
    } finally {
      setCheckingAuth(false);
    }
  }, []);

  useEffect(() => {
    loadAuth();
  }, [loadAuth]);

  const sendTest = useCallback(async () => {
    if (!email.trim()) {
      toast.error('Enter an email address');
      return;
    }
    setSending(true);
    setResult(null);
    try {
      const { data } = await api.post('/email/test-send', { to_email: email.trim() });
      setResult(data);
      if (data.domain_auth) setAuth(data.domain_auth);
      if (data.sent) toast.success(`Test email sent to ${email.trim()}`);
      else if (data.status === 'halted') toast.error('Sending is paused (kill switch engaged)');
      else toast.error(data.reason || 'Test send failed');
    } catch {
      toast.error('Test send failed');
    } finally {
      setSending(false);
    }
  }, [email]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
          <MailCheck className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Test Deliverability</h2>
          <p className="text-sm text-gray-500">Send a compliant test email and verify SPF / DKIM / DMARC</p>
        </div>
      </div>

      {/* Test send */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendTest()}
          placeholder="you@example.com"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={sendTest}
          disabled={sending}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-600 disabled:opacity-50"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send Test Email
        </button>
      </div>

      {result && (
        <div
          className={cn(
            'mt-3 flex items-start gap-2 rounded-lg px-4 py-3 text-sm',
            result.sent ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
          )}
        >
          {result.sent ? <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />}
          <div>
            <p className="font-medium">
              {result.sent ? `Sent via ${result.transport || 'configured sender'}` : `Not sent (${result.status})`}
            </p>
            {result.sender && <p className="text-xs opacity-80">From: {result.sender}</p>}
            {result.reason && <p className="text-xs opacity-80">{result.reason}</p>}
          </div>
        </div>
      )}

      {/* Domain auth posture */}
      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">
            Domain Authentication{auth?.domain ? ` — ${auth.domain}` : ''}
          </h3>
          {checkingAuth && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
        </div>
        {auth ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              <AuthChip label="SPF" record={auth.spf} />
              <AuthChip label="DKIM" record={auth.dkim} />
              <AuthChip label="DMARC" record={auth.dmarc} />
            </div>
            {Array.isArray(auth.recommendations) && auth.recommendations.length > 0 && (
              <ul className="mt-3 space-y-1">
                {auth.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-gray-500">
                    <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0 text-amber-500" />
                    {rec}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          !checkingAuth && (
            <p className="text-xs text-gray-400">Deliverability check unavailable.</p>
          )
        )}
      </div>
    </div>
  );
}

function AuthChip({ label, record }) {
  const status = record?.status || 'unknown';
  const styles = {
    pass: 'bg-green-100 text-green-700',
    warn: 'bg-amber-100 text-amber-700',
    fail: 'bg-red-100 text-red-700',
    unknown: 'bg-gray-100 text-gray-500',
  };
  const Icon = status === 'pass' ? CheckCircle2 : status === 'fail' ? XCircle : AlertTriangle;
  return (
    <div className={cn('flex flex-col items-center gap-1 rounded-lg px-2 py-2.5', styles[status] || styles.unknown)}>
      <Icon className="h-4 w-4" />
      <span className="text-xs font-semibold">{label}</span>
      <span className="text-[10px] uppercase tracking-wide">{status}</span>
    </div>
  );
}
