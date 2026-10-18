import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAddManualProspect } from '../../hooks/useCampaigns';

const EMPTY = { company_name: '', domain: '', first_name: '', last_name: '', title: '', email: '' };

const field =
  'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

/**
 * Add one person to a campaign by hand. They also join the contact database.
 * With no email, Hunter looks for one at the company's website; either way the
 * address is verified before anything is drafted or sent.
 */
export default function AddContactModal({ campaignId, onClose, initial = null }) {
  // `initial` prefills the company, for "add another contact at this company".
  const [form, setForm] = useState({ ...EMPTY, ...(initial || {}) });
  const add = useAddManualProspect(campaignId);
  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));
  const noWayToEmail = !form.email.trim() && !form.domain.trim();
  const valid = form.company_name.trim() && form.first_name.trim() && !noWayToEmail;

  const submit = async (e) => {
    e.preventDefault();
    if (!valid) return;
    const body = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, v.trim() || null]).filter(([, v]) => v !== null),
    );
    const result = await add.mutateAsync(body);
    if (result?.queued) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-label="Add a contact">
      <form onSubmit={submit} className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-semibold text-gray-900">
          {initial?.company_name ? `Add another contact at ${initial.company_name}` : 'Add a contact to this campaign'}
        </h3>
        <p className="mt-1 text-sm text-gray-600">
          No email? Give the company&apos;s website and Hunter will look for one. Every address is verified before anything is sent. To add people you already have,{' '}
          <Link to="/contacts" className="font-medium text-indigo-600 hover:underline">pick them from Contacts</Link>.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-gray-600">
            Company name *
            <input className={field} value={form.company_name} onChange={set('company_name')} required />
          </label>
          <label className="text-xs font-medium text-gray-600">
            Company website
            <input className={field} value={form.domain} onChange={set('domain')} placeholder="acme.com" />
          </label>
          <label className="text-xs font-medium text-gray-600">
            First name *
            <input className={field} value={form.first_name} onChange={set('first_name')} required />
          </label>
          <label className="text-xs font-medium text-gray-600">
            Last name
            <input className={field} value={form.last_name} onChange={set('last_name')} />
          </label>
          <label className="text-xs font-medium text-gray-600">
            Title
            <input className={field} value={form.title} onChange={set('title')} placeholder="Head of Operations" />
          </label>
          <label className="text-xs font-medium text-gray-600">
            Email
            <input className={field} type="email" value={form.email} onChange={set('email')} placeholder="name@acme.com" />
          </label>
        </div>
        {noWayToEmail && (form.company_name || form.first_name) && (
          <p className="mt-2 text-xs text-amber-700">Add an email, or the company&apos;s website so Hunter can find one.</p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!valid || add.isPending}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {add.isPending ? 'Adding…' : 'Add contact'}
          </button>
        </div>
      </form>
    </div>
  );
}
