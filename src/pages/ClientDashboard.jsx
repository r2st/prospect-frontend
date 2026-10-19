import { useNavigate } from 'react-router-dom';
import {
  Users, DollarSign, HeartPulse, AlertTriangle, CalendarClock, TrendingUp,
  Trophy, Activity, Clock, BarChart3,
} from 'lucide-react';
import {
  LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar,
} from 'recharts';
import MetricCard from '../components/MetricCard';
import EmptyState from '../components/EmptyState';
import HealthBadge from '../components/HealthBadge';
import { useClientOverview, useClients } from '../hooks/useClients';
import { HEALTH_COLORS, HEALTH_LABELS } from '../lib/constants';
import { formatCurrency, formatDate, timeAgo, daysUntil, cn } from '../lib/utils';

function ChartCard({ title, action, children }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {action}
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

export default function ClientDashboard() {
  const navigate = useNavigate();
  const { data, isLoading } = useClientOverview();

  const revenueData = (data?.revenue_over_time || []).map((r) => ({
    date: shortDate(r.date ?? r.month ?? r.period),
    revenue: r.revenue ?? r.value ?? 0,
  }));

  const healthData = (data?.health_distribution || []).map((h) => {
    const status = h.status || h.health_status;
    return {
      name: HEALTH_LABELS[status] || status,
      value: h.count ?? h.value ?? 0,
      fill: HEALTH_COLORS[status]?.hex || '#9ca3af',
    };
  });

  const retentionData = (data?.retention_over_time || []).map((r) => ({
    date: shortDate(r.date ?? r.month ?? r.period),
    rate: r.rate ?? r.value ?? 0,
  }));

  const renewals = data?.upcoming_renewals || [];

  // Client data for portfolio, leaderboard, and activity sections
  const { data: clients = [] } = useClients();

  // Industry pie chart: aggregate deal_value by industry, top 5
  const INDUSTRY_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#8b5cf6'];
  const industryData = (() => {
    const map = {};
    clients.forEach((c) => {
      const ind = c.industry || 'Other';
      map[ind] = (map[ind] || 0) + (c.deal_value || 0);
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value], i) => ({ name, value, fill: INDUSTRY_COLORS[i % INDUSTRY_COLORS.length] }));
  })();

  // Top 5 clients by deal_value
  const topClients = [...clients]
    .sort((a, b) => (b.deal_value || 0) - (a.deal_value || 0))
    .slice(0, 5);

  // Last 5 clients by last_contact_at
  const recentActivity = [...clients]
    .filter((c) => c.last_contact_at)
    .sort((a, b) => new Date(b.last_contact_at) - new Date(a.last_contact_at))
    .slice(0, 5);

  // Latest retention rate for metric card
  const latestRetentionRate = retentionData.length > 0
    ? `${retentionData[retentionData.length - 1].rate}%`
    : '—';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <HeartPulse className="h-5 w-5 text-rose-500" />
            Client Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-500">Revenue, health, and retention across your client base.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/clients')}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Users className="h-4 w-4" />
          View Clients
        </button>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <MetricCard title="Total Clients" value={data?.total_clients ?? 0} icon={Users} color="teal" />
        <MetricCard title="Total Revenue" value={formatCurrency(data?.total_revenue ?? 0, { compact: true })} icon={DollarSign} color="green" />
        <MetricCard title="Avg Health Score" value={data?.avg_health_score != null ? data.avg_health_score : '—'} icon={HeartPulse} color="purple" />
        <MetricCard title="At Risk" value={data?.at_risk_count ?? 0} icon={AlertTriangle} color="red" />
        <MetricCard title="Retention Rate" value={latestRetentionRate} icon={TrendingUp} color="blue" subtitle="Based on client retention trends" />
      </div>

      {/* Client Portfolio summary */}
      <ChartCard title="Client Portfolio">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col items-center justify-center rounded-lg bg-teal-50 p-4">
            <Users className="mb-1 h-5 w-5 text-teal-600" />
            <span className="text-2xl font-bold text-gray-900">{data?.total_clients ?? 0}</span>
            <span className="text-xs text-gray-500">Total Clients</span>
          </div>
          <div className="flex flex-col items-center justify-center rounded-lg bg-green-50 p-4">
            <DollarSign className="mb-1 h-5 w-5 text-green-600" />
            <span className="text-2xl font-bold text-gray-900">{formatCurrency(data?.total_revenue ?? 0, { compact: true })}</span>
            <span className="text-xs text-gray-500">Total Revenue</span>
          </div>
          <div className="flex flex-col items-center justify-center rounded-lg bg-purple-50 p-4">
            <HeartPulse className="mb-1 h-5 w-5 text-purple-600" />
            <span className="text-2xl font-bold text-gray-900">{data?.avg_health_score != null ? data.avg_health_score : '—'}</span>
            <span className="text-xs text-gray-500">Avg Health Score</span>
          </div>
          <div className="flex flex-col items-center justify-center">
            <span className="mb-2 text-xs font-medium text-gray-500">Revenue by Industry</span>
            {industryData.length === 0 ? (
              <span className="text-xs text-gray-400">No industry data</span>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={120}>
                  <PieChart>
                    <Pie data={industryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={45} paddingAngle={2}>
                      {industryData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatCurrency(v, { compact: true })} contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-1 flex flex-wrap justify-center gap-2">
                  {industryData.map((entry) => (
                    <div key={entry.name} className="flex items-center gap-1 text-[10px] text-gray-600">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.fill }} />
                      {entry.name}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </ChartCard>

      {/* Revenue + health distribution */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard title="Revenue Over Time">
            {isLoading ? (
              <div className="flex h-[280px] items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
              </div>
            ) : revenueData.length === 0 ? (
              <EmptyState icon={TrendingUp} title="No revenue data" description="Revenue trends appear once deals are recorded against clients."
          action={{ label: 'Add a client', href: '/clients' }}
        />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={revenueData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v, { compact: true })} width={60} />
                  <Tooltip
                    formatter={(v) => formatCurrency(v)}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        <ChartCard title="Health Distribution">
          {healthData.length === 0 ? (
            <EmptyState icon={HeartPulse} title="No health data" description="Client health appears once scores are computed."
          action={{ label: 'Add a client', href: '/clients' }}
        />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={healthData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2}>
                    {healthData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 flex flex-wrap justify-center gap-3">
                {healthData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-1.5 text-xs text-gray-600">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.fill }} />
                    {entry.name} ({entry.value})
                  </div>
                ))}
              </div>
            </>
          )}
        </ChartCard>
      </div>

      {/* Retention + upcoming renewals */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard title="Retention Rate">
            {retentionData.length === 0 ? (
              <EmptyState icon={TrendingUp} title="No retention data" description="Retention trends appear once client history accrues."
          action={{ label: 'Add a client', href: '/clients' }}
        />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={retentionData} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} width={44} />
                  <Tooltip formatter={(v) => `${v}%`} contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                  <Line type="monotone" dataKey="rate" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
              <CalendarClock className="h-4 w-4 text-amber-500" />
              Upcoming Renewals
            </h2>
          </div>
          {renewals.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-gray-500">No upcoming renewals.</div>
          ) : (
            <ul className="max-h-[300px] divide-y divide-gray-50 overflow-y-auto">
              {renewals.map((r, i) => {
                const days = daysUntil(r.renewal_date ?? r.date);
                const soon = days != null && days <= 30;
                return (
                  <li key={r.company_id ?? r.id ?? i}>
                    <button
                      type="button"
                      onClick={() => r.company_id && navigate(`/companies/${r.company_id}`)}
                      className="flex w-full items-center gap-3 px-6 py-3 text-left transition-colors hover:bg-gray-50"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-gray-900">
                          {r.company_name || r.name || 'Client'}
                        </span>
                        <span className="block text-xs text-gray-500">
                          {formatDate(r.renewal_date ?? r.date)}
                          {days != null && (
                            <span className={cn('ml-1', soon ? 'text-amber-600' : 'text-gray-400')}>
                              · {days < 0 ? `${Math.abs(days)}d overdue` : `in ${days}d`}
                            </span>
                          )}
                        </span>
                      </span>
                      {(r.value ?? r.deal_value) != null && (
                        <span className="text-sm font-semibold text-gray-900">
                          {formatCurrency(r.value ?? r.deal_value, { compact: true })}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Top Clients + Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard
          title="Top Clients by Revenue"
          action={<Trophy className="h-4 w-4 text-amber-500" />}
        >
          {topClients.length === 0 ? (
            <EmptyState icon={Trophy} title="No clients yet" description="Client rankings appear once deals are recorded."
          action={{ label: 'Add a client', href: '/clients' }}
        />
          ) : (
            <ul className="divide-y divide-gray-50">
              {topClients.map((client, i) => (
                <li key={client.id} className="flex items-center gap-3 py-3">
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-amber-50 text-xs font-bold text-amber-700">
                    {i + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate(`/companies/${client.id}`)}
                    className="min-w-0 flex-1 truncate text-left text-sm font-medium text-blue-600 hover:underline"
                  >
                    {client.name}
                  </button>
                  <span className="text-sm font-semibold text-gray-900">
                    {formatCurrency(client.deal_value || 0, { compact: true })}
                  </span>
                  <HealthBadge status={client.health_status} />
                </li>
              ))}
            </ul>
          )}
        </ChartCard>

        <ChartCard
          title="Recent Client Activity"
          action={<Activity className="h-4 w-4 text-blue-500" />}
        >
          {recentActivity.length === 0 ? (
            <EmptyState icon={Clock} title="No recent activity" description="Client activity will appear once contacts are logged." />
          ) : (
            <ul className="divide-y divide-gray-50">
              {recentActivity.map((client) => (
                <li key={client.id} className="flex items-center gap-3 py-3">
                  <span
                    className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: HEALTH_COLORS[client.health_status]?.hex || '#9ca3af' }}
                  />
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => navigate(`/companies/${client.id}`)}
                      className="block truncate text-sm font-medium text-gray-900 hover:text-blue-600"
                    >
                      {client.name}
                    </button>
                    <span className="text-xs text-gray-500">
                      Last contacted {timeAgo(client.last_contact_at)}
                    </span>
                  </div>
                  <HealthBadge status={client.health_status} />
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
