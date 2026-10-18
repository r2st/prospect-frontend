import { useState } from 'react';
import { useSetProspectContact } from '../../hooks/useCampaigns';

const field =
  'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

/**
 * Edit the person behind a prospect — or add one where discovery found nobody.
 * A new or changed email is verified with Hunter again before it can be sent,
 * and a changed name or email rewrites the unapproved draft.
 */
export default function ContactEditModal({ campaignId, prospect, onClose }) {
  const adding = !prospect.contact_id;
  const [form, setForm] = useState({
    first_name: prospect.contact_first_name || '',
    last_name: prospect.contact_last_name || '',
    title: prospect.contact_title || '',
    email: prospect.contact_email || '',
  });
  const save = useSetProspectContact(campaignId);
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.first_name.trim()) return;
    try {
      await save.mutateAsync({
        prospectId: prospect.id,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim() || null,
        title: form.title.trim() || null,
        email: form.email.trim() || null,
      });
      onClose();
    } catch {
      // The hook's onError has said why; stay open so it can be corrected.
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true"
      aria-label={adding ? 'Add contact' : 'Edit contact'}>
      <form onSubmit={submit} className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-semibold text-gray-900">
          {adding ? `Add a contact at ${prospect.company_name}` : `Edit ${prospect.contact_name || 'contact'}`}
        </h3>
        <p className="mt-1 text-sm text-gray-600">
          {prospect.company_name}{prospect.company_domain ? ` · ${prospect.company_domain}` : ''}.
          A new or changed email is verified with Hunter before anything is sent, and the draft is rewritten for the new details.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            <input className={field} value={form.title} onChange={set('title')} />
          </label>
          <label className="text-xs font-medium text-gray-600">
            Email
            <input className={field} type="email" value={form.email} onChange={set('email')}
              placeholder={prospect.company_domain ? `name@${prospect.company_domain}` : 'name@company.com'} />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" disabled={!form.first_name.trim() || save.isPending}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            {save.isPending ? 'Saving…' : 'Save contact'}
          </button>
        </div>
      </form>
    </div>
  );
}
