import { useState, useEffect } from 'react';
import { X, Server, Loader2 } from 'lucide-react';
import { useAddSmtp, useUpdateSmtp } from '../hooks/useSmtp';

// Common provider presets so users don't have to hunt for host/port settings.
const PRESETS = {
  custom: { label: 'Custom / Other', host: '', port: 587, use_tls: true, use_ssl: false },
  outlook: { label: 'Outlook.com', host: 'smtp-mail.outlook.com', port: 587, use_tls: true, use_ssl: false },
  office365: { label: 'Office 365', host: 'smtp.office365.com', port: 587, use_tls: true, use_ssl: false },
  gmail: { label: 'Gmail (app password)', host: 'smtp.gmail.com', port: 587, use_tls: true, use_ssl: false },
  yahoo: { label: 'Yahoo', host: 'smtp.mail.yahoo.com', port: 465, use_tls: false, use_ssl: true },
  zoho: { label: 'Zoho', host: 'smtp.zoho.com', port: 465, use_tls: false, use_ssl: true },
};

// Mailbox domain -> preset, so typing an address is usually all the setup needed.
const DOMAIN_PRESETS = {
  'gmail.com': 'gmail',
  'googlemail.com': 'gmail',
  'outlook.com': 'outlook',
  'hotmail.com': 'outlook',
  'live.com': 'outlook',
  'yahoo.com': 'yahoo',
  'ymail.com': 'yahoo',
  'zoho.com': 'zoho',
};

function detectFromEmail(email) {
  const domain = (email.split('@')[1] || '').trim().toLowerCase();
  if (!domain.includes('.')) return null;
  const key = DOMAIN_PRESETS[domain];
  if (key) return { key, ...PRESETS[key] };
  // Unknown domain: smtp.<domain> is right far more often than not.
  return { key: 'custom', host: `smtp.${domain}`, port: 587, use_tls: true, use_ssl: false };
}

const EMPTY = {
  email: '',
  display_name: '',
  host: '',
  port: 587,
  username: '',
  password: '',
  use_tls: true,
  use_ssl: false,
};

function Field({ label, children, hint }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

export default function SmtpAccountModal({ open, onClose, account }) {
  const isEdit = Boolean(account);
  const add = useAddSmtp();
  const update = useUpdateSmtp();
  const [form, setForm] = useState(EMPTY);
  const [advanced, setAdvanced] = useState(false);
  const [detected, setDetected] = useState('');

  useEffect(() => {
    if (!open) return;
    if (account) {
      setForm({
        email: account.email || '',
        display_name: account.display_name || '',
        host: account.host || '',
        port: account.port || 587,
        username: account.username || '',
        password: '', // never prefilled; blank means "keep existing"
        use_tls: account.use_tls ?? true,
        use_ssl: account.use_ssl ?? false,
      });
    } else {
      setForm(EMPTY);
    }
    setAdvanced(Boolean(account));
    setDetected('');
  }, [open, account]);

  if (!open) return null;

  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  // Fill server settings from the address once it's typed, unless the user has
  // already set a host themselves.
  const onEmailBlur = () => {
    if (isEdit) return;
    const d = detectFromEmail(form.email);
    if (!d || (form.host && form.host !== detected)) return;
    set({ host: d.host, port: d.port, use_tls: d.use_tls, use_ssl: d.use_ssl });
    setDetected(d.host);
    // A guessed host for a custom domain deserves a look; known providers don't.
    if (d.key === 'custom') setAdvanced(true);
  };
  const busy = add.isPending || update.isPending;

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Server settings stay collapsed unless detection missed; if the host is
    // still empty, open them rather than sending a doomed request.
    if (!form.host.trim()) {
      const d = detectFromEmail(form.email);
      if (d) set({ host: d.host, port: d.port, use_tls: d.use_tls, use_ssl: d.use_ssl });
      setAdvanced(true);
      return;
    }
    const payload = {
      email: form.email.trim(),
      display_name: form.display_name.trim() || null,
      host: form.host.trim(),
      port: Number(form.port),
      username: form.username.trim() || form.email.trim(),
      use_tls: form.use_tls,
      use_ssl: form.use_ssl,
    };
    if (form.password) payload.password = form.password;

    try {
      if (isEdit) {
        await update.mutateAsync({ id: account.id, payload });
      } else {
        await add.mutateAsync({ ...payload, password: form.password });
      }
      onClose();
    } catch {
      // toast handled in the hook; keep the modal open so the user can retry
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100">
              <Server className="h-4 w-4 text-indigo-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              {isEdit ? 'Edit SMTP account' : 'Add SMTP account'}
            </h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <Field label="Email">
            <input
              type="email"
              required
              autoFocus
              value={form.email}
              onChange={(e) => set({ email: e.target.value })}
              onBlur={onEmailBlur}
              placeholder="you@company.com"
              className={inputCls}
            />
          </Field>

          <Field
            label={isEdit ? 'Password (leave blank to keep current)' : 'Password'}
            hint="For Gmail/Outlook with 2FA, use an app password."
          >
            <input
              type="password"
              required={!isEdit}
              value={form.password}
              onChange={(e) => set({ password: e.target.value })}
              placeholder={isEdit ? '••••••••' : 'App password or SMTP password'}
              className={inputCls}
              autoComplete="new-password"
            />
          </Field>

          <button
            type="button"
            onClick={() => setAdvanced((v) => !v)}
            aria-expanded={advanced}
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            {advanced ? 'Hide server settings' : 'Server settings'}
          </button>

          {advanced && (
            <div className="space-y-4 rounded-lg border border-gray-100 bg-gray-50 p-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <Field label="SMTP host">
                    <input type="text" required value={form.host} onChange={(e) => set({ host: e.target.value })} placeholder="smtp.company.com" className={inputCls} />
                  </Field>
                </div>
                <Field label="Port">
                  <input type="number" required value={form.port} onChange={(e) => set({ port: e.target.value })} className={inputCls} />
                </Field>
              </div>

              <Field label="Username" hint="Defaults to your email address.">
                <input type="text" value={form.username} onChange={(e) => set({ username: e.target.value })} placeholder={form.email || 'you@company.com'} className={inputCls} />
              </Field>

              <Field label="Display name" hint="Optional">
                <input type="text" value={form.display_name} onChange={(e) => set({ display_name: e.target.value })} placeholder="Sales Team" className={inputCls} />
              </Field>

              <Field label="Encryption">
                <div className="flex gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="encryption"
                      checked={form.use_tls && !form.use_ssl}
                      onChange={() => set({ use_tls: true, use_ssl: false, port: 587 })}
                    />
                    STARTTLS (587)
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="encryption"
                      checked={form.use_ssl}
                      onChange={() => set({ use_tls: false, use_ssl: true, port: 465 })}
                    />
                    SSL/TLS (465)
                  </label>
                </div>
              </Field>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? 'Verifying…' : isEdit ? 'Save changes' : 'Add & verify'}
            </button>
          </div>
          <p className="text-center text-xs text-gray-400">
            We verify the connection before saving, so adding may take a few seconds.
          </p>
        </form>
      </div>
    </div>
  );
}
