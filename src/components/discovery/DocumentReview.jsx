import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Building2, CheckCircle2, ExternalLink, Mail, User } from 'lucide-react';
import { useImportCandidates } from '../../hooks/useDiscoveryDocuments';
import { cn } from '../../lib/utils';

function ConfidenceBadge({ value }) {
  const pct = Math.round((value ?? 0) * 100);
  const tone = pct >= 80 ? 'bg-green-50 text-green-700' : pct >= 50 ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700';
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', tone)} title="How sure the AI is this is a real company">
      {pct}%
    </span>
  );
}

function personName(p) {
  return [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || 'Unnamed';
}

const pendingPeople = (c) => (c.contacts || []).filter((p) => !p.imported_contact_id);
// A company can be picked if it isn't in yet, or it is but some of its people aren't.
const isSelectable = (c) => !c.imported_company_id || pendingPeople(c).length > 0;

function Stat({ label, value, tone = 'text-gray-900' }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
      <p className={cn('text-lg font-semibold', tone)}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

export default function DocumentReview({ doc, canContinue, onContinue }) {
  const candidates = useMemo(() => doc.candidates || [], [doc.candidates]);
  const selectable = useMemo(() => candidates.filter(isSelectable), [candidates]);

  // Default: every new company the model is reasonably sure of, with all its people.
  const [companies, setCompanies] = useState(
    () => new Set(selectable.filter((c) => !c.imported_company_id && (c.confidence ?? 1) >= 0.5).map((c) => c.id))
  );
  const [people, setPeople] = useState(
    () =>
      new Set(
        selectable
          .filter((c) => !c.imported_company_id && (c.confidence ?? 1) >= 0.5)
          .flatMap((c) => pendingPeople(c).map((p) => p.id))
      )
  );
  const importMutation = useImportCandidates(doc.id);

  const toggleCompany = (c) => {
    const on = !companies.has(c.id);
    setCompanies((prev) => {
      const next = new Set(prev);
      if (on) next.add(c.id);
      else next.delete(c.id);
      return next;
    });
    setPeople((prev) => {
      const next = new Set(prev);
      pendingPeople(c).forEach((p) => (on ? next.add(p.id) : next.delete(p.id)));
      return next;
    });
  };

  const togglePerson = (c, p) => {
    const on = !people.has(p.id);
    setPeople((prev) => {
      const next = new Set(prev);
      if (on) next.add(p.id);
      else next.delete(p.id);
      return next;
    });
    // Picking a person brings their company along.
    if (on) setCompanies((prev) => new Set(prev).add(c.id));
  };

  const allSelected = selectable.length > 0 && selectable.every((c) => companies.has(c.id));
  const toggleAll = () => {
    if (allSelected) {
      setCompanies(new Set());
      setPeople(new Set());
    } else {
      setCompanies(new Set(selectable.map((c) => c.id)));
      setPeople(new Set(selectable.flatMap((c) => pendingPeople(c).map((p) => p.id))));
    }
  };

  // An already-imported company is only worth sending if someone new comes with it.
  const chosen = selectable.filter(
    (c) => companies.has(c.id) && (!c.imported_company_id || pendingPeople(c).some((p) => people.has(p.id)))
  );
  const candidateIds = chosen.map((c) => c.id);
  const contactIds = chosen.flatMap((c) => pendingPeople(c).filter((p) => people.has(p.id)).map((p) => p.id));
  const newCompanies = chosen.filter((c) => !c.imported_company_id).length;

  const allPeople = candidates.flatMap((c) => c.contacts || []);
  const withEmail = allPeople.filter((p) => p.email).length;
  const alreadyIn = candidates.filter((c) => c.match && !c.imported_company_id).length;
  const importedCount = candidates.filter((c) => c.imported_company_id).length;

  const runImport = () =>
    importMutation.mutate(
      { candidateIds, contactIds },
      {
        onSuccess: () => {
          setCompanies(new Set());
          setPeople(new Set());
        },
      }
    );

  if (!candidates.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center">
        <Building2 className="h-10 w-10 text-gray-300" />
        <p className="mt-3 text-sm font-medium text-gray-900">No companies found in this document</p>
        <p className="mt-1 max-w-md text-sm text-gray-500">
          Try a file that lists company names, websites or contact emails — for example an exhibitor list or a CRM export.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Companies found" value={candidates.length} />
        <Stat label="People found" value={allPeople.length} />
        <Stat label="With an email" value={withEmail} />
        <Stat label="Imported so far" value={importedCount} tone={importedCount ? 'text-green-700' : 'text-gray-900'} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-600">
          Tick the companies and people to bring into Prospect.
          {alreadyIn > 0 && (
            <span className="text-gray-500"> {alreadyIn} already exist — importing merges into them.</span>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!candidateIds.length || importMutation.isPending}
            onClick={runImport}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-600 disabled:opacity-50"
          >
            {importMutation.isPending && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            )}
            {importMutation.isPending
              ? 'Importing…'
              : `Import ${newCompanies} compan${newCompanies === 1 ? 'y' : 'ies'} · ${contactIds.length} ${contactIds.length === 1 ? 'person' : 'people'}`}
          </button>
          <button
            type="button"
            disabled={!canContinue}
            onClick={onContinue}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium shadow-sm disabled:opacity-50',
              canContinue
                ? 'bg-purple-600 text-white hover:bg-purple-700'
                : 'border border-gray-200 bg-white text-gray-700'
            )}
          >
            Next: draft emails
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      {!canContinue && (
        <p className="text-xs text-gray-500">Import at least one person with an email address to draft emails.</p>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={allSelected}
                  onChange={toggleAll}
                  disabled={!selectable.length}
                  className="h-4 w-4 rounded border-gray-300"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Company</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">People</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Location</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Found in</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Confidence</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {candidates.map((c) => {
              const imported = Boolean(c.imported_company_id);
              const canPick = isSelectable(c);
              return (
                <tr key={c.id} className={cn('align-top', canPick && 'hover:bg-gray-50')} data-testid="candidate-row">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Select ${c.name}`}
                      checked={canPick ? companies.has(c.id) : true}
                      disabled={!canPick}
                      onChange={() => toggleCompany(c)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-900">{c.name}</p>
                    {c.domain && <p className="text-xs text-gray-500">{c.domain}</p>}
                    {c.industry && <p className="text-xs text-gray-400">{c.industry}</p>}
                  </td>
                  <td className="px-4 py-3">
                    {(c.contacts || []).length === 0 ? (
                      <span className="text-sm text-gray-400">No people listed</span>
                    ) : (
                      <ul className="space-y-1.5">
                        {c.contacts.map((p) => {
                          const done = Boolean(p.imported_contact_id);
                          return (
                            <li key={p.id} className="text-xs text-gray-700">
                              <label className="flex cursor-pointer items-start gap-2">
                                {done ? (
                                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-green-500" aria-label="Imported" />
                                ) : (
                                  <input
                                    type="checkbox"
                                    aria-label={`Select ${personName(p)}`}
                                    checked={people.has(p.id)}
                                    onChange={() => togglePerson(c, p)}
                                    className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300"
                                  />
                                )}
                                <span>
                                  <span className="inline-flex items-center gap-1">
                                    <User className="h-3 w-3 text-gray-400" />
                                    <span className="font-medium">{personName(p)}</span>
                                    {p.title && <span className="text-gray-400">· {p.title}</span>}
                                  </span>
                                  {p.email ? (
                                    <span className="flex items-center gap-1 text-gray-500">
                                      <Mail className="h-3 w-3" />
                                      {p.email}
                                    </span>
                                  ) : (
                                    <span className="block text-gray-400">no email — can&apos;t be emailed</span>
                                  )}
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                    {[c.city, c.state, c.country].filter(Boolean).join(', ') || '--'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{c.source_ref}</td>
                  <td className="px-4 py-3">
                    <ConfidenceBadge value={c.confidence} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {imported ? (
                      <Link
                        to={`/companies/${c.imported_company_id}`}
                        className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 hover:bg-green-100"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Imported
                      </Link>
                    ) : c.match ? (
                      <Link
                        to={`/companies/${c.match.matched_company_id}`}
                        className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-200"
                        title="Importing merges into the existing company"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Already in Prospect
                      </Link>
                    ) : (
                      <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">New</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {doc.stats?.ungrounded_fields_dropped > 0 && (
        <p className="text-xs text-gray-500">
          {doc.stats.ungrounded_fields_dropped} email/website/phone value(s) the AI suggested weren&apos;t in the document
          and were left out.
        </p>
      )}
    </div>
  );
}
