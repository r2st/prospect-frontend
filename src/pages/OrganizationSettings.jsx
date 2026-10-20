import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Loader2, Building2, Palette, CreditCard, Braces, ShieldAlert, Lock, Mail } from 'lucide-react';
import { orgApi, canManageOrg } from '../api/org';
import { useAuth } from '../context/AuthContext';
import { usePlatform } from '../context/PlatformContext';
import PlatformOrgPrompt from '../components/PlatformOrgPrompt';

// The sender identity printed in every outgoing email's footer — this org's,
// never DoAide's. CAN-SPAM / CASL require the sender's name and a physical
// postal address on commercial email. Stored in `branding` with the keys the
// backend reads (email_dispatch.sender_identity_for_org).
const FOOTER_FIELDS = [
  { key: 'company_name', label: 'Company name', placeholder: 'Defaults to the organization name', type: 'text' },
  { key: 'company_address', label: 'Company address', placeholder: 'Street, city, region, postal code, country', type: 'text' },
  { key: 'company_website', label: 'Company website', placeholder: 'https://yourco.com', type: 'url' },
];

// Branding keys we expose as a structured form; anything else lives in the raw
// config JSON editor below.
const BRANDING_FIELDS = [
  { key: 'support_email', label: 'Support email', placeholder: 'support@yourco.com', type: 'email' },
  { key: 'primary_color', label: 'Primary color', placeholder: '#4f46e5', type: 'color' },
  { key: 'secondary_color', label: 'Secondary color', placeholder: '#0ea5e9', type: 'color' },
  { key: 'logo_url', label: 'Logo URL', placeholder: 'https://… (upload coming soon)', type: 'text' },
];

const PLAN_LABEL = {
  free: 'Free', starter: 'Starter', growth: 'Growth', pro: 'Pro', enterprise: 'Enterprise',
};

export default function OrganizationSettings() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isPlatformAdmin, isImpersonating } = usePlatform();
  const canWrite = canManageOrg(user);

  // A platform admin has no org of their own; the /org/* endpoints 400 unless
  // they're impersonating one. Skip the doomed request and prompt them to pick.
  const needsOrgContext = isPlatformAdmin && !isImpersonating;

  const { data: org, isLoading, isError } = useQuery({
    queryKey: ['org-settings'],
    queryFn: orgApi.getSettings,
    enabled: !needsOrgContext,
  });

  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [branding, setBranding] = useState({});
  const [configText, setConfigText] = useState('{}');
  const [configError, setConfigError] = useState(null);

  // Hydrate the form once the org loads (and whenever it changes underneath us).
  useEffect(() => {
    if (!org) return;
    setName(org.name ?? '');
    setIndustry(org.industry ?? '');
    setBranding(org.branding ?? {});
    setConfigText(JSON.stringify(org.config ?? {}, null, 2));
    setConfigError(null);
  }, [org]);

  const updateMutation = useMutation({
    mutationFn: orgApi.updateSettings,
    onSuccess: (data) => {
      toast.success('Organization settings saved');
      queryClient.setQueryData(['org-settings'], data);
    },
    onError: (err) => {
      const status = err?.response?.status;
      toast.error(
        status === 403
          ? 'Only an organization admin can change settings'
          : err?.response?.data?.detail || 'Could not save settings'
      );
    },
  });

  const dirty = useMemo(() => {
    if (!org) return false;
    return (
      name !== (org.name ?? '') ||
      industry !== (org.industry ?? '') ||
      JSON.stringify(branding) !== JSON.stringify(org.branding ?? {}) ||
      configText !== JSON.stringify(org.config ?? {}, null, 2)
    );
  }, [org, name, industry, branding, configText]);

  const onSave = (e) => {
    e.preventDefault();
    if (!canWrite) return;
    let config;
    try {
      config = configText.trim() ? JSON.parse(configText) : {};
    } catch {
      setConfigError('Config must be valid JSON.');
      return;
    }
    if (config === null || typeof config !== 'object' || Array.isArray(config)) {
      setConfigError('Config must be a JSON object.');
      return;
    }
    setConfigError(null);
    // Drop empty branding values so we don't persist blank strings.
    const cleanBranding = Object.fromEntries(
      Object.entries(branding).filter(([, v]) => v !== '' && v != null)
    );
    updateMutation.mutate({ name: name.trim(), industry: industry.trim() || null, branding: cleanBranding, config });
  };

  if (needsOrgContext) {
    return <PlatformOrgPrompt noun="organization settings" />;
  }
  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading organization…
      </div>
    );
  }
  if (isError || !org) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-red-600">
        <ShieldAlert className="h-4 w-4" /> Could not load organization settings.
      </div>
    );
  }

  return (
    <form onSubmit={onSave} className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Organization</h1>
          <p className="mt-1 text-sm text-gray-500">
            Your organization's identity, branding, and configuration.
          </p>
        </div>
        {!canWrite && <AdminOnlyBadge />}
      </div>

      {/* Identity */}
      <Section icon={Building2} title="Identity">
        <Field label="Organization name">
          <input
            type="text"
            value={name}
            disabled={!canWrite}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Industry" hint="Primary vertical (e.g. cnc_machining, metal_stamping).">
          <input
            type="text"
            value={industry}
            disabled={!canWrite}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="Not set"
            className={inputCls}
          />
        </Field>
        <Field label="Slug" hint="Identifies your org in URLs — changed by the platform team.">
          <input type="text" value={org.slug} disabled readOnly className={`${inputCls} bg-gray-50 text-gray-500`} />
        </Field>
      </Section>

      {/* Email footer */}
      <Section
        icon={Mail}
        title="Email footer"
        subtitle="Printed under the unsubscribe link in every email you send. Anti-spam law (CAN-SPAM) requires your company's postal address."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FOOTER_FIELDS.map((f) => (
            <Field key={f.key} label={f.label}>
              <input
                type={f.type}
                value={branding[f.key] || ''}
                disabled={!canWrite}
                onChange={(e) => setBranding({ ...branding, [f.key]: e.target.value })}
                placeholder={f.placeholder}
                className={inputCls}
              />
            </Field>
          ))}
        </div>
        <div aria-label="Footer preview" className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs leading-relaxed text-gray-500">
          —<br />
          Don&apos;t want these emails? Reply UNSUBSCRIBE or click: <span className="underline">unsubscribe</span>
          <br />
          {(branding.company_name || name || 'Your company').trim()}
          {branding.company_address ? ` · ${branding.company_address.trim()}` : ''}
          {branding.company_website ? (
            <>
              <br />
              {branding.company_website.trim()}
            </>
          ) : null}
          {!branding.company_address && (
            <p className="mt-2 font-medium text-amber-700">Add your company address — emails without one aren&apos;t CAN-SPAM compliant.</p>
          )}
        </div>
      </Section>

      {/* Branding */}
      <Section icon={Palette} title="Branding" subtitle="Used for white-label surfaces. Logo upload is coming soon.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {BRANDING_FIELDS.map((f) => (
            <Field key={f.key} label={f.label}>
              {f.type === 'color' ? (
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label={f.label}
                    value={/^#[0-9a-fA-F]{6}$/.test(branding[f.key] || '') ? branding[f.key] : '#4f46e5'}
                    disabled={!canWrite}
                    onChange={(e) => setBranding({ ...branding, [f.key]: e.target.value })}
                    className="h-9 w-12 cursor-pointer rounded border border-gray-300 disabled:cursor-not-allowed"
                  />
                  <input
                    type="text"
                    value={branding[f.key] || ''}
                    disabled={!canWrite}
                    onChange={(e) => setBranding({ ...branding, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                    className={inputCls}
                  />
                </div>
              ) : (
                <input
                  type={f.type}
                  value={branding[f.key] || ''}
                  disabled={!canWrite}
                  onChange={(e) => setBranding({ ...branding, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  className={inputCls}
                />
              )}
            </Field>
          ))}
        </div>
      </Section>

      {/* Billing (read-only) */}
      <Section icon={CreditCard} title="Billing plan">
        <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-gray-900">{PLAN_LABEL[org.billing_plan] || org.billing_plan}</div>
            <div className="text-xs text-gray-500">
              {org.effective_ai_call_limit == null
                ? 'Unlimited AI calls / month'
                : `${org.effective_ai_call_limit.toLocaleString()} AI calls / month`}
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500 ring-1 ring-inset ring-gray-500/20">
            <Lock className="h-3 w-3" /> Managed by platform
          </span>
        </div>
      </Section>

      {/* Raw config (power users) */}
      <Section icon={Braces} title="Advanced config" subtitle="Raw JSONB — feature flags, enabled verticals, AI prompt overrides.">
        <textarea
          value={configText}
          disabled={!canWrite}
          onChange={(e) => { setConfigText(e.target.value); setConfigError(null); }}
          spellCheck={false}
          rows={10}
          aria-label="Organization config JSON"
          className={`w-full rounded-lg border px-3 py-2 font-mono text-xs focus:outline-none focus:ring-1 disabled:bg-gray-50 disabled:text-gray-500 ${
            configError ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
          }`}
        />
        {configError && <p className="mt-1 text-xs text-red-600">{configError}</p>}
      </Section>

      {canWrite && (
        <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-gray-200 bg-gray-50/80 py-4 backdrop-blur">
          {dirty && <span className="text-xs text-amber-600">Unsaved changes</span>}
          <button
            type="submit"
            disabled={!dirty || updateMutation.isPending}
            className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
          >
            {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </button>
        </div>
      )}
    </form>
  );
}

const inputCls =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-500';

function Section({ icon: Icon, title, subtitle, children }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-indigo-600" />
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        </div>
        {subtitle && <p className="mt-1 text-xs text-gray-400">{subtitle}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-gray-400">{hint}</span>}
    </label>
  );
}

export function AdminOnlyBadge() {
  return (
    <span
      title="Only an organization admin can make changes"
      className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20"
    >
      <Lock className="h-3 w-3" /> Admin only
    </span>
  );
}
