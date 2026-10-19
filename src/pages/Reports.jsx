import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3, Download, TrendingUp, Filter as FilterIcon, Activity, Trophy,
  Users, DollarSign, Heart, Zap, ShieldCheck, GraduationCap,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ReferenceLine,
} from 'recharts';
import EmptyState from '../components/EmptyState';
import {
  useRetentionReport, useRevenueFunnelReport, useActivityHeatmapReport, useTopClientsReport,
  useLeadQualityReport,
} from '../hooks/useReports';
import { deliverabilityApi } from '../api/client';
import { STAGE_LABELS, STAGE_COLORS } from '../lib/constants';
import { formatCurrency, formatDate, cn } from '../lib/utils';

function ChartCard({ title, icon: Icon, children, className, onExport }) {
  return (
    <div className={cn('rounded-xl border border-gray-200 bg-white p-6 shadow-sm', className)}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
          {Icon && <Icon className="h-4 w-4 text-gray-400" />}
          {title}
        </h2>
        {onExport && (
          <button
            type="button"
            onClick={onExport}
            className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
            title="Export chart data as CSV"
          >
            <Download className="h-3 w-3" />
            CSV
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function shortDate(d) {
  const dt = new Date(d);
  if (isNaN(dt)) return String(d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const GRADE_BAR = { A: 'bg-green-500', B: 'bg-lime-500', C: 'bg-amber-500', D: 'bg-orange-500', F: 'bg-red-400' };

function statusBadge(status) {
  if (status === 'pass') return 'bg-green-50 text-green-700';
  if (status === 'warn') return 'bg-amber-50 text-amber-700';
  if (status === 'fail') return 'bg-red-50 text-red-700';
  return 'bg-gray-100 text-gray-500';
}

// A/B/C/D/F grade distribution for the current leads plus qualified /
// disqualified / average-fit summary stats.
function LeadQualityCard({ report }) {
  const dist = report?.grade_distribution || {};
  const grades = ['A', 'B', 'C', 'D', 'F'];
  const total = grades.reduce((s, g) => s + (dist[g] || 0), 0);
  return (
    <ChartCard title="Lead Quality" icon={GraduationCap}>
      {total === 0 ? (
        <EmptyState icon={GraduationCap} title="No scored leads yet" description="Grades appear once Autopilot scores your leads."
          action={{ label: 'Import companies', href: '/import' }}
        />
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-gray-400">Graded by Dialtone</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              ['Qualified (A/B)', report.qualified_leads ?? 0],
              ['Disqualified', report.disqualified_leads ?? 0],
              ['Avg Fit', report.average_fit_score ?? 0],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-gray-50 p-3">
                <p className="text-[11px] font-medium text-gray-500">{label}</p>
                <p className="mt-0.5 text-lg font-bold text-gray-900">{value}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {grades.map((g) => {
              const count = dist[g] || 0;
              const pct = total ? Math.round((count / total) * 100) : 0;
              return (
                <div key={g} className="flex items-center gap-3">
                  <span className="w-5 text-right text-xs font-semibold text-gray-600">{g}</span>
                  <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-gray-100">
                    <div className={cn('h-full rounded-md', GRADE_BAR[g])} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-10 text-right text-xs text-gray-500">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </ChartCard>
  );
}

// On-demand SPF/DKIM/DMARC check for a sending domain.
function DomainAuthChecker() {
  const [domain, setDomain] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const check = async () => {
    const d = domain.trim();
    if (!d) return;
    setLoading(true); setError(''); setResult(null);
    try {
      setResult(await deliverabilityApi.domainAuth(d));
    } catch {
      setError('Check failed — try again.');
    } finally {
      setLoading(false);
    }
  };

  const rows = result ? [['SPF', result.spf], ['DKIM', result.dkim], ['DMARC', result.dmarc]] : [];
  return (
    <ChartCard title="Domain Authentication" icon={ShieldCheck}>
      <div className="flex gap-2">
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && check()}
          placeholder="yourdomain.com"
          className="h-9 flex-1 rounded-md border border-gray-300 px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={check}
          disabled={loading}
          className="h-9 rounded-md bg-indigo-600 px-4 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? 'Checking…' : 'Check'}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {!result && !error && (
        <p className="mt-3 text-xs text-gray-400">Verify SPF, DKIM and DMARC are set up before warming a sender.</p>
      )}
      {result && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">{result.domain}</span>
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold uppercase', statusBadge(result.overall))}>
              {result.overall}
            </span>
          </div>
          {rows.map(([label, rec]) => (
            <div key={label} className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2">
              <span className="text-xs font-medium text-gray-600">{label}</span>
              <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase', statusBadge(rec?.status))}>
                {rec?.status || 'unknown'}
              </span>
            </div>
          ))}
          {result.recommendations?.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[11px] text-gray-500">
              {result.recommendations.slice(0, 4).map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          )}
        </div>
      )}
    </ChartCard>
  );
}

// Horizontal funnel: bars scaled to the largest stage value.
function RevenueFunnel({ data }) {
  const max = Math.max(...data.map((d) => d.value || 0), 1);
  return (
    <div className="space-y-2">
      {data.map((d) => {
        const pct = ((d.value || 0) / max) * 100;
        const color = STAGE_COLORS[d.stage]?.hex || '#3b82f6';
        return (
          <div key={d.stage} className="flex items-center gap-3">
            <div className="w-24 flex-shrink-0 text-right text-xs font-medium text-gray-600">
              {STAGE_LABELS[d.stage] || d.stage}
            </div>
            <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-gray-100">
              <div
                className="flex h-full items-center justify-end rounded-md px-2 text-[11px] font-semibold text-white transition-all"
                style={{ width: `${Math.max(pct, 6)}%`, backgroundColor: color }}
              >
                {formatCurrency(d.value, { compact: true })}
              </div>
            </div>
            {d.count != null && <span className="w-10 flex-shrink-0 text-xs text-gray-400">{d.count}</span>}
          </div>
        );
      })}
    </div>
  );
}

// GitHub-style activity heatmap from daily { date, count } points.
function ActivityHeatmap({ data }) {
  const byDay = useMemo(() => {
    const map = {};
    let max = 0;
    for (const d of data) {
      const key = new Date(d.date).toDateString();
      const count = d.count ?? d.value ?? 0;
      map[key] = count;
      if (count > max) max = count;
    }
    return { map, max };
  }, [data]);

  // Build ~17 weeks back from today, aligned to weeks (columns) × 7 days (rows).
  const weeks = 17;
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + (6 - end.getDay())); // end of current week
  const columns = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const col = [];
    for (let dow = 0; dow < 7; dow++) {
      const d = new Date(end);
      d.setDate(end.getDate() - w * 7 - (6 - dow));
      col.push(d);
    }
    columns.push(col);
  }

  const level = (count) => {
    if (!count) return 'bg-gray-100';
    const ratio = byDay.max ? count / byDay.max : 0;
    if (ratio > 0.66) return 'bg-emerald-600';
    if (ratio > 0.33) return 'bg-emerald-400';
    return 'bg-emerald-200';
  };

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1">
        {columns.map((col, i) => (
          <div key={i} className="flex flex-col gap-1">
            {col.map((d) => {
              const count = byDay.map[d.toDateString()] || 0;
              const future = d > today;
              return (
                <div
                  key={d.toISOString()}
                  title={`${formatDate(d)}: ${count} ${count === 1 ? 'activity' : 'activities'}`}
                  className={cn('h-3 w-3 rounded-sm', future ? 'bg-transparent' : level(count))}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-gray-400">
        <span>Less</span>
        <span className="h-3 w-3 rounded-sm bg-gray-100" />
        <span className="h-3 w-3 rounded-sm bg-emerald-200" />
        <span className="h-3 w-3 rounded-sm bg-emerald-400" />
        <span className="h-3 w-3 rounded-sm bg-emerald-600" />
        <span>More</span>
      </div>
    </div>
  );
}

function downloadCsv(filename, headers, rows) {
  const escape = (val) => {
    const str = Array.isArray(val) ? val.join('; ') : val == null ? '' : String(val);
    return `"${str.replace(/"/g, '""')}"`;
  };
  const csv = [headers, ...rows].map((r) => r.map(escape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const navigate = useNavigate();
  const [range, setRange] = useState({ start: '', end: '' });

  const params = useMemo(() => {
    const p = {};
    if (range.start) p.start = range.start;
    if (range.end) p.end = range.end;
    return p;
  }, [range]);

  const { data: retention = [] } = useRetentionReport(params);
  const { data: funnel = [] } = useRevenueFunnelReport(params);
  const { data: heatmap = [] } = useActivityHeatmapReport(params);
  const { data: topClients = [] } = useTopClientsReport(params);
  const { data: leadQuality = {} } = useLeadQualityReport(30);

  const retentionData = retention.map((r) => ({ date: shortDate(r.date ?? r.period), rate: r.rate ?? r.value ?? 0 }));
  const funnelData = funnel.map((f) => ({ stage: f.stage, value: f.value ?? f.revenue ?? 0, count: f.count }));

  // Key metrics calculations
  const keyMetrics = useMemo(() => {
    const totalRevenue = funnelData.reduce((sum, f) => sum + (f.value || 0), 0);
    const clientCount = topClients.length;
    const avgHealth = topClients.length > 0
      ? Math.round(topClients.reduce((sum, c) => sum + (c.health_score || 0), 0) / topClients.length)
      : 0;
    const wonStage = funnelData.find(f => f.stage === 'closed_won' || f.stage === 'won');
    const totalDeals = funnelData.reduce((sum, f) => sum + (f.count || 0), 0);
    const wonDeals = wonStage?.count || 0;
    const winRate = totalDeals > 0 ? Math.round((wonDeals / totalDeals) * 100) : 0;
    return { totalRevenue, clientCount, avgHealth, winRate };
  }, [funnelData, topClients]);

  // Date range preset helper
  const setPreset = (preset) => {
    const end = new Date().toISOString().split('T')[0];
    let start;
    const now = new Date();
    if (preset === '7') {
      const d = new Date(now); d.setDate(d.getDate() - 7); start = d.toISOString().split('T')[0];
    } else if (preset === '30') {
      const d = new Date(now); d.setDate(d.getDate() - 30); start = d.toISOString().split('T')[0];
    } else if (preset === '90') {
      const d = new Date(now); d.setDate(d.getDate() - 90); start = d.toISOString().split('T')[0];
    } else if (preset === 'ytd') {
      start = `${now.getFullYear()}-01-01`;
    } else {
      setRange({ start: '', end: '' }); return;
    }
    setRange({ start, end });
  };

  const handleExport = () => {
    if (topClients.length === 0) return;
    downloadCsv(
      'prospect-top-clients.csv',
      ['Client', 'Revenue', 'Deals', 'Health'],
      topClients.map((c) => [c.name ?? c.company_name, c.revenue ?? c.total_revenue ?? '', c.deals ?? c.deal_count ?? '', c.health_score ?? '']),
    );
  };

  // Per-chart export handlers
  const exportRetention = () => {
    if (retentionData.length === 0) return;
    downloadCsv('prospect-retention.csv', ['Date', 'Rate (%)'], retentionData.map(r => [r.date, r.rate]));
  };
  const exportFunnel = () => {
    if (funnelData.length === 0) return;
    downloadCsv('prospect-revenue-funnel.csv', ['Stage', 'Value', 'Count'], funnelData.map(f => [f.stage, f.value, f.count ?? '']));
  };
  const exportHeatmap = () => {
    if (heatmap.length === 0) return;
    downloadCsv('prospect-activity-heatmap.csv', ['Date', 'Count'], heatmap.map(h => [h.date, h.count ?? h.value ?? 0]));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <BarChart3 className="h-5 w-5 text-indigo-500" />
            Reports
          </h1>
          <p className="mt-1 text-sm text-gray-500">Retention, revenue, and activity across your client base.</p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* Key Metrics Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
            <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
            Total Revenue
          </div>
          <p className="mt-1 text-2xl font-bold text-gray-900">{formatCurrency(keyMetrics.totalRevenue, { compact: true })}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
            <Users className="h-3.5 w-3.5 text-blue-500" />
            Client Count
          </div>
          <p className="mt-1 text-2xl font-bold text-gray-900">{keyMetrics.clientCount}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
            <Heart className="h-3.5 w-3.5 text-pink-500" />
            Avg Health Score
          </div>
          <p className="mt-1 text-2xl font-bold text-gray-900">{keyMetrics.avgHealth || '--'}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
            <Trophy className="h-3.5 w-3.5 text-amber-500" />
            Win Rate
          </div>
          <p className="mt-1 text-2xl font-bold text-gray-900">{keyMetrics.winRate}%</p>
        </div>
      </div>

      {/* Date range picker with presets */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        {/* Quick presets */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-500 mr-1">Quick:</span>
          {[
            { label: 'Last 7 days', value: '7' },
            { label: 'Last 30 days', value: '30' },
            { label: 'Last 90 days', value: '90' },
            { label: 'YTD', value: 'ytd' },
            { label: 'All time', value: 'all' },
          ].map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => setPreset(preset.value)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                (!range.start && !range.end && preset.value === 'all')
                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-800'
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-1.5 text-sm font-medium text-gray-500">
            <FilterIcon className="h-4 w-4" />
            Custom range
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">From</label>
            <input
              type="date"
              value={range.start}
              onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
              className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">To</label>
            <input
              type="date"
              value={range.end}
              onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
              className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          {(range.start || range.end) && (
            <button type="button" onClick={() => setRange({ start: '', end: '' })} className="h-9 text-sm text-gray-500 hover:text-gray-700">
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Client Retention" icon={TrendingUp} onExport={retentionData.length > 0 ? exportRetention : undefined}>
          {retentionData.length === 0 ? (
            <EmptyState icon={TrendingUp} title="No retention data" description="Retention appears once client history accrues."
          action={{ label: 'Add a client', href: '/clients' }}
        />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={retentionData} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} width={44} />
                <Tooltip formatter={(v) => `${v}%`} contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                <ReferenceLine y={85} stroke="#f59e0b" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: '85% healthy', position: 'insideTopRight', fill: '#b45309', fontSize: 10 }} />
                <Line type="monotone" dataKey="rate" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Revenue Pipeline Funnel" icon={BarChart3} onExport={funnelData.length > 0 ? exportFunnel : undefined}>
          {funnelData.length === 0 ? (
            <EmptyState icon={BarChart3} title="No pipeline data" description="The funnel appears once deals are recorded by stage."
          action={{ label: 'Add companies', href: '/companies' }}
        />
          ) : (
            <div className="py-2">
              <RevenueFunnel data={funnelData} />
            </div>
          )}
        </ChartCard>
      </div>

      {/* Lead quality + sending-domain authentication */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <LeadQualityCard report={leadQuality} />
        <DomainAuthChecker />
      </div>

      {/* Sales Velocity */}
      <div className="rounded-xl border border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-4 w-4 text-indigo-600" />
          <h2 className="text-base font-semibold text-gray-900">Sales Velocity</h2>
        </div>
        {(() => {
          const avgDealValue = keyMetrics.totalRevenue > 0 && keyMetrics.clientCount > 0
            ? keyMetrics.totalRevenue / keyMetrics.clientCount
            : 0;
          const winRateDecimal = keyMetrics.winRate / 100;
          // Placeholder avg days to close — would come from metrics API
          const avgDaysToClose = 30;
          const velocity = avgDaysToClose > 0 ? (avgDealValue * winRateDecimal) / avgDaysToClose : 0;

          return (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="rounded-lg bg-white/80 p-3">
                <p className="text-[11px] font-medium text-gray-500">Avg Deal Value</p>
                <p className="mt-0.5 text-lg font-bold text-gray-900">{formatCurrency(avgDealValue, { compact: true })}</p>
              </div>
              <div className="rounded-lg bg-white/80 p-3">
                <p className="text-[11px] font-medium text-gray-500">Win Rate</p>
                <p className="mt-0.5 text-lg font-bold text-gray-900">{keyMetrics.winRate}%</p>
              </div>
              <div className="rounded-lg bg-white/80 p-3">
                <p className="text-[11px] font-medium text-gray-500">Avg Days to Close</p>
                <p className="mt-0.5 text-lg font-bold text-gray-900">{avgDaysToClose}d</p>
              </div>
              <div className="rounded-lg bg-white/80 p-3 ring-1 ring-indigo-200">
                <p className="text-[11px] font-medium text-indigo-600">Sales Velocity</p>
                <p className="mt-0.5 text-lg font-bold text-indigo-700">{formatCurrency(velocity, { compact: true })}<span className="text-xs font-normal text-gray-500">/day</span></p>
              </div>
            </div>
          );
        })()}
        <p className="mt-3 text-[11px] text-gray-400">Velocity = (Avg Deal Value x Win Rate) / Avg Days to Close</p>
      </div>

      <ChartCard title="Activity Heatmap" icon={Activity} onExport={heatmap.length > 0 ? exportHeatmap : undefined}>
        {heatmap.length === 0 ? (
          <EmptyState icon={Activity} title="No activity data" description="Activity appears once interactions and outreach are logged."
          action={{ label: 'Start a campaign', href: '/outreach' }}
        />
        ) : (
          <ActivityHeatmap data={heatmap} />
        )}
      </ChartCard>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <Trophy className="h-4 w-4 text-amber-500" />
            Top Clients by Revenue
          </h2>
        </div>
        {topClients.length === 0 ? (
          <EmptyState icon={Trophy} title="No client revenue yet" description="Top clients appear once revenue is recorded."
          action={{ label: 'Add a client', href: '/clients' }}
        />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Client</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Revenue</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Deals</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {topClients.map((c, i) => {
                  const cid = c.company_id ?? c.id;
                  return (
                    <tr
                      key={cid ?? i}
                      className={cn('transition-colors', cid && 'cursor-pointer hover:bg-gray-50')}
                      onClick={() => cid && navigate(`/companies/${cid}`)}
                    >
                      <td className="px-6 py-3 text-sm font-medium text-blue-600">{c.name ?? c.company_name}</td>
                      <td className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                        {formatCurrency(c.revenue ?? c.total_revenue)}
                      </td>
                      <td className="px-6 py-3 text-right text-sm text-gray-600">{c.deals ?? c.deal_count ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
