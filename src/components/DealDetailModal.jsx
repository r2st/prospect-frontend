import { useState, useEffect } from 'react';
import {
  X, DollarSign, Calendar, Clock, Building2, User, FileText,
  CheckCircle2, XCircle, ChevronDown, Send, ArrowRight, Pencil,
  MessageSquare, Activity,
} from 'lucide-react';
import { cn, formatCurrency, formatDate, timeAgo } from '../lib/utils';
import {
  DEAL_STATUSES, DEAL_STATUS_LABELS, DEAL_STATUS_COLORS,
  DEAL_STAGES, DEAL_STAGE_LABELS, DEAL_STAGE_PROBABILITIES,
  DEAL_STAGE_COLORS, LOST_REASONS,
} from '../lib/constants';
import { useDealNotes, useDealActivity, useAddDealNote } from '../hooks/useDeals';

function daysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  const ms = new Date().setHours(0, 0, 0, 0) - d.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

function ConfirmButtons({ label, variant, onConfirm, onCancel }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-600">{label}</span>
      <button
        type="button"
        onClick={onConfirm}
        className={cn(
          'rounded-lg px-3 py-1.5 text-sm font-medium text-white',
          variant === 'green' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
        )}
      >
        Confirm
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        Cancel
      </button>
    </div>
  );
}

function ActivityItem({ item }) {
  const iconMap = {
    created: <DollarSign className="h-4 w-4 text-blue-500" />,
    stage_change: <ArrowRight className="h-4 w-4 text-purple-500" />,
    status_changed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    value_changed: <DollarSign className="h-4 w-4 text-amber-500" />,
    note_added: <MessageSquare className="h-4 w-4 text-gray-500" />,
  };
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
        {iconMap[item.activity_type] || <Activity className="h-4 w-4 text-gray-400" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-gray-700">{item.description || item.activity_type}</p>
        <p className="text-xs text-gray-400">{timeAgo(item.created_at)}</p>
      </div>
    </div>
  );
}

export default function DealDetailModal({ open, onClose, deal, onUpdate, onDelete, updating }) {
  const [activeTab, setActiveTab] = useState('details');
  const [editField, setEditField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [noteText, setNoteText] = useState('');
  const [confirmAction, setConfirmAction] = useState(null); // 'won' | 'lost'
  const [lostReason, setLostReason] = useState('');
  const [lostReasonText, setLostReasonText] = useState('');

  const { data: notes = [] } = useDealNotes(open ? deal?.id : null);
  const { data: activity = [] } = useDealActivity(open ? deal?.id : null);
  const addNote = useAddDealNote();

  useEffect(() => {
    if (open) {
      setActiveTab('details');
      setEditField(null);
      setConfirmAction(null);
      setNoteText('');
      setLostReason('');
      setLostReasonText('');
    }
  }, [open, deal?.id]);

  if (!open || !deal) return null;

  const daysInPipeline = daysSince(deal.created_at);
  const stageColor = DEAL_STAGE_COLORS[deal.deal_stage] || {};
  const statusColor = DEAL_STATUS_COLORS[deal.status] || DEAL_STATUS_COLORS.pending;
  const probability = DEAL_STAGE_PROBABILITIES[deal.deal_stage] || 0;

  const handleInlineEdit = (field, current) => {
    setEditField(field);
    setEditValue(current ?? '');
  };

  const saveInlineEdit = () => {
    if (!editField) return;
    let val = editValue;
    if (editField === 'value') val = val === '' ? null : Number(val);
    if (editField === 'close_date') val = val || null;
    onUpdate({ id: deal.id, data: { [editField]: val } });
    setEditField(null);
  };

  const handleStageChange = (newStage) => {
    onUpdate({ id: deal.id, data: { deal_stage: newStage } });
  };

  const handleMarkWon = () => {
    onUpdate({ id: deal.id, data: { status: 'won', close_date: new Date().toISOString() } });
    setConfirmAction(null);
  };

  const handleMarkLost = () => {
    const reason = lostReason === 'Other' ? lostReasonText : lostReason;
    onUpdate({ id: deal.id, data: { status: 'lost', lost_reason: reason || null, close_date: new Date().toISOString() } });
    setConfirmAction(null);
  };

  const handleAddNote = (e) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    addNote.mutate({ dealId: deal.id, content: noteText.trim() });
    setNoteText('');
  };

  const tabs = [
    { key: 'details', label: 'Details' },
    { key: 'notes', label: 'Notes', count: notes.length },
    { key: 'activity', label: 'Activity', count: activity.length },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative flex max-h-[95vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-h-[90vh] sm:rounded-xl">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-gray-200 px-6 py-4">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              {editField === 'title' ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="rounded-lg border border-blue-300 px-2 py-1 text-lg font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') saveInlineEdit(); if (e.key === 'Escape') setEditField(null); }}
                  />
                  <button onClick={saveInlineEdit} className="text-sm text-blue-600 hover:text-blue-700">Save</button>
                  <button onClick={() => setEditField(null)} className="text-sm text-gray-400 hover:text-gray-600">Cancel</button>
                </div>
              ) : (
                <h2
                  className="group cursor-pointer truncate text-lg font-semibold text-gray-900"
                  onClick={() => handleInlineEdit('title', deal.title)}
                >
                  {deal.title}
                  <Pencil className="ml-2 inline h-3.5 w-3.5 text-gray-300 opacity-0 transition group-hover:opacity-100" />
                </h2>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', statusColor.bg, statusColor.text)}>
                  {DEAL_STATUS_LABELS[deal.status] || deal.status}
                </span>
                <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', stageColor.bg, stageColor.text)}>
                  {DEAL_STAGE_LABELS[deal.deal_stage] || deal.deal_stage} ({probability}%)
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="ml-4 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Deal value - large prominent display */}
          <div className="mt-4 flex items-baseline gap-3">
            {editField === 'value' ? (
              <div className="flex items-center gap-2">
                <span className="text-gray-400">$</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-40 rounded-lg border border-blue-300 px-2 py-1 text-2xl font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') saveInlineEdit(); if (e.key === 'Escape') setEditField(null); }}
                />
                <button onClick={saveInlineEdit} className="text-sm text-blue-600 hover:text-blue-700">Save</button>
                <button onClick={() => setEditField(null)} className="text-sm text-gray-400 hover:text-gray-600">Cancel</button>
              </div>
            ) : (
              <span
                className="group cursor-pointer text-3xl font-bold text-gray-900"
                onClick={() => handleInlineEdit('value', deal.value ?? '')}
              >
                {formatCurrency(deal.value)}
                <Pencil className="ml-2 inline h-3.5 w-3.5 text-gray-300 opacity-0 transition group-hover:opacity-100" />
              </span>
            )}
            <span className="text-sm text-gray-400">{deal.currency}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-shrink-0 border-b border-gray-200 px-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'relative px-4 py-3 text-sm font-medium transition-colors',
                activeTab === tab.key
                  ? 'text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gray-100 px-1.5 text-xs font-medium text-gray-600">
                  {tab.count}
                </span>
              )}
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-blue-600" />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {activeTab === 'details' && (
            <div className="space-y-5">
              {/* Stage selector */}
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">Deal Stage</label>
                <div className="flex flex-wrap gap-1.5">
                  {DEAL_STAGES.map((s) => {
                    const sc = DEAL_STAGE_COLORS[s] || {};
                    const isActive = deal.deal_stage === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleStageChange(s)}
                        disabled={updating}
                        className={cn(
                          'rounded-lg px-3 py-1.5 text-sm font-medium transition-all',
                          isActive
                            ? `${sc.bg} ${sc.text} ring-2 ring-offset-1`
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        )}
                        style={isActive ? { '--tw-ring-color': sc.hex } : undefined}
                      >
                        {DEAL_STAGE_LABELS[s]} ({DEAL_STAGE_PROBABILITIES[s]}%)
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                    <Calendar className="h-3.5 w-3.5" />
                    Created
                  </div>
                  <p className="mt-1 text-sm font-medium text-gray-900">{formatDate(deal.created_at)}</p>
                </div>
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                    <Clock className="h-3.5 w-3.5" />
                    Last Updated
                  </div>
                  <p className="mt-1 text-sm font-medium text-gray-900">{timeAgo(deal.updated_at)}</p>
                </div>
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                    <Clock className="h-3.5 w-3.5" />
                    Days in Pipeline
                  </div>
                  <p className={cn(
                    'mt-1 text-sm font-bold',
                    daysInPipeline == null ? 'text-gray-400' :
                    daysInPipeline < 7 ? 'text-green-600' :
                    daysInPipeline < 14 ? 'text-amber-600' : 'text-red-600'
                  )}>
                    {daysInPipeline != null ? `${daysInPipeline}d` : '--'}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                    <Calendar className="h-3.5 w-3.5" />
                    Close Date
                  </div>
                  {editField === 'close_date' ? (
                    <div className="mt-1 flex items-center gap-1">
                      <input
                        type="date"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="rounded border border-blue-300 px-1 py-0.5 text-sm focus:outline-none"
                        autoFocus
                      />
                      <button onClick={saveInlineEdit} className="text-xs text-blue-600">Save</button>
                      <button onClick={() => setEditField(null)} className="text-xs text-gray-400">Cancel</button>
                    </div>
                  ) : (
                    <p
                      className="group mt-1 cursor-pointer text-sm font-medium text-gray-900"
                      onClick={() => handleInlineEdit('close_date', deal.close_date ? String(deal.close_date).slice(0, 10) : '')}
                    >
                      {deal.close_date ? formatDate(deal.close_date) : 'Not set'}
                      <Pencil className="ml-1 inline h-3 w-3 text-gray-300 opacity-0 transition group-hover:opacity-100" />
                    </p>
                  )}
                </div>
              </div>

              {/* Notes inline */}
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500">Notes</label>
                {editField === 'notes' ? (
                  <div className="space-y-2">
                    <textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-blue-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button onClick={saveInlineEdit} className="text-sm text-blue-600 hover:text-blue-700">Save</button>
                      <button onClick={() => setEditField(null)} className="text-sm text-gray-400 hover:text-gray-600">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <p
                    className="group cursor-pointer rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700"
                    onClick={() => handleInlineEdit('notes', deal.notes || '')}
                  >
                    {deal.notes || 'Click to add notes...'}
                    <Pencil className="ml-1 inline h-3 w-3 text-gray-300 opacity-0 transition group-hover:opacity-100" />
                  </p>
                )}
              </div>

              {/* Lost reason (if lost) */}
              {deal.status === 'lost' && deal.lost_reason && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-red-600">Lost Reason</p>
                  <p className="mt-1 text-sm text-red-800">{deal.lost_reason}</p>
                </div>
              )}

              {/* Action buttons */}
              {deal.status === 'pending' && (
                <div className="flex flex-wrap gap-3 border-t border-gray-100 pt-4">
                  {confirmAction === 'won' ? (
                    <ConfirmButtons
                      label="Mark as Won?"
                      variant="green"
                      onConfirm={handleMarkWon}
                      onCancel={() => setConfirmAction(null)}
                    />
                  ) : confirmAction === 'lost' ? (
                    <div className="w-full space-y-3">
                      <p className="text-sm font-medium text-gray-700">Mark as Lost - Select reason:</p>
                      <div className="flex flex-wrap gap-2">
                        {LOST_REASONS.map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setLostReason(r)}
                            className={cn(
                              'rounded-lg px-3 py-1.5 text-sm font-medium transition',
                              lostReason === r
                                ? 'bg-red-100 text-red-700 ring-2 ring-red-300'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            )}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                      {lostReason === 'Other' && (
                        <input
                          type="text"
                          value={lostReasonText}
                          onChange={(e) => setLostReasonText(e.target.value)}
                          placeholder="Specify reason..."
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                          autoFocus
                        />
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleMarkLost}
                          disabled={!lostReason}
                          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          Confirm Lost
                        </button>
                        <button
                          type="button"
                          onClick={() => { setConfirmAction(null); setLostReason(''); setLostReasonText(''); }}
                          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setConfirmAction('won')}
                        className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Mark as Won
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmAction('lost')}
                        className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700"
                      >
                        <XCircle className="h-4 w-4" />
                        Mark as Lost
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-4">
              {/* Add note form */}
              <form onSubmit={handleAddNote} className="flex gap-2">
                <input
                  type="text"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add a note..."
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={!noteText.trim() || addNote.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  Add
                </button>
              </form>

              {/* Notes list */}
              {notes.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-400">No notes yet. Add one above.</div>
              ) : (
                <div className="space-y-3">
                  {notes.map((note) => (
                    <div key={note.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
                      <p className="mt-2 text-xs text-gray-400">{timeAgo(note.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'activity' && (
            <div>
              {activity.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-400">No activity recorded yet.</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {activity.map((item) => (
                    <ActivityItem key={item.id} item={item} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
