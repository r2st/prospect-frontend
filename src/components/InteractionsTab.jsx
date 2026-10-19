import { useState, useMemo } from 'react';
import {
  Plus, Trash2, Phone, Video, Mail, StickyNote, CalendarClock,
} from 'lucide-react';
import EmptyState from './EmptyState';
import { useCompanyInteractions, useCreateInteraction, useDeleteInteraction } from '../hooks/useInteractions';
import { INTERACTION_TYPES, INTERACTION_TYPE_LABELS, INTERACTION_TYPE_COLORS } from '../lib/constants';
import { formatDate, timeAgo, cn } from '../lib/utils';

const typeIcons = {
  meeting: Video,
  call: Phone,
  email: Mail,
  note: StickyNote,
};

function AddInteractionForm({ onAdd, saving }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('meeting');
  const [content, setContent] = useState('');
  const [hasFollowUp, setHasFollowUp] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');

  const reset = () => {
    setType('meeting'); setContent(''); setHasFollowUp(false); setFollowUpDate('');
  };

  const submit = (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    onAdd(
      {
        type,
        content: content.trim(),
        follow_up_date: hasFollowUp && followUpDate ? followUpDate : null,
      },
      () => { reset(); setOpen(false); }
    );
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-600"
      >
        <Plus className="h-4 w-4" />
        Log Interaction
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="flex flex-wrap gap-1.5">
        {INTERACTION_TYPES.map((t) => {
          const Icon = typeIcons[t];
          const active = type === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                active ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
              )}
            >
              <Icon className="h-4 w-4" />
              {INTERACTION_TYPE_LABELS[t]}
            </button>
          );
        })}
      </div>
      <textarea
        rows={3}
        autoFocus
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="What was discussed? Key points, decisions, next steps…"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={hasFollowUp}
            onChange={(e) => setHasFollowUp(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600"
          />
          Set a follow-up date
        </label>
        {hasFollowUp && (
          <input
            type="date"
            value={followUpDate}
            onChange={(e) => setFollowUpDate(e.target.value)}
            className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        )}
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => { reset(); setOpen(false); }} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Cancel
        </button>
        <button type="submit" disabled={saving || !content.trim()} className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50">
          Save
        </button>
      </div>
    </form>
  );
}

export default function InteractionsTab({ companyId }) {
  const { data: interactions = [], isLoading } = useCompanyInteractions(companyId);
  const createInteraction = useCreateInteraction();
  const deleteInteraction = useDeleteInteraction();
  const [filter, setFilter] = useState('');

  const when = (i) => i.occurred_at || i.created_at || i.date;

  const sorted = useMemo(() => {
    const list = filter ? interactions.filter((i) => i.type === filter) : interactions;
    return [...list].sort((a, b) => new Date(when(b)) - new Date(when(a)));
  }, [interactions, filter]);

  const handleAdd = (payload, done) => {
    createInteraction.mutate({ company_id: companyId, ...payload }, { onSuccess: done });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilter('')}
            className={cn('rounded-lg border px-2.5 py-1 text-xs font-medium', !filter ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50')}
          >
            All
          </button>
          {INTERACTION_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFilter(filter === t ? '' : t)}
              className={cn('rounded-lg border px-2.5 py-1 text-xs font-medium', filter === t ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50')}
            >
              {INTERACTION_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
        <AddInteractionForm onAdd={handleAdd} saving={createInteraction.isPending} />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600" />
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={StickyNote}
          title={filter ? `No ${INTERACTION_TYPE_LABELS[filter].toLowerCase()} interactions` : 'No interactions logged'}
          description="Log meetings, calls, and notes to build a relationship history."
        />
      ) : (
        <div className="relative ml-4 border-l-2 border-gray-200 pl-6">
          {sorted.map((i) => {
            const Icon = typeIcons[i.type] || StickyNote;
            const palette = INTERACTION_TYPE_COLORS[i.type] || INTERACTION_TYPE_COLORS.note;
            return (
              <div key={i.id} className="group relative mb-5">
                <div className={cn('absolute -left-[33px] flex h-6 w-6 items-center justify-center rounded-full', palette.bg, palette.text)}>
                  <Icon className="h-3 w-3" />
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{INTERACTION_TYPE_LABELS[i.type] || 'Note'}</span>
                      <span className="text-xs text-gray-400">{timeAgo(when(i))}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteInteraction.mutate(i.id)}
                      title="Delete"
                      className="rounded-md p-1 text-gray-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {i.content && <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{i.content}</p>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                    <span>{formatDate(when(i))}</span>
                    {i.follow_up_date && (
                      <span className="inline-flex items-center gap-1 text-amber-600">
                        <CalendarClock className="h-3 w-3" />
                        Follow up {formatDate(i.follow_up_date)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
