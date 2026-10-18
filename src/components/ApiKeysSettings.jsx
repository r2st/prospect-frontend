import { useState, useEffect, useCallback } from 'react';
import { Key, Eye, EyeOff, Plus, Copy, XCircle, Trash2 } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import { settingsApi, apiKeysApi } from '../api/client';
import toast from 'react-hot-toast';

// Read scopes are pre-selected so a key does something useful out of the box.
// The backend grants nothing beyond a key's scopes, so a key minted with an
// empty list authenticates and then gets 403 on every public endpoint.
const DEFAULT_SCOPES = ['contacts:read', 'companies:read', 'deals:read', 'sequences:read'];

// FastAPI sends ``detail`` as a string for HTTPException but as a list of
// {loc, msg} objects for a 422 — handing that list to toast crashes React.
function errorDetail(err, fallback) {
  const detail = err.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  return fallback;
}

function LoadingRows({ rows = 2 }) {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-4 w-48 rounded bg-gray-200" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-10 rounded bg-gray-200" />
      ))}
    </div>
  );
}

// Fallback order matches the backend (services/org_gemini.py): Gemini first,
// then Claude, Groq and OpenRouter when the one before is out of quota or failing.
const LLM_PROVIDERS = [
  {
    id: 'gemini',
    label: 'Gemini',
    badge: 'Primary',
    help: 'Powers Discovery: web-grounded company search (Google Search) and finding companies and contacts in uploaded documents.',
    placeholder: 'Enter your Gemini API key',
    getKeyUrl: 'https://aistudio.google.com/apikey',
  },
  {
    id: 'anthropic',
    label: 'Claude',
    badge: 'Optional',
    help: 'Used when Gemini is unavailable. Needs an Anthropic API key (a Claude.ai subscription does not include API access). Billed per use by Anthropic.',
    placeholder: 'Enter your Anthropic API key (sk-ant-...)',
    getKeyUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'groq',
    label: 'Groq',
    badge: 'Fallback',
    help: 'Free tier. Without a web search key below, company search results come from the model\'s training data.',
    placeholder: 'Enter your Groq API key (gsk_...)',
    getKeyUrl: 'https://console.groq.com/keys',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    badge: 'Fallback',
    help: 'Used when the providers above fail. Uses free models.',
    placeholder: 'Enter your OpenRouter API key (sk-or-...)',
    getKeyUrl: 'https://openrouter.ai/keys',
  },
];

// Web search behind Discovery when Gemini's Google Search grounding is out of
// quota: the search finds real companies, any AI key above reads the results.
export const SEARCH_PROVIDERS = [
  {
    id: 'tavily',
    label: 'Tavily',
    badge: 'Recommended',
    help: '1,000 free searches a month, no card needed. Built for AI search, returns page content.',
    placeholder: 'Enter your Tavily API key (tvly-...)',
    getKeyUrl: 'https://app.tavily.com',
  },
  {
    id: 'serper',
    label: 'Serper',
    badge: 'Google results',
    help: '2,500 free searches when you sign up. Google search results.',
    placeholder: 'Enter your Serper API key',
    getKeyUrl: 'https://serper.dev/api-key',
  },
  {
    id: 'brave',
    label: 'Brave Search',
    badge: 'Independent index',
    help: 'Brave\'s own search index, with a monthly free allowance.',
    placeholder: 'Enter your Brave Search API key',
    getKeyUrl: 'https://api-dashboard.search.brave.com/app/keys',
  },
];

function ProviderKeyRow({ provider, initial }) {
  const [llmKey, setLlmKey] = useState(initial);
  const [newKey, setNewKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const { id, label } = provider;

  const handleSave = async () => {
    if (!newKey.trim()) return;
    setSaving(true);
    try {
      setLlmKey(await settingsApi.setLlmKey(newKey.trim(), id));
      setNewKey('');
      setShowKey(false);
      toast.success(`${label} API key saved`);
    } catch (err) {
      toast.error(errorDetail(err, 'Failed to save key'));
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setRemoveConfirm(false);
    try {
      await settingsApi.deleteLlmKey(id);
      setLlmKey({ provider: id, key_hint: '', has_key: false });
      toast.success(`${label} API key removed`);
    } catch (err) {
      toast.error(errorDetail(err, 'Failed to remove key'));
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold text-gray-900">{label}</h4>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{provider.badge}</span>
        {llmKey.has_key && (
          <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">Saved</span>
        )}
        <a
          href={provider.getKeyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-xs font-medium text-blue-600 hover:underline"
        >
          Get a key
        </a>
      </div>
      <p className="text-sm text-gray-600">{provider.help}</p>

      {llmKey.has_key && (
        <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-gray-700">Current key</p>
            <p className="font-mono text-sm text-gray-500">{llmKey.key_hint}</p>
          </div>
          <button
            type="button"
            onClick={() => setRemoveConfirm(true)}
            aria-label={`Remove ${label} key`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={showKey ? 'text' : 'password'}
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder={llmKey.has_key ? 'Replace with a new key...' : provider.placeholder}
            aria-label={`${label} API key`}
            autoComplete="off"
            className="w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            aria-label={showKey ? 'Hide key' : 'Show key'}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !newKey.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <ConfirmDialog
        open={removeConfirm}
        title={`Remove ${label} API Key`}
        message={
          id === 'gemini'
            ? 'Discovery will use your other saved keys instead.'
            : provider.kind === 'search'
              ? `Discovery will no longer search the web with ${label}.`
              : `Discovery will no longer fall back to ${label}.`
        }
        confirmLabel="Remove Key"
        variant="danger"
        onConfirm={handleRemove}
        onCancel={() => setRemoveConfirm(false)}
      />
    </div>
  );
}

function LlmKeySection() {
  const [keys, setKeys] = useState(null);

  useEffect(() => {
    const empty = Object.fromEntries(
      [...LLM_PROVIDERS, ...SEARCH_PROVIDERS].map((p) => [p.id, { provider: p.id, key_hint: '', has_key: false }]),
    );
    settingsApi.listLlmKeys()
      .then((rows) => setKeys({ ...empty, ...Object.fromEntries(rows.map((r) => [r.provider, r])) }))
      .catch(() => setKeys(empty));
  }, []);

  if (!keys) return <LoadingRows rows={4} />;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Discovery tries these in order: if Gemini is out of quota or unavailable, it falls back to Claude, then Groq, then OpenRouter. Keys are stored encrypted on the server and never shown again; only the last four characters are displayed.
      </p>
      {LLM_PROVIDERS.map((p) => (
        <ProviderKeyRow key={p.id} provider={p} initial={keys[p.id]} />
      ))}
      <h4 className="pt-2 text-sm font-semibold text-gray-900">Web search</h4>
      <p className="text-sm text-gray-600">
        Lets Discovery find real, current companies when Gemini&apos;s Google Search isn&apos;t available. Without one, company search falls back to the AI&apos;s memory, which tends to suggest the same well-known companies. Only one is needed; they&apos;re tried in this order.
      </p>
      {SEARCH_PROVIDERS.map((p) => (
        <ProviderKeyRow key={p.id} provider={{ ...p, kind: 'search' }} initial={keys[p.id]} />
      ))}
    </div>
  );
}

function ProgrammaticKeysSection() {
  const [keys, setKeys] = useState([]);
  const [allScopes, setAllScopes] = useState([]);
  const [selectedScopes, setSelectedScopes] = useState(DEFAULT_SCOPES);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState(null);
  const [revokeTarget, setRevokeTarget] = useState(null);

  const loadKeys = useCallback(
    () => apiKeysApi.list()
      .then(setKeys)
      .catch(() => {})
      .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    loadKeys();
    apiKeysApi.scopes()
      .then((data) => setAllScopes(data.scopes || []))
      .catch(() => {});
  }, [loadKeys]);

  const toggleScope = (scope) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const canCreate = newKeyName.trim() && selectedScopes.length > 0 && !creating;

  const handleCreate = async () => {
    if (!canCreate) return;
    setCreating(true);
    try {
      const data = await apiKeysApi.create({ name: newKeyName.trim(), scopes: selectedScopes });
      setCreatedKey(data.api_key);
      setNewKeyName('');
      await loadKeys();
      toast.success("API key created — copy it now, it won't be shown again");
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Failed to create key');
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(createdKey);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Could not copy — select the key and copy it manually');
    }
  };

  const handleRevoke = async () => {
    const id = revokeTarget;
    setRevokeTarget(null);
    if (!id) return;
    try {
      await apiKeysApi.revoke(id);
      await loadKeys();
      toast.success('API key revoked');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to revoke key');
    }
  };

  if (loading) return <LoadingRows rows={2} />;

  const activeKeys = keys.filter((k) => !k.revoked_at);
  const revokedKeys = keys.filter((k) => k.revoked_at);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Generate API keys to access Prospect programmatically. Keys authenticate requests to the public API at{' '}
        <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">/api/v1/public/*</code>.
      </p>

      <div className="space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Key name (e.g. Zapier integration)"
            maxLength={120}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={!canCreate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {creating ? 'Creating...' : 'Create Key'}
          </button>
        </div>

        {allScopes.length > 0 && (
          <fieldset>
            <legend className="mb-1.5 text-xs font-medium text-gray-700">Scopes</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {allScopes.map((scope) => (
                <label key={scope} className="inline-flex items-center gap-1.5 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={selectedScopes.includes(scope)}
                    onChange={() => toggleScope(scope)}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-mono">{scope}</span>
                </label>
              ))}
            </div>
            {selectedScopes.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">Select at least one scope — a key without scopes can&apos;t call anything.</p>
            )}
          </fieldset>
        )}
      </div>

      {createdKey && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="mb-2 text-sm font-medium text-green-800">
            New API key created — copy it now. It won&apos;t be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all rounded border border-green-200 bg-white px-3 py-2 font-mono text-sm text-gray-900">
              {createdKey}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              <Copy className="h-4 w-4" />
              Copy
            </button>
          </div>
          <button
            type="button"
            onClick={() => setCreatedKey(null)}
            className="mt-2 text-xs text-green-700 underline hover:text-green-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {activeKeys.length > 0 ? (
        <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
          {activeKeys.map((k) => (
            <div key={k.id} className="flex items-center justify-between px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{k.name}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                  <span className="font-mono text-xs text-gray-500">{k.key_prefix}•••</span>
                  <span className="text-xs text-gray-400">
                    Created {new Date(k.created_at).toLocaleDateString()}
                  </span>
                  {k.last_used_at && (
                    <span className="text-xs text-gray-400">
                      Last used {new Date(k.last_used_at).toLocaleDateString()}
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    {k.scopes?.length ? k.scopes.join(', ') : 'no scopes'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRevokeTarget(k.id)}
                className="ml-3 inline-flex items-center gap-1 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
              >
                <XCircle className="h-3.5 w-3.5" />
                Revoke
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
          No active API keys. Create one above to get started.
        </div>
      )}

      {revokedKeys.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
            {revokedKeys.length} revoked key{revokedKeys.length !== 1 ? 's' : ''}
          </summary>
          <div className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200 opacity-60">
            {revokedKeys.map((k) => (
              <div key={k.id} className="flex items-center justify-between px-4 py-2">
                <div>
                  <p className="text-sm text-gray-500 line-through">{k.name}</p>
                  <span className="font-mono text-xs text-gray-400">{k.key_prefix}•••</span>
                </div>
                <span className="text-xs text-red-500">
                  Revoked {new Date(k.revoked_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

      <ConfirmDialog
        open={!!revokeTarget}
        title="Revoke API Key"
        message="This key will immediately stop working. Any integrations using it will lose access. This cannot be undone."
        confirmLabel="Revoke Key"
        variant="danger"
        onConfirm={handleRevoke}
        onCancel={() => setRevokeTarget(null)}
      />
    </div>
  );
}

export default function ApiKeysSettings() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100">
          <Key className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">API Keys</h2>
          <p className="text-sm text-gray-500">Manage your AI provider keys and programmatic API keys</p>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-800">AI Provider Keys</h3>
          <LlmKeySection />
        </div>

        <hr className="border-gray-200" />

        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-800">Programmatic API Keys</h3>
          <ProgrammaticKeysSection />
        </div>
      </div>
    </div>
  );
}
