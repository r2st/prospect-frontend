import { useState, useRef, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Send, ChevronDown, Mail, Loader2, Check } from 'lucide-react';
import { useSequences, useEnrollContact } from '../hooks/useOutreach';
import { useCompanyContacts } from '../hooks/useContacts';
import { pickPrimaryContact, contactLabel, cn } from '../lib/utils';

/**
 * One-click sequence enrollment. Shows a dropdown of available sequences and
 * auto-selects the company's primary contact (changeable). Pass `contacts` if
 * you already have them (CompanyDetail); otherwise they're fetched lazily by
 * companyId when the menu opens (Companies list rows).
 */
export default function EnrollSequenceMenu({
  companyId,
  contacts: contactsProp,
  size = 'md',
  label = 'Enroll in Sequence',
  align = 'right',
  onEnrolled,
}) {
  const [open, setOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [pendingSeq, setPendingSeq] = useState(null);
  const ref = useRef(null);

  const { data: sequences = [] } = useSequences();
  // Only fetch contacts lazily (when opened) if they weren't supplied.
  const needFetch = !contactsProp && open && !!companyId;
  const { data: fetchedContacts = [], isLoading: contactsLoading } = useCompanyContacts(needFetch ? companyId : null);
  const contacts = contactsProp || fetchedContacts;
  const enroll = useEnrollContact();

  const primary = useMemo(() => pickPrimaryContact(contacts), [contacts]);
  const selectedContact =
    contacts.find((c) => String(c.id) === String(selectedContactId)) || primary;

  useEffect(() => {
    if (open && primary && selectedContactId == null) setSelectedContactId(primary.id);
  }, [open, primary, selectedContactId]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const handleEnroll = (sequence) => {
    if (!selectedContact) {
      toast.error('This company has no contacts to enroll');
      return;
    }
    setPendingSeq(sequence.id);
    enroll.mutate(
      { contact_id: selectedContact.id, sequence_id: sequence.id },
      {
        onSuccess: () => {
          toast.success(`${contactLabel(selectedContact)} enrolled in "${sequence.name}"`);
          setOpen(false);
          onEnrolled?.(sequence, selectedContact);
        },
        onSettled: () => setPendingSeq(null),
      }
    );
  };

  const sizeCls = size === 'sm'
    ? 'px-2.5 py-1.5 text-xs'
    : 'px-3 py-2 text-sm';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 font-medium text-white shadow-sm hover:bg-indigo-600',
          sizeCls
        )}
      >
        <Send className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        {label}
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div className={cn(
          'absolute top-full z-20 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 bg-white shadow-lg',
          align === 'right' ? 'right-0' : 'left-0'
        )}>
          {/* Contact picker */}
          <div className="border-b border-gray-100 p-3">
            <label className="mb-1 block text-xs font-medium text-gray-500">Enroll contact</label>
            {contactsLoading ? (
              <div className="flex items-center gap-2 py-1 text-sm text-gray-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading contacts…
              </div>
            ) : contacts.length === 0 ? (
              <p className="py-1 text-sm text-gray-400">No contacts — add one first.</p>
            ) : (
              <select
                value={selectedContact?.id || ''}
                onChange={(e) => setSelectedContactId(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {contactLabel(c)}{!c.email ? ' (no email)' : ''}{c.is_primary ? ' • primary' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Sequence list */}
          <div className="max-h-64 overflow-y-auto py-1">
            {sequences.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-500">No sequences available.</p>
            ) : (
              sequences.map((seq) => (
                <button
                  key={seq.id}
                  type="button"
                  disabled={enroll.isPending || contacts.length === 0}
                  onClick={() => handleEnroll(seq)}
                  className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {pendingSeq === seq.id ? (
                    <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-blue-500" />
                  ) : (
                    <Mail className="h-4 w-4 flex-shrink-0 text-gray-400" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{seq.name}</span>
                    <span className="block text-xs text-gray-500">{seq.steps?.length || 0} steps</span>
                  </span>
                </button>
              ))
            )}
          </div>

          {selectedContact && (
            <div className="flex items-center gap-1.5 border-t border-gray-100 px-4 py-2 text-xs text-gray-400">
              <Check className="h-3 w-3 text-green-500" />
              Will enroll {contactLabel(selectedContact)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
