import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Bell,
  Clock,
  AlertTriangle,
  Check,
  X,
  CalendarPlus,
  Building2,
  User,
  Snowflake,
  Mail,
  AlarmClock,
  ExternalLink,
  Search,
  CalendarClock,
  TrendingUp,
  Plus,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react';
import EmptyState from '../components/EmptyState';
import {
  useFollowUps,
  useStaleContacts,
  useUpdateFollowUp,
  useDeleteFollowUp,
  useCreateFollowUp,
} from '../hooks/useFollowUps';
import { formatDate, timeAgo, cn, daysUntil } from '../lib/utils';

function daysFromNowISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function daysUntilNextMonday() {
  const today = new Date();
  const day = today.getDay(); // 0=Sun, 1=Mon, ...
  // If today is Monday (1), next Monday is 7 days away
  // If today is Tuesday (2), next Monday is 6 days away
  // If today is Sunday (0), next Monday is 1 day away
  const daysAway = day === 0 ? 1 : 8 - day;
  return daysAway;
}

function computePriorityScore(followUp) {
  let score = 0;

  // Days overdue factor (higher = more urgent)
  if (followUp.is_overdue && followUp.due_date) {
    const daysOver = Math.max(0, Math.floor((new Date() - new Date(followUp.due_date)) / (1000 * 60 * 60 * 24)));
    score += Math.min(daysOver * 10, 50); // Max 50 from overdue
  } else if (followUp.due_date) {
    const days = daysUntil(followUp.due_date);
    if (days === 0) score += 30; // Due today
    else if (days <= 2) score += 15; // Due soon
  }

  // Deal value factor
  if (followUp.deal_value) {
    score += Math.min(Math.floor(followUp.deal_value / 1000) * 5, 30);
  }

  // Company score factor
  if (followUp.company_score) {
    score += Math.min(Math.floor(followUp.company_score / 10) * 5, 20);
  }

  return Math.min(score, 100);
}

function PriorityBadge({ score }) {
  if (score === 0) return null;

  let color, label;
  if (score >= 70) {
    color = 'bg-red-100 text-red-700';
    label = 'High';
  } else if (score >= 40) {
    color = 'bg-amber-100 text-amber-700';
    label = 'Medium';
  } else {
    color = 'bg-blue-100 text-blue-700';
    label = 'Low';
  }

  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium', color)}>
      <span className="font-bold">{score}</span> {label}
    </span>
  );
}

function SkeletonRows({ rows = 4 }) {
  return (
    <div className="space-y-2 p-4">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-gray-200" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 rounded bg-gray-200" />
            <div className="h-2.5 w-1/4 rounded bg-gray-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Snooze dropdown ──────────────────────────────────────────────────────────

function SnoozeDropdown({ followUpId, onClose }) {
  const updateFollowUp = useUpdateFollowUp();
  const [showCustom, setShowCustom] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const snooze = (days) => {
    updateFollowUp.mutate(
      { id: followUpId, data: { due_date: daysFromNowISO(days) } },
      {
        onSuccess: () => {
          toast.success(`Snoozed for ${days} day${days === 1 ? '' : 's'}`);
          onClose();
        },
      }
    );
  };

  const snoozeToDate = (dateStr) => {
    if (!dateStr) return;
    const d = new Date(dateStr);
    d.setHours(12, 0, 0, 0);
    updateFollowUp.mutate(
      { id: followUpId, data: { due_date: d.toISOString() } },
      {
        onSuccess: () => {
          toast.success('Snoozed to ' + formatDate(d.toISOString()));
          onClose();
        },
      }
    );
  };

  const presets = [
    { label: 'Tomorrow', days: 1 },
    { label: 'In 3 days', days: 3 },
    { label: 'Next Monday', days: daysUntilNextMonday() },
    { label: 'Next week', days: 7 },
  ];

  // Minimum selectable date is tomorrow
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().split('T')[0];

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
    >
      {presets.map((p) => (
        <button
          key={p.label}
          type="button"
          onClick={() => snooze(p.days)}
          disabled={updateFollowUp.isPending}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <AlarmClock className="h-3.5 w-3.5 text-gray-400" />
          {p.label}
        </button>
      ))}
      <div className="my-1 border-t border-gray-100" />
      {showCustom ? (
        <div className="px-3 py-2">
          <input
            type="date"
            min={minDateStr}
            autoFocus
            onChange={(e) => snoozeToDate(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowCustom(true)}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
        >
          <CalendarClock className="h-3.5 w-3.5 text-gray-400" />
          Custom date...
        </button>
      )}
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ followUp }) {
  const f = followUp;

  if (f.status === 'completed') {
    return (
      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
        Completed
      </span>
    );
  }
  if (f.status === 'dismissed') {
    return (
      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
        Dismissed
      </span>
    );
  }
  if (f.is_overdue) {
    return (
      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
        Overdue
      </span>
    );
  }

  const days = daysUntil(f.due_date);
  if (days !== null && days === 0) {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
        Due today
      </span>
    );
  }

  return (
    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
      Upcoming
    </span>
  );
}

// ─── Summary stats ────────────────────────────────────────────────────────────

function SummaryStats({ items }) {
  const stats = useMemo(() => {
    const pending = items.filter((f) => f.status === 'pending');
    const overdue = pending.filter((f) => f.is_overdue);
    const dueToday = pending.filter(
      (f) => !f.is_overdue && daysUntil(f.due_date) === 0
    );
    const upcoming = pending.filter(
      (f) => !f.is_overdue && daysUntil(f.due_date) !== 0
    );
    return {
      total: pending.length,
      overdue: overdue.length,
      dueToday: dueToday.length,
      upcoming: upcoming.length,
    };
  }, [items]);

  const cards = [
    {
      label: 'Pending',
      value: stats.total,
      color: 'text-gray-900',
      bg: 'bg-gray-50',
      border: 'border-gray-200',
      icon: Bell,
      iconColor: 'text-gray-400',
    },
    {
      label: 'Overdue',
      value: stats.overdue,
      color: 'text-red-700',
      bg: 'bg-red-50',
      border: 'border-red-200',
      icon: AlertTriangle,
      iconColor: 'text-red-400',
    },
    {
      label: 'Due today',
      value: stats.dueToday,
      color: 'text-amber-700',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      icon: Clock,
      iconColor: 'text-amber-400',
    },
    {
      label: 'Upcoming',
      value: stats.upcoming,
      color: 'text-blue-700',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      icon: TrendingUp,
      iconColor: 'text-blue-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className={cn(
            'flex items-center gap-3 rounded-xl border px-4 py-3',
            c.bg,
            c.border
          )}
        >
          <c.icon className={cn('h-5 w-5 flex-shrink-0', c.iconColor)} />
          <div>
            <p className={cn('text-lg font-bold leading-tight', c.color)}>{c.value}</p>
            <p className="text-xs text-gray-500">{c.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Quick create follow-up form ─────────────────────────────────────────────

function QuickCreateForm() {
  const createFollowUp = useCreateFollowUp();
  const [contactSearch, setContactSearch] = useState('');
  const [reason, setReason] = useState('');
  const [dueDate, setDueDate] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!contactSearch.trim() || !dueDate) {
      toast.error('Contact/company and due date are required');
      return;
    }
    const d = new Date(dueDate);
    d.setHours(12, 0, 0, 0);
    createFollowUp.mutate(
      {
        due_date: d.toISOString(),
        reason: reason.trim() || `Follow up with ${contactSearch.trim()}`,
        notes: `Quick follow-up for: ${contactSearch.trim()}`,
      },
      {
        onSuccess: () => {
          toast.success('Follow-up created');
          setContactSearch('');
          setReason('');
          setDueDate('');
        },
      }
    );
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50/50 px-4 py-3"
    >
      <div className="min-w-[140px] flex-1">
        <label className="mb-1 block text-xs font-medium text-gray-500">
          Contact / Company
        </label>
        <input
          type="text"
          value={contactSearch}
          onChange={(e) => setContactSearch(e.target.value)}
          placeholder="Name or company..."
          className="h-8 w-full rounded-md border border-gray-300 bg-white px-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div className="min-w-[120px] flex-1">
        <label className="mb-1 block text-xs font-medium text-gray-500">Reason</label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Check on proposal"
          className="h-8 w-full rounded-md border border-gray-300 bg-white px-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div className="w-[150px]">
        <label className="mb-1 block text-xs font-medium text-gray-500">Due date</label>
        <input
          type="date"
          value={dueDate}
          min={todayStr}
          onChange={(e) => setDueDate(e.target.value)}
          className="h-8 w-full rounded-md border border-gray-300 bg-white px-2.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <button
        type="submit"
        disabled={createFollowUp.isPending}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        <Plus className="h-3.5 w-3.5" />
        Add
      </button>
    </form>
  );
}

// ─── Timeline dot ────────────────────────────────────────────────────────────

function TimelineDot({ category }) {
  if (category === 'overdue') {
    return (
      <div className="relative z-10 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 border-red-400 bg-red-100">
        <div className="h-2 w-2 rounded-full bg-red-500" />
      </div>
    );
  }
  if (category === 'today') {
    return (
      <div className="relative z-10 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 border-amber-400 bg-amber-100">
        <div className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
      </div>
    );
  }
  if (category === 'upcoming') {
    return (
      <div className="relative z-10 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 border-blue-400 bg-blue-100">
        <div className="h-2 w-2 rounded-full bg-blue-500" />
      </div>
    );
  }
  // completed / done
  return (
    <div className="relative z-10 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 border-green-400 bg-green-100">
      <Check className="h-3 w-3 text-green-600" />
    </div>
  );
}

// ─── Timeline "TODAY" marker ─────────────────────────────────────────────────

function TodayMarker() {
  return (
    <div className="relative flex items-center py-2 pl-[7px]">
      {/* Connector line through the marker */}
      <div className="absolute bottom-0 left-[16px] top-0 w-0.5 bg-gray-200" />
      {/* The marker itself */}
      <div className="relative z-10 flex items-center gap-2">
        <div className="flex h-5 w-5 items-center justify-center">
          <div className="h-3 w-3 rotate-45 rounded-sm border-2 border-amber-500 bg-amber-400" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600">
          Today
        </span>
        <div className="h-px flex-1 bg-amber-300" />
      </div>
    </div>
  );
}

// ─── Mini calendar heatmap ───────────────────────────────────────────────────

function MiniCalendarHeatmap({ followUps }) {
  const heatmap = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = [];

    for (let i = 0; i < 14; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      const count = (followUps || []).filter(f => {
        if (f.status !== 'pending') return false;
        const fDate = new Date(f.due_date);
        fDate.setHours(0, 0, 0, 0);
        return fDate.toISOString().split('T')[0] === dateStr;
      }).length;

      days.push({
        date,
        dateStr,
        dayLabel: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: date.getDate(),
        count,
        isToday: i === 0,
      });
    }
    return days;
  }, [followUps]);

  const maxCount = Math.max(1, ...heatmap.map(d => d.count));

  function cellColor(count, isToday) {
    if (count === 0) return isToday ? 'bg-amber-50 border-amber-300' : 'bg-gray-50 border-gray-200';
    const intensity = count / maxCount;
    if (intensity > 0.75) return 'bg-blue-500 border-blue-600 text-white';
    if (intensity > 0.5) return 'bg-blue-400 border-blue-500 text-white';
    if (intensity > 0.25) return 'bg-blue-200 border-blue-300 text-blue-800';
    return 'bg-blue-100 border-blue-200 text-blue-700';
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-gray-700">Next 14 Days</h3>
      <div className="flex gap-1.5 overflow-x-auto">
        {heatmap.map((day) => (
          <div key={day.dateStr} className="flex flex-col items-center gap-1">
            <span className="text-[10px] text-gray-400">{day.dayLabel}</span>
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-md border text-xs font-medium',
                cellColor(day.count, day.isToday),
                day.isToday && 'ring-2 ring-amber-400 ring-offset-1'
              )}
              title={`${day.dateStr}: ${day.count} follow-up${day.count !== 1 ? 's' : ''}`}
            >
              {day.count > 0 ? day.count : day.dayNum}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1.5 text-[10px] text-gray-400">
        <span>Less</span>
        <div className="flex gap-0.5">
          <div className="h-2.5 w-4 rounded-sm bg-gray-50 border border-gray-200" />
          <div className="h-2.5 w-4 rounded-sm bg-blue-100" />
          <div className="h-2.5 w-4 rounded-sm bg-blue-200" />
          <div className="h-2.5 w-4 rounded-sm bg-blue-400" />
          <div className="h-2.5 w-4 rounded-sm bg-blue-500" />
        </div>
        <span>More</span>
      </div>
    </div>
  );
}

// ─── Follow-up templates ────────────────────────────────────────────────────

const FOLLOW_UP_TEMPLATES = [
  { label: 'Check-in call', reason: 'Check-in call', days: 3 },
  { label: 'Proposal follow-up', reason: 'Follow up on proposal', days: 2 },
  { label: 'Quarterly review', reason: 'Quarterly review meeting', days: 7 },
  { label: 'Demo follow-up', reason: 'Follow up after demo', days: 1 },
  { label: 'Contract review', reason: 'Review contract status', days: 5 },
];

function TemplateQuickAdd() {
  const createFollowUp = useCreateFollowUp();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTemplate = (template) => {
    createFollowUp.mutate(
      {
        due_date: daysFromNowISO(template.days),
        reason: template.reason,
        notes: `Created from template: ${template.label}`,
      },
      {
        onSuccess: () => {
          toast.success(`Follow-up created: ${template.label}`);
          setOpen(false);
        },
      }
    );
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
      >
        <CalendarPlus className="h-4 w-4" />
        Templates
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute left-0 z-20 mt-1 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {FOLLOW_UP_TEMPLATES.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => handleTemplate(t)}
              disabled={createFollowUp.isPending}
              className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <span>{t.label}</span>
              <span className="text-xs text-gray-400">in {t.days}d</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Reminders tab ────────────────────────────────────────────────────────────

function RemindersTab() {
  const navigate = useNavigate();
  const [showCompleted, setShowCompleted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { data: followUps, isLoading } = useFollowUps(
    showCompleted ? {} : { status: 'pending' }
  );
  const updateFollowUp = useUpdateFollowUp();
  const deleteFollowUp = useDeleteFollowUp();
  const [bulkCompleting, setBulkCompleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const pendingIds = (followUps || []).filter(f => f.status === 'pending').map(f => f.id);
    setSelectedIds(new Set(pendingIds));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkAction = async (action) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    try {
      if (action === 'complete') {
        await Promise.all(ids.map(id =>
          new Promise((resolve, reject) => {
            updateFollowUp.mutate({ id, data: { status: 'completed' } }, { onSuccess: resolve, onError: reject });
          })
        ));
        toast.success(`Completed ${ids.length} follow-up${ids.length !== 1 ? 's' : ''}`);
      } else if (action === 'snooze') {
        await Promise.all(ids.map(id =>
          new Promise((resolve, reject) => {
            updateFollowUp.mutate({ id, data: { due_date: daysFromNowISO(3) } }, { onSuccess: resolve, onError: reject });
          })
        ));
        toast.success(`Snoozed ${ids.length} follow-up${ids.length !== 1 ? 's' : ''} by 3 days`);
      } else if (action === 'dismiss') {
        await Promise.all(ids.map(id =>
          new Promise((resolve, reject) => {
            updateFollowUp.mutate({ id, data: { status: 'dismissed' } }, { onSuccess: resolve, onError: reject });
          })
        ));
        toast.success(`Dismissed ${ids.length} follow-up${ids.length !== 1 ? 's' : ''}`);
      }
      setSelectedIds(new Set());
    } catch {
      toast.error('Some bulk actions failed');
    }
  };

  const items = followUps || [];

  const streakInfo = useMemo(() => {
    // Count recent completed follow-ups and check for missed ones
    const completed = items.filter(f => f.status === 'completed');
    const overdueItems = items.filter(f => f.is_overdue);

    // Simple streak: count of completed items with no current overdue
    const streak = completed.length;
    const hasOverdue = overdueItems.length > 0;

    if (streak === 0) return null;

    return {
      count: streak,
      hasOverdue,
      message: hasOverdue
        ? `${streak} completed, but ${overdueItems.length} overdue — time to catch up!`
        : streak >= 5
          ? `${streak} follow-ups completed — great consistency!`
          : `${streak} follow-up${streak !== 1 ? 's' : ''} completed — keep it up!`,
    };
  }, [items]);

  // Filter by search query
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      (f) =>
        (f.contact_name && f.contact_name.toLowerCase().includes(q)) ||
        (f.company_name && f.company_name.toLowerCase().includes(q)) ||
        (f.reason && f.reason.toLowerCase().includes(q))
    );
  }, [items, searchQuery]);

  // Categorize: overdue, due today, upcoming, done
  const overdue = filtered.filter((f) => f.is_overdue);
  const dueToday = filtered.filter(
    (f) => f.status === 'pending' && !f.is_overdue && daysUntil(f.due_date) === 0
  );
  const pendingUpcoming = filtered.filter(
    (f) => f.status === 'pending' && !f.is_overdue && daysUntil(f.due_date) !== 0
  );
  const done = filtered.filter((f) => f.status !== 'pending');

  // Bulk complete all overdue
  const handleBulkComplete = async () => {
    if (overdue.length === 0) return;
    setBulkCompleting(true);
    try {
      await Promise.all(
        overdue.map(
          (f) =>
            new Promise((resolve, reject) => {
              updateFollowUp.mutate(
                { id: f.id, data: { status: 'completed' } },
                { onSuccess: resolve, onError: reject }
              );
            })
        )
      );
      toast.success(`Completed ${overdue.length} overdue follow-up${overdue.length === 1 ? '' : 's'}`);
    } catch {
      toast.error('Failed to complete some follow-ups');
    } finally {
      setBulkCompleting(false);
    }
  };

  // Determine the timeline line color for a category segment
  const lineColor = (category) => {
    if (category === 'overdue') return 'bg-red-300';
    if (category === 'today') return 'bg-amber-300';
    if (category === 'upcoming') return 'bg-blue-300';
    return 'bg-green-300';
  };

  const TimelineRow = ({ f, category }) => {
    const [snoozeOpen, setSnoozeOpen] = useState(false);

    return (
      <li className="relative flex gap-0">
        {/* Timeline spine */}
        <div className="relative flex w-9 flex-shrink-0 flex-col items-center">
          {/* Vertical line above dot */}
          <div className={cn('w-0.5 flex-1', lineColor(category))} />
          {/* Dot */}
          <TimelineDot category={category} />
          {/* Vertical line below dot */}
          <div className={cn('w-0.5 flex-1', lineColor(category))} />
        </div>

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 py-3 pr-4 transition-colors hover:bg-gray-50/50">
          {f.status === 'pending' && (
            <input
              type="checkbox"
              checked={selectedIds.has(f.id)}
              onChange={() => toggleSelect(f.id)}
              onClick={(e) => e.stopPropagation()}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => f.company_id && navigate(`/companies/${f.company_id}`)}
                className="truncate text-sm font-medium text-gray-900 hover:text-blue-600"
              >
                {f.contact_name || f.company_name || 'Follow-up'}
              </button>
              {f.company_name && f.contact_name && (
                <span className="truncate text-xs text-gray-400">{f.company_name}</span>
              )}
              <StatusBadge followUp={f} />
              <PriorityBadge score={computePriorityScore(f)} />
            </div>
            {f.reason && <p className="mt-0.5 truncate text-sm text-gray-600">{f.reason}</p>}
            <p className="mt-0.5 text-xs text-gray-400">Due {formatDate(f.due_date)}</p>
          </div>

          {f.status === 'pending' ? (
            <div className="relative flex items-center gap-1">
              <button
                type="button"
                title="Mark complete"
                onClick={() =>
                  updateFollowUp.mutate({ id: f.id, data: { status: 'completed' } })
                }
                className="rounded-md p-1.5 text-gray-400 hover:bg-green-50 hover:text-green-600"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                type="button"
                title="Snooze"
                onClick={() => setSnoozeOpen(!snoozeOpen)}
                className={cn(
                  'rounded-md p-1.5 text-gray-400 hover:bg-amber-50 hover:text-amber-600',
                  snoozeOpen && 'bg-amber-50 text-amber-600'
                )}
              >
                <AlarmClock className="h-4 w-4" />
              </button>
              {f.company_id && (
                <button
                  type="button"
                  title="Open contact"
                  onClick={() => navigate(`/companies/${f.company_id}`)}
                  className="rounded-md p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                >
                  <ExternalLink className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                title="Dismiss"
                onClick={() =>
                  updateFollowUp.mutate({ id: f.id, data: { status: 'dismissed' } })
                }
                className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
              {snoozeOpen && (
                <SnoozeDropdown
                  followUpId={f.id}
                  onClose={() => setSnoozeOpen(false)}
                />
              )}
            </div>
          ) : (
            <button
              type="button"
              title="Delete"
              onClick={() => deleteFollowUp.mutate(f.id)}
              className="rounded-md p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </li>
    );
  };

  // Build whether we need the TODAY marker. It goes between overdue/today items and upcoming items.
  const hasOverdueOrToday = overdue.length > 0 || dueToday.length > 0;
  const hasUpcoming = pendingUpcoming.length > 0;
  const showTodayMarker = hasOverdueOrToday && hasUpcoming;

  return (
    <div className="space-y-5">
      {/* Quick create form */}
      <QuickCreateForm />

      {/* Streak indicator */}
      {!isLoading && streakInfo && (
        <div className={cn(
          'flex items-center gap-3 rounded-xl border px-4 py-3',
          streakInfo.hasOverdue
            ? 'border-amber-200 bg-amber-50'
            : 'border-green-200 bg-green-50'
        )}>
          <div className={cn(
            'flex h-10 w-10 items-center justify-center rounded-full',
            streakInfo.hasOverdue ? 'bg-amber-100' : 'bg-green-100'
          )}>
            <TrendingUp className={cn(
              'h-5 w-5',
              streakInfo.hasOverdue ? 'text-amber-600' : 'text-green-600'
            )} />
          </div>
          <div>
            <p className={cn(
              'text-sm font-semibold',
              streakInfo.hasOverdue ? 'text-amber-800' : 'text-green-800'
            )}>
              {streakInfo.message}
            </p>
          </div>
        </div>
      )}

      {/* Summary stats */}
      {!isLoading && items.length > 0 && <SummaryStats items={items} />}

      {/* Mini calendar heatmap */}
      {!isLoading && items.length > 0 && <MiniCalendarHeatmap followUps={items} />}

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, company, or reason..."
            className="h-9 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-700 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600"
          />
          Show completed
        </label>
        <TemplateQuickAdd />
      </div>

      {/* Bulk complete overdue button */}
      {!isLoading && overdue.length > 0 && (
        <button
          type="button"
          onClick={handleBulkComplete}
          disabled={bulkCompleting}
          className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
        >
          <CheckCircle2 className="h-4 w-4" />
          {bulkCompleting
            ? 'Completing...'
            : `Complete All Overdue (${overdue.length})`}
        </button>
      )}

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5">
          <span className="text-sm font-medium text-blue-700">
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleBulkAction('complete')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
            >
              <Check className="h-3.5 w-3.5" />
              Complete
            </button>
            <button
              type="button"
              onClick={() => handleBulkAction('snooze')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600"
            >
              <AlarmClock className="h-3.5 w-3.5" />
              Snooze 3d
            </button>
            <button
              type="button"
              onClick={() => handleBulkAction('dismiss')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-600"
            >
              <X className="h-3.5 w-3.5" />
              Dismiss
            </button>
          </div>
          <button
            type="button"
            onClick={clearSelection}
            className="ml-auto text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Filtered count when searching */}
      {searchQuery.trim() && !isLoading && (
        <p className="text-xs text-gray-400">
          {filtered.length} result{filtered.length === 1 ? '' : 's'} matching "{searchQuery}"
        </p>
      )}

      {/* Follow-ups timeline */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <SkeletonRows />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No follow-ups yet"
            description="You haven't scheduled any follow-ups. Head to the Cold Contacts tab to find contacts that need attention, or create a follow-up from any contact page."
            action={{
              label: 'View Cold Contacts',
              onClick: () => {
                const coldTab = document.querySelector('[data-tab="cold"]');
                if (coldTab) coldTab.click();
              },
            }}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No matches"
            description={`No follow-ups match "${searchQuery}". Try a different search term or clear the filter.`}
            action={{
              label: 'Clear search',
              onClick: () => setSearchQuery(''),
            }}
          />
        ) : (
          <div className="py-2">
            {/* Overdue section */}
            {overdue.length > 0 && (
              <div>
                <div className="flex items-center gap-2 px-4 py-2">
                  <div className="h-2 w-2 rounded-full bg-red-500" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-red-600">
                    Overdue ({overdue.length})
                  </span>
                </div>
                <ul>
                  {overdue.map((f) => (
                    <TimelineRow key={f.id} f={f} category="overdue" />
                  ))}
                </ul>
              </div>
            )}

            {/* Due today section */}
            {dueToday.length > 0 && (
              <div>
                <div className="flex items-center gap-2 px-4 py-2">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-amber-600">
                    Due today ({dueToday.length})
                  </span>
                </div>
                <ul>
                  {dueToday.map((f) => (
                    <TimelineRow key={f.id} f={f} category="today" />
                  ))}
                </ul>
              </div>
            )}

            {/* TODAY marker between past/present and future */}
            {showTodayMarker && <TodayMarker />}
            {/* Also show marker if only upcoming items exist (no overdue/today) to anchor the timeline */}
            {!hasOverdueOrToday && hasUpcoming && <TodayMarker />}

            {/* Upcoming section */}
            {pendingUpcoming.length > 0 && (
              <div>
                <div className="flex items-center gap-2 px-4 py-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-blue-500">
                    Upcoming ({pendingUpcoming.length})
                  </span>
                </div>
                <ul>
                  {pendingUpcoming.map((f) => (
                    <TimelineRow key={f.id} f={f} category="upcoming" />
                  ))}
                </ul>
              </div>
            )}

            {/* Completed / done section */}
            {showCompleted && done.length > 0 && (
              <div>
                <div className="flex items-center gap-2 px-4 py-2">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Done ({done.length})
                  </span>
                </div>
                <ul>
                  {done.map((f) => (
                    <TimelineRow key={f.id} f={f} category="done" />
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Cold contacts tab ─────────────────────────────────────────────────────────

function ColdContactsTab() {
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const { data: stale, isLoading } = useStaleContacts(days);
  const createFollowUp = useCreateFollowUp();

  const contacts = stale || [];

  const schedule = (c) => {
    createFollowUp.mutate({
      contact_id: c.contact_id,
      company_id: c.company_id,
      due_date: daysFromNowISO(3),
      reason: `Re-engage ${[c.first_name, c.last_name].filter(Boolean).join(' ') || 'contact'} — no email in ${days}+ days`,
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-gray-600">Not emailed in</label>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {[7, 14, 30, 60, 90].map((d) => (
            <option key={d} value={d}>
              {d} days
            </option>
          ))}
        </select>
        <span className="text-sm text-gray-400">
          {contacts.length} contact{contacts.length === 1 ? '' : 's'} flagged
        </span>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <SkeletonRows />
        ) : contacts.length === 0 ? (
          <EmptyState
            icon={Snowflake}
            title="All contacts are warm"
            description={`Every contact with an email has been reached within the last ${days} days. Adjust the window above to widen the search.`}
          />
        ) : (
          <ul className="divide-y divide-gray-50">
            {contacts.map((c) => (
              <li
                key={c.contact_id}
                className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-gray-50"
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-500">
                  <User className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-gray-900">
                      {[c.first_name, c.last_name].filter(Boolean).join(' ') || c.email}
                    </span>
                    {c.title && (
                      <span className="truncate text-xs text-gray-500">{c.title}</span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-400">
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      <button
                        type="button"
                        onClick={() =>
                          c.company_id && navigate(`/companies/${c.company_id}`)
                        }
                        className="hover:text-blue-600"
                      >
                        {c.company_name || 'Unknown company'}
                      </button>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {c.last_emailed_at
                        ? `last emailed ${timeAgo(c.last_emailed_at)}`
                        : 'never emailed'}
                    </span>
                  </div>
                </div>
                {c.has_open_follow_up ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600">
                    <Clock className="h-3 w-3" />
                    Follow-up set
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => schedule(c)}
                    disabled={createFollowUp.isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <CalendarPlus className="h-3.5 w-3.5" />
                    Schedule follow-up
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function FollowUps() {
  const [tab, setTab] = useState('reminders');

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <Bell className="h-5 w-5 text-blue-500" />
          Follow-ups
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Track reminders and re-engage contacts that have gone cold.
        </p>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {[
          { id: 'reminders', label: 'Reminders' },
          { id: 'cold', label: 'Cold Contacts' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            data-tab={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              tab === t.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'reminders' ? <RemindersTab /> : <ColdContactsTab />}
    </div>
  );
}
