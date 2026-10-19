import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Globe,
  History,
  LayoutGrid,
  LayoutList,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { discoveryApi, queryClient } from '../../api/client';
import { useSearchCompanies } from '../../hooks/useDiscovery';
import {
  errMsg,
  hasDiscoveryAiKey,
  isGeminiKeyRequired,
  useDiscoveryAiStatus,
} from '../../hooks/useDiscoveryDocuments';
import { useOptionalAuth } from '../../context/AuthContext';
import { isPlatformAdmin } from '../../lib/roles';
import { cn, formatNumber } from '../../lib/utils';
import { usePersistedState } from '../../lib/persistedState';
import Skeleton from '../Skeleton';
import GeminiKeyBanner from './GeminiKeyBanner';

const MANUFACTURING_INDUSTRIES = [
  'Injection Molding',
  'CNC Machining',
  'Metal Stamping',
  'Die Casting',
  'Sheet Metal Fabrication',
  'Plastic Extrusion',
  'Powder Coating',
  '3D Printing / Additive Manufacturing',
  'Welding & Assembly',
  'Surface Finishing',
  'Precision Machining',
  'Tool & Die Making',
  'Metal Forging',
  'Wire EDM',
  'Laser Cutting',
  'Rubber & Silicone Molding',
  'PCB Manufacturing',
  'Packaging Manufacturing',
  'Textile Manufacturing',
  'Food Processing Equipment',
];

const EMPTY_FORM = {
  query: '',
  industry_keyword: '',
  location: '',
  min_employees: '',
  max_employees: '',
  keywords: '',
  num_results: 10,
};

// Existing keys — renaming them would drop users' saved searches.
const SAVED_KEY = 'landline_saved_searches';
const HISTORY_KEY = 'landline_search_history';
const SESSION_KEY = 'prospect.discovery.search';

// Gemini (grounded in Google Search, on the org's own key) is the default:
// Apollo's free plan refuses company search outright.
const SOURCES = {
  gemini: {
    label: 'Gemini web search',
    name: 'Gemini',
    button: 'Search with Gemini',
    pending: 'Gemini is searching the web — this can take up to a minute…',
    note: 'Runs on your organization’s Gemini key. Matches are added to Companies straight away; duplicates merge.',
  },
  apollo: {
    label: 'Apollo database',
    name: 'Apollo',
    button: 'Search Apollo',
    pending: 'Searching Apollo — this usually takes a few seconds…',
    note: 'Each result uses Apollo credits. Matches are added to Companies straight away; duplicates merge.',
  },
};

const inputCls =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

function getRelativeDate(dateStr) {
  const diffMins = Math.floor((Date.now() - new Date(dateStr)) / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return `${Math.floor(diffHrs / 24)}d ago`;
}

// The API's field names (`industry`, `per_page`) — the form's names are older.
// Sending the form names silently dropped the industry and result count.
export function toSearchPayload(form) {
  const keywords = form.keywords
    ? form.keywords.split(',').map((k) => k.trim()).filter(Boolean)
    : [];
  return {
    industry: form.industry_keyword.trim(),
    location: form.location.trim(),
    keywords,
    min_employees: form.min_employees ? Number(form.min_employees) : null,
    max_employees: form.max_employees ? Number(form.max_employees) : null,
    per_page: Number(form.num_results) || 10,
  };
}

// Gemini reads a sentence best, so the structured filters are folded into the
// description (`query`) as well as sent as fields the backend applies itself.
// The endpoint builds its prompt from the structured fields only, so the
// description also rides along as the first keyword: without that, a search
// typed only as a sentence reaches Gemini as "any industry and location".
export function toGeminiPayload(form) {
  const base = toSearchPayload(form);
  const description = form.query.trim();
  const size =
    base.min_employees && base.max_employees ? `${base.min_employees}-${base.max_employees} employees`
      : base.min_employees ? `at least ${base.min_employees} employees`
        : base.max_employees ? `up to ${base.max_employees} employees`
          : '';
  const extras = [
    base.industry && `industry: ${base.industry}`,
    base.location && `located in ${base.location}`,
    size,
    base.keywords.length > 0 && `keywords: ${base.keywords.join(', ')}`,
  ].filter(Boolean);
  const query = [description, extras.length ? `${description ? 'Filters' : 'Companies'} — ${extras.join('; ')}.` : '']
    .filter(Boolean)
    .join('\n');
  return { ...base, keywords: description ? [description, ...base.keywords] : base.keywords, query };
}

const PROVIDER_LABEL = { gemini: 'Gemini', groq: 'Groq', openrouter: 'OpenRouter' };

// Only Gemini searches the web. When it's out of quota or unavailable the
// backend answers from Groq/OpenRouter's training data instead and says so in
// `notice` — results that can be stale or invented must not look web-verified.
function UngroundedNotice({ results }) {
  if (!results?.notice || results.grounded !== false) return null;
  const label = PROVIDER_LABEL[results.provider] || results.provider;
  return (
    <div role="status" className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
      <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-600" />
      <div>
        <p className="font-medium text-amber-900">
          {label ? `Results from ${label}, not a live web search` : 'Not a live web search'}
        </p>
        <p className="mt-1 text-amber-800">{results.notice}</p>
      </div>
    </div>
  );
}

function Sources({ sources }) {
  if (!sources?.length) return null;
  return (
    <details className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm">
      <summary className="cursor-pointer font-medium text-gray-700">
        Web sources Gemini used ({sources.length})
      </summary>
      <ul className="mt-2 space-y-1">
        {sources.map((src) => (
          <li key={src.url} className="truncate">
            <a
              href={src.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
            >
              {src.title || src.url}
              <ExternalLink className="h-3 w-3 flex-shrink-0" />
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}

// Gemini returns decision-makers with each company; they're imported with it.
function ContactsFound({ company }) {
  const n = company.contacts?.length || 0;
  if (!n) return null;
  const names = company.contacts.map((c) => [c.name, c.title].filter(Boolean).join(', ')).filter(Boolean);
  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-gray-500"
      title={names.join('\n') || undefined}
      data-testid="contacts-found"
    >
      <Users className="h-3 w-3" />
      {n} contact{n === 1 ? '' : 's'} found
    </span>
  );
}

// A 401 here is *our* session being refused before anything reached the
// provider — the backend's "Invalid or missing API key / Bearer token"
// otherwise reads as Apollo/Gemini rejecting its key: the wrong fix.
function searchFailureMessage(error, name) {
  if (error?.response?.status === 401) {
    return `Your session wasn’t accepted, so nothing was sent to ${name}. Refresh the page (or sign in again) and search again.`;
  }
  return errMsg(error, `Something went wrong talking to ${name}.`);
}

const GEMINI_STATUS_COPY = {
  rate_limited: {
    title: 'Gemini is rate-limiting searches right now',
    body: 'Wait a minute, then search again.',
  },
  budget_exhausted: {
    title: 'Your Gemini quota is used up for now',
    body: 'Searches resume when the quota resets. Companies already found stay in your pipeline.',
  },
  unauthorized: {
    title: 'Gemini refused the search',
    body: 'Your organization’s Gemini API key was rejected. An org admin can replace it in Settings → API Keys.',
  },
  error: {
    title: 'Gemini returned an error',
    body: 'Try again in a moment, or describe the companies a little differently.',
  },
};

function SearchStatusNotice({ status, detail, canFix, source }) {
  if (!status || status === 'ok') return null;
  // A missing Gemini key gets the full banner (with the Settings link) instead.
  if (source === 'gemini' && status === 'skipped') return null;
  const copy = (source === 'gemini' && GEMINI_STATUS_COPY[status]) || {
    rate_limited: {
      title: 'Apollo is rate-limiting searches right now',
      body: 'Wait a minute, then search again. Nothing was charged for this attempt.',
    },
    budget_exhausted: {
      title: 'The Apollo credit budget is used up for now',
      body: 'Searches resume when the budget resets. Companies already found stay in your pipeline.',
    },
    skipped: {
      title: 'Apollo isn’t connected yet',
      body: canFix
        ? 'Add the Apollo API key in Platform credentials to start searching.'
        : 'Ask a platform admin to add the Apollo API key for this deployment.',
    },
    unauthorized: {
      title: 'Apollo refused the search',
      body: canFix
        ? 'The Apollo API key was rejected, or the Apollo plan doesn’t include company search. Check the key in Platform credentials, or upgrade the Apollo plan.'
        : 'The Apollo API key was rejected, or the Apollo plan doesn’t include company search. Ask a platform admin to check the Apollo key and plan.',
    },
    error: {
      title: 'Apollo returned an error',
      body: 'Try again in a moment, or loosen your filters.',
    },
  }[status] || { title: 'The search didn’t complete', body: 'Try again in a moment.' };
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
      <div className="text-sm">
        <p className="font-medium text-amber-900">{copy.title}</p>
        <p className="mt-1 text-amber-800">
          {copy.body}{' '}
          {source !== 'gemini' && (status === 'skipped' || status === 'unauthorized') && canFix && (
            <Link to="/platform/credentials" className="font-medium underline hover:text-amber-900">
              Open Platform credentials
            </Link>
          )}
        </p>
        {detail && status !== 'skipped' && (
          <p className="mt-1 break-words text-xs text-amber-700" data-testid="search-status-detail">{detail}</p>
        )}
      </div>
    </div>
  );
}

function ResultsSkeleton({ message }) {
  return (
    <div data-testid="results-skeleton" className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
        <Skeleton className="h-3 w-40" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-gray-100 px-4 py-4 last:border-0">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/6" />
          <Skeleton className="hidden h-4 w-1/6 sm:block" />
          <Skeleton className="ml-auto h-7 w-28 rounded-lg" />
        </div>
      ))}
      <p className="px-4 py-3 text-xs text-gray-500">{message}</p>
    </div>
  );
}

function StatusBadge({ company }) {
  if (company.status === 'imported') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
        <CheckCircle2 className="h-3 w-3" />
        Added
      </span>
    );
  }
  if (company.status === 'error') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700"
        title={company.error || undefined}
      >
        <AlertTriangle className="h-3 w-3" />
        Not added
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
      <CheckCircle2 className="h-3 w-3" />
      Already in Prospect
    </span>
  );
}

function RowAction({ company, enrich, onEnrich, block }) {
  if (!company.id) return <span className="text-xs text-gray-400">--</span>;
  const state = enrich[company.id];
  const base = cn(
    'inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50',
    block && 'w-full'
  );
  if (state?.state === 'done') {
    return (
      <Link
        to={`/companies/${company.id}`}
        className={cn(base, 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100')}
      >
        <Users className="h-3.5 w-3.5" />
        {state.contacts} contact{state.contacts === 1 ? '' : 's'} found
      </Link>
    );
  }
  return (
    <div className={cn('inline-flex items-center gap-2', block && 'w-full')}>
      <button
        type="button"
        onClick={() => onEnrich(company)}
        disabled={state?.state === 'running'}
        aria-label={`Find contacts at ${company.name}`}
        className={cn(base, 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100')}
      >
        {state?.state === 'running' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : state?.state === 'failed' ? (
          <RefreshCw className="h-3.5 w-3.5" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        {state?.state === 'running' ? 'Finding…' : state?.state === 'failed' ? 'Retry' : 'Find contacts'}
      </button>
      <Link
        to={`/companies/${company.id}`}
        aria-label={`Open ${company.name}`}
        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

export default function CompanySearch() {
  const user = useOptionalAuth()?.user;
  const canFixApollo = isPlatformAdmin(user?.role);
  const searchCompanies = useSearchCompanies();

  // Form + last results live in sessionStorage, so leaving the page (or the
  // tab) and coming back doesn't throw the search away.
  const [session, setSession] = usePersistedState(
    SESSION_KEY,
    { source: 'gemini', form: EMPTY_FORM, results: null },
    'session'
  );
  const source = session.source === 'apollo' ? 'apollo' : 'gemini';
  const copy = SOURCES[source];
  const form = { ...EMPTY_FORM, ...session.form };
  const results = session.results;
  const setForm = (next) => setSession((s) => ({ ...s, form: next }));
  const setResults = (next) => setSession((s) => ({ ...s, results: next }));
  const setSource = (next) => {
    if (next === source) return;
    searchCompanies.reset();
    setFormError(null);
    setSession((s) => ({ ...s, source: next }));
  };

  // Checked up front, so a missing key is explained before anyone types.
  const aiStatus = useDiscoveryAiStatus();
  // The search endpoint reports a missing key as a 'skipped' result; other
  // Gemini routes answer 409 — either way it's the same banner.
  const geminiKeyMissing =
    source === 'gemini' &&
    ((aiStatus.data && !hasDiscoveryAiKey(aiStatus.data)) ||
      isGeminiKeyRequired(searchCompanies.error) ||
      (results?.source === 'gemini' && results.search_error_code === 'gemini_key_required'));

  const [viewMode, setViewMode] = usePersistedState('prospect.discovery.view', 'table');
  const [savedSearches, setSavedSearches] = usePersistedState(SAVED_KEY, []);
  const [searchHistory, setSearchHistory] = usePersistedState(HISTORY_KEY, []);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState('');
  const [formError, setFormError] = useState(null);
  const [lastPayload, setLastPayload] = useState(null);

  const [showIndustrySuggestions, setShowIndustrySuggestions] = useState(false);
  const industryInputRef = useRef(null);
  const industryDropdownRef = useRef(null);

  // Per-company enrichment: { [id]: { state: 'running'|'done'|'failed', contacts } }
  const [enrich, setEnrich] = useState({});
  const [bulk, setBulk] = useState(null); // { current, total }

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        industryInputRef.current && !industryInputRef.current.contains(e.target) &&
        industryDropdownRef.current && !industryDropdownRef.current.contains(e.target)
      ) {
        setShowIndustrySuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredIndustries = form.industry_keyword.trim()
    ? MANUFACTURING_INDUSTRIES.filter((ind) =>
        ind.toLowerCase().includes(form.industry_keyword.toLowerCase())
      ).slice(0, 6)
    : [];

  const handleSaveSearch = () => {
    if (!saveSearchName.trim()) return;
    setSavedSearches((prev) => [...prev, { id: Date.now(), name: saveSearchName.trim(), criteria: { ...form } }]);
    setSaveSearchName('');
    setShowSaveInput(false);
  };

  const runSearch = (request) => {
    setLastPayload(request);
    setEnrich({});
    searchCompanies.mutate(request, { onSuccess: (data) => setResults({ ...data, source: request.source }) });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const hasFilter = form.industry_keyword.trim() || form.location.trim() || form.keywords.trim();
    if (source === 'gemini' && !form.query.trim() && !hasFilter) {
      setFormError('Describe the companies you’re looking for, or fill in at least one filter.');
      return;
    }
    if (source === 'apollo' && !hasFilter) {
      setFormError('Enter an industry, a location or a keyword to search.');
      return;
    }
    const min = Number(form.min_employees);
    const max = Number(form.max_employees);
    if (form.min_employees && form.max_employees && min > max) {
      setFormError('Min employees can’t be more than max employees.');
      return;
    }
    setFormError(null);
    setSearchHistory((prev) => [{ criteria: { ...form }, date: new Date().toISOString() }, ...prev].slice(0, 5));
    runSearch({ source, payload: source === 'apollo' ? toSearchPayload(form) : toGeminiPayload(form) });
  };

  const enrichOne = async (company) => {
    setEnrich((prev) => ({ ...prev, [company.id]: { state: 'running' } }));
    try {
      const res = await discoveryApi.enrichCompany(company.id, { find_contacts: true });
      const contacts = res?.contacts_count ?? 0;
      setEnrich((prev) => ({ ...prev, [company.id]: { state: 'done', contacts } }));
      return contacts;
    } catch (e) {
      setEnrich((prev) => ({ ...prev, [company.id]: { state: 'failed', error: errMsg(e, 'Enrichment failed') } }));
      throw e;
    }
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['companies'] });
    queryClient.invalidateQueries({ queryKey: ['contacts'] });
  };

  const handleEnrich = async (company) => {
    try {
      const n = await enrichOne(company);
      toast.success(n ? `Found ${n} contact${n === 1 ? '' : 's'} at ${company.name}` : `No new contacts found at ${company.name}`);
    } catch (e) {
      toast.error(errMsg(e, `Couldn't enrich ${company.name}`));
    } finally {
      invalidate();
    }
  };

  const pending = (results?.companies || []).filter((c) => c.id && enrich[c.id]?.state !== 'done');

  const handleBulkEnrich = async () => {
    if (!pending.length || bulk) return;
    setBulk({ current: 0, total: pending.length });
    let found = 0;
    let failed = 0;
    for (let i = 0; i < pending.length; i++) {
      setBulk({ current: i + 1, total: pending.length });
      try {
        found += await enrichOne(pending[i]);
      } catch {
        failed += 1;
      }
    }
    setBulk(null);
    invalidate();
    const msg = `Found ${found} contact${found === 1 ? '' : 's'} across ${pending.length - failed} compan${pending.length - failed === 1 ? 'y' : 'ies'}`;
    if (failed) toast.error(`${msg}; ${failed} couldn't be enriched`);
    else toast.success(msg);
  };

  const companies = results?.companies || [];
  const isPending = searchCompanies.isPending;

  return (
    <div className="space-y-6">
      {(savedSearches.length > 0 || searchHistory.length > 0) && (
        <div className="space-y-3">
          {savedSearches.length > 0 && (
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-gray-500">
                <BookmarkCheck className="h-3.5 w-3.5" />
                Saved searches
              </div>
              <div className="flex flex-wrap gap-2">
                {savedSearches.map((s) => (
                  <span
                    key={s.id}
                    className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 text-xs font-medium text-blue-700"
                  >
                    <button
                      type="button"
                      onClick={() => setForm({ ...EMPTY_FORM, ...s.criteria })}
                      className="inline-flex items-center gap-1.5 rounded-l-full py-1 pl-3 pr-1 hover:bg-blue-100"
                    >
                      <Bookmark className="h-3 w-3" />
                      {s.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSavedSearches((prev) => prev.filter((x) => x.id !== s.id))}
                      aria-label={`Delete saved search ${s.name}`}
                      className="rounded-r-full py-1 pl-1 pr-2 hover:bg-blue-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
          {searchHistory.length > 0 && (
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-gray-500">
                <History className="h-3.5 w-3.5" />
                Recent searches
              </div>
              <div className="flex flex-wrap gap-2">
                {searchHistory.map((h, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setForm({ ...EMPTY_FORM, ...h.criteria })}
                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs text-gray-600 hover:bg-gray-100"
                  >
                    <Clock className="h-3 w-3 text-gray-400" />
                    <span className="max-w-[16rem] truncate">
                      {h.criteria.query ||
                        [h.criteria.industry_keyword, h.criteria.location].filter(Boolean).join(' - ') ||
                        h.criteria.keywords ||
                        'Search'}
                    </span>
                    <span className="text-gray-400">{getRelativeDate(h.date)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {geminiKeyMissing && (
        <GeminiKeyBanner feature="Gemini search" uses="Searching the web for companies runs" />
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <form onSubmit={handleSearch} className="space-y-4" noValidate>
          <div role="radiogroup" aria-label="Search with" className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            {Object.entries(SOURCES).map(([key, s]) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={source === key}
                onClick={() => setSource(key)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  source === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                )}
              >
                {key === 'gemini' ? <Sparkles className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />}
                {s.label}
              </button>
            ))}
          </div>

          {source === 'gemini' && (
            <div>
              <label htmlFor="disc-query" className="mb-1 block text-sm font-medium text-gray-700">
                Describe the companies you&apos;re looking for
              </label>
              <textarea
                id="disc-query"
                rows={3}
                value={form.query}
                onChange={(e) => setForm({ ...form, query: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSearch(e);
                }}
                className={cn(inputCls, 'resize-y')}
                placeholder="e.g., SaaS companies in Bangalore with 50-200 employees focused on healthcare"
              />
              <p className="mt-1 text-xs text-gray-500">
                Plain language works best. The filters below are optional and get added to your description.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-1">
              <label htmlFor="disc-industry" className="mb-1 block text-sm font-medium text-gray-700">Industry</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="disc-industry"
                  ref={industryInputRef}
                  type="text"
                  autoComplete="off"
                  value={form.industry_keyword}
                  onChange={(e) => {
                    setForm({ ...form, industry_keyword: e.target.value });
                    setShowIndustrySuggestions(true);
                  }}
                  onFocus={() => setShowIndustrySuggestions(true)}
                  className={cn(inputCls, 'pl-9')}
                  placeholder="e.g., injection molding, CNC machining"
                />
                {showIndustrySuggestions && filteredIndustries.length > 0 && (
                  <div
                    ref={industryDropdownRef}
                    className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
                  >
                    {filteredIndustries.map((ind) => (
                      <button
                        key={ind}
                        type="button"
                        onClick={() => {
                          setForm({ ...form, industry_keyword: ind });
                          setShowIndustrySuggestions(false);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                      >
                        <Building2 className="h-3.5 w-3.5 text-gray-400" />
                        {ind}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="disc-location" className="mb-1 block text-sm font-medium text-gray-700">Location</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="disc-location"
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className={cn(inputCls, 'pl-9')}
                  placeholder="e.g., Ohio, United States"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label htmlFor="disc-min" className="mb-1 block text-sm font-medium text-gray-700">Min employees</label>
                <input
                  id="disc-min"
                  type="number"
                  min="1"
                  value={form.min_employees}
                  onChange={(e) => setForm({ ...form, min_employees: e.target.value })}
                  className={inputCls}
                  placeholder="10"
                />
              </div>
              <div className="flex-1">
                <label htmlFor="disc-max" className="mb-1 block text-sm font-medium text-gray-700">Max employees</label>
                <input
                  id="disc-max"
                  type="number"
                  min="1"
                  value={form.max_employees}
                  onChange={(e) => setForm({ ...form, max_employees: e.target.value })}
                  className={inputCls}
                  placeholder="500"
                />
              </div>
            </div>

            <div className="sm:col-span-2 lg:col-span-2">
              <label htmlFor="disc-keywords" className="mb-1 block text-sm font-medium text-gray-700">Additional keywords</label>
              <input
                id="disc-keywords"
                type="text"
                value={form.keywords}
                onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                className={inputCls}
                placeholder="Comma-separated, e.g., automotive, aerospace, precision"
              />
            </div>

            <div>
              <label htmlFor="disc-count" className="mb-1 block text-sm font-medium text-gray-700">Number of results</label>
              <select
                id="disc-count"
                value={form.num_results}
                onChange={(e) => setForm({ ...form, num_results: Number(e.target.value) })}
                className={inputCls}
              >
                {[5, 10, 15, 25].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>

          {formError && (
            <p role="alert" className="text-sm text-red-600">{formError}</p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-gray-500">{copy.note}</p>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {showSaveInput ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={saveSearchName}
                    onChange={(e) => setSaveSearchName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveSearch();
                      }
                    }}
                    className={cn(inputCls, 'w-44')}
                    placeholder="Search name..."
                    aria-label="Saved search name"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleSaveSearch}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-green-500 px-3 py-2 text-sm font-medium text-white hover:bg-green-600"
                  >
                    <BookmarkCheck className="h-4 w-4" />
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSaveInput(false);
                      setSaveSearchName('');
                    }}
                    aria-label="Cancel saving search"
                    className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSaveInput(true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                >
                  <Bookmark className="h-4 w-4" />
                  Save search
                </button>
              )}
              <button
                type="submit"
                disabled={isPending || geminiKeyMissing}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-600 disabled:opacity-50"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : source === 'gemini' ? (
                  <Sparkles className="h-4 w-4" />
                ) : (
                  <Globe className="h-4 w-4" />
                )}
                {isPending ? 'Searching…' : copy.button}
              </button>
            </div>
          </div>
        </form>
      </div>

      {isPending && <ResultsSkeleton message={copy.pending} />}

      {!isPending && searchCompanies.isError && !geminiKeyMissing && (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
            <div className="text-sm text-red-800">
              <p className="font-medium">The search didn&apos;t go through</p>
              <p className="mt-1">{searchFailureMessage(searchCompanies.error, SOURCES[lastPayload?.source || source].name)}</p>
            </div>
          </div>
          {lastPayload && (
            <button
              type="button"
              onClick={() => runSearch(lastPayload)}
              className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
          )}
        </div>
      )}

      {!isPending && results && (
        <div className="space-y-4">
          <SearchStatusNotice
            status={results.search_status}
            detail={results.search_error}
            canFix={canFixApollo}
            source={results.source || 'apollo'}
          />

          {companies.length > 0 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {results.total || companies.length} compan{(results.total || companies.length) === 1 ? 'y' : 'ies'} found
                </h2>
                <p className="text-sm text-gray-500">
                  <span className="font-medium text-green-700">{results.imported || 0} added to your pipeline</span>
                  {' · '}
                  {results.already_existed || 0} already in Prospect
                  {' · '}
                  <Link to="/companies" className="font-medium text-blue-600 hover:text-blue-700">View in Companies</Link>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBulkEnrich}
                  disabled={Boolean(bulk) || !pending.length}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50"
                >
                  {bulk ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Enriching {bulk.current} of {bulk.total}…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      {pending.length ? `Find contacts for all (${pending.length})` : 'All enriched'}
                    </>
                  )}
                </button>
                <div className="flex items-center rounded-lg border border-gray-200 bg-white p-0.5">
                  {[
                    { mode: 'table', Icon: LayoutList, label: 'Table view' },
                    { mode: 'card', Icon: LayoutGrid, label: 'Card view' },
                  ].map(({ mode, Icon, label }) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setViewMode(mode)}
                      aria-label={label}
                      aria-pressed={viewMode === mode}
                      className={cn(
                        'rounded-md p-1.5 transition-colors',
                        viewMode === mode ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <UngroundedNotice results={results} />
          <Sources sources={results.sources} />

          {companies.length === 0 ? (
            (!results.search_status || results.search_status === 'ok') && (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center">
                <Search className="h-10 w-10 text-gray-300" />
                <p className="mt-3 text-sm font-medium text-gray-900">No companies matched</p>
                <p className="mt-1 text-sm text-gray-500">
                  {results.source === 'gemini'
                    ? 'Try describing the companies more broadly, a wider location (a state instead of a city), or drop the employee range.'
                    : 'Try a broader industry term, a wider location (a state instead of a city), or drop the employee range.'}
                </p>
              </div>
            )
          ) : viewMode === 'table' ? (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['Company', 'Industry', 'Employees', 'Location', 'Status'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{h}</th>
                    ))}
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Contacts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {companies.map((company, idx) => (
                    <tr key={company.id || idx} className="hover:bg-gray-50" data-testid="result-row">
                      <td className="px-4 py-3">
                        <p className="whitespace-nowrap text-sm font-medium text-gray-900">{company.name}</p>
                        {company.domain && (
                          <a
                            href={`https://${company.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                          >
                            {company.domain}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {company.description && (
                          <p className="mt-0.5 max-w-xs text-xs text-gray-500 line-clamp-2">{company.description}</p>
                        )}
                        <ContactsFound company={company} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{company.industry || '--'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        {company.employee_count ? formatNumber(company.employee_count) : '--'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        {[company.city, company.state].filter(Boolean).join(', ') || company.location || '--'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <StatusBadge company={company} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <RowAction company={company} enrich={enrich} onEnrich={handleEnrich} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {companies.map((company, idx) => (
                <div
                  key={company.id || idx}
                  data-testid="result-card"
                  className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <p className="text-sm font-bold text-gray-900">{company.name}</p>
                    <StatusBadge company={company} />
                  </div>
                  {company.domain && (
                    <a
                      href={`https://${company.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mb-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                    >
                      {company.domain}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {company.description && (
                    <p className="mb-2 text-xs text-gray-500 line-clamp-3">{company.description}</p>
                  )}
                  <div className="space-y-1.5 text-xs text-gray-600">
                    <ContactsFound company={company} />
                    {company.industry && (
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-gray-400" />
                        {company.industry}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-gray-400" />
                      {[company.city, company.state].filter(Boolean).join(', ') || company.location || '--'}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-gray-400" />
                      {company.employee_count ? `${formatNumber(company.employee_count)} employees` : 'Size unknown'}
                    </div>
                  </div>
                  <div className="mt-auto border-t border-gray-100 pt-3">
                    <RowAction company={company} enrich={enrich} onEnrich={handleEnrich} block />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!isPending && !results && !searchCompanies.isError && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center">
          <Globe className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-900">Find companies that fit your ideal customer</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
            {source === 'gemini'
              ? 'Describe who you sell to and Gemini searches the web for matching companies.'
              : 'Search Apollo’s B2B database by industry, location and size.'}{' '}
            Matches go straight into Companies; then use{' '}
            <span className="font-medium text-gray-700">Find contacts</span> to pull the decision-makers.
          </p>
        </div>
      )}
    </div>
  );
}
