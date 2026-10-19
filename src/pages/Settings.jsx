import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Settings as SettingsIcon,
  Target,
  Download,
  AlertCircle,
  Flame,
  Bot,
  Zap,
  BarChart3,
  Calendar,
  Activity,
  RotateCcw,
  Save,
  Building2,
  Users,
  Mail,
  Bell,
  Database,
  User,
  Clock,
  AlertOctagon,
  Trash2,
  Shield,
  Sparkles,
  Search,
  Loader2,
  AlertTriangle,
  Key,
} from 'lucide-react';
import GmailConnect from '../components/GmailConnect';
import EmailSignatureEditor from '../components/EmailSignatureEditor';
import SendingKillSwitch from '../components/SendingKillSwitch';
import ResetWarmupControl from '../components/ResetWarmupControl';
import TestDeliverability from '../components/TestDeliverability';
import ApiKeysSettings from '../components/ApiKeysSettings';
import { useAuth } from '../context/AuthContext';
import { isOrgAdmin, isPlatformAdmin } from '../lib/roles';
import { api } from '../api/client';
import { useAutomation } from '../hooks/useAutomation';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';

// localStorage keys
const SCORING_WEIGHTS_KEY = 'landline.scoring_weights';
const NOTIFICATION_PREFS_KEY = 'landline.notification_prefs';
const USER_NAME_KEY = 'landline.user_name';
const TIMEZONE_KEY = 'landline.timezone';
const WORKING_HOURS_KEY = 'landline.working_hours';

const DEFAULT_WEIGHTS = {
  company_size: 25,
  industry_match: 30,
  contact_quality: 25,
  engagement_level: 20,
};

const DEFAULT_NOTIFICATION_PREFS = {
  new_reply: true,
  task_due: true,
  deal_won: true,
  sequence_completed: false,
};

const DEFAULT_WORKING_HOURS = {
  start: '09:00',
  end: '17:00',
  days: ['mon', 'tue', 'wed', 'thu', 'fri'],
};

const WEEKDAYS = [
  { id: 'mon', label: 'Mon' },
  { id: 'tue', label: 'Tue' },
  { id: 'wed', label: 'Wed' },
  { id: 'thu', label: 'Thu' },
  { id: 'fri', label: 'Fri' },
  { id: 'sat', label: 'Sat' },
  { id: 'sun', label: 'Sun' },
];

const FALLBACK_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Australia/Sydney',
  'Pacific/Auckland',
];

function getTimezones() {
  try {
    if (typeof Intl !== 'undefined' && Intl.supportedValuesOf) {
      return Intl.supportedValuesOf('timeZone');
    }
  } catch {
    // fallback
  }
  return FALLBACK_TIMEZONES;
}

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'email', label: 'Email Accounts', icon: Mail },
  { id: 'scoring', label: 'Scoring', icon: Target },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'data', label: 'Data', icon: Download },
  // Org admins only: the backend rejects everyone else, and platform admins
  // have no org of their own to hold keys.
  { id: 'api-keys', label: 'API Keys', icon: Key, orgAdminOnly: true },
  { id: 'system', label: 'System', icon: Activity },
];

/* ---------- sub-components ---------- */

function WeightSlider({ label, value, description, onChange }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span className="text-sm font-semibold text-gray-900">{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-blue-500"
      />
      <p className="text-xs text-gray-500">{description}</p>
    </div>
  );
}

// One automation behaviour, exactly as the server reported it.
//
// `flag` comes from GET /system/automation and is never defaulted here. These
// badges used to be hardcoded literals that claimed to reflect backend state:
// auto-reply was right by coincidence, and follow-ups and scoring both showed
// OFF while running on the beat schedule every 4h and 30m. An operator reads
// this during an incident, so an invented value is worse than no value.
function AutomationStatusRow({ icon: Icon, flag }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-4 py-3">
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 flex-shrink-0 text-gray-500" />
        <div>
          <span className="text-sm font-medium text-gray-700">{flag.label}</span>
          {flag.detail && <p className="text-xs text-gray-400">{flag.detail}</p>}
        </div>
      </div>
      <div className="flex flex-shrink-0 flex-col items-end gap-1">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${flag.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${flag.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
          {flag.enabled ? 'ON' : 'OFF'}
        </span>
        {/* Whether this is even changeable. A scheduled task has no off switch,
            so "contact your administrator" would be wrong advice for it. */}
        <span className="text-[10px] text-gray-400">
          {flag.source === 'schedule' ? 'always on' : 'env setting'}
        </span>
      </div>
    </div>
  );
}

// Icons are cosmetic, so key off the server's vocabulary with a safe fallback
// rather than letting an unknown key crash the row.
const AUTOMATION_ICONS = {
  auto_reply: Zap,
  ai_compose: Sparkles,
  auto_research: Search,
  auto_followups: Bot,
  auto_scoring: BarChart3,
};

function NotificationToggle({ label, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
      <div>
        <span className="text-sm font-medium text-gray-700">{label}</span>
        {description && <p className="text-xs text-gray-400">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
          checked ? 'bg-blue-500' : 'bg-gray-300'
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </button>
    </div>
  );
}

/* ---------- main component ---------- */

export default function Settings() {
  const { user } = useAuth();
  const canManageKeys = !!user && isOrgAdmin(user.role) && !isPlatformAdmin(user.role);
  const visibleTabs = TABS.filter((tab) => !tab.orgAdminOnly || canManageKeys);
  // Deep link from Discovery's "add your Gemini key" banner: /settings#api-keys
  const [activeTab, setActiveTab] = useState(() => {
    const hashTab = window.location.hash.slice(1);
    if (hashTab === 'signatures') return 'email';
    return TABS.some((t) => t.id === hashTab) ? hashTab : 'profile';
  });

  // API health
  const [apiConnected, setApiConnected] = useState(false);
  const [checking, setChecking] = useState(true);
  const [healthData, setHealthData] = useState(null);

  // Live sending status, surfaced by the kill switch on load. Shared so the
  // warm-up card can show the current ramp without a second fetch.
  const [sendingStatus, setSendingStatus] = useState(null);

  // Automation — read from the backend, never assumed. These used to be
  // hardcoded literals that the page then described as backend state.
  const {
    data: automation,
    isLoading: automationLoading,
    error: automationError,
  } = useAutomation();

  // Scoring weights
  const [weights, setWeights] = useState(() => {
    try {
      const saved = localStorage.getItem(SCORING_WEIGHTS_KEY);
      return saved ? JSON.parse(saved) : { ...DEFAULT_WEIGHTS };
    } catch {
      return { ...DEFAULT_WEIGHTS };
    }
  });
  const [weightsDirty, setWeightsDirty] = useState(false);

  // Notification preferences
  const [notifPrefs, setNotifPrefs] = useState(() => {
    try {
      const saved = localStorage.getItem(NOTIFICATION_PREFS_KEY);
      return saved ? { ...DEFAULT_NOTIFICATION_PREFS, ...JSON.parse(saved) } : { ...DEFAULT_NOTIFICATION_PREFS };
    } catch {
      return { ...DEFAULT_NOTIFICATION_PREFS };
    }
  });

  // Profile
  // The display-name override is per user: an unscoped key showed whoever
  // last saved a name in this browser to the next person who logged in.
  const userNameKey = user?.id ? `${USER_NAME_KEY}:${user.id}` : USER_NAME_KEY;
  const [userName, setUserName] = useState(() => {
    try {
      return localStorage.getItem(userNameKey) || user?.name || '';
    } catch {
      return user?.name || '';
    }
  });
  const [userTimezone, setUserTimezone] = useState(() => {
    try {
      return localStorage.getItem(TIMEZONE_KEY) || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
    } catch {
      return 'America/New_York';
    }
  });

  const [workingHours, setWorkingHours] = useState(() => {
    try {
      const saved = localStorage.getItem(WORKING_HOURS_KEY);
      return saved ? { ...DEFAULT_WORKING_HOURS, ...JSON.parse(saved) } : { ...DEFAULT_WORKING_HOURS };
    } catch {
      return { ...DEFAULT_WORKING_HOURS };
    }
  });

  // Danger zone confirmation
  const [resetConfirm, setResetConfirm] = useState(false);

  const timezones = useMemo(() => getTimezones(), []);

  // Check API connection
  useEffect(() => {
    const checkConnection = async () => {
      setChecking(true);
      try {
        const response = await api.get('/health');
        setApiConnected(true);
        setHealthData(response.data);
      } catch {
        setApiConnected(false);
        setHealthData(null);
      }
      setChecking(false);
    };
    checkConnection();
  }, []);

  // Persist notification prefs whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(notifPrefs));
    } catch {
      // localStorage unavailable
    }
  }, [notifPrefs]);

  const handleNotifChange = useCallback((key, value) => {
    setNotifPrefs((prev) => ({ ...prev, [key]: value }));
    toast.success('Notification preference updated');
  }, []);

  const handleProfileSave = useCallback(() => {
    try {
      localStorage.setItem(userNameKey, userName.trim());
      localStorage.setItem(TIMEZONE_KEY, userTimezone);
      localStorage.setItem(WORKING_HOURS_KEY, JSON.stringify(workingHours));
      toast.success('Profile saved');
    } catch {
      toast.error('Could not save profile');
    }
  }, [userNameKey, userName, userTimezone, workingHours]);

  const handleExportCompanies = useCallback(() => {
    const baseURL = import.meta.env.VITE_API_URL
      ? `${import.meta.env.VITE_API_URL}/api/v1`
      : '/api/v1';
    window.open(`${baseURL}/import-export/export/companies/csv`, '_blank');
    toast.success('Companies CSV export started');
  }, []);

  const handleExportContacts = useCallback(() => {
    const baseURL = import.meta.env.VITE_API_URL
      ? `${import.meta.env.VITE_API_URL}/api/v1`
      : '/api/v1';
    window.open(`${baseURL}/import-export/export/contacts/csv`, '_blank');
    toast.success('Contacts CSV export started');
  }, []);

  const handleWeightChange = useCallback((key, value) => {
    setWeights((prev) => ({ ...prev, [key]: value }));
    setWeightsDirty(true);
  }, []);

  const handleWeightsSave = useCallback(() => {
    try {
      localStorage.setItem(SCORING_WEIGHTS_KEY, JSON.stringify(weights));
      setWeightsDirty(false);
      toast.success('Scoring weights saved');
    } catch {
      toast.error('Could not save scoring weights');
    }
  }, [weights]);

  const handleWeightsReset = useCallback(() => {
    setWeights({ ...DEFAULT_WEIGHTS });
    setWeightsDirty(true);
  }, []);

  const handleResetScoring = useCallback(() => {
    try {
      localStorage.removeItem(SCORING_WEIGHTS_KEY);
      setWeights({ ...DEFAULT_WEIGHTS });
      setWeightsDirty(false);
      setResetConfirm(false);
      toast.success('Scoring weights reset to defaults');
    } catch {
      toast.error('Could not reset scoring');
    }
  }, []);

  // Tab visual indicators
  const gmailConnected = useMemo(() => {
    try { return localStorage.getItem('gmail_connected') === 'true'; } catch { return false; }
  }, [activeTab]); // re-check when switching tabs

  const weightsTotal = useMemo(() => {
    return Object.values(weights).reduce((sum, v) => sum + v, 0);
  }, [weights]);

  /* ---------- tab content renderers ---------- */

  const renderEmailTab = () => (
    <div className="space-y-6">
      <GmailConnect />
      <EmailSignatureEditor />
    </div>
  );

  const renderScoringTab = () => (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100">
          <Target className="h-5 w-5 text-yellow-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Scoring Weights</h2>
          <p className="text-sm text-gray-500">Configure how lead scores are calculated</p>
        </div>
      </div>

      <div className="space-y-5">
        <WeightSlider
          label="Company Size"
          value={weights.company_size}
          description="Weight based on number of employees and revenue indicators"
          onChange={(v) => handleWeightChange('company_size', v)}
        />
        <WeightSlider
          label="Industry Match"
          value={weights.industry_match}
          description="How well the company fits your target industry profile"
          onChange={(v) => handleWeightChange('industry_match', v)}
        />
        <WeightSlider
          label="Contact Quality"
          value={weights.contact_quality}
          description="Decision-maker contacts found and engagement quality"
          onChange={(v) => handleWeightChange('contact_quality', v)}
        />
        <WeightSlider
          label="Engagement Level"
          value={weights.engagement_level}
          description="Email opens, replies, website visits, and other signals"
          onChange={(v) => handleWeightChange('engagement_level', v)}
        />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={handleWeightsSave}
          disabled={!weightsDirty}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          Save Weights
        </button>
        <button
          type="button"
          onClick={handleWeightsReset}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          <RotateCcw className="h-4 w-4" />
          Reset to Defaults
        </button>
      </div>

      <div className="mt-4 rounded-lg bg-blue-50 px-4 py-3 text-xs text-blue-600">
        These weights are visual indicators only. Actual scoring is performed by the backend ML model.
      </div>

      {/* Sample Score Preview */}
      <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Score Preview — Sample Company</h3>
        <p className="mb-3 text-xs text-gray-500">
          See how your current weights would score a sample lead in real-time.
        </p>
        <div className="space-y-2 text-xs">
          {[
            { key: 'company_size', label: 'Company Size', raw: 80 },
            { key: 'industry_match', label: 'Industry Match', raw: 90 },
            { key: 'contact_quality', label: 'Contact Quality', raw: 70 },
            { key: 'engagement_level', label: 'Engagement Level', raw: 60 },
          ].map((item) => {
            const w = weights[item.key] || 0;
            const contribution = ((item.raw * w) / 100).toFixed(1);
            return (
              <div key={item.key} className="flex items-center justify-between rounded bg-white px-3 py-2">
                <span className="text-gray-600">{item.label} <span className="text-gray-400">(raw {item.raw})</span></span>
                <span className="font-medium text-gray-900">{contribution} pts <span className="text-gray-400">({w}%)</span></span>
              </div>
            );
          })}
        </div>
        {(() => {
          const sampleScores = { company_size: 80, industry_match: 90, contact_quality: 70, engagement_level: 60 };
          const total = Object.entries(sampleScores).reduce((sum, [k, raw]) => sum + (raw * (weights[k] || 0)) / 100, 0);
          return (
            <div className="mt-3 flex items-center justify-between rounded-lg bg-blue-100 px-4 py-2">
              <span className="text-sm font-semibold text-blue-800">Total Score</span>
              <span className="text-lg font-bold text-blue-700">{total.toFixed(1)}</span>
            </div>
          );
        })()}
        {weightsTotal !== 100 && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
            <AlertCircle className="h-3.5 w-3.5" />
            Weights sum to {weightsTotal}% (expected 100%)
          </div>
        )}
      </div>
    </div>
  );

  const renderNotificationsTab = () => (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
          <Bell className="h-5 w-5 text-orange-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Notification Preferences</h2>
          <p className="text-sm text-gray-500">Choose which events trigger email notifications</p>
        </div>
      </div>

      <div className="space-y-3">
        <NotificationToggle
          label="New reply received"
          description="Get notified when a lead replies to your email"
          checked={notifPrefs.new_reply}
          onChange={(v) => handleNotifChange('new_reply', v)}
        />
        <NotificationToggle
          label="Task due reminder"
          description="Receive a reminder when a task is approaching its due date"
          checked={notifPrefs.task_due}
          onChange={(v) => handleNotifChange('task_due', v)}
        />
        <NotificationToggle
          label="Deal won"
          description="Get notified when a deal moves to the won stage"
          checked={notifPrefs.deal_won}
          onChange={(v) => handleNotifChange('deal_won', v)}
        />
        <NotificationToggle
          label="Sequence completed"
          description="Notification when an email sequence finishes all steps"
          checked={notifPrefs.sequence_completed}
          onChange={(v) => handleNotifChange('sequence_completed', v)}
        />
      </div>
    </div>
  );

  const renderDataTab = () => (
    <div className="space-y-6">
      {/* Data Export */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100">
            <Download className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Data Export</h2>
            <p className="text-sm text-gray-500">Download your data as CSV files</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleExportCompanies}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <Building2 className="h-4 w-4" />
            Export Companies
          </button>
          <button
            type="button"
            onClick={handleExportContacts}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <Users className="h-4 w-4" />
            Export Contacts
          </button>
        </div>
      </div>

      {/* Automation */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
            <Bot className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Automation</h2>
            <p className="text-sm text-gray-500">Autonomous outreach and follow-up features</p>
          </div>
        </div>

        {automationLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Reading automation state…
          </div>
        ) : automationError ? (
          // Say we couldn't check. The old page would have shown confident
          // ON/OFF badges here regardless — that is the bug this replaced.
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="flex items-center gap-1.5 text-sm font-medium text-amber-900">
              <AlertTriangle className="h-4 w-4" />
              Couldn't read automation state
            </p>
            <p className="mt-1 text-xs text-amber-800">
              {automationError?.response?.data?.detail || automationError?.message || 'The system endpoint did not respond.'}
              {' '}Nothing is shown below rather than guessing what's on.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {(automation?.flags || []).map((flag) => (
              <AutomationStatusRow
                key={flag.key}
                icon={AUTOMATION_ICONS[flag.key] || Bot}
                flag={flag}
              />
            ))}

            <div className="rounded-lg bg-gray-50 px-4 py-3">
              <div className="mb-2 flex items-center gap-3">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Scheduling Link</span>
              </div>
              {/* Read-only on purpose. This used to be an editable field with a
                  Save button that wrote to localStorage — which nothing reads.
                  The link that actually reaches a prospect comes from the
                  backend's `scheduling_link` env setting (or a sender's own
                  booking URL), so typing here changed nothing while reporting
                  success. */}
              {automation?.scheduling_link ? (
                <a
                  href={automation.scheduling_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-sm text-blue-600 hover:underline"
                >
                  {automation.scheduling_link}
                </a>
              ) : (
                <p className="text-sm text-gray-400">
                  Not set — auto-replies go out without a booking link unless the sending account
                  has its own.
                </p>
              )}
              <p className="mt-1.5 text-xs text-gray-400">
                Offered in auto-replies and injected as {'{{booking_link}}'}. A sender's own booking
                URL takes precedence over this.
              </p>
            </div>
          </div>
        )}

        <div className="mt-4 rounded-lg bg-blue-50 px-4 py-3 text-xs text-blue-600">
          Read live from the backend. Items marked “env setting” change only by editing the server's
          environment — ask your administrator. Items marked “always on” are scheduled jobs with no
          off switch; the kill switch above stops all sending regardless.
        </div>
      </div>

      {/* Danger Zone */}
      <div className="rounded-xl border-2 border-red-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
            <AlertOctagon className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-red-700">Danger Zone</h2>
            <p className="text-sm text-gray-500">Destructive actions that cannot be easily undone</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50 px-4 py-3">
            <div>
              <span className="text-sm font-medium text-gray-700">Export All Data</span>
              <p className="text-xs text-gray-400">Download all companies, contacts, and activity as a ZIP</p>
            </div>
            <button
              type="button"
              onClick={() => {
                handleExportCompanies();
                handleExportContacts();
                toast.success('All data export started');
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              <Download className="h-4 w-4" />
              Export All
            </button>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50 px-4 py-3">
            <div>
              <span className="text-sm font-medium text-gray-700">Reset Scoring Weights</span>
              <p className="text-xs text-gray-400">Revert all scoring weights back to factory defaults</p>
            </div>
            {resetConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600">Are you sure?</span>
                <button
                  type="button"
                  onClick={handleResetScoring}
                  className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setResetConfirm(false)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setResetConfirm(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                Reset Scoring
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderSystemTab = () => (
    <div className="space-y-6">
      {/* Global sending kill switch — the launch-blocker safety valve. */}
      <SendingKillSwitch onChange={setSendingStatus} />

      {/* Warm-up ramp. Reads its numbers off the kill switch's status rather
          than fetching /system/sending-status a second time. */}
      <ResetWarmupControl status={sendingStatus} />

      {/* Test deliverability — compliant test send + SPF/DKIM/DMARC posture. */}
      <TestDeliverability />

      {/* System Status */}
      {!checking && apiConnected && healthData && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <Database className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">System Status</h2>
              <p className="text-sm text-gray-500">Backend service information</p>
            </div>
          </div>

          <div className="space-y-2">
            {healthData.status && (
              <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
                <span className="text-sm text-gray-700">Status</span>
                <span className="text-sm font-medium text-green-600">{healthData.status}</span>
              </div>
            )}
            {healthData.version && (
              <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
                <span className="text-sm text-gray-700">Version</span>
                <span className="text-sm font-medium text-gray-900">{healthData.version}</span>
              </div>
            )}
            {healthData.environment && (
              <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
                <span className="text-sm text-gray-700">Environment</span>
                <span className="text-sm font-medium text-gray-900">{healthData.environment}</span>
              </div>
            )}
            {healthData.database && (
              <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
                <span className="text-sm text-gray-700">Database</span>
                <span className={`text-sm font-medium ${healthData.database === 'connected' ? 'text-green-600' : 'text-red-600'}`}>
                  {healthData.database}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* About */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
            <Flame className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">About</h2>
            <p className="text-sm text-gray-500">DoAide Prospect v1.0 by DoAide</p>
          </div>
        </div>
        <div className="mt-4 space-y-2 text-sm text-gray-600">
          <p>DoAide Prospect is a B2B lead-to-client platform designed to help sales teams discover, qualify, and engage with potential customers.</p>
          <p className="text-xs text-gray-400">
            Built with React, Tailwind CSS, and FastAPI.
          </p>
        </div>
      </div>
    </div>
  );

  const renderProfileTab = () => {
    const initials = userName.trim()
      ? userName.trim().split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2)
      : '?';
    return (
      <div className="space-y-6">
        {/* Avatar + Name/Email */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
              <User className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Profile</h2>
              <p className="text-sm text-gray-500">Your personal settings</p>
            </div>
          </div>

          {/* Avatar */}
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-xl font-bold text-white shadow-inner">
              {initials}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{userName.trim() || 'Not set'}</p>
              <p className="text-xs text-gray-500">{user?.email || ''}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                readOnly
                value={user?.email || ''}
                className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-600"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Timezone
                </span>
              </label>
              <select
                value={userTimezone}
                onChange={(e) => setUserTimezone(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {timezones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Working Hours */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <Clock className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Working Hours</h2>
              <p className="text-sm text-gray-500">Set your availability for scheduling and notifications</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Start Time</label>
              <input
                type="time"
                value={workingHours.start}
                onChange={(e) => setWorkingHours((prev) => ({ ...prev, start: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">End Time</label>
              <input
                type="time"
                value={workingHours.end}
                onChange={(e) => setWorkingHours((prev) => ({ ...prev, end: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-2 block text-sm font-medium text-gray-700">Working Days</label>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((day) => {
                const active = workingHours.days.includes(day.id);
                return (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() =>
                      setWorkingHours((prev) => ({
                        ...prev,
                        days: active
                          ? prev.days.filter((d) => d !== day.id)
                          : [...prev.days, day.id],
                      }))
                    }
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                      active
                        ? 'bg-blue-500 text-white shadow-sm'
                        : 'border border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                    )}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleProfileSave}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-600"
          >
            <Save className="h-4 w-4" />
            Save Profile
          </button>
        </div>
      </div>
    );
  };

  const tabContent = {
    profile: renderProfileTab,
    email: renderEmailTab,
    scoring: renderScoringTab,
    notifications: renderNotificationsTab,
    data: renderDataTab,
    'api-keys': () => <ApiKeysSettings />,
    system: renderSystemTab,
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Tab Navigation */}
      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const showGreen = tab.id === 'email' && gmailConnected;
          const showWarning = tab.id === 'scoring' && weightsTotal !== 100;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
              {showGreen && (
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-green-500" />
              )}
              {showWarning && (
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-amber-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {tabContent[visibleTabs.some((t) => t.id === activeTab) ? activeTab : 'profile']()}
    </div>
  );
}
