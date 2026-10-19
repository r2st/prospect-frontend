import { useState, useMemo } from 'react';
import {
  Mail,
  Plus,
  Send,
  Eye,
  Users,
  ChevronDown,
  ChevronUp,
  X,
  Clock,
  Trash2,
  BarChart3,
  Pause,
  Play,
  Copy,
  ArrowUp,
  ArrowDown,
  FileText,
  TrendingUp,
  Award,
  GripVertical,
  CheckCircle2,
  Circle,
  ChevronRight,
  AlertTriangle,
  DollarSign,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from 'recharts';
import EmptyState from '../components/EmptyState';
import {
  useSequences, useCreateSequence, useUpdateSequenceStatus, useDeleteSequence, useSequenceAnalytics,
} from '../hooks/useOutreach';
import { useDealAttribution } from '../hooks/useDeals';
import { formatNumber, cn } from '../lib/utils';

/** Format a numeric value as whole-dollar USD (attribution revenue). */
function fmtMoney(value) {
  const n = safeNum(value);
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/** Safely coerce to a finite number, falling back to 0. */
function safeNum(val) {
  const n = Number(val);
  return isFinite(n) ? n : 0;
}

/** Compute a percentage safely -- returns "0.0" when denominator is 0 or result is NaN. */
function safeRate(numerator, denominator) {
  const num = safeNum(numerator);
  const den = safeNum(denominator);
  if (den <= 0) return '0.0';
  const rate = (num / den) * 100;
  return isNaN(rate) || !isFinite(rate) ? '0.0' : rate.toFixed(1);
}

/** Return the raw numeric rate (0-100) for comparisons. */
function safeRateNum(numerator, denominator) {
  const num = safeNum(numerator);
  const den = safeNum(denominator);
  if (den <= 0) return 0;
  const rate = (num / den) * 100;
  return isNaN(rate) || !isFinite(rate) ? 0 : rate;
}

/** Render a template body with placeholder styling for preview. */
function renderPreview(body) {
  if (!body) return 'No content';
  return body.replace(
    /\{\{(\w+)\}\}/g,
    (_, name) => `[${name.replace(/_/g, ' ')}]`,
  );
}

/** Compute total days spanned by a sequence from its step delay_days. */
function computeTotalDays(steps) {
  if (!steps || steps.length === 0) return 0;
  return steps.reduce((sum, s) => sum + safeNum(s.delay_days), 0);
}

/* -------------------------------------------------------------------------- */
/*  Send condition options (frontend-only)                                    */
/* -------------------------------------------------------------------------- */

const SEND_CONDITIONS = [
  { value: 'always', label: 'Always send' },
  { value: 'if_opened', label: 'Only if previous opened' },
  { value: 'if_not_replied', label: 'Only if not replied' },
];

function getConditionLabel(value) {
  return SEND_CONDITIONS.find((c) => c.value === value)?.label || 'Always send';
}

/* -------------------------------------------------------------------------- */
/*  SequenceStats -- enhanced with step funnel                                */
/* -------------------------------------------------------------------------- */

function SequenceStats({ stats = {}, steps = [] }) {
  const stepStats = stats?.step_stats;
  const hasStepData = Array.isArray(stepStats) && stepStats.length > 0;

  // Find best/worst open rate step indices
  const { bestIdx, worstIdx } = useMemo(() => {
    if (!hasStepData) return { bestIdx: -1, worstIdx: -1 };
    let best = -1;
    let worst = -1;
    let bestRate = -1;
    let worstRate = Infinity;
    stepStats.forEach((ss, i) => {
      const sent = safeNum(ss.sent);
      if (sent <= 0) return;
      const rate = safeRateNum(ss.opened, sent);
      if (rate > bestRate) { bestRate = rate; best = i; }
      if (rate < worstRate) { worstRate = rate; worst = i; }
    });
    // Only differentiate if there are at least 2 steps with data
    if (best === worst) return { bestIdx: -1, worstIdx: -1 };
    return { bestIdx: best, worstIdx: worst };
  }, [stepStats, hasStepData]);

  return (
    <div className="space-y-4">
      {/* Core stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg bg-blue-50 p-2.5 text-center">
          <div className="flex items-center justify-center gap-1 text-blue-600">
            <Users className="h-3.5 w-3.5" />
            <span className="text-lg font-bold">{formatNumber(safeNum(stats.enrolled))}</span>
          </div>
          <p className="text-xs text-blue-600/70">Enrolled</p>
        </div>
        <div className="rounded-lg bg-purple-50 p-2.5 text-center">
          <div className="flex items-center justify-center gap-1 text-purple-600">
            <Send className="h-3.5 w-3.5" />
            <span className="text-lg font-bold">{formatNumber(safeNum(stats.sent))}</span>
          </div>
          <p className="text-xs text-purple-600/70">Sent</p>
        </div>
        <div className="rounded-lg bg-indigo-50 p-2.5 text-center">
          <div className="flex items-center justify-center gap-1 text-indigo-600">
            <Eye className="h-3.5 w-3.5" />
            <span className="text-lg font-bold">{formatNumber(safeNum(stats.opened))}</span>
          </div>
          <p className="text-xs text-indigo-600/70">Opened</p>
        </div>
        <div className="rounded-lg bg-green-50 p-2.5 text-center">
          <div className="flex items-center justify-center gap-1 text-green-600">
            <Mail className="h-3.5 w-3.5" />
            <span className="text-lg font-bold">{formatNumber(safeNum(stats.replied))}</span>
          </div>
          <p className="text-xs text-green-600/70">Replied</p>
        </div>
      </div>

      {/* Step-by-step funnel */}
      {hasStepData && (
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
          <div className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-gray-600">
            <TrendingUp className="h-3.5 w-3.5" />
            Step-by-Step Funnel
          </div>
          <div className="flex items-stretch gap-1 overflow-x-auto">
            {stepStats.map((ss, i) => {
              const sent = safeNum(ss.sent);
              const opened = safeNum(ss.opened);
              const replied = safeNum(ss.replied);
              const openRate = safeRate(opened, sent);
              const replyRate = safeRate(replied, sent);
              const isBest = i === bestIdx;
              const isWorst = i === worstIdx;

              // Drop-off from previous step
              const prevSent = i > 0 ? safeNum(stepStats[i - 1].sent) : null;
              const dropOff = prevSent !== null && prevSent > 0
                ? ((prevSent - sent) / prevSent * 100).toFixed(0)
                : null;

              return (
                <div key={i} className="flex items-stretch">
                  {/* Drop-off arrow between steps */}
                  {i > 0 && (
                    <div className="flex flex-col items-center justify-center px-1">
                      <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
                      {dropOff !== null && Number(dropOff) > 0 && (
                        <span className="text-[10px] text-red-400">-{dropOff}%</span>
                      )}
                    </div>
                  )}

                  <div
                    className={cn(
                      'flex min-w-[100px] flex-1 flex-col rounded-md border p-2 text-center',
                      isBest ? 'border-green-300 bg-green-50' :
                      isWorst ? 'border-red-200 bg-red-50/50' :
                      'border-gray-200 bg-white',
                    )}
                  >
                    <div className="mb-1 flex items-center justify-center gap-1">
                      <span className={cn(
                        'text-[10px] font-bold uppercase tracking-wide',
                        isBest ? 'text-green-600' : isWorst ? 'text-red-500' : 'text-gray-400',
                      )}>
                        Step {i + 1}
                      </span>
                      {isBest && <Award className="h-3 w-3 text-green-500" />}
                      {isWorst && <AlertTriangle className="h-3 w-3 text-red-400" />}
                    </div>
                    <p className="text-xs text-gray-500">{sent} sent</p>
                    <p className={cn('text-xs font-medium', isBest ? 'text-green-700' : isWorst ? 'text-red-600' : 'text-indigo-600')}>
                      {openRate}% opened
                    </p>
                    <p className="text-xs text-green-600">{replyRate}% replied</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  StepTimeline -- visual timeline in expanded card                          */
/* -------------------------------------------------------------------------- */

function StepTimeline({ steps, stats }) {
  if (!steps || steps.length === 0) return null;
  const stepStats = stats?.step_stats; // may be undefined

  return (
    <div className="relative ml-5">
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1;
        const ss = Array.isArray(stepStats) ? stepStats[idx] : null;
        const stepOpen = ss ? safeRate(ss.opened, ss.sent) : null;
        const stepReply = ss ? safeRate(ss.replied, ss.sent) : null;

        return (
          <div key={idx} className="relative flex gap-4 pb-6 last:pb-0">
            {/* Vertical connector line */}
            {!isLast && (
              <div className="absolute left-[15px] top-[32px] h-[calc(100%-20px)] w-0.5 bg-gradient-to-b from-blue-300 to-gray-200" />
            )}

            {/* Step circle */}
            <div className="relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 border-blue-400 bg-white text-xs font-bold text-blue-600 shadow-sm">
              {step.order}
            </div>

            {/* Step content */}
            <div className="flex-1 rounded-lg border border-gray-100 bg-gray-50 p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-gray-900">{step.subject || 'Untitled'}</p>
                <div className="flex flex-shrink-0 items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
                  <Clock className="h-3 w-3" />
                  {step.delay_days === 0 ? 'Immediately' : `Day ${step.delay_days}`}
                </div>
              </div>

              <p className="mt-1.5 whitespace-pre-wrap text-xs text-gray-600 line-clamp-3">
                {step.body}
              </p>

              {/* Per-step metrics */}
              {ss && (
                <div className="mt-2 flex items-center gap-3 border-t border-gray-200 pt-2">
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Send className="h-3 w-3" /> {safeNum(ss.sent)} sent
                  </span>
                  <span className="flex items-center gap-1 text-xs text-indigo-600">
                    <Eye className="h-3 w-3" /> {stepOpen}% opened
                  </span>
                  <span className="flex items-center gap-1 text-xs text-green-600">
                    <Mail className="h-3 w-3" /> {stepReply}% replied
                  </span>
                </div>
              )}

              {/* A/B variant comparison */}
              {step.ab_variants && step.ab_variants.length > 1 && (
                <div className="mt-2 border-t border-gray-200 pt-2">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">A/B Comparison</p>
                  <div className="space-y-1">
                    {step.ab_variants.map((variant, vi) => {
                      const vSent = safeNum(variant.sent);
                      const vOpenRate = safeRateNum(variant.opened, vSent);
                      const vClickRate = safeRateNum(variant.clicked, vSent);
                      return (
                        <div key={vi} className="flex items-center gap-2">
                          <span className="w-14 text-xs font-medium text-gray-600">
                            {variant.name || `Var ${String.fromCharCode(65 + vi)}`}
                          </span>
                          <div className="flex-1">
                            <div className="flex h-4 items-center gap-1">
                              <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-gray-100">
                                <div
                                  className="absolute inset-y-0 left-0 rounded-full bg-indigo-400"
                                  style={{ width: `${Math.min(vOpenRate, 100)}%` }}
                                />
                              </div>
                              <span className="w-12 text-right text-[10px] text-indigo-600">{vOpenRate.toFixed(1)}% open</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  EnrollmentSection -- enrollment dashboard in expanded card                */
/* -------------------------------------------------------------------------- */

function EnrollmentSection({ enrolledCount }) {
  return (
    <div className="border-t border-gray-100 px-5 py-4">
      <h4 className="mb-3 text-sm font-semibold text-gray-700">Enrollments</h4>

      {/* Status legend */}
      <div className="mb-3 flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Circle className="h-2.5 w-2.5 fill-green-500 text-green-500" />
          Active
        </span>
        <span className="flex items-center gap-1">
          <CheckCircle2 className="h-2.5 w-2.5 text-blue-500" />
          Completed
        </span>
        <span className="flex items-center gap-1">
          <Circle className="h-2.5 w-2.5 fill-orange-400 text-orange-400" />
          Paused
        </span>
      </div>

      {enrolledCount > 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white">
          {/* Placeholder table header */}
          <div className="grid grid-cols-4 gap-2 border-b border-gray-100 px-3 py-2 text-xs font-medium text-gray-500">
            <span>Contact</span>
            <span>Current Step</span>
            <span>Status</span>
            <span>Enrolled</span>
          </div>
          {/* Placeholder rows */}
          <div className="px-3 py-6 text-center">
            <p className="text-sm text-gray-400">Enrollment details load from individual contact pages.</p>
            <button
              type="button"
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-100"
            >
              <Users className="h-3.5 w-3.5" />
              View all {formatNumber(enrolledCount)} enrolled contact{enrolledCount !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-6 text-center text-sm text-gray-400">
          No contacts enrolled yet. Enroll contacts from company pages.
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  SequenceFlowDiagram -- horizontal timeline of steps                       */
/* -------------------------------------------------------------------------- */

function SequenceFlowDiagram({ steps, stats }) {
  if (!steps || steps.length === 0) return null;
  const stepStats = stats?.step_stats;

  return (
    <div className="border-t border-gray-100 px-5 py-4">
      <h4 className="mb-3 text-sm font-semibold text-gray-700">Sequence Flow</h4>
      <div className="flex items-center gap-0 overflow-x-auto pb-2">
        {steps.map((step, idx) => {
          const ss = Array.isArray(stepStats) ? stepStats[idx] : null;
          const openRate = ss ? safeRate(ss.opened, ss.sent) : null;
          const isFirst = idx === 0;

          return (
            <div key={idx} className="flex items-center">
              {/* Connector line with day label */}
              {!isFirst && (
                <div className="flex flex-col items-center mx-1">
                  <span className="text-[10px] font-medium text-gray-400 mb-1">
                    {step.delay_days}d
                  </span>
                  <div className="h-0.5 w-8 bg-gradient-to-r from-blue-300 to-blue-400" />
                </div>
              )}
              {/* Node */}
              <div className="flex flex-col items-center">
                <div className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold shadow-sm',
                  openRate && Number(openRate) > 20
                    ? 'border-green-400 bg-green-50 text-green-700'
                    : 'border-blue-400 bg-blue-50 text-blue-700'
                )}>
                  {idx + 1}
                </div>
                {openRate != null && (
                  <span className={cn(
                    'mt-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                    Number(openRate) > 20 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  )}>
                    {openRate}%
                  </span>
                )}
                <span className="mt-0.5 text-[10px] text-gray-400 max-w-[60px] truncate text-center">
                  {step.subject || `Step ${idx + 1}`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  SequenceHealth -- health indicator badge                                  */
/* -------------------------------------------------------------------------- */

function SequenceHealth({ stats }) {
  const openRate = safeRateNum(stats?.opened, stats?.sent);
  const replyRate = safeRateNum(stats?.replied, stats?.sent);
  const sent = safeNum(stats?.sent);

  if (sent === 0) return null;

  let color, label, bg, textColor;
  if (openRate < 10) {
    color = 'red';
    label = 'Needs attention';
    bg = 'bg-red-100';
    textColor = 'text-red-700';
  } else if (openRate >= 20 && replyRate >= 2) {
    color = 'green';
    label = 'Healthy';
    bg = 'bg-green-100';
    textColor = 'text-green-700';
  } else {
    color = 'amber';
    label = 'Fair';
    bg = 'bg-amber-100';
    textColor = 'text-amber-700';
  }

  const dotColor = {
    green: 'bg-green-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
  }[color];

  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium', bg, textColor)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', dotColor)} />
      {label}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  SequenceCard                                                              */
/* -------------------------------------------------------------------------- */

function SequenceCard({ sequence, onDuplicate, onDelete, isBestPerformer }) {
  const [expanded, setExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const updateStatus = useUpdateSequenceStatus();

  const stats = sequence.stats || {};
  const openRate = safeRate(stats.opened, stats.sent);
  const replyRate = safeRate(stats.replied, stats.sent);
  const enrolledCount = safeNum(stats.enrolled);
  const totalDays = computeTotalDays(sequence.steps);
  const stepCount = sequence.steps?.length || 0;

  // Completion rate: approximate as (sent on last step / enrolled)
  const completionRate = useMemo(() => {
    if (enrolledCount <= 0) return 0;
    const stepStats = stats?.step_stats;
    if (!Array.isArray(stepStats) || stepStats.length === 0) return 0;
    const lastStepSent = safeNum(stepStats[stepStats.length - 1].sent);
    return Math.min(100, (lastStepSent / enrolledCount) * 100);
  }, [enrolledCount, stats]);

  return (
    <div
      className={cn(
        'rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md',
        isBestPerformer ? 'border-amber-300 ring-1 ring-amber-200' : 'border-gray-200',
      )}
    >
      {/* Best performer badge */}
      {isBestPerformer && (
        <div className="flex items-center gap-1.5 rounded-t-xl bg-amber-50 px-4 py-1.5 text-xs font-medium text-amber-700">
          <Award className="h-3.5 w-3.5" />
          Best Performing Sequence
        </div>
      )}

      <div
        className="cursor-pointer p-5"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full',
              isBestPerformer ? 'bg-amber-100' : 'bg-blue-100',
            )}>
              <Mail className={cn('h-5 w-5', isBestPerformer ? 'text-amber-600' : 'text-blue-600')} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">{sequence.name}</h3>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                <span>{stepCount} step{stepCount !== 1 ? 's' : ''} over {totalDays} day{totalDays !== 1 ? 's' : ''}</span>
                <span className="text-gray-300">|</span>
                <span className="flex items-center gap-0.5">
                  <Eye className="h-3 w-3" /> {openRate}% open
                </span>
                <span className="text-gray-300">|</span>
                <span className="flex items-center gap-0.5">
                  <Mail className="h-3 w-3" /> {replyRate}% reply
                </span>
                <span className="text-gray-300">|</span>
                <span className="flex items-center gap-0.5">
                  <Users className="h-3 w-3" /> {formatNumber(enrolledCount)} enrolled
                </span>
                <span className="text-gray-300">|</span>
                <span className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                  (sequence.status || 'active') === 'active' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700',
                )}>
                  {(sequence.status || 'active') === 'active' ? 'Active' : 'Paused'}
                </span>
                <SequenceHealth stats={stats} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Duplicate */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate(sequence);
              }}
              title="Duplicate sequence"
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <Copy className="h-4 w-4" />
            </button>

            {/* Delete */}
            {showDeleteConfirm ? (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => {
                    onDelete(sequence.id);
                    setShowDeleteConfirm(false);
                  }}
                  className="rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-100"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="rounded-md px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteConfirm(true);
                }}
                title="Delete sequence"
                className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}

            {/* Pause / Resume */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const newStatus = (sequence.status || 'active') === 'active' ? 'paused' : 'active';
                updateStatus.mutate({ id: sequence.id, status: newStatus });
              }}
              disabled={updateStatus.isPending}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                (sequence.status || 'active') === 'active'
                  ? 'bg-orange-50 text-orange-700 hover:bg-orange-100'
                  : 'bg-green-50 text-green-700 hover:bg-green-100',
              )}
            >
              {(sequence.status || 'active') === 'active' ? (
                <><Pause className="h-3.5 w-3.5" /> Pause</>
              ) : (
                <><Play className="h-3.5 w-3.5" /> Resume</>
              )}
            </button>

            {/* Expand chevron */}
            <button
              type="button"
              className="rounded-md p-1 text-gray-400 hover:bg-gray-100"
            >
              {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Stats grid */}
        <div className="mt-4">
          <SequenceStats stats={stats} steps={sequence.steps} />
        </div>

        {/* Completion progress bar */}
        {enrolledCount > 0 && (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
              <span>Completion</span>
              <span>{completionRate.toFixed(0)}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all"
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Expanded sections */}
      {expanded && (
        <>
          {/* Sequence flow diagram */}
          <SequenceFlowDiagram steps={sequence.steps} stats={stats} />

          {/* Step timeline */}
          {sequence.steps && (
            <div className="border-t border-gray-100 px-5 py-4">
              <h4 className="mb-3 text-sm font-semibold text-gray-700">Sequence Steps</h4>
              <StepTimeline steps={sequence.steps} stats={stats} />
            </div>
          )}

          {/* Enrollment dashboard */}
          <EnrollmentSection enrolledCount={enrolledCount} />

          {/* Per-step funnel analytics (Feature 4) — fetched lazily on expand. */}
          <SequenceAnalyticsSection sequenceId={sequence.id} enabled={expanded} />
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  SequenceAnalyticsSection -- per-step funnel + conversion (Feature 4)       */
/* -------------------------------------------------------------------------- */

function pct(fraction) {
  return `${(safeNum(fraction) * 100).toFixed(1)}%`;
}

function SequenceAnalyticsSection({ sequenceId, enabled }) {
  const { data, isLoading, isError } = useSequenceAnalytics(sequenceId, enabled);

  if (isLoading) {
    return (
      <div className="border-t border-gray-100 px-5 py-6 text-sm text-gray-400">
        Loading analytics…
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="border-t border-gray-100 px-5 py-4 text-sm text-gray-400">
        Analytics couldn't load for this sequence.
      </div>
    );
  }

  const steps = Array.isArray(data.steps) ? data.steps : [];
  // Funnel data: the "reach" at each step is that step's sent count, with the
  // engagement it produced layered on. Drop-off is sent[n] vs sent[n-1].
  const funnel = steps.map((s, i) => {
    const prevSent = i > 0 ? safeNum(steps[i - 1].sent) : null;
    const dropOff = prevSent && prevSent > 0
      ? Math.max(0, 1 - safeNum(s.sent) / prevSent)
      : null;
    return {
      name: `Step ${s.step_number}`,
      sent: safeNum(s.sent),
      opened: safeNum(s.opened),
      replied: safeNum(s.replied),
      dropOff,
      step: s,
    };
  });

  const anyActivity = funnel.some((f) => f.sent > 0);

  return (
    <div className="space-y-5 border-t border-gray-100 bg-gray-50/50 px-5 py-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-indigo-500" />
        <h4 className="text-sm font-semibold text-gray-700">Analytics</h4>
      </div>

      {/* Outcome tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <AnalyticsTile label="Enrolled" value={formatNumber(data.total_enrollments)} />
        <AnalyticsTile label="Replied" value={formatNumber(data.replied_enrollments)} />
        <AnalyticsTile label="Deals" value={formatNumber(data.deals_attributed)} />
        <AnalyticsTile
          label="Conversion"
          value={pct(data.conversion_rate)}
          hint="enrolled → deal"
          highlight
        />
      </div>

      {!anyActivity ? (
        <p className="rounded-lg border border-dashed border-gray-200 bg-white px-3 py-4 text-center text-sm text-gray-400">
          No sends yet — the funnel fills in once this sequence starts delivering.
        </p>
      ) : (
        <>
          {/* Funnel: sends per step, drop-off between steps. */}
          <div>
            <h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Funnel — sends per step
            </h5>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnel} margin={{ top: 16, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <RTooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="sent" radius={[4, 4, 0, 0]} name="Sent">
                    {funnel.map((f, i) => (
                      <Cell key={f.name} fill={i === 0 ? '#4338ca' : '#6366f1'} />
                    ))}
                    <LabelList dataKey="sent" position="top" style={{ fontSize: 11, fill: '#6b7280' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Per-step rate table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
                  <th className="py-2 pr-3 font-medium">Step</th>
                  <th className="px-3 py-2 font-medium">Sent</th>
                  <th className="px-3 py-2 font-medium">Open</th>
                  <th className="px-3 py-2 font-medium">Click</th>
                  <th className="px-3 py-2 font-medium">Reply</th>
                  <th className="px-3 py-2 font-medium">Bounce</th>
                  <th className="px-3 py-2 font-medium">Drop-off</th>
                </tr>
              </thead>
              <tbody>
                {funnel.map((f) => (
                  <tr key={f.name} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 pr-3 font-medium text-gray-800">
                      {f.name}
                      {f.step.label && (
                        <span className="ml-1.5 text-xs font-normal text-gray-400">
                          · {f.step.label}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-gray-700">{formatNumber(f.sent)}</td>
                    <td className="px-3 py-2 tabular-nums text-gray-700">{pct(f.step.open_rate)}</td>
                    <td className="px-3 py-2 tabular-nums text-gray-700">{pct(f.step.click_rate)}</td>
                    <td className="px-3 py-2 tabular-nums text-gray-700">{pct(f.step.reply_rate)}</td>
                    <td className={cn(
                      'px-3 py-2 tabular-nums',
                      safeNum(f.step.bounce_rate) > 0 ? 'text-red-600' : 'text-gray-700'
                    )}>
                      {pct(f.step.bounce_rate)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-gray-500">
                      {f.dropOff == null ? '—' : pct(f.dropOff)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function AnalyticsTile({ label, value, hint, highlight }) {
  return (
    <div
      className={cn(
        'rounded-lg border p-3',
        highlight ? 'border-indigo-200 bg-indigo-50/60' : 'border-gray-200 bg-white'
      )}
    >
      <div className={cn('text-lg font-bold tabular-nums', highlight ? 'text-indigo-700' : 'text-gray-900')}>
        {value}
      </div>
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
      {hint && <div className="text-[10px] text-gray-400">{hint}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Template variables                                                        */
/* -------------------------------------------------------------------------- */

const templateVariables = [
  { label: 'Company', value: '{{company_name}}' },
  { label: 'First Name', value: '{{contact_first_name}}' },
  { label: 'Title', value: '{{contact_title}}' },
  { label: 'Industry', value: '{{industry}}' },
];

/* -------------------------------------------------------------------------- */
/*  StepPreview -- rendered preview of a single step                          */
/* -------------------------------------------------------------------------- */

function StepPreview({ step }) {
  return (
    <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/50 p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-blue-700">
        <FileText className="h-3 w-3" />
        Preview
      </div>
      <div className="rounded-md bg-white p-3 shadow-sm">
        <p className="text-sm font-medium text-gray-900">
          Subject: {step.subject || '(no subject)'}
        </p>
        <hr className="my-2 border-gray-100" />
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
          {renderPreview(step.body) || '(no body)'}
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  SequenceBuilder                                                           */
/* -------------------------------------------------------------------------- */

function SequenceBuilder({ onSave, onCancel, initialData }) {
  const [name, setName] = useState(initialData?.name || '');
  const [steps, setSteps] = useState(
    initialData?.steps?.length
      ? initialData.steps.map((s, i) => ({
          ...s,
          order: i + 1,
          send_condition: s.send_condition || 'always',
        }))
      : [{ order: 1, type: 'email', subject: '', body: '', delay_days: 0, send_condition: 'always' }],
  );
  const [previewIndex, setPreviewIndex] = useState(null);

  const addStep = () => {
    setSteps([
      ...steps,
      {
        order: steps.length + 1,
        type: 'email',
        subject: '',
        body: '',
        delay_days: 3,
        send_condition: 'always',
      },
    ]);
  };

  const removeStep = (index) => {
    if (steps.length <= 1) return;
    const updated = steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i + 1 }));
    setSteps(updated);
    if (previewIndex === index) setPreviewIndex(null);
  };

  const moveStep = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    const updated = [...steps];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    setSteps(updated.map((s, i) => ({ ...s, order: i + 1 })));
    if (previewIndex === index) setPreviewIndex(target);
    else if (previewIndex === target) setPreviewIndex(index);
  };

  const updateStep = (index, field, value) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], [field]: value };
    setSteps(updated);
  };

  const insertVariable = (index, variable) => {
    const step = steps[index];
    const textarea = document.getElementById(`step-body-${index}`);
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newBody = step.body.substring(0, start) + variable + step.body.substring(end);
      updateStep(index, 'body', newBody);
    } else {
      updateStep(index, 'body', step.body + variable);
    }
  };

  const handleSave = () => {
    if (!name.trim()) return;
    if (steps.some((s) => !s.subject.trim())) return;
    onSave({ name, steps });
  };

  return (
    <div className="rounded-xl border border-blue-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          {initialData ? 'Duplicate Sequence' : 'Create New Sequence'}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-5">
        {/* Sequence Name */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Sequence Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Cold Outreach - Q2 Campaign"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Steps with visual timeline */}
        <div className="relative space-y-0">
          {steps.map((step, idx) => {
            const isLast = idx === steps.length - 1;

            return (
              <div key={idx} className="relative flex gap-4">
                {/* Left timeline connector */}
                <div className="flex flex-col items-center pt-4">
                  {/* Step circle */}
                  <div className="relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 border-blue-400 bg-white text-xs font-bold text-blue-600 shadow-sm">
                    {step.order}
                  </div>
                  {/* Vertical line to next step */}
                  {!isLast && (
                    <div className="w-0.5 flex-1 bg-gradient-to-b from-blue-300 to-gray-200" />
                  )}
                </div>

                {/* Step card */}
                <div className="mb-4 flex-1 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {/* Drag handle icon */}
                      <GripVertical className="h-4 w-4 text-gray-300" />
                      <span className="text-sm font-medium text-gray-700">Email Step</span>
                      {/* Send condition label */}
                      {step.send_condition && step.send_condition !== 'always' && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                          {getConditionLabel(step.send_condition)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {/* Move up / down */}
                      <button
                        type="button"
                        onClick={() => moveStep(idx, -1)}
                        disabled={idx === 0}
                        title="Move step up"
                        className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveStep(idx, 1)}
                        disabled={idx === steps.length - 1}
                        title="Move step down"
                        className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>

                      <div className="mx-1 h-4 w-px bg-gray-200" />

                      {/* Preview toggle */}
                      <button
                        type="button"
                        onClick={() => setPreviewIndex(previewIndex === idx ? null : idx)}
                        title="Preview rendered email"
                        className={cn(
                          'rounded p-1 transition-colors',
                          previewIndex === idx
                            ? 'bg-blue-100 text-blue-600'
                            : 'text-gray-400 hover:bg-gray-200 hover:text-gray-600',
                        )}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>

                      <div className="mx-1 h-4 w-px bg-gray-200" />

                      {/* Delay */}
                      <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-gray-400" />
                        <input
                          type="number"
                          min="0"
                          max="30"
                          value={step.delay_days}
                          onChange={(e) => updateStep(idx, 'delay_days', Number(e.target.value))}
                          className="w-14 rounded border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                        />
                        <span className="text-xs text-gray-500">day delay</span>
                      </div>

                      {/* Remove step */}
                      {steps.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeStep(idx)}
                          className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <input
                    type="text"
                    placeholder="Email subject line *"
                    value={step.subject}
                    onChange={(e) => updateStep(idx, 'subject', e.target.value)}
                    className="mb-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />

                  <textarea
                    id={`step-body-${idx}`}
                    placeholder="Email body text..."
                    value={step.body}
                    onChange={(e) => updateStep(idx, 'body', e.target.value)}
                    rows={4}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-gray-500">Insert:</span>
                    {templateVariables.map((v) => (
                      <button
                        key={v.value}
                        type="button"
                        onClick={() => insertVariable(idx, v.value)}
                        className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600 hover:bg-blue-100"
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>

                  {/* Send condition dropdown */}
                  <div className="mt-3 flex items-center gap-2 border-t border-gray-200 pt-3">
                    <span className="text-xs text-gray-500">Send condition:</span>
                    <select
                      value={step.send_condition || 'always'}
                      onChange={(e) => updateStep(idx, 'send_condition', e.target.value)}
                      className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 focus:border-blue-500 focus:outline-none"
                    >
                      {SEND_CONDITIONS.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Step preview */}
                  {previewIndex === idx && <StepPreview step={step} />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add Step */}
        <button
          type="button"
          onClick={addStep}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:border-blue-400 hover:text-blue-500"
        >
          <Plus className="h-4 w-4" />
          Add Step
        </button>

        {/* Actions */}
        <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!name.trim() || steps.some((s) => !s.subject.trim())}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-600 disabled:opacity-50"
          >
            Save Sequence
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sequences (page)                                                          */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*  Sequence Attribution — which sequences produced revenue                   */
/* -------------------------------------------------------------------------- */

function SequenceAttributionPanel() {
  const { data, isLoading } = useDealAttribution();

  // Nothing to show until a deal has been attributed to a sequence. Keep the
  // panel silent (rather than an empty card) so it only appears once there's
  // signal — matching the "graceful empty state" convention.
  const rows = (data?.by_sequence || []).filter(
    (r) => safeNum(r.total_deals) > 0
  );
  if (isLoading || !data || rows.length === 0) return null;

  const attributedRevenue = safeNum(data.total_attributed_won_revenue);
  const attributedDeals = safeNum(data.attributed_won_deals);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <DollarSign className="h-5 w-5 text-green-500" />
        <h2 className="text-base font-semibold text-gray-900">Sequence Attribution</h2>
      </div>
      <p className="mb-4 text-xs text-gray-500">
        Won deals and revenue traced back to the sequence that first engaged the company.
      </p>

      {/* Summary */}
      <div className="mb-4 grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-green-50 px-4 py-3 text-center">
          <p className="text-2xl font-bold text-green-700">{fmtMoney(attributedRevenue)}</p>
          <p className="text-xs text-gray-500">Attributed Won Revenue</p>
        </div>
        <div className="rounded-lg bg-blue-50 px-4 py-3 text-center">
          <p className="text-2xl font-bold text-blue-700">{formatNumber(attributedDeals)}</p>
          <p className="text-xs text-gray-500">Attributed Won Deals</p>
        </div>
      </div>

      {/* Per-sequence table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500">
              <th className="px-2 py-2">Sequence</th>
              <th className="px-2 py-2 text-right">Enrolled</th>
              <th className="px-2 py-2 text-right">Won</th>
              <th className="px-2 py-2 text-right">Revenue</th>
              <th className="px-2 py-2 text-right">Open Pipeline</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const unattributed = !r.sequence_id;
              return (
                <tr
                  key={r.sequence_id || 'unattributed'}
                  className="border-b border-gray-50 last:border-0"
                >
                  <td className="px-2 py-2">
                    <span
                      className={cn(
                        'font-medium',
                        unattributed ? 'italic text-gray-400' : 'text-gray-900'
                      )}
                    >
                      {r.sequence_name || 'Unattributed'}
                    </span>
                    {r.sequence_status && r.sequence_status !== 'active' && (
                      <span className="ml-2 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                        {r.sequence_status}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right text-gray-600">
                    {r.enrollments == null ? '—' : formatNumber(r.enrollments)}
                  </td>
                  <td className="px-2 py-2 text-right text-gray-600">
                    {formatNumber(safeNum(r.won_deals))}
                  </td>
                  <td className="px-2 py-2 text-right font-semibold text-green-700">
                    {fmtMoney(r.won_revenue)}
                  </td>
                  <td className="px-2 py-2 text-right text-gray-500">
                    {fmtMoney(r.pipeline_value)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Sequences() {
  const { data: sequences, isLoading, isError } = useSequences();
  const createSequence = useCreateSequence();
  const deleteSequence = useDeleteSequence();
  const [showBuilder, setShowBuilder] = useState(false);
  const [duplicateData, setDuplicateData] = useState(null);

  /* Identify best-performing sequence (highest reply rate among those with > 0 sent) */
  const bestPerformerId = useMemo(() => {
    if (!sequences || sequences.length === 0) return null;
    let bestId = null;
    let bestRate = -1;
    for (const seq of sequences) {
      const s = seq.stats || {};
      const sent = safeNum(s.sent);
      if (sent <= 0) continue;
      const rate = safeNum(s.replied) / sent;
      if (rate > bestRate) {
        bestRate = rate;
        bestId = seq.id;
      }
    }
    // Only highlight if there is a meaningful rate
    return bestRate > 0 ? bestId : null;
  }, [sequences]);

  const handleSave = (data) => {
    createSequence.mutate(data);
    setShowBuilder(false);
    setDuplicateData(null);
  };

  const handleDuplicate = (sequence) => {
    const clonedSteps = (sequence.steps || []).map((s) => ({
      order: s.order,
      type: s.type || 'email',
      subject: s.subject || '',
      body: s.body || '',
      delay_days: s.delay_days ?? 3,
    }));
    setDuplicateData({
      name: `${sequence.name} (Copy)`,
      steps: clonedSteps,
    });
    setShowBuilder(true);
  };

  const handleDelete = (id) => {
    deleteSequence.mutate(id);
  };

  const handleCancel = () => {
    setShowBuilder(false);
    setDuplicateData(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">
            Build the outreach sequences Dialtone sends automatically, and track their performance.
          </p>
        </div>
        {!showBuilder && (
          <button
            type="button"
            onClick={() => setShowBuilder(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-600"
          >
            <Plus className="h-4 w-4" />
            Create Sequence
          </button>
        )}
      </div>

      {/* Quick Stats */}
      {sequences && sequences.length > 0 && !showBuilder && (
        <div className="grid grid-cols-3 gap-3">
          <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <Play className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-lg font-bold text-gray-900">
                {sequences.filter(s => (s.status || 'active') === 'active').length}
              </p>
              <p className="text-xs text-gray-500">Active Sequences</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <Users className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-lg font-bold text-gray-900">
                {formatNumber(sequences.reduce((sum, s) => sum + safeNum(s.stats?.enrolled), 0))}
              </p>
              <p className="text-xs text-gray-500">Total Enrolled</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <Eye className="h-5 w-5 text-indigo-500" />
            <div>
              <p className="text-lg font-bold text-indigo-600">
                {(() => {
                  const totalSent = sequences.reduce((sum, s) => sum + safeNum(s.stats?.sent), 0);
                  const totalOpened = sequences.reduce((sum, s) => sum + safeNum(s.stats?.opened), 0);
                  return safeRate(totalOpened, totalSent);
                })()}%
              </p>
              <p className="text-xs text-gray-500">Avg Open Rate</p>
            </div>
          </div>
        </div>
      )}

      {/* Builder */}
      {showBuilder && (
        <SequenceBuilder
          onSave={handleSave}
          onCancel={handleCancel}
          initialData={duplicateData}
        />
      )}

      {/* Sequence List */}
      {isError ? (
        <EmptyState
          title="Failed to load sequences"
          description="There was an error loading your sequences. Please try again."
          icon={Mail}
        />
      ) : sequences && sequences.length === 0 ? (
        <EmptyState
          title="No sequences yet"
          description="Create your first outreach sequence to start engaging with leads."
          icon={Mail}
          action={{ label: 'Create Sequence', onClick: () => setShowBuilder(true) }}
        />
      ) : (
        <div className="space-y-4">
          {(sequences || []).map((sequence) => (
            <SequenceCard
              key={sequence.id}
              sequence={sequence}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
              isBestPerformer={sequence.id === bestPerformerId}
            />
          ))}
        </div>
      )}

      {/* Aggregate Stats */}
      {sequences && sequences.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-gray-400" />
            <h2 className="text-base font-semibold text-gray-900">Overall Performance</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {formatNumber(sequences.reduce((sum, s) => sum + safeNum(s.stats?.enrolled), 0))}
              </p>
              <p className="text-sm text-gray-500">Total Enrolled</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {formatNumber(sequences.reduce((sum, s) => sum + safeNum(s.stats?.sent), 0))}
              </p>
              <p className="text-sm text-gray-500">Emails Sent</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">
                {(() => {
                  const totalSent = sequences.reduce((sum, s) => sum + safeNum(s.stats?.sent), 0);
                  const totalOpened = sequences.reduce((sum, s) => sum + safeNum(s.stats?.opened), 0);
                  return safeRate(totalOpened, totalSent);
                })()}%
              </p>
              <p className="text-sm text-gray-500">Open Rate</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {(() => {
                  const totalSent = sequences.reduce((sum, s) => sum + safeNum(s.stats?.sent), 0);
                  const totalReplied = sequences.reduce((sum, s) => sum + safeNum(s.stats?.replied), 0);
                  return safeRate(totalReplied, totalSent);
                })()}%
              </p>
              <p className="text-sm text-gray-500">Reply Rate</p>
            </div>
          </div>
        </div>
      )}

      {/* Sequence Attribution — deals & revenue per sequence */}
      {!showBuilder && <SequenceAttributionPanel />}
    </div>
  );
}
