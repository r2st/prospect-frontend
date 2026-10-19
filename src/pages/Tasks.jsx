import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  CheckSquare, Plus, Search, List, Calendar as CalendarIcon, Check, Pencil, Trash2,
  Building2, AlertTriangle, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  ArrowUpDown, MousePointerClick, X, Repeat, LayoutGrid, GripVertical, ArrowRight,
  Timer, Play, Pause, Sun, ListChecks, CopyPlus,
} from 'lucide-react';
import EmptyState from '../components/EmptyState';
import TaskFormModal from '../components/TaskFormModal';
import { useTasks, useCreateTask, useUpdateTask, useDeleteTask } from '../hooks/useTasks';
import { useCompanies } from '../hooks/useCompanies';
import {
  TASK_PRIORITIES, TASK_PRIORITY_LABELS, TASK_PRIORITY_COLORS,
  TASK_STATUSES, TASK_STATUS_LABELS,
} from '../lib/constants';
import { formatDate, daysUntil, cn } from '../lib/utils';

const isDone = (t) => t.status === 'completed' || t.status === 'done';

// ─── Checklist parser ─────────────────────────────────────────────────────
function parseChecklist(description) {
  if (!description) return null;
  const lines = description.split('\n');
  let total = 0, checked = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- [x]') || trimmed.startsWith('- [X]')) { total++; checked++; }
    else if (trimmed.startsWith('- [ ]')) { total++; }
  }
  return total > 0 ? { total, checked } : null;
}

const SORT_OPTIONS = [
  { value: 'due_date', label: 'Due Date' },
  { value: 'priority', label: 'Priority (High First)' },
  { value: 'created', label: 'Created Date (Newest)' },
  { value: 'title', label: 'Title (A-Z)' },
];

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

function PriorityDot({ priority }) {
  const c = TASK_PRIORITY_COLORS[priority] || TASK_PRIORITY_COLORS.medium;
  return <span className={cn('h-2 w-2 flex-shrink-0 rounded-full', c.dot)} />;
}

// ─── Progress Bar ──────────────────────────────────────────────────────────

function ProgressBar({ total, completed }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden">
        <div
          className="h-full rounded-full bg-green-500 transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium text-gray-500 whitespace-nowrap">{pct}% done</span>
    </div>
  );
}

// ─── Subtask Progress ─────────────────────────────────────────────────────

function SubtaskProgress({ description }) {
  const info = parseChecklist(description);
  if (!info) return null;
  const pct = Math.round((info.checked / info.total) * 100);
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <ListChecks className="h-3 w-3 text-gray-400" />
      <div className="h-1.5 w-16 rounded-full bg-gray-200 overflow-hidden">
        <div
          className="h-full rounded-full bg-blue-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-gray-400">{info.checked}/{info.total}</span>
    </div>
  );
}

// ─── Time Tracker ─────────────────────────────────────────────────────────

function TimeTracker({ taskId, timers, onToggle }) {
  const entry = timers[taskId] || { elapsed: 0, running: false };
  const mm = String(Math.floor(entry.elapsed / 60)).padStart(2, '0');
  const ss = String(entry.elapsed % 60).padStart(2, '0');
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(taskId); }}
      className="group inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-mono text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-colors"
      title={entry.running ? 'Pause timer' : 'Start timer'}
    >
      {entry.running ? <Pause className="h-2.5 w-2.5" /> : <Play className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />}
      <Timer className="h-2.5 w-2.5 group-hover:hidden" />
      {mm}:{ss}
    </button>
  );
}

// ─── Quick Add Form ─────────────────────────────────────────────────────────

function QuickAddForm({ onAdd, isAdding }) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [recurringFreq, setRecurringFreq] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    const payload = { title: trimmed, priority, due_date: dueDate || null, status: 'open' };
    if (recurringFreq) {
      payload.recurring = true;
      payload.recurring_frequency = recurringFreq;
    }
    onAdd(
      payload,
      () => { setTitle(''); setPriority('medium'); setDueDate(''); setRecurringFreq(''); }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2 border-b border-gray-100 bg-gray-50/60 px-4 py-3">
      <input
        type="text"
        placeholder="Quick add task..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="h-9 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <select
        value={priority}
        onChange={(e) => setPriority(e.target.value)}
        className="h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {TASK_PRIORITIES.map((p) => (
          <option key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</option>
        ))}
      </select>
      <input
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        className="h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <select
        value={recurringFreq}
        onChange={(e) => setRecurringFreq(e.target.value)}
        className={cn(
          'h-9 rounded-lg border bg-white px-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500',
          recurringFreq ? 'border-purple-400 text-purple-700' : 'border-gray-300 text-gray-700'
        )}
      >
        <option value="">No repeat</option>
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
      </select>
      <button
        type="submit"
        disabled={!title.trim() || isAdding}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white shadow-sm hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Plus className="h-4 w-4" />
        Add
      </button>
    </form>
  );
}

// ─── Summary Stats Bar ──────────────────────────────────────────────────────

function StatsBar({ tasks }) {
  const stats = useMemo(() => {
    let total = 0, overdue = 0, dueToday = 0, completed = 0;
    for (const t of tasks) {
      total++;
      if (isDone(t)) { completed++; continue; }
      const d = daysUntil(t.due_date);
      if (d != null && d < 0) overdue++;
      else if (d === 0) dueToday++;
    }
    return { total, overdue, dueToday, completed };
  }, [tasks]);

  return (
    <div className="space-y-2">
      <ProgressBar total={stats.total} completed={stats.completed} />
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
          Total <span className="font-bold">{stats.total}</span>
        </span>
        {stats.overdue > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
            Overdue <span className="font-bold">{stats.overdue}</span>
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
          Due Today <span className="font-bold">{stats.dueToday}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
          Completed <span className="font-bold">{stats.completed}</span>
        </span>
      </div>
    </div>
  );
}

// ─── Task Card with expansion + selection ───────────────────────────────────

function TaskCard({
  task, onToggle, onEdit, onDelete, onOpenCompany, onNotesUpdate,
  selectMode, isSelected, onSelectToggle,
  expandedId, onExpand,
  timers = {}, onTimerToggle, onCompleteFollowUp,
}) {
  const done = isDone(task);
  const days = daysUntil(task.due_date);
  const overdue = !done && days != null && days < 0;
  const palette = TASK_PRIORITY_COLORS[task.priority] || TASK_PRIORITY_COLORS.medium;
  const isExpanded = expandedId === task.id;
  const isRecurring = task.recurring || task.task_type === 'recurring';

  const [notes, setNotes] = useState(task.notes || '');
  const [notesDirty, setNotesDirty] = useState(false);

  const handleNotesBlur = () => {
    if (notesDirty && notes !== (task.notes || '')) {
      onNotesUpdate(task, notes);
      setNotesDirty(false);
    }
  };

  return (
    <li
      className={cn(
        'border-l-4 transition-colors hover:bg-gray-50',
        done ? 'border-l-gray-200' : palette.accent,
        overdue && 'bg-red-50/40',
        isExpanded && 'bg-gray-50/60',
      )}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Checkbox or complete toggle */}
        {selectMode ? (
          <button
            type="button"
            onClick={() => onSelectToggle(task.id)}
            className={cn(
              'mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition-colors',
              isSelected
                ? 'border-blue-500 bg-blue-500 text-white'
                : 'border-gray-300 hover:border-blue-400'
            )}
          >
            {isSelected && <Check className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onToggle(task)}
            title={done ? 'Mark open' : 'Mark complete'}
            className={cn(
              'mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition-colors',
              done ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300 hover:border-green-400'
            )}
          >
            {done && <Check className="h-3.5 w-3.5" />}
          </button>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onExpand(isExpanded ? null : task.id)}
              className={cn(
                'text-sm font-medium text-left hover:text-blue-600 transition-colors',
                done ? 'text-gray-400 line-through' : 'text-gray-900'
              )}
            >
              {task.title}
            </button>
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', palette.bg, palette.text)}>
              <PriorityDot priority={task.priority} />
              {TASK_PRIORITY_LABELS[task.priority] || task.priority}
            </span>
            {isRecurring && (
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-medium text-purple-700" title="Recurring task">
                <Repeat className="h-3 w-3" />
                Recurring
              </span>
            )}
            {overdue && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">
                <AlertTriangle className="h-3 w-3" />
                Overdue
              </span>
            )}
            {isExpanded ? (
              <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
            )}
          </div>
          <SubtaskProgress description={task.description} />
          {!isExpanded && task.description && (
            <p className="mt-0.5 truncate text-sm text-gray-600">{task.description}</p>
          )}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-400">
            {task.due_date && (
              <span className={cn(overdue && 'font-medium text-red-600')}>
                Due {formatDate(task.due_date)}
                {!done && days != null && days >= 0 && days <= 7 && <span> · in {days}d</span>}
              </span>
            )}
            {(task.company_name || task.company_id) && (
              <button
                type="button"
                onClick={() => task.company_id && onOpenCompany(task.company_id)}
                className="inline-flex items-center gap-1 hover:text-blue-600"
              >
                <Building2 className="h-3 w-3" />
                {task.company_name || 'Company'}
              </button>
            )}
            {onTimerToggle && <TimeTracker taskId={task.id} timers={timers} onToggle={onTimerToggle} />}
          </div>
        </div>

        {!selectMode && (
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => onEdit(task)} title="Edit" className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
              <Pencil className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => onDelete(task)} title="Delete" className="rounded-md p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Expanded detail panel */}
      {isExpanded && (
        <div className="border-t border-gray-100 bg-gray-50/40 px-4 py-3 pl-12 space-y-3">
          {/* Description */}
          {task.description && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">Description</div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{task.description}</p>
            </div>
          )}

          {/* Notes (editable) */}
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">Notes</div>
            <textarea
              value={notes}
              onChange={(e) => { setNotes(e.target.value); setNotesDirty(true); }}
              onBlur={handleNotesBlur}
              placeholder="Add notes..."
              rows={2}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Company link */}
          {(task.company_name || task.company_id) && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">Company</div>
              <button
                type="button"
                onClick={() => task.company_id && onOpenCompany(task.company_id)}
                className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 hover:underline"
              >
                <Building2 className="h-3.5 w-3.5" />
                {task.company_name || 'View Company'}
              </button>
            </div>
          )}

          {/* Meta info */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
            {task.created_at && <span>Created {formatDate(task.created_at)}</span>}
            {task.updated_at && <span>Updated {formatDate(task.updated_at)}</span>}
          </div>

          {/* Quick actions row */}
          <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
            <button
              type="button"
              onClick={() => onToggle(task)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                done
                  ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              )}
            >
              <Check className="h-3.5 w-3.5" />
              {done ? 'Reopen' : 'Complete'}
            </button>
            <button
              type="button"
              onClick={() => onEdit(task)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
            <button
              type="button"
              onClick={() => onDelete(task)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
            {!done && onCompleteFollowUp && (
              <button
                type="button"
                onClick={() => onCompleteFollowUp(task)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-100 ml-auto"
              >
                <CopyPlus className="h-3.5 w-3.5" />
                Complete &amp; Follow Up
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function Section({ title, count, tone, children }) {
  if (count === 0) return null;
  return (
    <div>
      <div className={cn('border-b border-gray-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide', tone)}>
        {title} ({count})
      </div>
      <ul className="divide-y divide-gray-50">{children}</ul>
    </div>
  );
}

// ─── Bulk Action Bar ────────────────────────────────────────────────────────

function BulkActionBar({ selectedCount, onComplete, onDelete, onCancel, isProcessing }) {
  if (selectedCount === 0) return null;
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 transform">
      <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-3 shadow-lg">
        <span className="text-sm font-medium text-gray-700">{selectedCount} selected</span>
        <div className="h-5 w-px bg-gray-200" />
        <button
          type="button"
          onClick={onComplete}
          disabled={isProcessing}
          className="inline-flex items-center gap-1.5 rounded-lg bg-green-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          Mark Complete
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={isProcessing}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          title="Cancel selection"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Calendar view ───────────────────────────────────────────────────────────

function CalendarView({ tasks, onOpenCompany }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const { year, month } = cursor;
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = new Date().toDateString();

  // Bucket tasks by their due date's local date string.
  const byDay = useMemo(() => {
    const map = {};
    for (const t of tasks) {
      if (!t.due_date) continue;
      const d = new Date(t.due_date);
      if (isNaN(d)) continue;
      const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toDateString();
      (map[key] = map[key] || []).push(t);
    }
    return map;
  }, [tasks]);

  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const monthLabel = first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const shift = (delta) => {
    setCursor((c) => {
      const m = c.month + delta;
      return { year: c.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">{monthLabel}</h2>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => shift(-1)} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setCursor({ year: new Date().getFullYear(), month: new Date().getMonth() })} className="rounded-md px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100">
            Today
          </button>
          <button type="button" onClick={() => shift(1)} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
      <div className="grid grid-cols-7 gap-px min-w-[500px]">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="pb-1 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-400">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (day == null) return <div key={`empty-${i}`} className="min-h-[60px] sm:min-h-[84px] rounded-lg bg-gray-50/50" />;
          const key = new Date(year, month, day).toDateString();
          const dayTasks = byDay[key] || [];
          const isToday = key === todayKey;
          return (
            <div key={key} className={cn('min-h-[60px] sm:min-h-[84px] rounded-lg border p-1 sm:p-1.5', isToday ? 'border-blue-300 bg-blue-50/40' : 'border-gray-100')}>
              <div className={cn('mb-1 text-xs font-medium', isToday ? 'text-blue-600' : 'text-gray-500')}>{day}</div>
              <div className="space-y-1">
                {dayTasks.slice(0, 3).map((t) => {
                  const palette = TASK_PRIORITY_COLORS[t.priority] || TASK_PRIORITY_COLORS.medium;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => t.company_id && onOpenCompany(t.company_id)}
                      title={t.title}
                      className={cn('flex w-full items-center gap-1 rounded px-1.5 py-0.5 text-left text-[11px] font-medium', palette.bg, palette.text, isDone(t) && 'opacity-50 line-through')}
                    >
                      <PriorityDot priority={t.priority} />
                      <span className="truncate">{t.title}</span>
                    </button>
                  );
                })}
                {dayTasks.length > 3 && (
                  <div className="px-1.5 text-[11px] text-gray-400">+{dayTasks.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}

// ─── Kanban Board Card ──────────────────────────────────────────────────────

function KanbanCard({ task, onToggle, onEdit, onDelete, onOpenCompany, onMove, expandedId, onExpand }) {
  const done = isDone(task);
  const days = daysUntil(task.due_date);
  const overdue = !done && days != null && days < 0;
  const palette = TASK_PRIORITY_COLORS[task.priority] || TASK_PRIORITY_COLORS.medium;
  const isExpanded = expandedId === task.id;
  const isRecurring = task.recurring || task.task_type === 'recurring';
  const [moveOpen, setMoveOpen] = useState(false);

  const statusColumn = done ? 'completed' : (task.status === 'in_progress' ? 'in_progress' : 'open');
  const moveTargets = [
    { value: 'open', label: 'To Do' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Done' },
  ].filter((t) => t.value !== statusColumn);

  return (
    <div
      className={cn(
        'rounded-lg border bg-white shadow-sm transition-shadow hover:shadow-md',
        overdue ? 'border-red-200' : 'border-gray-200',
      )}
    >
      <div className="p-3">
        <div className="flex items-start gap-2">
          <GripVertical className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-300 cursor-grab" />
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => onExpand(isExpanded ? null : task.id)}
              className={cn(
                'text-sm font-medium text-left hover:text-blue-600 transition-colors w-full',
                done ? 'text-gray-400 line-through' : 'text-gray-900'
              )}
            >
              {task.title}
            </button>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', palette.bg, palette.text)}>
                <PriorityDot priority={task.priority} />
                {TASK_PRIORITY_LABELS[task.priority] || task.priority}
              </span>
              {isRecurring && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700" title="Recurring task">
                  <Repeat className="h-2.5 w-2.5" />
                </span>
              )}
              {overdue && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  Overdue
                </span>
              )}
            </div>
            {task.due_date && (
              <div className={cn('mt-1.5 text-xs', overdue ? 'font-medium text-red-600' : 'text-gray-400')}>
                Due {formatDate(task.due_date)}
              </div>
            )}
            {(task.company_name || task.company_id) && (
              <button
                type="button"
                onClick={() => task.company_id && onOpenCompany(task.company_id)}
                className="mt-1 inline-flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600"
              >
                <Building2 className="h-3 w-3" />
                {task.company_name || 'Company'}
              </button>
            )}
          </div>
        </div>

        {/* Expanded detail */}
        {isExpanded && (
          <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
            {task.description && (
              <p className="text-xs text-gray-600 whitespace-pre-wrap">{task.description}</p>
            )}
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-400">
              {task.created_at && <span>Created {formatDate(task.created_at)}</span>}
              {task.updated_at && <span>Updated {formatDate(task.updated_at)}</span>}
            </div>
            <div className="flex items-center gap-1.5 pt-1">
              <button type="button" onClick={() => onToggle(task)} className={cn('rounded px-2 py-1 text-[11px] font-medium', done ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-green-100 text-green-700 hover:bg-green-200')}>
                {done ? 'Reopen' : 'Complete'}
              </button>
              <button type="button" onClick={() => onEdit(task)} className="rounded px-2 py-1 text-[11px] font-medium bg-gray-100 text-gray-600 hover:bg-gray-200">
                Edit
              </button>
              <button type="button" onClick={() => onDelete(task)} className="rounded px-2 py-1 text-[11px] font-medium bg-red-50 text-red-600 hover:bg-red-100">
                Delete
              </button>
            </div>
          </div>
        )}

        {/* Move-to dropdown */}
        <div className="mt-2 flex items-center justify-end relative">
          <button
            type="button"
            onClick={() => setMoveOpen(!moveOpen)}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <ArrowRight className="h-3 w-3" />
            Move to
          </button>
          {moveOpen && (
            <div className="absolute right-0 top-full z-10 mt-1 min-w-[120px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              {moveTargets.map((target) => (
                <button
                  key={target.value}
                  type="button"
                  onClick={() => {
                    onMove(task, target.value);
                    setMoveOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50"
                >
                  <ArrowRight className="h-3 w-3 text-gray-400" />
                  {target.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Kanban Board View ──────────────────────────────────────────────────────

const KANBAN_COLUMNS = [
  { key: 'open', title: 'To Do', headerColor: 'bg-gray-100 text-gray-700', countColor: 'bg-gray-200 text-gray-600' },
  { key: 'in_progress', title: 'In Progress', headerColor: 'bg-blue-50 text-blue-700', countColor: 'bg-blue-200 text-blue-700' },
  { key: 'completed', title: 'Done', headerColor: 'bg-green-50 text-green-700', countColor: 'bg-green-200 text-green-700' },
];

function KanbanView({ tasks, onToggle, onEdit, onDelete, onOpenCompany, onMove, expandedId, onExpand }) {
  const columns = useMemo(() => {
    const buckets = { open: [], in_progress: [], completed: [] };
    for (const t of tasks) {
      if (isDone(t)) {
        buckets.completed.push(t);
      } else if (t.status === 'in_progress') {
        buckets.in_progress.push(t);
      } else {
        buckets.open.push(t);
      }
    }
    return buckets;
  }, [tasks]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {KANBAN_COLUMNS.map((col) => (
        <div key={col.key} className="flex flex-col rounded-xl border border-gray-200 bg-gray-50/50">
          <div className={cn('flex items-center justify-between rounded-t-xl px-4 py-2.5', col.headerColor)}>
            <span className="text-sm font-semibold">{col.title}</span>
            <span className={cn('inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold', col.countColor)}>
              {columns[col.key].length}
            </span>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-3" style={{ maxHeight: '70vh' }}>
            {columns[col.key].length === 0 ? (
              <div className="flex items-center justify-center py-8 text-xs text-gray-400">
                No tasks
              </div>
            ) : (
              columns[col.key].map((task) => (
                <KanbanCard
                  key={task.id}
                  task={task}
                  onToggle={onToggle}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onOpenCompany={onOpenCompany}
                  onMove={onMove}
                  expandedId={expandedId}
                  onExpand={onExpand}
                />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── My Day Section ───────────────────────────────────────────────────────

function MyDaySection({ tasks, onToggle, onEdit, onDelete, onOpenCompany, onNotesUpdate, expandedId, onExpand, timers, onTimerToggle, onCompleteFollowUp }) {
  const myDayTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (isDone(t)) return false;
      const d = daysUntil(t.due_date);
      return d != null && d <= 0;
    });
  }, [tasks]);

  if (myDayTasks.length === 0) return null;

  const overdueCount = myDayTasks.filter(t => { const d = daysUntil(t.due_date); return d != null && d < 0; }).length;

  const msg = `${myDayTasks.length} task${myDayTasks.length !== 1 ? 's' : ''} to tackle today`;

  return (
    <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 via-sky-50 to-cyan-50 shadow-sm overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-2 border-b border-blue-100">
        <Sun className="h-5 w-5 text-amber-500" />
        <div>
          <h2 className="text-sm font-semibold text-gray-900">My Day</h2>
          <p className="text-xs text-gray-500">{msg}</p>
        </div>
        {overdueCount > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">
            <AlertTriangle className="h-3 w-3" />
            {overdueCount} overdue
          </span>
        )}
      </div>
      <ul className="divide-y divide-blue-50">
        {myDayTasks.map((t) => (
          <TaskCard
            key={`myday-${t.id}`}
            task={t}
            onToggle={onToggle}
            onEdit={onEdit}
            onDelete={onDelete}
            onOpenCompany={onOpenCompany}
            onNotesUpdate={onNotesUpdate}
            selectMode={false}
            isSelected={false}
            onSelectToggle={() => {}}
            expandedId={expandedId}
            onExpand={onExpand}
            timers={timers}
            onTimerToggle={onTimerToggle}
            onCompleteFollowUp={onCompleteFollowUp}
          />
        ))}
      </ul>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Tasks() {
  const navigate = useNavigate();
  const [view, setView] = useState('list');
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('due_date');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  // Bulk selection state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Task time tracking
  const [taskTimers, setTaskTimers] = useState({});
  useEffect(() => {
    const interval = setInterval(() => {
      setTaskTimers((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const id of Object.keys(next)) {
          if (next[id].running) {
            next[id] = { ...next[id], elapsed: next[id].elapsed + 1 };
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleTimer = useCallback((taskId) => {
    setTaskTimers((prev) => {
      const entry = prev[taskId] || { elapsed: 0, running: false };
      return { ...prev, [taskId]: { ...entry, running: !entry.running } };
    });
  }, []);

  const { data: tasks = [], isLoading } = useTasks();
  const { data: companiesData } = useCompanies();
  const companies = companiesData?.items || [];
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  // ── Keyboard shortcut: 'n' opens add task modal ──────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore when typing in an input, textarea, select, or contenteditable
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return;
      // Ignore if modifier keys are held
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'n') {
        e.preventDefault();
        setEditing(null);
        setModalOpen(true);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (tasks || []).filter((t) => {
      if (priorityFilter && t.priority !== priorityFilter) return false;
      if (statusFilter === 'completed' && !isDone(t)) return false;
      if (statusFilter && statusFilter !== 'completed' && t.status !== statusFilter) return false;
      if (q && !(`${t.title} ${t.description || ''} ${t.company_name || ''}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [tasks, search, priorityFilter, statusFilter]);

  // Sort the filtered tasks
  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sortBy) {
      case 'priority':
        arr.sort((a, b) => {
          const pa = PRIORITY_ORDER[a.priority] ?? 1;
          const pb = PRIORITY_ORDER[b.priority] ?? 1;
          if (pa !== pb) return pa - pb;
          // Secondary sort by due date
          return (a.due_date || '9999') < (b.due_date || '9999') ? -1 : 1;
        });
        break;
      case 'created':
        arr.sort((a, b) => {
          const da = a.created_at || '';
          const db = b.created_at || '';
          return db < da ? -1 : db > da ? 1 : 0;
        });
        break;
      case 'title':
        arr.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        break;
      case 'due_date':
      default:
        // due_date is the default bucket sort; no extra sorting needed here
        // because buckets handle the ordering
        break;
    }
    return arr;
  }, [filtered, sortBy]);

  // Buckets for the list view (only used for due_date sort).
  const buckets = useMemo(() => {
    const source = sortBy === 'due_date' ? filtered : sorted;
    const overdue = [], today = [], upcoming = [], noDate = [], done = [];
    for (const t of source) {
      if (isDone(t)) { done.push(t); continue; }
      if (!t.due_date) { noDate.push(t); continue; }
      const d = daysUntil(t.due_date);
      if (d == null) noDate.push(t);
      else if (d < 0) overdue.push(t);
      else if (d === 0) today.push(t);
      else upcoming.push(t);
    }
    if (sortBy === 'due_date') {
      const byDue = (a, b) => new Date(a.due_date) - new Date(b.due_date);
      upcoming.sort(byDue);
    }
    return { overdue, today, upcoming, noDate, done };
  }, [filtered, sorted, sortBy]);

  // Flat list for non-due_date sorts
  const flatList = useMemo(() => {
    if (sortBy === 'due_date') return [];
    return sorted;
  }, [sorted, sortBy]);

  const openAdd = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (t) => { setEditing(t); setModalOpen(true); };

  const toggle = (t) => updateTask.mutate({ id: t.id, data: { status: isDone(t) ? 'open' : 'completed' } });
  const remove = (t) => deleteTask.mutate(t.id);

  const handleSubmit = (payload) => {
    if (editing) updateTask.mutate({ id: editing.id, data: payload }, { onSuccess: () => setModalOpen(false) });
    else createTask.mutate(payload, { onSuccess: () => setModalOpen(false) });
  };

  const handleQuickAdd = (payload, onDone) => {
    createTask.mutate(payload, { onSuccess: () => onDone() });
  };

  const handleNotesUpdate = useCallback((task, notes) => {
    updateTask.mutate({ id: task.id, data: { notes } });
  }, [updateTask]);

  const handleCompleteAndFollowUp = useCallback((task) => {
    updateTask.mutate({ id: task.id, data: { status: 'completed' } });
    setEditing({ title: `Follow up: ${task.title}`, priority: task.priority, company_id: task.company_id, due_date: '' });
    setModalOpen(true);
    toast.success('Task completed! Create a follow-up.');
  }, [updateTask]);

  // ── Kanban move handler ──────────────────────────────────────────────
  const handleKanbanMove = useCallback((task, newStatus) => {
    updateTask.mutate({ id: task.id, data: { status: newStatus } });
  }, [updateTask]);

  // ── Bulk selection handlers ────────────────────────────────────────────

  const toggleSelectMode = () => {
    if (selectMode) {
      setSelectMode(false);
      setSelectedIds(new Set());
    } else {
      setSelectMode(true);
      setSelectedIds(new Set());
    }
  };

  const toggleSelect = useCallback((taskId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const allOpenTaskIds = useMemo(() => {
    return filtered.filter((t) => !isDone(t)).map((t) => t.id);
  }, [filtered]);

  const allSelected = allOpenTaskIds.length > 0 && allOpenTaskIds.every((id) => selectedIds.has(id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allOpenTaskIds));
    }
  };

  const [bulkProcessing, setBulkProcessing] = useState(false);

  const bulkComplete = async () => {
    if (selectedIds.size === 0) return;
    setBulkProcessing(true);
    const ids = Array.from(selectedIds);
    let completed = 0;
    for (const id of ids) {
      try {
        await updateTask.mutateAsync({ id, data: { status: 'completed' } });
        completed++;
      } catch {
        // continue with others
      }
    }
    toast.success(`${completed} task${completed !== 1 ? 's' : ''} completed`);
    setSelectedIds(new Set());
    setSelectMode(false);
    setBulkProcessing(false);
  };

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkProcessing(true);
    const ids = Array.from(selectedIds);
    let deleted = 0;
    for (const id of ids) {
      try {
        await deleteTask.mutateAsync(id);
        deleted++;
      } catch {
        // continue with others
      }
    }
    toast.success(`${deleted} task${deleted !== 1 ? 's' : ''} deleted`);
    setSelectedIds(new Set());
    setSelectMode(false);
    setBulkProcessing(false);
  };

  const cardProps = {
    onToggle: toggle,
    onEdit: openEdit,
    onDelete: remove,
    onOpenCompany: (id) => navigate(`/companies/${id}`),
    onNotesUpdate: handleNotesUpdate,
    selectMode,
    expandedId,
    onExpand: setExpandedId,
    timers: taskTimers,
    onTimerToggle: toggleTimer,
    onCompleteFollowUp: handleCompleteAndFollowUp,
  };

  const hasFilters = search || priorityFilter || statusFilter;

  const renderTaskCard = (t) => (
    <TaskCard
      key={t.id}
      task={t}
      {...cardProps}
      isSelected={selectedIds.has(t.id)}
      onSelectToggle={toggleSelect}
    />
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <CheckSquare className="h-5 w-5 text-blue-500" />
            Tasks
          </h1>
          <p className="mt-1 text-sm text-gray-500">Follow-ups and to-dos across all your accounts.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-300 bg-white p-0.5">
            <button
              type="button"
              onClick={() => setView('list')}
              className={cn('inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium', view === 'list' ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:text-gray-700')}
            >
              <List className="h-4 w-4" /> List
            </button>
            <button
              type="button"
              onClick={() => setView('calendar')}
              className={cn('inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium', view === 'calendar' ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:text-gray-700')}
            >
              <CalendarIcon className="h-4 w-4" /> Calendar
            </button>
            <button
              type="button"
              onClick={() => setView('board')}
              className={cn('inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium', view === 'board' ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:text-gray-700')}
            >
              <LayoutGrid className="h-4 w-4" /> Board
            </button>
          </div>
          {view === 'list' && (
            <button
              type="button"
              onClick={toggleSelectMode}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                selectMode
                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                  : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
              )}
            >
              <MousePointerClick className="h-4 w-4" />
              Select
            </button>
          )}
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-600"
            title="Add Task (N)"
          >
            <Plus className="h-4 w-4" />
            Add Task
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      {!isLoading && tasks.length > 0 && <StatsBar tasks={tasks} />}

      {/* Filters + Sort */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:flex-1" style={{ minWidth: '200px', maxWidth: '360px' }}>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All Priorities</option>
          {TASK_PRIORITIES.map((p) => (
            <option key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>
          ))}
        </select>
        {view !== 'board' && (
          <div className="relative">
            <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-10 rounded-lg border border-gray-300 bg-white pl-9 pr-8 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none"
            >
              {SORT_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        )}
        {hasFilters && (
          <button type="button" onClick={() => { setSearch(''); setPriorityFilter(''); setStatusFilter(''); }} className="text-sm text-gray-500 hover:text-gray-700">
            Clear
          </button>
        )}
      </div>

      {/* Select all checkbox (when in select mode) */}
      {selectMode && view === 'list' && filtered.length > 0 && (
        <div className="flex items-center gap-2 px-1">
          <button
            type="button"
            onClick={toggleSelectAll}
            className={cn(
              'flex h-5 w-5 items-center justify-center rounded border transition-colors',
              allSelected
                ? 'border-blue-500 bg-blue-500 text-white'
                : 'border-gray-300 hover:border-blue-400'
            )}
          >
            {allSelected && <Check className="h-3.5 w-3.5" />}
          </button>
          <span className="text-sm text-gray-500">
            {allSelected ? 'Deselect all' : 'Select all open tasks'}
          </span>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
        </div>
      ) : view === 'calendar' ? (
        <CalendarView tasks={filtered} onOpenCompany={(id) => navigate(`/companies/${id}`)} />
      ) : view === 'board' ? (
        <KanbanView
          tasks={filtered}
          onToggle={toggle}
          onEdit={openEdit}
          onDelete={remove}
          onOpenCompany={(id) => navigate(`/companies/${id}`)}
          onMove={handleKanbanMove}
          expandedId={expandedId}
          onExpand={setExpandedId}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No tasks"
          description={hasFilters ? 'No tasks match your filters.' : 'Add your first task to start tracking follow-ups.'}
          action={!hasFilters ? { label: 'Add Task', onClick: openAdd } : undefined}
        />
      ) : (
        <>
        <MyDaySection
          tasks={filtered}
          onToggle={toggle}
          onEdit={openEdit}
          onDelete={remove}
          onOpenCompany={(id) => navigate(`/companies/${id}`)}
          onNotesUpdate={handleNotesUpdate}
          expandedId={expandedId}
          onExpand={setExpandedId}
          timers={taskTimers}
          onTimerToggle={toggleTimer}
          onCompleteFollowUp={handleCompleteAndFollowUp}
        />
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {/* Quick Add Form */}
          <QuickAddForm onAdd={handleQuickAdd} isAdding={createTask.isPending} />

          {sortBy === 'due_date' ? (
            <>
              <Section title="Overdue" count={buckets.overdue.length} tone="bg-red-50/40 text-red-600">
                {buckets.overdue.map(renderTaskCard)}
              </Section>
              <Section title="Today" count={buckets.today.length} tone="bg-blue-50/40 text-blue-600">
                {buckets.today.map(renderTaskCard)}
              </Section>
              <Section title="Upcoming" count={buckets.upcoming.length} tone="bg-gray-50 text-gray-500">
                {buckets.upcoming.map(renderTaskCard)}
              </Section>
              <Section title="No due date" count={buckets.noDate.length} tone="bg-gray-50 text-gray-500">
                {buckets.noDate.map(renderTaskCard)}
              </Section>
              <Section title="Completed" count={buckets.done.length} tone="bg-gray-50 text-gray-500">
                {buckets.done.map(renderTaskCard)}
              </Section>
            </>
          ) : (
            <ul className="divide-y divide-gray-50">
              {flatList.map(renderTaskCard)}
            </ul>
          )}
        </div>
        </>
      )}

      {/* Bulk Action Bar */}
      {selectMode && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          onComplete={bulkComplete}
          onDelete={bulkDelete}
          onCancel={toggleSelectMode}
          isProcessing={bulkProcessing}
        />
      )}

      <TaskFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        task={editing}
        companies={companies}
        saving={createTask.isPending || updateTask.isPending}
      />
    </div>
  );
}
