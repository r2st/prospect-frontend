import { useState } from 'react';
import {
  HeartHandshake, Loader2, RefreshCw, Power, Check, X, Eye, EyeOff,
  TrendingUp, TrendingDown, Minus, AlertTriangle, PartyPopper, PhoneCall,
  MessageCircle, ShieldAlert, Save,
} from 'lucide-react';
import toast from 'react-hot-toast';
import MetricCard from '../components/MetricCard';
import EmptyState from '../components/EmptyState';
import { cn, timeAgo } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import {
  ACTION_META, LLM_MODEL_OPTIONS,
  useAgentActions, useAgentConfig, useAgentStats, useApproveAction,
  useClientHealthOverview, useDismissAction, useUpdateAgentConfig,
} from '../hooks/useClientSuccess';

/**
 * Client Success Agent dashboard.
 *
 * The autonomous agent watches per-client health and proactively acts when it
 * drops: AI-drafted check-ins, escalations to a manager, review-call
 * suggestions, and celebrations of client wins. This screen is where an admin
 * turns it on/off, tunes its thresholds and LLM backend, and works the queue of
 * actions it has proposed.
 */
export default function ClientSuccessAgent() {
  const { isAdmin } = useAuth();
  const { data: config, isLoading, isError, refetch, isFetching } = useAgentConfig();
  const updateConfig = useUpdateAgentConfig();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (isError || !config) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Couldn't load the Client Success Agent"
        description="The agent config endpoint didn't respond. Try again in a moment."
        action={{ label: 'Retry', onClick: () => refetch() }}
      />
    );
  }

  const toggleActive = () =>
    updateConfig.mutate({ is_active: !config.is_active });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
            <HeartHandshake className="h-6 w-6 text-rose-500" />
            Client Success Agent
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Watches client health and proactively engages — AI check-ins when
            engagement cools, escalations and review calls when health is
            critical, and celebrations when clients hit a milestone.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          Refresh
        </button>
      </header>

      <PowerToggle
        active={config.is_active}
        disabled={!isAdmin || updateConfig.isPending}
        onToggle={toggleActive}
      />

      <StatsRow />

      {/* Remount when the server config changes so the form re-seeds from it
          (e.g. after the master toggle) without a setState-in-effect. */}
      <ConfigForm key={config.updated_at} config={config} canEdit={isAdmin} />

      <div className="grid gap-6 lg:grid-cols-2">
        <ActionQueue />
        <HealthOverview />
      </div>
    </div>
  );
}

// ── Prominent ON/OFF toggle ───────────────────────────────────────────────────

function PowerToggle({ active, disabled, onToggle }) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-4 rounded-xl border p-5 shadow-sm transition-colors',
        active ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-white'
      )}
    >
      <div className="flex items-center gap-4">
        <div
          className={cn(
            'flex h-12 w-12 items-center justify-center rounded-full',
            active ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'
          )}
        >
          <Power className="h-6 w-6" />
        </div>
        <div>
          <p className="text-lg font-semibold text-gray-900">
            Agent is {active ? 'ON' : 'OFF'}
          </p>
          <p className="text-sm text-gray-500">
            {active
              ? 'Scanning client health and proposing actions automatically.'
              : 'Turn on to let the agent monitor health and draft outreach.'}
          </p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={active}
        aria-label="Toggle Client Success Agent"
        disabled={disabled}
        onClick={onToggle}
        className={cn(
          'relative inline-flex h-9 w-16 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50',
          active ? 'bg-emerald-500' : 'bg-gray-300'
        )}
      >
        <span
          className={cn(
            'inline-block h-7 w-7 transform rounded-full bg-white shadow transition-transform',
            active ? 'translate-x-8' : 'translate-x-1'
          )}
        />
      </button>
    </div>
  );
}

// ── Stat cards ────────────────────────────────────────────────────────────────

function StatsRow() {
  const { data: stats } = useAgentStats();
  const s = stats || {};
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      <MetricCard title="Clients Monitored" value={s.clients_monitored ?? '—'} icon={HeartHandshake} color="blue" />
      <MetricCard title="Check-ins Sent" value={s.checkins_sent ?? '—'} icon={MessageCircle} color="teal" />
      <MetricCard title="Escalations" value={s.escalations ?? '—'} icon={ShieldAlert} color="red" />
      <MetricCard title="Celebrations" value={s.celebrations ?? '—'} icon={PartyPopper} color="green" />
      <MetricCard title="Review Calls" value={s.review_calls ?? '—'} icon={PhoneCall} color="purple" />
      <MetricCard title="Pending" value={s.pending_actions ?? '—'} icon={AlertTriangle} color="orange" />
    </div>
  );
}

// ── Configuration form ─────────────────────────────────────────────────────────

function ConfigForm({ config, canEdit }) {
  const update = useUpdateAgentConfig();
  const [form, setForm] = useState(() => seedForm(config));
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [clearKey, setClearKey] = useState(false);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const thresholdsValid = form.health_critical_threshold < form.health_warning_threshold;

  const onSubmit = (e) => {
    e.preventDefault();
    if (!canEdit) return;
    if (!thresholdsValid) {
      toast.error('Critical threshold must be below the warning threshold');
      return;
    }
    const body = { ...form };
    if (clearKey) body.llm_api_key = '';
    else if (apiKey.trim()) body.llm_api_key = apiKey.trim();
    update.mutate(body, {
      onSuccess: () => {
        setApiKey('');
        setClearKey(false);
      },
    });
  };

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Configuration</h2>
        {!canEdit && (
          <span className="text-xs font-medium text-gray-400">
            Read-only — org admins can edit
          </span>
        )}
      </div>

      <fieldset disabled={!canEdit} className="space-y-6">
        {/* LLM backend */}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">LLM Model</span>
            <select
              value={form.llm_model}
              onChange={(e) => set({ llm_model: e.target.value })}
              className="mt-1 block w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              {LLM_MODEL_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
              {/* Preserve a custom value that isn't in the preset list. */}
              {!LLM_MODEL_OPTIONS.some((m) => m.value === form.llm_model) && (
                <option value={form.llm_model}>{form.llm_model}</option>
              )}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">API Key</span>
            <span className="ml-1 text-xs text-gray-400">
              Leave blank to use organization default
            </span>
            <div className="mt-1 flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={clearKey ? '' : apiKey}
                  disabled={clearKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    config.llm_api_key_set ? '•••• key on file' : 'sk-or-...'
                  }
                  className="block w-full rounded-lg border-gray-300 pr-9 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-gray-50"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-2 text-gray-400 hover:text-gray-600"
                  aria-label={showKey ? 'Hide key' : 'Show key'}
                  tabIndex={-1}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {config.llm_api_key_set && (
                <button
                  type="button"
                  onClick={() => { setClearKey((v) => !v); setApiKey(''); }}
                  className={cn(
                    'shrink-0 rounded-lg border px-3 py-2 text-xs font-medium',
                    clearKey
                      ? 'border-red-300 bg-red-50 text-red-600'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  )}
                >
                  {clearKey ? 'Will clear' : 'Clear'}
                </button>
              )}
            </div>
          </label>
        </div>

        {/* Thresholds */}
        <div className="grid gap-6 sm:grid-cols-2">
          <ThresholdSlider
            label="Warning threshold"
            help="Below this health score, draft a check-in."
            value={form.health_warning_threshold}
            onChange={(v) => set({ health_warning_threshold: v })}
            accent="amber"
          />
          <ThresholdSlider
            label="Critical threshold"
            help="Below this, escalate and suggest a review call."
            value={form.health_critical_threshold}
            onChange={(v) => set({ health_critical_threshold: v })}
            accent="red"
          />
        </div>
        {!thresholdsValid && (
          <p className="text-sm text-red-600">
            Critical threshold must be below the warning threshold.
          </p>
        )}

        {/* Cadence */}
        <label className="block max-w-xs">
          <span className="text-sm font-medium text-gray-700">Scan frequency (days)</span>
          <input
            type="number"
            min={1}
            max={90}
            value={form.check_frequency_days}
            onChange={(e) => set({ check_frequency_days: Number(e.target.value) })}
            className="mt-1 block w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </label>

        {/* Auto toggles */}
        <div className="space-y-3">
          <ToggleRow
            label="Auto check-ins"
            help="Send drafted check-ins automatically when health slips."
            checked={form.auto_checkin_enabled}
            onChange={(v) => set({ auto_checkin_enabled: v })}
          />
          <ToggleRow
            label="Auto escalation"
            help="Raise an escalation to a manager on critical health."
            checked={form.auto_escalation_enabled}
            onChange={(v) => set({ auto_escalation_enabled: v })}
          />
          <ToggleRow
            label="Celebrations"
            help="Congratulate clients when they hit a milestone."
            checked={form.celebration_enabled}
            onChange={(v) => set({ celebration_enabled: v })}
          />
        </div>

        {/* Templates */}
        <div className="grid gap-4 lg:grid-cols-3">
          <TemplateField
            label="Check-in guidance"
            value={form.checkin_template}
            onChange={(v) => set({ checkin_template: v })}
            placeholder="Tone/notes for check-in emails…"
          />
          <TemplateField
            label="Escalation guidance"
            value={form.escalation_template}
            onChange={(v) => set({ escalation_template: v })}
            placeholder="What a manager brief should emphasize…"
          />
          <TemplateField
            label="Celebration guidance"
            value={form.celebration_template}
            onChange={(v) => set({ celebration_template: v })}
            placeholder="How to phrase congratulations…"
          />
        </div>
      </fieldset>

      {canEdit && (
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={update.isPending || !thresholdsValid}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save settings
          </button>
        </div>
      )}
    </form>
  );
}

function seedForm(config) {
  return {
    llm_model: config.llm_model,
    health_warning_threshold: config.health_warning_threshold,
    health_critical_threshold: config.health_critical_threshold,
    check_frequency_days: config.check_frequency_days,
    auto_checkin_enabled: config.auto_checkin_enabled,
    auto_escalation_enabled: config.auto_escalation_enabled,
    celebration_enabled: config.celebration_enabled,
    checkin_template: config.checkin_template || '',
    escalation_template: config.escalation_template || '',
    celebration_template: config.celebration_template || '',
  };
}

function ThresholdSlider({ label, help, value, onChange, accent }) {
  const accentText = accent === 'red' ? 'text-red-600' : 'text-amber-600';
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className={cn('text-sm font-bold', accentText)}>{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-indigo-600"
      />
      <p className="mt-1 text-xs text-gray-400">{help}</p>
    </div>
  );
}

function ToggleRow({ label, help, checked, onChange }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-xs text-gray-500">{help}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
          checked ? 'bg-indigo-600' : 'bg-gray-300'
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1'
          )}
        />
      </button>
    </div>
  );
}

function TemplateField({ label, value, onChange, placeholder }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <textarea
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 block w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
      />
    </label>
  );
}

// ── Action queue ────────────────────────────────────────────────────────────────

function ActionQueue() {
  const { data, isLoading } = useAgentActions({ status: 'pending', limit: 50 });
  const approve = useApproveAction();
  const dismiss = useDismissAction();
  const actions = data?.actions || [];

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">
        Action queue
        {actions.length > 0 && (
          <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
            {actions.length}
          </span>
        )}
      </h2>
      {isLoading ? (
        <div className="flex justify-center py-8 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : actions.length === 0 ? (
        <EmptyState
          icon={Check}
          title="Nothing pending"
          description="When the agent proposes an action, it'll show up here for review."
        />
      ) : (
        <ul className="space-y-3">
          {actions.map((a) => (
            <ActionCard
              key={a.id}
              action={a}
              onApprove={() => approve.mutate(a.id)}
              onDismiss={() => dismiss.mutate(a.id)}
              busy={approve.isPending || dismiss.isPending}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

const TINT = {
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  green: 'bg-green-50 text-green-700 border-green-200',
};

function ActionCard({ action, onApprove, onDismiss, busy }) {
  const meta = ACTION_META[action.action_type] || { label: action.action_type, color: 'blue' };
  return (
    <li className="rounded-lg border border-gray-100 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('rounded-full border px-2 py-0.5 text-xs font-semibold', TINT[meta.color])}>
              {meta.label}
            </span>
            <span className="truncate text-sm font-medium text-gray-900">
              {action.company_name || 'Unknown client'}
            </span>
            {typeof action.health_score_at_trigger === 'number' && (
              <span className="text-xs text-gray-400">
                health {action.health_score_at_trigger}
              </span>
            )}
          </div>
          {action.contact_name && (
            <p className="mt-0.5 text-xs text-gray-500">{action.contact_name}</p>
          )}
          {action.trigger_reason && (
            <p className="mt-1 text-xs text-gray-500">{action.trigger_reason}</p>
          )}
          {action.ai_message && (
            <p className="mt-2 whitespace-pre-wrap rounded bg-gray-50 p-2 text-xs text-gray-700">
              {action.ai_message}
            </p>
          )}
          <p className="mt-1 text-[11px] text-gray-400">{timeAgo(action.created_at)}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <button
            type="button"
            onClick={onApprove}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" /> Approve
          </button>
          <button
            type="button"
            onClick={onDismiss}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" /> Dismiss
          </button>
        </div>
      </div>
    </li>
  );
}

// ── Client health overview ──────────────────────────────────────────────────────

function HealthOverview() {
  const { data, isLoading } = useClientHealthOverview();
  const clients = data?.clients || [];

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Client health</h2>
      {isLoading ? (
        <div className="flex justify-center py-8 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : clients.length === 0 ? (
        <EmptyState
          icon={HeartHandshake}
          title="No clients yet"
          description="Companies in the 'client' pipeline stage will appear here, sorted by health."
          action={{ label: 'Add a client', href: '/clients' }}
        />
      ) : (
        <ul className="divide-y divide-gray-100">
          {clients.map((c) => (
            <li key={c.company_id} className="flex items-center justify-between py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">
                  {c.company_name || 'Unnamed client'}
                </p>
                <p className="text-xs capitalize text-gray-400">{c.health_status?.replace('_', ' ')}</p>
              </div>
              <div className="flex items-center gap-3">
                <TrendArrow trend={c.trend} />
                <ScorePill score={c.score} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TrendArrow({ trend }) {
  if (trend === 'up') return <TrendingUp className="h-4 w-4 text-emerald-500" aria-label="trending up" />;
  if (trend === 'down') return <TrendingDown className="h-4 w-4 text-red-500" aria-label="trending down" />;
  return <Minus className="h-4 w-4 text-gray-300" aria-label="flat" />;
}

function ScorePill({ score }) {
  const tone =
    score >= 70 ? 'bg-emerald-100 text-emerald-700'
    : score >= 40 ? 'bg-amber-100 text-amber-700'
    : 'bg-red-100 text-red-700';
  return (
    <span className={cn('inline-flex h-7 w-9 items-center justify-center rounded-md text-sm font-bold', tone)}>
      {score}
    </span>
  );
}
