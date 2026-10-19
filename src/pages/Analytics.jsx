import { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail,
  Eye,
  MessageSquare,
  MousePointerClick,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Activity,
  Send,
  Download,
  Users,
  ChevronDown,
  Lightbulb,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  Legend,
} from 'recharts';
import ScoreBadge from '../components/ScoreBadge';
import EmptyState from '../components/EmptyState';
import {
  useAnalyticsMetrics,
  useEmailTrendsAnalytics,
  useTopEngagedLeads,
  useRecentEmailActivity,
  useAnalyticsEmailSends,
  useContactGrowth,
  useEmailPerformance,
  usePipelineAnalytics,
} from '../hooks/useAnalytics';
import { STAGES, STAGE_LABELS, STAGE_COLORS } from '../lib/constants';
import { formatNumber, timeAgo, cn } from '../lib/utils';

/* ---------- helpers ---------- */

function shortDate(d) {
  const parts = String(d).split('-');
  if (parts.length !== 3) return d;
  const dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function pctChange(current, previous) {
  if (!previous) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function getYTDDays() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return Math.ceil((now - start) / (1000 * 60 * 60 * 24));
}

/* ---------- skeleton / card components ---------- */

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-4 w-24 rounded bg-gray-200" />
          <div className="h-7 w-16 rounded bg-gray-200" />
        </div>
        <div className="h-12 w-12 rounded-full bg-gray-200" />
      </div>
    </div>
  );
}

function ChartCard({ title, children, className, headerRight }) {
  return (
    <div className={cn('rounded-xl border border-gray-200 bg-white p-6 shadow-sm', className)}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {headerRight && <div>{headerRight}</div>}
      </div>
      {children}
    </div>
  );
}

function RateCard({ title, value, icon: Icon, color, subtitle, colorCode }) {
  const colorMap = {
    blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
    green: { bg: 'bg-green-100', text: 'text-green-600' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
    teal: { bg: 'bg-teal-100', text: 'text-teal-600' },
    yellow: { bg: 'bg-yellow-100', text: 'text-yellow-600' },
    red: { bg: 'bg-red-100', text: 'text-red-600' },
  };
  const palette = colorMap[color] || colorMap.blue;

  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="space-y-1">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className={cn('text-2xl font-bold', colorCode || 'text-gray-900')}>{value}</p>
        {subtitle && (
          <div className="flex items-center gap-1">
            {subtitle.trend >= 0 ? (
              <TrendingUp className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-red-500" />
            )}
            <span
              className={cn(
                'text-xs font-medium',
                subtitle.trend >= 0 ? 'text-green-600' : 'text-red-600'
              )}
            >
              {subtitle.trend >= 0 ? '+' : ''}
              {subtitle.trend}% {subtitle.label}
            </span>
          </div>
        )}
      </div>
      {Icon && (
        <div className={cn('flex h-12 w-12 items-center justify-center rounded-full', palette.bg)}>
          <Icon className={cn('h-6 w-6', palette.text)} />
        </div>
      )}
    </div>
  );
}

/* ---------- gauge circle ---------- */

function GaugeCircle({ label, value, color, maxValue = 100 }) {
  const size = 120;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(value / maxValue, 1);
  const offset = circumference * (1 - pct);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute mt-[42px] flex flex-col items-center">
        <span className="text-xl font-bold text-gray-900">{value}%</span>
      </div>
      <p className="text-sm font-medium text-gray-600 -mt-1">{label}</p>
    </div>
  );
}

/* ---------- insight card ---------- */

function InsightCard({ text, type = 'neutral' }) {
  const borderColor = {
    positive: 'border-l-green-500',
    negative: 'border-l-red-500',
    neutral: 'border-l-blue-500',
  }[type] || 'border-l-blue-500';

  const iconColor = {
    positive: 'text-green-500',
    negative: 'text-red-500',
    neutral: 'text-blue-500',
  }[type] || 'text-blue-500';

  return (
    <div className={cn('rounded-lg border border-gray-200 border-l-4 bg-white px-4 py-3 shadow-sm', borderColor)}>
      <div className="flex items-start gap-2">
        <Lightbulb className={cn('mt-0.5 h-4 w-4 flex-shrink-0', iconColor)} />
        <p className="text-sm text-gray-700">{text}</p>
      </div>
    </div>
  );
}

/* ---------- send timing heatmap ---------- */

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = ['6a', '8a', '10a', '12p', '2p', '4p', '6p', '8p'];

function SendTimingHeatmap({ emailSends }) {
  // Compute heatmap from real email send timestamps.
  // Groups sends by day-of-week (Mon=0) and hour bucket.
  const { heatData, maxVal } = useMemo(() => {
    const hourBuckets = [6, 8, 10, 12, 14, 16, 18, 20]; // start of each 2-hour window
    // 7 days x 8 hour-buckets, initialised to 0
    const grid = Array.from({ length: 7 }, () => Array(hourBuckets.length).fill(0));

    const items = Array.isArray(emailSends) ? emailSends : [];
    items.forEach((send) => {
      const ts = send.sent_at || send.created_at;
      if (!ts) return;
      const dt = new Date(ts);
      if (isNaN(dt)) return;
      const dow = (dt.getDay() + 6) % 7; // Mon=0 ... Sun=6
      const hour = dt.getHours();
      // Find which bucket this hour falls into
      let bucketIdx = -1;
      for (let i = hourBuckets.length - 1; i >= 0; i--) {
        if (hour >= hourBuckets[i]) { bucketIdx = i; break; }
      }
      if (bucketIdx >= 0) grid[dow][bucketIdx]++;
    });

    let peak = 0;
    grid.forEach((row) => row.forEach((v) => { if (v > peak) peak = v; }));

    return { heatData: grid, maxVal: peak || 1 };
  }, [emailSends]);

  function cellColor(val) {
    if (val === 0) return 'bg-gray-50';
    const intensity = val / maxVal;
    if (intensity > 0.75) return 'bg-blue-600 text-white';
    if (intensity > 0.5) return 'bg-blue-400 text-white';
    if (intensity > 0.25) return 'bg-blue-200 text-blue-800';
    return 'bg-blue-100 text-blue-700';
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr>
            <th className="p-1 text-xs text-gray-400" />
            {HOURS.map((h) => (
              <th key={h} className="p-1 text-center text-xs font-medium text-gray-500">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DAYS.map((day, di) => (
            <tr key={day}>
              <td className="p-1 text-xs font-medium text-gray-500">{day}</td>
              {HOURS.map((_, hi) => (
                <td key={hi} className="p-1">
                  <div
                    className={cn(
                      'flex h-8 items-center justify-center rounded text-xs font-medium',
                      cellColor(heatData[di][hi])
                    )}
                  >
                    {heatData[di][hi] > 0 ? heatData[di][hi] : ''}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex items-center justify-end gap-2 text-xs text-gray-400">
        <span>Low</span>
        <div className="flex gap-0.5">
          <div className="h-3 w-6 rounded-sm bg-blue-100" />
          <div className="h-3 w-6 rounded-sm bg-blue-200" />
          <div className="h-3 w-6 rounded-sm bg-blue-400" />
          <div className="h-3 w-6 rounded-sm bg-blue-600" />
        </div>
        <span>High</span>
      </div>
    </div>
  );
}

/* ---------- email status badge ---------- */

function EmailStatusBadge({ status }) {
  const statusConfig = {
    email_sent: { label: 'Sent', bg: 'bg-blue-100', text: 'text-blue-700' },
    email_opened: { label: 'Opened', bg: 'bg-green-100', text: 'text-green-700' },
    email_replied: { label: 'Replied', bg: 'bg-purple-100', text: 'text-purple-700' },
    email_clicked: { label: 'Clicked', bg: 'bg-teal-100', text: 'text-teal-700' },
    sent: { label: 'Sent', bg: 'bg-blue-100', text: 'text-blue-700' },
    delivered: { label: 'Delivered', bg: 'bg-blue-100', text: 'text-blue-700' },
    opened: { label: 'Opened', bg: 'bg-green-100', text: 'text-green-700' },
    replied: { label: 'Replied', bg: 'bg-purple-100', text: 'text-purple-700' },
    clicked: { label: 'Clicked', bg: 'bg-teal-100', text: 'text-teal-700' },
    bounced: { label: 'Bounced', bg: 'bg-red-100', text: 'text-red-700' },
    failed: { label: 'Failed', bg: 'bg-red-100', text: 'text-red-700' },
  };
  const config = statusConfig[status] || { label: status || 'Unknown', bg: 'bg-gray-100', text: 'text-gray-700' };
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', config.bg, config.text)}>
      {config.label}
    </span>
  );
}

/* ---------- custom tooltip ---------- */

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md">
      <p className="mb-1 text-xs font-medium text-gray-500">{label}</p>
      {payload.map((entry, i) => {
        // Calculate change from previous data point if available
        const chartData = entry.payload;
        const dataKey = entry.dataKey;
        const prevKey = `prev_${dataKey}`;
        const prevValue = chartData?.[prevKey];
        const change = prevValue != null && prevValue > 0
          ? Math.round(((entry.value - prevValue) / prevValue) * 100)
          : null;

        return (
          <div key={i} className="flex items-center gap-2">
            <p className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatNumber(entry.value)}
            </p>
            {change != null && (
              <span className={cn('text-xs font-medium', change >= 0 ? 'text-green-600' : 'text-red-600')}>
                {change >= 0 ? '+' : ''}{change}%
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- pie chart label ---------- */

const PIE_COLORS = ['#8b5cf6', '#3b82f6', '#14b8a6', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#10b981'];

function renderPieLabel({ cx, cy, midAngle, innerRadius, outerRadius, name, percent }) {
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 24;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  if (percent < 0.04) return null;
  return (
    <text
      x={x}
      y={y}
      fill="#374151"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      fontSize={11}
    >
      {name} ({(percent * 100).toFixed(0)}%)
    </text>
  );
}

/* ---------- export dropdown ---------- */

function ExportDropdown({ onExportCSV, onExportSummary }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
      >
        <Download className="h-4 w-4" />
        Download Report
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            onClick={() => { onExportCSV(); setOpen(false); }}
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            onClick={() => { onExportSummary(); setOpen(false); }}
          >
            <Mail className="h-3.5 w-3.5" />
            Export Summary
          </button>
        </div>
      )}
    </div>
  );
}

/* ========== MAIN COMPONENT ========== */

export default function Analytics() {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState(30); // days
  const [compareMode, setCompareMode] = useState(false);

  const ytdDays = useMemo(() => getYTDDays(), []);

  const dateRangeOptions = [
    { label: '7d', value: 7 },
    { label: '30d', value: 30 },
    { label: '90d', value: 90 },
    { label: '365d', value: 365 },
    { label: 'YTD', value: ytdDays },
  ];

  const { data: metrics, isLoading: metricsLoading } = useAnalyticsMetrics();
  const { data: trends, isLoading: trendsLoading } = useEmailTrendsAnalytics(dateRange);
  const { data: comparisonTrends } = useEmailTrendsAnalytics(compareMode ? dateRange * 2 : dateRange);
  const { data: topLeads, isLoading: leadsLoading } = useTopEngagedLeads(10);
  const { data: recentEmails, isLoading: emailsLoading } = useRecentEmailActivity(20);
  const { data: emailSends, isLoading: sendsLoading } = useAnalyticsEmailSends(20);
  const { data: allEmailSends } = useAnalyticsEmailSends(500); // larger set for heatmap
  const { data: contactGrowth } = useContactGrowth(dateRange);
  const { data: emailPerf } = useEmailPerformance(dateRange);
  const { data: pipelineAnalytics } = usePipelineAnalytics();

  // --- Derived data ---

  const emailTrend = pctChange(
    metrics?.emails_sent_last_week || 0,
    metrics?.emails_sent_prev_week || 0
  );

  const openRateColor = useMemo(() => {
    const rate = metrics?.open_rate || 0;
    if (rate >= 25) return 'text-green-600';
    if (rate >= 15) return 'text-yellow-600';
    return 'text-red-600';
  }, [metrics?.open_rate]);

  // Email activity over time (line chart data)
  const trendData = useMemo(() => {
    return (trends || []).map((t, i) => {
      const prev = (trends || [])[i - 1];
      return {
        date: shortDate(t.date),
        Sent: t.sent || 0,
        Opened: t.opened || t.opens || 0,
        Replied: t.replied || t.replies || 0,
        prev_Sent: prev ? (prev.sent || 0) : null,
        prev_Opened: prev ? (prev.opened || prev.opens || 0) : null,
        prev_Replied: prev ? (prev.replied || prev.replies || 0) : null,
      };
    });
  }, [trends]);

  // Comparison data: split the doubled-range data into previous and current periods
  const comparisonData = useMemo(() => {
    if (!compareMode || !comparisonTrends || comparisonTrends.length === 0) return null;
    const all = (comparisonTrends || []).map((t) => ({
      date: shortDate(t.date),
      Sent: t.sent || 0,
      Opened: t.opened || t.opens || 0,
      Replied: t.replied || t.replies || 0,
    }));
    const midpoint = Math.floor(all.length / 2);
    const previous = all.slice(0, midpoint);
    const current = all.slice(midpoint);
    // Merge previous period data onto current period by index
    return current.map((c, i) => ({
      ...c,
      'Prev Sent': previous[i]?.Sent || 0,
      'Prev Opened': previous[i]?.Opened || 0,
      'Prev Replied': previous[i]?.Replied || 0,
    }));
  }, [compareMode, comparisonTrends]);

  const chartData = compareMode && comparisonData ? comparisonData : trendData;

  // Period comparison metrics for RateCard subtitles when compareMode is on
  const periodComparison = useMemo(() => {
    if (!compareMode || !comparisonTrends || comparisonTrends.length === 0) return null;
    const all = comparisonTrends || [];
    const midpoint = Math.floor(all.length / 2);
    const previous = all.slice(0, midpoint);
    const current = all.slice(midpoint);

    const sum = (arr, key1, key2) => arr.reduce((s, t) => s + (t[key1] || t[key2] || 0), 0);
    const prevSent = sum(previous, 'sent', 'sent');
    const currSent = sum(current, 'sent', 'sent');

    // Rate of `key` against sent, as a percentage, rounded the way the card
    // displays it — so the badge agrees with the numbers either side of it.
    const rate = (arr, sent, key1, key2) =>
      sent > 0 ? Math.round((sum(arr, key1, key2) / sent) * 1000) / 10 : 0;

    return {
      openRate: pctChange(rate(current, currSent, 'opened', 'opens'), rate(previous, prevSent, 'opened', 'opens')),
      replyRate: pctChange(rate(current, currSent, 'replied', 'replies'), rate(previous, prevSent, 'replied', 'replies')),
      // Was hardcoded to 0 with a comment saying clicks weren't in the trend
      // series. They are — `/dashboard/email-trends` returns `clicked` per day
      // alongside opened and replied. The comment stayed true to its own
      // history and false about the endpoint, and the cost of that is not a
      // missing badge: `pctChange` renders 0 as a real reading, so the Click
      // Rate card carried a flat "0% vs previous period" through every change
      // clicks actually made. Same shape as the two above it.
      clickRate: pctChange(rate(current, currSent, 'clicked', 'clicks'), rate(previous, prevSent, 'clicked', 'clicks')),
    };
  }, [compareMode, comparisonTrends]);

  // Pipeline conversion funnel
  const funnelData = useMemo(() => {
    const stageCounts = Object.fromEntries(
      (metrics?.pipeline || []).map((p) => [p.stage, p.count])
    );
    const funnelStages = ['new', 'scored', 'contacted', 'engaged', 'qualified', 'opportunity'];
    return funnelStages.map((stage) => ({
      stage: STAGE_LABELS[stage] || stage,
      count: stageCounts[stage] || 0,
      fill: STAGE_COLORS[stage]?.hex || '#6b7280',
    }));
  }, [metrics?.pipeline]);

  // Top performing industries (pie chart data)
  const industryData = useMemo(() => {
    return (metrics?.industry_breakdown || [])
      .slice(0, 8)
      .map((i, idx) => ({
        name: i.industry || 'Unknown',
        value: i.count || 0,
        fill: PIE_COLORS[idx % PIE_COLORS.length],
      }));
  }, [metrics?.industry_breakdown]);

  // Combine recent email activity + email sends for the activity log
  const emailActivityLog = useMemo(() => {
    const activityItems = (recentEmails || []).map((item) => ({
      id: item.id,
      company: item.company_name || item.description?.split(' ').slice(-2).join(' ') || 'Unknown',
      subject: item.subject || item.description || '',
      status: item.type || item.status || 'email_sent',
      date: item.created_at || item.sent_at,
      company_id: item.company_id,
    }));
    const sendItems = (emailSends || []).map((item) => ({
      id: `send-${item.id}`,
      company: item.company_name || item.to_name || 'Unknown',
      subject: item.subject || '',
      status: item.status || 'sent',
      date: item.sent_at || item.created_at,
      company_id: item.company_id,
    }));
    // Merge, deduplicate, and sort
    const merged = [...activityItems, ...sendItems];
    const seen = new Set();
    const unique = merged.filter((item) => {
      const key = `${item.company}-${item.subject}-${item.status}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return unique.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 20);
  }, [recentEmails, emailSends]);

  const contactGrowthData = useMemo(() => {
    return (contactGrowth || []).map((item) => ({
      week: shortDate(item.week),
      count: item.count,
    }));
  }, [contactGrowth]);

  // --- Key Insights ---
  const insights = useMemo(() => {
    if (metricsLoading || !metrics) return [];
    const items = [];

    // Open rate vs industry average
    const openRate = metrics.open_rate || 0;
    const industryAvg = 20;
    if (openRate > 0) {
      const diff = openRate - industryAvg;
      items.push({
        text: `Open rate is ${openRate}% — ${diff >= 0 ? 'above' : 'below'} the industry average of ${industryAvg}%`,
        type: diff >= 0 ? 'positive' : 'negative',
      });
    }

    // Dormant contacts
    const dormant = metrics.dormant_contacts || metrics.contacts_not_contacted_30d || 0;
    if (dormant > 0) {
      items.push({
        text: `${formatNumber(dormant)} contacts haven't been contacted in 30+ days`,
        type: 'negative',
      });
    }

    // Week-over-week email volume change
    if (emailTrend !== 0) {
      items.push({
        text: `${Math.abs(emailTrend)}% week-over-week email volume ${emailTrend >= 0 ? 'increase' : 'decrease'}`,
        type: emailTrend >= 0 ? 'positive' : 'negative',
      });
    }

    // Top industry
    const topIndustry = (metrics.industry_breakdown || [])[0];
    if (topIndustry) {
      items.push({
        text: `Top industry: ${topIndustry.industry || 'Unknown'} with ${formatNumber(topIndustry.count)} contacts`,
        type: 'neutral',
      });
    }

    // Reply rate insight
    const replyRate = metrics.reply_rate || 0;
    if (replyRate > 0) {
      items.push({
        text: `Reply rate of ${replyRate}% ${replyRate >= 5 ? 'shows strong engagement' : 'has room for improvement'}`,
        type: replyRate >= 5 ? 'positive' : 'neutral',
      });
    }

    return items.slice(0, 4);
  }, [metrics, metricsLoading, emailTrend]);

  // --- Deliverability rates ---
  const bounceRate = useMemo(() => {
    if (metrics?.bounce_rate != null) return Math.round(metrics.bounce_rate * 10) / 10;
    if (metrics?.bounced && metrics?.emails_sent) return Math.round((metrics.bounced / metrics.emails_sent) * 1000) / 10;
    return 0;
  }, [metrics]);

  const spamRate = useMemo(() => {
    if (metrics?.spam_rate != null) return Math.round(metrics.spam_rate * 10) / 10;
    return 0;
  }, [metrics]);

  const unsubRate = useMemo(() => {
    if (metrics?.unsubscribe_rate != null) return Math.round(metrics.unsubscribe_rate * 10) / 10;
    return 0;
  }, [metrics]);

  // --- Best day to send ---
  const bestSendDay = useMemo(() => {
    if (!trends || trends.length === 0) return null;
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayBuckets = {};
    (trends || []).forEach((t) => {
      const parts = String(t.date).split('-');
      if (parts.length !== 3) return;
      const dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      if (isNaN(dt)) return;
      const day = dayNames[dt.getDay()];
      if (!dayBuckets[day]) dayBuckets[day] = { opens: 0, sent: 0 };
      dayBuckets[day].opens += (t.opened || t.opens || 0);
      dayBuckets[day].sent += (t.sent || 0);
    });

    let best = null;
    Object.entries(dayBuckets).forEach(([day, data]) => {
      if (data.sent === 0) return;
      const rate = Math.round((data.opens / data.sent) * 1000) / 10;
      if (!best || rate > best.rate) best = { day, rate };
    });
    return best;
  }, [trends]);

  // --- Export handlers ---

  function handleExportCSV() {
    const rows = [['Section', 'Metric', 'Value']];
    // Key metrics
    rows.push(['Key Metrics', 'Total Emails Sent', metrics?.emails_sent || 0]);
    rows.push(['Key Metrics', 'Open Rate', `${metrics?.open_rate || 0}%`]);
    rows.push(['Key Metrics', 'Reply Rate', `${metrics?.reply_rate || 0}%`]);
    rows.push(['Key Metrics', 'Click Rate', `${metrics?.click_rate || 0}%`]);
    rows.push(['Key Metrics', 'Bounce Rate', `${bounceRate}%`]);
    rows.push(['Key Metrics', 'Spam Rate', `${spamRate}%`]);
    rows.push(['Key Metrics', 'Unsubscribe Rate', `${unsubRate}%`]);
    rows.push([]);
    // Trend data
    rows.push(['Date', 'Sent', 'Opened', 'Replied']);
    (trends || []).forEach((t) => {
      rows.push([t.date, t.sent || 0, t.opened || t.opens || 0, t.replied || t.replies || 0]);
    });
    rows.push([]);
    // Pipeline
    rows.push(['Pipeline Stage', 'Count', '']);
    (funnelData || []).forEach((s) => {
      rows.push([s.stage, s.count, '']);
    });
    rows.push([]);
    // Top leads
    rows.push(['Top Lead', 'Score', 'Interactions']);
    (topLeads || []).forEach((l) => {
      rows.push([l.name, l.score || '', l.total_interactions || 0]);
    });

    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-full-${dateRange}d-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExportSummary() {
    const lines = [
      `DoAide Prospect Analytics Summary - ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      `Period: Last ${dateRange} days`,
      '',
      '--- Key Metrics ---',
      `Total Emails Sent: ${formatNumber(metrics?.emails_sent || 0)}`,
      `Open Rate: ${metrics?.open_rate || 0}%`,
      `Reply Rate: ${metrics?.reply_rate || 0}%`,
      `Click Rate: ${metrics?.click_rate || 0}%`,
      `Week-over-Week Trend: ${emailTrend >= 0 ? '+' : ''}${emailTrend}%`,
      '',
      '--- Pipeline ---',
      ...(funnelData || []).map((s) => `${s.stage}: ${s.count}`),
      '',
      '--- Top Industries ---',
      ...(industryData || []).map((i) => `${i.name}: ${i.value}`),
      '',
      '--- Insights ---',
      ...insights.map((i) => `- ${i.text}`),
    ];
    const text = lines.join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-summary-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Date range label for display
  const dateRangeLabel = dateRange === ytdDays ? 'YTD' : `Last ${dateRange} Days`;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">
            Email campaign performance and lead engagement insights
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
            {dateRangeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDateRange(opt.value)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  dateRange === opt.value
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setCompareMode((c) => !c)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium shadow-sm transition-colors',
              compareMode
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            )}
            title="Compare with previous period"
          >
            {compareMode ? (
              <ToggleRight className="h-4 w-4" />
            ) : (
              <ToggleLeft className="h-4 w-4" />
            )}
            Compare
          </button>
          <ExportDropdown onExportCSV={handleExportCSV} onExportSummary={handleExportSummary} />
        </div>
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metricsLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <RateCard
              title="Total Emails Sent"
              value={formatNumber(metrics?.emails_sent || 0)}
              icon={Mail}
              color="blue"
              subtitle={{ trend: emailTrend, label: 'vs last week' }}
            />
            <RateCard
              title="Open Rate"
              value={`${metrics?.open_rate || 0}%`}
              icon={Eye}
              color="green"
              colorCode={openRateColor}
              subtitle={compareMode && periodComparison ? { trend: periodComparison.openRate, label: 'vs previous period' } : undefined}
            />
            <RateCard
              title="Reply Rate"
              value={`${metrics?.reply_rate || 0}%`}
              icon={MessageSquare}
              color="purple"
              subtitle={compareMode && periodComparison ? { trend: periodComparison.replyRate, label: 'vs previous period' } : undefined}
            />
            <RateCard
              title="Click Rate"
              value={`${metrics?.click_rate || 0}%`}
              icon={MousePointerClick}
              color="teal"
              subtitle={compareMode && periodComparison ? { trend: periodComparison.clickRate, label: 'vs previous period' } : undefined}
            />
          </>
        )}
      </div>

      {/* Gauge-style Rate Circles */}
      {!metricsLoading && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-900">Performance Gauges</h2>
          <div className="flex items-center justify-center gap-12 flex-wrap">
            <div className="relative flex flex-col items-center">
              <GaugeCircle label="Open Rate" value={metrics?.open_rate || 0} color="#22c55e" />
            </div>
            <div className="relative flex flex-col items-center">
              <GaugeCircle label="Reply Rate" value={metrics?.reply_rate || 0} color="#8b5cf6" />
            </div>
            <div className="relative flex flex-col items-center">
              <GaugeCircle label="Click Rate" value={metrics?.click_rate || 0} color="#14b8a6" />
            </div>
          </div>
        </div>
      )}

      {/* Deliverability */}
      {!metricsLoading && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-900">Deliverability</h2>
          <div className="flex items-center justify-center gap-12 flex-wrap">
            <div className="relative flex flex-col items-center">
              <GaugeCircle label="Bounce Rate" value={bounceRate} color="#ef4444" maxValue={20} />
            </div>
            <div className="relative flex flex-col items-center">
              <GaugeCircle label="Spam Rate" value={spamRate} color="#f59e0b" maxValue={5} />
            </div>
            <div className="relative flex flex-col items-center">
              <GaugeCircle label="Unsubscribe Rate" value={unsubRate} color="#6b7280" maxValue={10} />
            </div>
          </div>
        </div>
      )}

      {/* Key Insights Cards */}
      {insights.length > 0 && (
        <div>
          <h2 className="mb-3 text-base font-semibold text-gray-900">Key Insights</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {insights.map((insight, i) => (
              <InsightCard key={i} text={insight.text} type={insight.type} />
            ))}
          </div>
        </div>
      )}

      {/* Best Day to Send Insight */}
      {bestSendDay && (
        <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
              <Lightbulb className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Best Day to Send</p>
              <p className="text-sm text-gray-600">
                <span className="font-bold text-blue-600">{bestSendDay.day}</span> has your highest open rate at{' '}
                <span className="font-bold text-blue-600">{bestSendDay.rate}%</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Charts Section (2x2) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Email Activity Over Time */}
        <ChartCard
          title={`Email Activity (${dateRangeLabel})`}
          headerRight={
            compareMode && (
              <span className="text-xs font-medium text-blue-600 bg-blue-50 rounded-full px-2 py-0.5">
                Comparing with previous period
              </span>
            )
          }
        >
          {trendsLoading ? (
            <div className="flex h-[280px] items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : chartData.length === 0 ? (
            <EmptyState
              icon={Mail}
              title="No email data yet"
              description="Send outreach emails to see activity trends here."
          action={{ label: 'Start a campaign', href: '/outreach' }}
        />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                />
                <Line
                  type="monotone"
                  dataKey="Sent"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="Opened"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="Replied"
                  stroke="#14b8a6"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  activeDot={{ r: 4 }}
                />
                {compareMode && (
                  <>
                    <Line
                      type="monotone"
                      dataKey="Prev Sent"
                      stroke="#3b82f6"
                      strokeWidth={1.5}
                      strokeDasharray="6 3"
                      dot={false}
                      opacity={0.5}
                    />
                    <Line
                      type="monotone"
                      dataKey="Prev Opened"
                      stroke="#8b5cf6"
                      strokeWidth={1.5}
                      strokeDasharray="6 3"
                      dot={false}
                      opacity={0.5}
                    />
                    <Line
                      type="monotone"
                      dataKey="Prev Replied"
                      stroke="#14b8a6"
                      strokeWidth={1.5}
                      strokeDasharray="6 3"
                      dot={false}
                      opacity={0.5}
                    />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Pipeline Conversion Funnel */}
        <ChartCard title="Pipeline Conversion Funnel">
          {metricsLoading ? (
            <div className="flex h-[280px] items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={funnelData}
                margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={36}>
                  {funnelData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Contacts by Industry - Donut/Pie Chart */}
        <ChartCard title="Contacts by Industry">
          {metricsLoading ? (
            <div className="flex h-[280px] items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : industryData.length === 0 ? (
            <EmptyState
              title="No industry data"
              description="Add companies with industry info to see this breakdown."
          action={{ label: 'Import companies', href: '/import' }}
        />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={industryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  label={renderPieLabel}
                  labelLine={{ stroke: '#9ca3af', strokeWidth: 1 }}
                >
                  {industryData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Send Timing Heatmap */}
        <ChartCard title="Email Send Volume by Day & Hour">
          <SendTimingHeatmap emailSends={allEmailSends || emailSends} />
        </ChartCard>
      </div>

      {/* Contact Growth + Pipeline Analytics */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Contact Growth */}
        <ChartCard title="Contact Growth (Weekly)">
          {(contactGrowthData || []).length === 0 ? (
            <EmptyState
              icon={Users}
              title="No contact data yet"
              description="Add contacts to see growth trends here."
          action={{ label: 'Add contacts', href: '/contacts' }}
        />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={contactGrowthData} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="New Contacts" fill="#14b8a6" radius={[4, 4, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Pipeline Analytics */}
        <ChartCard title="Pipeline Conversion Rates">
          {!pipelineAnalytics?.conversion_rates?.length ? (
            <EmptyState
              title="No pipeline data"
              description="Move companies through stages to see conversion analytics."
          action={{ label: 'Add companies', href: '/companies' }}
        />
          ) : (
            <div className="space-y-3">
              {(pipelineAnalytics.conversion_rates || []).map((cr, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-28 text-xs font-medium text-gray-500 text-right">{cr.from_stage}</span>
                  <div className="flex-1">
                    <div className="relative h-6 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-blue-500 transition-all"
                        style={{ width: `${Math.min(cr.rate, 100)}%` }}
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-700">
                        {cr.rate.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <span className="w-28 text-xs font-medium text-gray-500">{cr.to_stage}</span>
                </div>
              ))}
              <div className="mt-4 grid grid-cols-3 gap-4 border-t border-gray-100 pt-4">
                <div className="text-center">
                  <p className="text-lg font-bold text-green-600">{(pipelineAnalytics.win_rate || 0).toFixed(1)}%</p>
                  <p className="text-xs text-gray-500">Win Rate</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-red-600">{(pipelineAnalytics.loss_rate || 0).toFixed(1)}%</p>
                  <p className="text-xs text-gray-500">Loss Rate</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-900">{(pipelineAnalytics.avg_deal_cycle_days || 0).toFixed(0)}</p>
                  <p className="text-xs text-gray-500">Avg Cycle (days)</p>
                </div>
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Tables Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top 10 Most Engaged Leads */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <h2 className="text-base font-semibold text-gray-900">
              Top Engaged Leads
            </h2>
            <button
              onClick={() => navigate('/companies')}
              className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              View All
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="overflow-x-auto">
            {leadsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
              </div>
            ) : (topLeads || []).length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-gray-500">
                No scored leads yet. Score companies to see engagement data.
              </div>
            ) : (
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Company
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Score
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Stage
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Engagement
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(topLeads || []).slice(0, 10).map((lead, idx) => (
                    <tr
                      key={lead.id || idx}
                      className="cursor-pointer transition-colors hover:bg-gray-50"
                      onClick={() => lead.id && navigate(`/companies/${lead.id}`)}
                    >
                      <td className="whitespace-nowrap px-6 py-3">
                        <span className="font-medium text-blue-600 hover:text-blue-700">
                          {lead.name}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {lead.score != null ? (
                          <ScoreBadge score={lead.score} size="sm" />
                        ) : (
                          <span className="text-sm text-gray-400">--</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                            STAGE_COLORS[lead.stage]?.bg || '',
                            STAGE_COLORS[lead.stage]?.text || ''
                          )}
                        >
                          {STAGE_LABELS[lead.stage] || lead.stage || '--'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <span className="text-sm font-semibold text-gray-700">
                          {lead.total_interactions || 0}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Recent Email Activity Log */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <h2 className="text-base font-semibold text-gray-900">
              Recent Email Activity
            </h2>
            <Activity className="h-4 w-4 text-gray-400" />
          </div>
          <div className="max-h-[440px] overflow-y-auto">
            {(emailsLoading && sendsLoading) ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
              </div>
            ) : emailActivityLog.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-gray-500">
                No email activity yet. Send campaigns to see activity here.
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {emailActivityLog.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50 cursor-pointer"
                    onClick={() =>
                      item.company_id && navigate(`/companies/${item.company_id}`)
                    }
                  >
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-50">
                      <Send className="h-3.5 w-3.5 text-blue-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-gray-700">
                          {item.company}
                        </p>
                        <EmailStatusBadge status={item.status} />
                      </div>
                      <p className="mt-0.5 truncate text-xs text-gray-400">
                        {item.subject || 'No subject'}
                      </p>
                    </div>
                    <span className="flex-shrink-0 text-xs text-gray-400">
                      {item.date ? timeAgo(item.date) : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
