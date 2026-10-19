import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Globe,
  Users,
  Building2,
  MapPin,
  Target,
  RefreshCw,
  Send,
  Eye,
  Mail,
  Clock,
  ArrowRight,
  Plus,
  ExternalLink,
  FileText,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Brain,
  Wand2,
  Copy as CopyIcon,
  Loader2,
  Newspaper,
  Tag,
  CheckCircle2,
  Search,
  Linkedin,
  Phone,
  UserPlus,
  CalendarDays,
  Layers,
  Crosshair,
  X,
  Pencil,
  Check,
  CheckSquare,
  DollarSign,
  Activity,
  Link2,
} from 'lucide-react';
import ScoreBadge from '../components/ScoreBadge';
import StageSelector from '../components/StageSelector';
import ContactList from '../components/ContactList';
import ActivityTimeline from '../components/ActivityTimeline';
import EnrollSequenceMenu from '../components/EnrollSequenceMenu';
import EmptyState from '../components/EmptyState';
import HealthWidget from '../components/HealthWidget';
import DialtoneProvenance from '../components/DialtoneProvenance';
import DealsTab from '../components/DealsTab';
import InteractionsTab from '../components/InteractionsTab';
import TaskFormModal from '../components/TaskFormModal';
import EmailsTab from '../components/EmailsTab';
import { useCompany, useUpdateCompany, useScoreCompany, useCompanyScores } from '../hooks/useCompanies';
import { useCompanyContacts, useCreateContact } from '../hooks/useContacts';
import { useTransitionStage } from '../hooks/usePipeline';
import { useOutreachEvents } from '../hooks/useOutreach';
import { useEnrichCompany } from '../hooks/useDiscovery';
import { useAnalyzeCompany, useGenerateEmail } from '../hooks/useAI';
import { useNews, useCheckCompanyNews, useMarkActioned } from '../hooks/useNews';
import { useEmailSends } from '../hooks/useEmailSends';
import { useCompanyHealth } from '../hooks/useHealth';
import { useCreateTask } from '../hooks/useTasks';
import {
  useDiscoverExecutives,
  useLinkedinDraft,
  usePhoneScript,
  useReferralDraft,
  useEventOutreach,
  useMultiTouchPlan,
} from '../hooks/useTactics';
import toast from 'react-hot-toast';
import { STAGE_LABELS, STAGE_COLORS, SOURCE_LABELS } from '../lib/constants';
import { formatDate, formatNumber, getInitials, getScoreColor, getScoreLabel, cn } from '../lib/utils';

// Map a LeadScore record's sub-scores into displayable factor rows.
function scoreToFactors(score) {
  if (!score) return [];
  const rows = [
    { label: 'Industry Match', value: score.industry_score, description: 'Target industry alignment' },
    { label: 'Company Size', value: score.size_score, description: 'Based on employee count' },
    { label: 'Location Fit', value: score.location_score, description: 'Within target geography' },
    { label: 'Engagement', value: score.engagement_score, description: 'Outreach activity signals' },
  ];
  return rows.filter((r) => r.value != null);
}

const eventIcons = {
  email_sent: Send,
  email_opened: Eye,
  email_replied: Mail,
  stage_changed: ArrowRight,
  lead_scored: Target,
  contact_added: Plus,
};

const eventColors = {
  email_sent: 'text-purple-500 bg-purple-50',
  email_opened: 'text-indigo-500 bg-indigo-50',
  email_replied: 'text-green-500 bg-green-50',
  stage_changed: 'text-blue-500 bg-blue-50',
  lead_scored: 'text-yellow-500 bg-yellow-50',
  contact_added: 'text-teal-500 bg-teal-50',
};

function TabButton({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-shrink-0 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
        active
          ? 'border-blue-500 text-blue-600'
          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
      )}
    >
      {label}
    </button>
  );
}

function AddContactForm({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    title: '',
    phone: '',
    linkedin_url: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) return;
    onAdd(form);
    setForm({ first_name: '', last_name: '', email: '', title: '', phone: '', linkedin_url: '' });
    setOpen(false);
  };

  return (
    <div className="border-t border-gray-200">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        <span className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Contact
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <form onSubmit={handleSubmit} className="space-y-3 px-4 pb-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input type="text" required placeholder="First name *" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            <input type="text" required placeholder="Last name *" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            <input type="text" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            <input type="tel" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            <input type="url" placeholder="LinkedIn URL" value={form.linkedin_url} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-600">Add</button>
          </div>
        </form>
      )}
    </div>
  );
}

const TAG_COLOR_PALETTE = [
  'bg-blue-100 text-blue-700',
  'bg-green-100 text-green-700',
  'bg-purple-100 text-purple-700',
  'bg-pink-100 text-pink-700',
  'bg-amber-100 text-amber-700',
  'bg-cyan-100 text-cyan-700',
  'bg-rose-100 text-rose-700',
  'bg-indigo-100 text-indigo-700',
];

function getTagColor(tag) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLOR_PALETTE[Math.abs(hash) % TAG_COLOR_PALETTE.length];
}

// Editable Source / Tags / Notes card. Tags save immediately on add/remove;
// notes save explicitly so a half-typed note isn't persisted.
function CompanyInfoEditor({ company, onSave, saving }) {
  const [tags, setTags] = useState(company.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [notes, setNotes] = useState(company.notes || '');
  const [editingNotes, setEditingNotes] = useState(false);

  useEffect(() => { setTags(company.tags || []); }, [company.tags]);
  useEffect(() => { if (!editingNotes) setNotes(company.notes || ''); }, [company.notes, editingNotes]);

  const commitTags = (next) => {
    setTags(next);
    onSave({ tags: next });
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (!t || tags.includes(t)) { setTagInput(''); return; }
    commitTags([...tags, t]);
    setTagInput('');
  };

  const removeTag = (t) => commitTags(tags.filter((x) => x !== t));

  const saveNotes = () => {
    onSave({ notes });
    setEditingNotes(false);
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Source */}
        <div>
          <p className="text-sm text-gray-500">Source</p>
          <p className="mt-1 font-medium text-gray-900">{SOURCE_LABELS[company.source] || company.source || '—'}</p>
        </div>

        {/* Tags — editable */}
        <div className="sm:col-span-2">
          <p className="text-sm text-gray-500">Tags</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {tags.map((tag) => (
              <span key={tag} className={cn('inline-flex items-center gap-1 rounded-full py-0.5 pl-2 pr-1 text-xs font-medium', getTagColor(tag))}>
                <Tag className="h-3 w-3" />
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="rounded-full p-0.5 opacity-60 hover:opacity-100"
                  aria-label={`Remove tag ${tag}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {showTagInput ? (
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } if (e.key === 'Escape') { setShowTagInput(false); setTagInput(''); } }}
                onBlur={() => { addTag(); setShowTagInput(false); }}
                placeholder="Tag name…"
                autoFocus
                className="min-w-[7rem] max-w-[10rem] rounded-full border border-gray-300 px-2.5 py-0.5 text-xs text-gray-700 focus:border-blue-400 focus:outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => setShowTagInput(true)}
                className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-500 hover:border-gray-400 hover:text-gray-700"
              >
                <Plus className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Notes — editable */}
      <div className="mt-4 border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">Notes</p>
          {!editingNotes && (
            <button
              type="button"
              onClick={() => setEditingNotes(true)}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              <Pencil className="h-3 w-3" />
              {company.notes ? 'Edit' : 'Add notes'}
            </button>
          )}
        </div>
        {editingNotes ? (
          <div className="mt-2 space-y-2">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              autoFocus
              placeholder="Add context, relationship history, next steps…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setNotes(company.notes || ''); setEditingNotes(false); }}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveNotes}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-600 disabled:opacity-50"
              >
                <Check className="h-3 w-3" />
                Save
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-1 whitespace-pre-wrap text-sm text-gray-900">{company.notes || 'No notes yet.'}</p>
        )}
      </div>

      {/* Sits under Source because it is the long answer to it: "google_places"
          says where the row came from, this says why the agent kept it. Renders
          nothing for a company Dialtone never touched. */}
      <DialtoneProvenance companyId={company.id} />
    </div>
  );
}

export default function CompanyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');

  const { data: company, isLoading, isError } = useCompany(id);
  const { data: health } = useCompanyHealth(id);
  const createTask = useCreateTask();
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const updateCompany = useUpdateCompany();
  const scoreCompany = useScoreCompany();
  const transitionStage = useTransitionStage();
  const { data: outreachEvents } = useOutreachEvents(id);
  const { data: companyContacts = [] } = useCompanyContacts(id);
  const { data: companyScores = [] } = useCompanyScores(id);
  const createContact = useCreateContact();
  const enrichCompany = useEnrichCompany();
  const checkCompanyNews = useCheckCompanyNews();
  // The /news endpoint doesn't filter by company server-side, so fetch a wide
  // window and scope to this company below.
  const { data: companyNewsData } = useNews({ limit: 200 });
  const { data: emailSends = [] } = useEmailSends();
  const markActioned = useMarkActioned();
  const analyzeCompany = useAnalyzeCompany();
  const generateEmail = useGenerateEmail();
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiEmail, setAiEmail] = useState(null);

  // Tactics hooks
  const discoverExecutives = useDiscoverExecutives();
  const linkedinDraft = useLinkedinDraft();
  const phoneScript = usePhoneScript();
  const referralDraft = useReferralDraft();
  const eventOutreach = useEventOutreach();
  const multiTouchPlan = useMultiTouchPlan();
  const [tacticsResults, setTacticsResults] = useState({});
  const [linkedinForm, setLinkedinForm] = useState({ contact_name: '', contact_title: '', topic: '' });
  const [phoneForm, setPhoneForm] = useState({ contact_name: '', contact_title: '', product: '' });
  const [referralForm, setReferralForm] = useState({ referrer_name: '', target_name: '', target_title: '' });
  const [eventForm, setEventForm] = useState({ event_name: '', contact_name: '', event_type: 'conference' });

  const latestScore = companyScores[0] || null;
  const realFactors = scoreToFactors(latestScore);

  // News for this company (the /news endpoint isn't scoped server-side).
  const companyNews = (() => {
    const all = companyNewsData?.items || companyNewsData || [];
    return (Array.isArray(all) ? all : []).filter((a) => String(a.company_id) === String(id));
  })();

  const handleStageChange = (newStage) => {
    transitionStage.mutate({ id: company.id, stage: newStage });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (isError || !company) {
    return (
      <EmptyState
        title="Company not found"
        description="The company you are looking for does not exist or could not be loaded."
        icon={Building2}
        action={{ label: 'Back to Companies', onClick: () => navigate('/companies') }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mt-1 rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
            {company.domain && (
              <a
                href={`https://${company.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
              >
                {company.domain}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <StageSelector value={company.stage} onChange={handleStageChange} />
            {company.score != null ? (
              <ScoreBadge score={company.score} size="lg" />
            ) : (
              <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-500">
                Not scored
              </span>
            )}
            {/* Relationship Strength Meter */}
            {(() => {
              const now = new Date();
              const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
              const recentEvents = (outreachEvents || []).filter(e => new Date(e.created_at) > thirtyDaysAgo);
              const hasRecentInteractions = recentEvents.length > 0;
              const hasEmailOpens = (emailSends || []).some(e => String(e.company_id) === String(id) && e.status === 'opened');
              const hasDeal = (company.deal_value || 0) > 0;
              const hasMultipleContacts = companyContacts.length > 1;
              const hasRecentStageProgression = company.stage_changed_at && new Date(company.stage_changed_at) > thirtyDaysAgo;
              const strength = [hasRecentInteractions, hasEmailOpens, hasDeal, hasMultipleContacts, hasRecentStageProgression].filter(Boolean).length;
              const barColor = strength >= 4 ? 'bg-green-500' : strength >= 2 ? 'bg-yellow-500' : 'bg-red-500';
              return (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500">Relationship</span>
                  <div className="flex items-end gap-0.5">
                    {[1, 2, 3, 4, 5].map(level => (
                      <div
                        key={level}
                        className={cn(
                          'w-1.5 rounded-sm',
                          level <= strength ? barColor : 'bg-gray-200'
                        )}
                        style={{ height: `${8 + level * 3}px` }}
                      />
                    ))}
                  </div>
                </div>
              );
            })()}
            <button
              type="button"
              onClick={() => enrichCompany.mutate({ id: company.id, data: { find_contacts: true } })}
              disabled={enrichCompany.isPending}
              className="inline-flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-sm font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50"
            >
              <Sparkles className={cn('h-4 w-4', enrichCompany.isPending && 'animate-pulse')} />
              {enrichCompany.isPending ? 'Enriching...' : 'Enrich with Apollo'}
            </button>
            <button
              type="button"
              onClick={() => checkCompanyNews.mutate(company.id)}
              disabled={checkCompanyNews.isPending}
              className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            >
              <Newspaper className={cn('h-4 w-4', checkCompanyNews.isPending && 'animate-pulse')} />
              {checkCompanyNews.isPending ? 'Checking...' : 'Check News'}
            </button>
            <button
              type="button"
              onClick={() => setTaskModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <CheckSquare className="h-4 w-4" />
              Add Task
            </button>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href).then(() => {
                  toast.success('Company link copied to clipboard');
                }).catch(() => {
                  toast.error('Failed to copy link');
                });
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Link2 className="h-4 w-4" />
              Copy Link
            </button>
          </div>
        </div>
      </div>

      {/* Quick Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <div className="flex items-center gap-1.5">
            <DollarSign className="h-4 w-4 text-green-600" />
            <span className="text-xs text-green-700">Deal Value</span>
          </div>
          <p className="mt-1 text-lg font-bold text-green-900">
            {company.deal_value ? `$${formatNumber(company.deal_value)}` : '--'}
          </p>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <div className="flex items-center gap-1.5">
            <Users className="h-4 w-4 text-blue-600" />
            <span className="text-xs text-blue-700">Contacts</span>
          </div>
          <p className="mt-1 text-lg font-bold text-blue-900">{companyContacts.length}</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-amber-600" />
            <span className="text-xs text-amber-700">Last Activity</span>
          </div>
          <p className="mt-1 text-sm font-bold text-amber-900">
            {(() => {
              const events = outreachEvents || [];
              const dates = events.map(e => new Date(e.created_at)).filter(d => !isNaN(d));
              if (company.updated_at) dates.push(new Date(company.updated_at));
              if (dates.length === 0) return '--';
              const latest = new Date(Math.max(...dates));
              return formatDate(latest.toISOString());
            })()}
          </p>
        </div>
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
          <div className="flex items-center gap-1.5">
            <Eye className="h-4 w-4 text-purple-600" />
            <span className="text-xs text-purple-700">Email Open Rate</span>
          </div>
          <p className="mt-1 text-lg font-bold text-purple-900">
            {(() => {
              const sends = (emailSends || []).filter(e => String(e.company_id) === String(id));
              if (sends.length === 0) return '--';
              const opened = sends.filter(e => e.status === 'opened').length;
              return `${Math.round((opened / sends.length) * 100)}%`;
            })()}
          </p>
        </div>
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
          <div className="flex items-center gap-1.5">
            <Activity className="h-4 w-4 text-orange-600" />
            <span className="text-xs text-orange-700">Days in Stage</span>
          </div>
          <p className="mt-1 text-lg font-bold text-orange-900">
            {(() => {
              const ref = company.stage_changed_at || company.updated_at;
              if (!ref) return '--';
              const days = Math.floor((new Date() - new Date(ref)) / (1000 * 60 * 60 * 24));
              return days;
            })()}
          </p>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <MapPin className="h-4 w-4" />
            Location
          </div>
          <p className="mt-1 font-medium text-gray-900">
            {[company.city, company.state, company.country].filter(Boolean).join(', ') || 'Not specified'}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Users className="h-4 w-4" />
            Employees
          </div>
          <p className="mt-1 font-medium text-gray-900">
            {company.employees ? formatNumber(company.employees) : 'Not specified'}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Building2 className="h-4 w-4" />
            Industry
          </div>
          <p className="mt-1 font-medium text-gray-900">
            {company.industry || 'Not specified'}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <FileText className="h-4 w-4" />
            NAICS Code
          </div>
          <p className="mt-1 font-medium text-gray-900">
            {company.naics_code || 'Not specified'}
          </p>
        </div>
      </div>

      {/* Extra Info: Source, Tags, Notes — editable */}
      <CompanyInfoEditor
        company={company}
        saving={updateCompany.isPending}
        onSave={(data) => updateCompany.mutate({ id: company.id, data })}
      />

      {/* Client health — gauge, history sparkline, key relationship metrics */}
      <HealthWidget health={health} />

      {/* Tabs */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex overflow-x-auto border-b border-gray-200 px-2">
          <TabButton label="Overview" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
          <TabButton label="Contacts" active={activeTab === 'contacts'} onClick={() => setActiveTab('contacts')} />
          <TabButton label="Deals" active={activeTab === 'deals'} onClick={() => setActiveTab('deals')} />
          <TabButton label="Interactions" active={activeTab === 'interactions'} onClick={() => setActiveTab('interactions')} />
          <TabButton label="Emails" active={activeTab === 'emails'} onClick={() => setActiveTab('emails')} />
          <TabButton label="Score" active={activeTab === 'score'} onClick={() => setActiveTab('score')} />
          <TabButton label="Outreach" active={activeTab === 'outreach'} onClick={() => setActiveTab('outreach')} />
          <TabButton label="Activity" active={activeTab === 'activity'} onClick={() => setActiveTab('activity')} />
          <TabButton label="News" active={activeTab === 'news'} onClick={() => setActiveTab('news')} />
          <TabButton label="AI" active={activeTab === 'ai'} onClick={() => setActiveTab('ai')} />
          <TabButton label="Tactics" active={activeTab === 'tactics'} onClick={() => setActiveTab('tactics')} />
        </div>

        <div className="p-4">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{companyContacts.length}</p>
                  <p className="text-xs text-gray-500">Contacts</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{company.score ?? '—'}</p>
                  <p className="text-xs text-gray-500">Lead Score</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{company.domain ? 'Yes' : 'No'}</p>
                  <p className="text-xs text-gray-500">Enriched</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{company.stage ? STAGE_LABELS[company.stage] : '—'}</p>
                  <p className="text-xs text-gray-500">Stage</p>
                </div>
              </div>

              {/* Recent Contacts Preview */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">Recent Contacts</h3>
                  <button onClick={() => setActiveTab('contacts')} className="text-xs text-blue-600 hover:text-blue-700">View all</button>
                </div>
                {companyContacts.slice(0, 3).map(contact => {
                  // An enriched contact is often just an address — falling back
                  // to it keeps the row from rendering as a blank line.
                  const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ');
                  return (
                    <div key={contact.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                      <div className="h-8 w-8 flex-shrink-0 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-600">
                        {getInitials(contact.first_name, contact.last_name)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">{name || contact.email || 'Unnamed contact'}</p>
                        <p className="truncate text-xs text-gray-500">
                          {[contact.title, name ? contact.email : null].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {companyContacts.length === 0 && (
                  <p className="text-sm text-gray-400">No contacts yet</p>
                )}
              </div>

              {/* Quick Navigation */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => scoreCompany.mutate(company.id)}
                    disabled={scoreCompany.isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-1.5 text-xs font-medium text-yellow-700 hover:bg-yellow-100 disabled:opacity-50"
                  >
                    <Target className="h-3.5 w-3.5" />
                    {company.score != null ? 'Re-score' : 'Score'}
                  </button>
                  <button
                    type="button"
                    onClick={() => enrichCompany.mutate({ id: company.id, data: { find_contacts: true } })}
                    disabled={enrichCompany.isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Enrich
                  </button>
                  <button
                    type="button"
                    onClick={() => checkCompanyNews.mutate(company.id)}
                    disabled={checkCompanyNews.isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                  >
                    <Newspaper className="h-3.5 w-3.5" />
                    Check News
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Contacts Tab */}
          {activeTab === 'contacts' && (
            <div>
              <ContactList
                contacts={companyContacts}
                companyId={id}
              />
              <AddContactForm
                onAdd={(data) => {
                  createContact.mutate({ company_id: company.id, ...data });
                }}
              />
            </div>
          )}

          {/* Deals Tab */}
          {activeTab === 'deals' && <DealsTab companyId={id} />}

          {/* Interactions Tab */}
          {activeTab === 'interactions' && <InteractionsTab companyId={id} />}

          {/* Emails Tab */}
          {activeTab === 'emails' && <EmailsTab companyId={id} />}

          {/* Score Tab */}
          {activeTab === 'score' && (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-5xl font-bold text-gray-900">{company.score ?? '—'}</div>
                    {company.score != null && (
                      <div className={cn('mt-1 text-sm font-semibold', getScoreColor(company.score).split(' ')[0])}>
                        {getScoreLabel(company.score)}
                      </div>
                    )}
                  </div>
                  <div className="h-16 w-px bg-gray-200" />
                  <div className="flex-1">
                    <div className="mb-1 text-sm text-gray-500">Score Range</div>
                    <div className="relative h-4 w-full max-w-xs rounded-full bg-gray-200 sm:w-64">
                      <div
                        className="absolute left-0 top-0 h-4 rounded-full bg-gradient-to-r from-red-400 via-yellow-400 to-green-400"
                        style={{ width: '100%' }}
                      />
                      {company.score != null && (
                        <div
                          className="absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-gray-900 shadow-md"
                          style={{ left: `${company.score}%` }}
                        />
                      )}
                    </div>
                    <div className="mt-1 flex justify-between text-xs text-gray-400">
                      <span>0</span>
                      <span>50</span>
                      <span>100</span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => scoreCompany.mutate(company.id)}
                  disabled={scoreCompany.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-yellow-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-yellow-600 disabled:opacity-50"
                >
                  <RefreshCw className={cn('h-4 w-4', scoreCompany.isPending && 'animate-spin')} />
                  {company.score != null ? 'Re-score' : 'Score now'}
                </button>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold text-gray-900">Scoring Factors</h3>
                {realFactors.length > 0 ? (
                  <div className="space-y-2">
                    {realFactors.map((factor) => (
                      <div key={factor.label} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-2.5">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{factor.label}</p>
                          <p className="text-xs text-gray-500">{factor.description}</p>
                        </div>
                        <span className="text-sm font-semibold text-green-600">+{factor.value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                    This company hasn't been scored yet. Run scoring to see the breakdown.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Outreach Tab */}
          {activeTab === 'outreach' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Outreach Timeline</h3>
                <EnrollSequenceMenu companyId={id} contacts={companyContacts} />
              </div>

              {outreachEvents && outreachEvents.length > 0 ? (
                <div className="relative ml-4 border-l-2 border-gray-200 pl-6">
                  {outreachEvents.map((event) => {
                    const IconComp = eventIcons[event.type] || Clock;
                    const colorClass = eventColors[event.type] || 'text-gray-500 bg-gray-50';
                    return (
                      <div key={event.id} className="relative mb-4 pb-4">
                        <div className={`absolute -left-[33px] flex h-6 w-6 items-center justify-center rounded-full ${colorClass}`}>
                          <IconComp className="h-3 w-3" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {event.type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                          </p>
                          {event.subject && (
                            <p className="mt-0.5 text-sm text-gray-600">{event.subject}</p>
                          )}
                          <p className="mt-0.5 text-xs text-gray-400">{formatDate(event.created_at)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  icon={Send}
                  title="No outreach events"
                  description="Enroll this company in a sequence to start outreach."
                />
              )}
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === 'activity' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">Activity Timeline</h3>
              <ActivityTimeline
                company={company}
                contacts={companyContacts}
                scores={companyScores}
                news={companyNews}
                sends={emailSends}
                outreachEvents={outreachEvents}
              />
            </div>
          )}

          {/* News Tab */}
          {activeTab === 'news' && (() => {
            const newsArticles = companyNews;
            const categoryColors = {
              funding: 'bg-green-100 text-green-700',
              expansion: 'bg-blue-100 text-blue-700',
              leadership_change: 'bg-purple-100 text-purple-700',
              acquisition: 'bg-orange-100 text-orange-700',
              product_launch: 'bg-teal-100 text-teal-700',
              partnership: 'bg-indigo-100 text-indigo-700',
              award: 'bg-yellow-100 text-yellow-700',
              hiring: 'bg-cyan-100 text-cyan-700',
              general: 'bg-gray-100 text-gray-700',
            };
            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">Company News</h3>
                  <button
                    type="button"
                    onClick={() => checkCompanyNews.mutate(company.id)}
                    disabled={checkCompanyNews.isPending}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-600 disabled:opacity-50"
                  >
                    <RefreshCw className={cn('h-4 w-4', checkCompanyNews.isPending && 'animate-spin')} />
                    {checkCompanyNews.isPending ? 'Checking...' : 'Check for News'}
                  </button>
                </div>
                {newsArticles.length > 0 ? (
                  <div className="space-y-3">
                    {newsArticles.map((article) => {
                      const cat = article.category || 'general';
                      return (
                        <div
                          key={article.id}
                          className={cn(
                            'rounded-lg border border-gray-200 bg-white p-4',
                            article.actioned && 'opacity-50'
                          )}
                        >
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', categoryColors[cat] || categoryColors.general)}>
                              <Tag className="h-3 w-3" />
                              {cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </span>
                            {article.relevance_score != null && (
                              <span className="text-xs text-gray-400">Relevance: {article.relevance_score}/10</span>
                            )}
                            {article.actioned && (
                              <span className="inline-flex items-center gap-1 text-xs text-green-600">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Done
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-semibold text-gray-900">
                            {article.url ? (
                              <a href={article.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 inline-flex items-center gap-1">
                                {article.title}
                                <ExternalLink className="h-3 w-3 text-gray-400" />
                              </a>
                            ) : article.title}
                          </h4>
                          {article.summary && (
                            <p className="mt-1 text-sm text-gray-600">{article.summary}</p>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                            {article.source && <span>{article.source}</span>}
                            {article.published_at && <span>{formatDate(article.published_at)}</span>}
                          </div>
                          {article.actionable && !article.actioned && article.suggested_action && (
                            <div className="mt-2 flex items-center justify-between rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
                              <div className="flex items-center gap-2">
                                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                                <span className="text-xs text-amber-700">{article.suggested_action}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => markActioned.mutate(article.id)}
                                className="inline-flex items-center gap-1 rounded-md bg-green-500 px-2 py-1 text-xs font-medium text-white hover:bg-green-600"
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                Done
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    icon={Newspaper}
                    title="No news yet"
                    description="Click 'Check for News' to scan for recent articles about this company."
                  />
                )}
              </div>
            );
          })()}

          {/* AI Tab */}
          {activeTab === 'ai' && (
            <div className="space-y-6">
              {/* Action buttons */}
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    analyzeCompany.mutate(company.id, {
                      onSuccess: (data) => setAiAnalysis(data),
                    });
                  }}
                  disabled={analyzeCompany.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-purple-700 disabled:opacity-50"
                >
                  {analyzeCompany.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Brain className="h-4 w-4" />
                  )}
                  {analyzeCompany.isPending ? 'Analyzing...' : 'Analyze with AI'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    generateEmail.mutate(
                      {
                        company_id: company.id,
                        company_name: company.name,
                        industry: company.industry,
                        domain: company.domain,
                      },
                      { onSuccess: (data) => setAiEmail(data) }
                    );
                  }}
                  disabled={generateEmail.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  {generateEmail.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4" />
                  )}
                  {generateEmail.isPending ? 'Generating...' : 'Generate Email'}
                </button>
              </div>

              {/* AI Analysis Results */}
              {aiAnalysis && (
                <div className="space-y-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <Brain className="h-4 w-4 text-purple-500" />
                    AI Analysis
                  </h3>

                  {/* Fit Score */}
                  {aiAnalysis.fit_score != null && (
                    <div className="flex items-center gap-4 rounded-lg border border-purple-200 bg-purple-50 p-4">
                      <div className="text-3xl font-bold text-purple-700">{aiAnalysis.fit_score}</div>
                      <div>
                        <p className="text-sm font-medium text-purple-900">Fit Score</p>
                        {aiAnalysis.fit_reasoning && (
                          <p className="mt-0.5 text-sm text-purple-700">{aiAnalysis.fit_reasoning}</p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {/* Recommended Approach */}
                    {aiAnalysis.recommended_approach && (
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">Recommended Approach</p>
                        <p className="text-sm text-gray-800">{aiAnalysis.recommended_approach}</p>
                      </div>
                    )}

                    {/* Messaging Angle */}
                    {aiAnalysis.messaging_angle && (
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">Messaging Angle</p>
                        <p className="text-sm text-gray-800">{aiAnalysis.messaging_angle}</p>
                      </div>
                    )}

                    {/* Pain Points */}
                    {aiAnalysis.likely_pain_points && aiAnalysis.likely_pain_points.length > 0 && (
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Likely Pain Points</p>
                        <ul className="space-y-1">
                          {aiAnalysis.likely_pain_points.map((point, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-gray-800">
                              <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-purple-400" />
                              {point}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Target Roles */}
                    {aiAnalysis.target_roles && aiAnalysis.target_roles.length > 0 && (
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Target Roles</p>
                        <div className="flex flex-wrap gap-1.5">
                          {aiAnalysis.target_roles.map((role, i) => (
                            <span key={i} className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                              {role}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Subject Line */}
                  {aiAnalysis.suggested_subject_line && (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">Suggested Subject Line</p>
                      <p className="text-sm font-medium text-gray-900">{aiAnalysis.suggested_subject_line}</p>
                    </div>
                  )}

                  {/* Red Flags */}
                  {aiAnalysis.red_flags && aiAnalysis.red_flags.length > 0 && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-red-600">Red Flags</p>
                      <ul className="space-y-1">
                        {aiAnalysis.red_flags.map((flag, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400" />
                            {flag}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Generated Email */}
              {aiEmail && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                      <Wand2 className="h-4 w-4 text-blue-500" />
                      Generated Email
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        const text = `Subject: ${aiEmail.subject || ''}\n\n${aiEmail.body || aiEmail.content || ''}`;
                        navigator.clipboard.writeText(text);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <CopyIcon className="h-3.5 w-3.5" />
                      Copy
                    </button>
                  </div>
                  {aiEmail.subject && (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2">
                      <span className="text-xs font-medium text-gray-500">Subject: </span>
                      <span className="text-sm text-gray-900">{aiEmail.subject}</span>
                    </div>
                  )}
                  <div className="whitespace-pre-wrap rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-800">
                    {aiEmail.body || aiEmail.content || ''}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {!aiAnalysis && !aiEmail && !analyzeCompany.isPending && !generateEmail.isPending && (
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center">
                  <Brain className="mx-auto h-8 w-8 text-gray-300" />
                  <p className="mt-2 text-sm text-gray-500">
                    Use AI to analyze this company's fit and generate personalized outreach.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Tactics Tab */}
          {activeTab === 'tactics' && (
            <div className="space-y-6">

              {/* Action Buttons Row */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => {
                    discoverExecutives.mutate(company.id, {
                      onSuccess: (data) => setTacticsResults((prev) => ({ ...prev, executives: data })),
                    });
                  }}
                  disabled={discoverExecutives.isPending}
                  className="flex flex-col items-center gap-2 rounded-lg border border-gray-200 bg-white p-4 text-center shadow-sm transition hover:border-blue-300 hover:shadow-md disabled:opacity-50"
                >
                  {discoverExecutives.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                  ) : (
                    <Search className="h-5 w-5 text-blue-500" />
                  )}
                  <span className="text-xs font-medium text-gray-700">
                    {discoverExecutives.isPending ? 'Searching...' : 'Discover Executives'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    multiTouchPlan.mutate(company.id, {
                      onSuccess: (data) => setTacticsResults((prev) => ({ ...prev, multiTouch: data })),
                    });
                  }}
                  disabled={multiTouchPlan.isPending}
                  className="flex flex-col items-center gap-2 rounded-lg border border-gray-200 bg-white p-4 text-center shadow-sm transition hover:border-purple-300 hover:shadow-md disabled:opacity-50"
                >
                  {multiTouchPlan.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
                  ) : (
                    <Layers className="h-5 w-5 text-purple-500" />
                  )}
                  <span className="text-xs font-medium text-gray-700">
                    {multiTouchPlan.isPending ? 'Planning...' : 'Multi-Touch Plan'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setTacticsResults((prev) => ({ ...prev, showLinkedin: !prev.showLinkedin }))}
                  className="flex flex-col items-center gap-2 rounded-lg border border-gray-200 bg-white p-4 text-center shadow-sm transition hover:border-sky-300 hover:shadow-md"
                >
                  <Linkedin className="h-5 w-5 text-sky-600" />
                  <span className="text-xs font-medium text-gray-700">LinkedIn Draft</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTacticsResults((prev) => ({ ...prev, showPhone: !prev.showPhone }))}
                  className="flex flex-col items-center gap-2 rounded-lg border border-gray-200 bg-white p-4 text-center shadow-sm transition hover:border-green-300 hover:shadow-md"
                >
                  <Phone className="h-5 w-5 text-green-500" />
                  <span className="text-xs font-medium text-gray-700">Phone Script</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTacticsResults((prev) => ({ ...prev, showReferral: !prev.showReferral }))}
                  className="flex flex-col items-center gap-2 rounded-lg border border-gray-200 bg-white p-4 text-center shadow-sm transition hover:border-amber-300 hover:shadow-md"
                >
                  <UserPlus className="h-5 w-5 text-amber-500" />
                  <span className="text-xs font-medium text-gray-700">Referral Draft</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTacticsResults((prev) => ({ ...prev, showEvent: !prev.showEvent }))}
                  className="flex flex-col items-center gap-2 rounded-lg border border-gray-200 bg-white p-4 text-center shadow-sm transition hover:border-rose-300 hover:shadow-md"
                >
                  <CalendarDays className="h-5 w-5 text-rose-500" />
                  <span className="text-xs font-medium text-gray-700">Event Outreach</span>
                </button>
              </div>

              {/* Discover Executives Results */}
              {tacticsResults.executives && (
                <div className="space-y-3">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <Search className="h-4 w-4 text-blue-500" />
                    Discovered Executives
                  </h3>
                  {(tacticsResults.executives.executives || tacticsResults.executives.contacts_created_list || []).length > 0 ? (
                    <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                      {(tacticsResults.executives.executives || tacticsResults.executives.contacts_created_list || []).map((exec, i) => (
                        <div key={i} className="flex items-center justify-between px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {exec.first_name} {exec.last_name}
                            </p>
                            <p className="text-xs text-gray-500">{exec.title || exec.role}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {exec.email && (
                              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                                {exec.email}
                              </span>
                            )}
                            {exec.linkedin_url && (
                              <a href={exec.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-sky-500 hover:text-sky-700">
                                <Linkedin className="h-4 w-4" />
                              </a>
                            )}
                            <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                              {exec.seniority || 'Executive'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center">
                      <p className="text-sm text-gray-500">
                        {tacticsResults.executives.message || 'No executives found from public sources.'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* LinkedIn Draft Form */}
              {tacticsResults.showLinkedin && (
                <div className="space-y-3 rounded-lg border border-sky-200 bg-sky-50/50 p-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <Linkedin className="h-4 w-4 text-sky-600" />
                    Generate LinkedIn Message
                  </h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <input
                      type="text"
                      placeholder="Contact name"
                      value={linkedinForm.contact_name}
                      onChange={(e) => setLinkedinForm((f) => ({ ...f, contact_name: e.target.value }))}
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                    <input
                      type="text"
                      placeholder="Their title (e.g. CTO)"
                      value={linkedinForm.contact_title}
                      onChange={(e) => setLinkedinForm((f) => ({ ...f, contact_title: e.target.value }))}
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                    <input
                      type="text"
                      placeholder="Topic / angle (optional)"
                      value={linkedinForm.topic}
                      onChange={(e) => setLinkedinForm((f) => ({ ...f, topic: e.target.value }))}
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      linkedinDraft.mutate(
                        {
                          company_name: company.name,
                          company_industry: company.industry,
                          company_domain: company.domain,
                          ...linkedinForm,
                        },
                        { onSuccess: (data) => setTacticsResults((prev) => ({ ...prev, linkedin: data })) }
                      );
                    }}
                    disabled={linkedinDraft.isPending || !linkedinForm.contact_name}
                    className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-700 disabled:opacity-50"
                  >
                    {linkedinDraft.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                    {linkedinDraft.isPending ? 'Generating...' : 'Generate'}
                  </button>

                  {tacticsResults.linkedin && (
                    <div className="space-y-3 pt-2">
                      {tacticsResults.linkedin.connection_note && (
                        <div className="rounded-lg border border-gray-200 bg-white p-3">
                          <div className="mb-1 flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Connection Note (300 char)</p>
                            <button type="button" onClick={() => navigator.clipboard.writeText(tacticsResults.linkedin.connection_note)} className="text-xs text-blue-600 hover:text-blue-800">
                              <CopyIcon className="inline h-3.5 w-3.5" /> Copy
                            </button>
                          </div>
                          <p className="whitespace-pre-wrap text-sm text-gray-800">{tacticsResults.linkedin.connection_note}</p>
                        </div>
                      )}
                      {tacticsResults.linkedin.follow_up_message && (
                        <div className="rounded-lg border border-gray-200 bg-white p-3">
                          <div className="mb-1 flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Follow-Up Message</p>
                            <button type="button" onClick={() => navigator.clipboard.writeText(tacticsResults.linkedin.follow_up_message)} className="text-xs text-blue-600 hover:text-blue-800">
                              <CopyIcon className="inline h-3.5 w-3.5" /> Copy
                            </button>
                          </div>
                          <p className="whitespace-pre-wrap text-sm text-gray-800">{tacticsResults.linkedin.follow_up_message}</p>
                        </div>
                      )}
                      {tacticsResults.linkedin.comment_draft && (
                        <div className="rounded-lg border border-gray-200 bg-white p-3">
                          <div className="mb-1 flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Post Comment Draft</p>
                            <button type="button" onClick={() => navigator.clipboard.writeText(tacticsResults.linkedin.comment_draft)} className="text-xs text-blue-600 hover:text-blue-800">
                              <CopyIcon className="inline h-3.5 w-3.5" /> Copy
                            </button>
                          </div>
                          <p className="whitespace-pre-wrap text-sm text-gray-800">{tacticsResults.linkedin.comment_draft}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Phone Script Form */}
              {tacticsResults.showPhone && (
                <div className="space-y-3 rounded-lg border border-green-200 bg-green-50/50 p-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <Phone className="h-4 w-4 text-green-500" />
                    Generate Phone Script
                  </h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <input
                      type="text"
                      placeholder="Contact name"
                      value={phoneForm.contact_name}
                      onChange={(e) => setPhoneForm((f) => ({ ...f, contact_name: e.target.value }))}
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                    />
                    <input
                      type="text"
                      placeholder="Their title"
                      value={phoneForm.contact_title}
                      onChange={(e) => setPhoneForm((f) => ({ ...f, contact_title: e.target.value }))}
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                    />
                    <input
                      type="text"
                      placeholder="Product / service to pitch"
                      value={phoneForm.product}
                      onChange={(e) => setPhoneForm((f) => ({ ...f, product: e.target.value }))}
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      phoneScript.mutate(
                        {
                          company_name: company.name,
                          company_industry: company.industry,
                          ...phoneForm,
                        },
                        { onSuccess: (data) => setTacticsResults((prev) => ({ ...prev, phone: data })) }
                      );
                    }}
                    disabled={phoneScript.isPending || !phoneForm.contact_name}
                    className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 disabled:opacity-50"
                  >
                    {phoneScript.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                    {phoneScript.isPending ? 'Generating...' : 'Generate Script'}
                  </button>

                  {tacticsResults.phone && (
                    <div className="space-y-3 pt-2">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            const full = [
                              `OPENER:\n${tacticsResults.phone.opener || ''}`,
                              `VALUE PROPOSITION:\n${tacticsResults.phone.value_proposition || ''}`,
                              `DISCOVERY QUESTIONS:\n${(tacticsResults.phone.discovery_questions || []).join('\n')}`,
                              `OBJECTION HANDLERS:\n${Object.entries(tacticsResults.phone.objection_responses || {}).map(([k, v]) => `"${k}" → ${v}`).join('\n')}`,
                              `CLOSE:\n${tacticsResults.phone.close || ''}`,
                              `VOICEMAIL:\n${tacticsResults.phone.voicemail_script || ''}`,
                            ].join('\n\n');
                            navigator.clipboard.writeText(full);
                            toast.success('Full script copied');
                          }}
                          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          <CopyIcon className="h-3.5 w-3.5" /> Copy All
                        </button>
                      </div>
                      {tacticsResults.phone.opener && (
                        <div className="rounded-lg border border-gray-200 bg-white p-3">
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">Opener</p>
                          <p className="whitespace-pre-wrap text-sm text-gray-800">{tacticsResults.phone.opener}</p>
                        </div>
                      )}
                      {tacticsResults.phone.value_proposition && (
                        <div className="rounded-lg border border-gray-200 bg-white p-3">
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">Value Proposition</p>
                          <p className="whitespace-pre-wrap text-sm text-gray-800">{tacticsResults.phone.value_proposition}</p>
                        </div>
                      )}
                      {tacticsResults.phone.discovery_questions && tacticsResults.phone.discovery_questions.length > 0 && (
                        <div className="rounded-lg border border-gray-200 bg-white p-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Discovery Questions</p>
                          <ul className="space-y-1">
                            {tacticsResults.phone.discovery_questions.map((q, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-gray-800">
                                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green-400" />
                                {q}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {tacticsResults.phone.objection_responses && Object.keys(tacticsResults.phone.objection_responses).length > 0 && (
                        <div className="rounded-lg border border-gray-200 bg-white p-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Objection Handlers</p>
                          <div className="space-y-2">
                            {Object.entries(tacticsResults.phone.objection_responses).map(([objection, response], i) => (
                              <div key={i} className="rounded-md bg-gray-50 p-2">
                                <p className="text-xs font-medium text-red-600">"{objection}"</p>
                                <p className="mt-0.5 text-sm text-gray-800">{response}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {tacticsResults.phone.close && (
                        <div className="rounded-lg border border-gray-200 bg-white p-3">
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">Close</p>
                          <p className="whitespace-pre-wrap text-sm text-gray-800">{tacticsResults.phone.close}</p>
                        </div>
                      )}
                      {tacticsResults.phone.voicemail_script && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-amber-600">Voicemail Script</p>
                          <p className="whitespace-pre-wrap text-sm text-gray-800">{tacticsResults.phone.voicemail_script}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Referral Draft Form */}
              {tacticsResults.showReferral && (
                <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <UserPlus className="h-4 w-4 text-amber-500" />
                    Generate Referral Request
                  </h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <input
                      type="text"
                      placeholder="Referrer's name (who you know)"
                      value={referralForm.referrer_name}
                      onChange={(e) => setReferralForm((f) => ({ ...f, referrer_name: e.target.value }))}
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    <input
                      type="text"
                      placeholder="Target person's name"
                      value={referralForm.target_name}
                      onChange={(e) => setReferralForm((f) => ({ ...f, target_name: e.target.value }))}
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    <input
                      type="text"
                      placeholder="Target's title"
                      value={referralForm.target_title}
                      onChange={(e) => setReferralForm((f) => ({ ...f, target_title: e.target.value }))}
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      referralDraft.mutate(
                        {
                          company_name: company.name,
                          company_industry: company.industry,
                          ...referralForm,
                        },
                        { onSuccess: (data) => setTacticsResults((prev) => ({ ...prev, referral: data })) }
                      );
                    }}
                    disabled={referralDraft.isPending || !referralForm.referrer_name || !referralForm.target_name}
                    className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
                  >
                    {referralDraft.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                    {referralDraft.isPending ? 'Generating...' : 'Generate'}
                  </button>

                  {tacticsResults.referral && (
                    <div className="space-y-3 pt-2">
                      {tacticsResults.referral.referral_email && (
                        <div className="rounded-lg border border-gray-200 bg-white p-3">
                          <div className="mb-1 flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Referral Email</p>
                            <button type="button" onClick={() => navigator.clipboard.writeText(tacticsResults.referral.referral_email)} className="text-xs text-blue-600 hover:text-blue-800">
                              <CopyIcon className="inline h-3.5 w-3.5" /> Copy
                            </button>
                          </div>
                          <p className="whitespace-pre-wrap text-sm text-gray-800">{tacticsResults.referral.referral_email}</p>
                        </div>
                      )}
                      {tacticsResults.referral.forwardable_blurb && (
                        <div className="rounded-lg border border-gray-200 bg-white p-3">
                          <div className="mb-1 flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Forwardable Blurb</p>
                            <button type="button" onClick={() => navigator.clipboard.writeText(tacticsResults.referral.forwardable_blurb)} className="text-xs text-blue-600 hover:text-blue-800">
                              <CopyIcon className="inline h-3.5 w-3.5" /> Copy
                            </button>
                          </div>
                          <p className="whitespace-pre-wrap text-sm text-gray-800">{tacticsResults.referral.forwardable_blurb}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Event Outreach Form */}
              {tacticsResults.showEvent && (
                <div className="space-y-3 rounded-lg border border-rose-200 bg-rose-50/50 p-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <CalendarDays className="h-4 w-4 text-rose-500" />
                    Generate Event Outreach
                  </h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <input
                      type="text"
                      placeholder="Event name"
                      value={eventForm.event_name}
                      onChange={(e) => setEventForm((f) => ({ ...f, event_name: e.target.value }))}
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                    />
                    <input
                      type="text"
                      placeholder="Contact name"
                      value={eventForm.contact_name}
                      onChange={(e) => setEventForm((f) => ({ ...f, contact_name: e.target.value }))}
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                    />
                    <select
                      value={eventForm.event_type}
                      onChange={(e) => setEventForm((f) => ({ ...f, event_type: e.target.value }))}
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                    >
                      <option value="conference">Conference</option>
                      <option value="webinar">Webinar</option>
                      <option value="meetup">Meetup</option>
                      <option value="trade_show">Trade Show</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      eventOutreach.mutate(
                        {
                          company_name: company.name,
                          company_industry: company.industry,
                          ...eventForm,
                        },
                        { onSuccess: (data) => setTacticsResults((prev) => ({ ...prev, event: data })) }
                      );
                    }}
                    disabled={eventOutreach.isPending || !eventForm.event_name || !eventForm.contact_name}
                    className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
                  >
                    {eventOutreach.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                    {eventOutreach.isPending ? 'Generating...' : 'Generate Sequence'}
                  </button>

                  {tacticsResults.event && (
                    <div className="space-y-3 pt-2">
                      {tacticsResults.event.pre_event_email && (
                        <div className="rounded-lg border border-gray-200 bg-white p-3">
                          <div className="mb-1 flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Pre-Event Email</p>
                            <button type="button" onClick={() => navigator.clipboard.writeText(tacticsResults.event.pre_event_email)} className="text-xs text-blue-600 hover:text-blue-800">
                              <CopyIcon className="inline h-3.5 w-3.5" /> Copy
                            </button>
                          </div>
                          <p className="whitespace-pre-wrap text-sm text-gray-800">{tacticsResults.event.pre_event_email}</p>
                        </div>
                      )}
                      {tacticsResults.event.at_event_message && (
                        <div className="rounded-lg border border-gray-200 bg-white p-3">
                          <div className="mb-1 flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">At-Event Message</p>
                            <button type="button" onClick={() => navigator.clipboard.writeText(tacticsResults.event.at_event_message)} className="text-xs text-blue-600 hover:text-blue-800">
                              <CopyIcon className="inline h-3.5 w-3.5" /> Copy
                            </button>
                          </div>
                          <p className="whitespace-pre-wrap text-sm text-gray-800">{tacticsResults.event.at_event_message}</p>
                        </div>
                      )}
                      {tacticsResults.event.post_event_followup && (
                        <div className="rounded-lg border border-gray-200 bg-white p-3">
                          <div className="mb-1 flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Post-Event Follow-Up</p>
                            <button type="button" onClick={() => navigator.clipboard.writeText(tacticsResults.event.post_event_followup)} className="text-xs text-blue-600 hover:text-blue-800">
                              <CopyIcon className="inline h-3.5 w-3.5" /> Copy
                            </button>
                          </div>
                          <p className="whitespace-pre-wrap text-sm text-gray-800">{tacticsResults.event.post_event_followup}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Multi-Touch Plan Results */}
              {tacticsResults.multiTouch && (
                <div className="space-y-3">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <Layers className="h-4 w-4 text-purple-500" />
                    Multi-Touch Campaign Plan
                  </h3>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        const plan = tacticsResults.multiTouch;
                        const text = [
                          plan.summary || '',
                          '',
                          ...(plan.steps || plan.touches || []).map((s, i) =>
                            `Step ${i + 1}: [${s.channel || s.type}] ${s.timing || s.day || ''}\n${s.action || s.description || s.content || ''}`
                          ),
                        ].join('\n\n');
                        navigator.clipboard.writeText(text);
                        toast.success('Plan copied');
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <CopyIcon className="h-3.5 w-3.5" /> Copy Plan
                    </button>
                  </div>
                  {tacticsResults.multiTouch.summary && (
                    <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
                      <p className="text-sm text-purple-800">{tacticsResults.multiTouch.summary}</p>
                    </div>
                  )}
                  <div className="space-y-2">
                    {(tacticsResults.multiTouch.steps || tacticsResults.multiTouch.touches || []).map((step, i) => {
                      const channelColors = {
                        linkedin: 'border-sky-300 bg-sky-50',
                        email: 'border-blue-300 bg-blue-50',
                        phone: 'border-green-300 bg-green-50',
                        referral: 'border-amber-300 bg-amber-50',
                      };
                      const channel = (step.channel || step.type || '').toLowerCase();
                      const colorClass = channelColors[channel] || 'border-gray-200 bg-gray-50';
                      return (
                        <div key={i} className={`rounded-lg border p-3 ${colorClass}`}>
                          <div className="mb-1 flex items-center gap-2">
                            <span className="inline-flex items-center justify-center rounded-full bg-gray-900 px-2 py-0.5 text-xs font-bold text-white">
                              {i + 1}
                            </span>
                            <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                              {step.channel || step.type || 'Touch'}
                            </span>
                            {(step.timing || step.day) && (
                              <span className="text-xs text-gray-500">{step.timing || step.day}</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-800">{step.action || step.description || step.content || ''}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {!tacticsResults.executives && !tacticsResults.multiTouch && !tacticsResults.showLinkedin && !tacticsResults.showPhone && !tacticsResults.showReferral && !tacticsResults.showEvent && (
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center">
                  <Crosshair className="mx-auto h-8 w-8 text-gray-300" />
                  <p className="mt-2 text-sm text-gray-500">
                    Use tactics to find executives, generate multi-channel outreach drafts, and build campaign plans.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick-add task pinned to this company */}
      <TaskFormModal
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        onSubmit={(payload) => createTask.mutate(payload, { onSuccess: () => setTaskModalOpen(false) })}
        companyId={id}
        saving={createTask.isPending}
      />
    </div>
  );
}
