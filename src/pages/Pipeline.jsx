import { useState, useMemo, useCallback } from 'react';
import {
  Filter, Search, Plus, X, LayoutGrid, List, DollarSign, TrendingUp,
  Target, Clock, Award, BarChart3, ChevronDown, AlertCircle, CalendarClock,
} from 'lucide-react';
import DealPipelineColumn from '../components/DealPipelineColumn';
import DealDetailModal from '../components/DealDetailModal';
import DealModal from '../components/DealModal';
import { useDeals, useCreateDeal, useUpdateDeal, useDeleteDeal, useDealMetrics } from '../hooks/useDeals';
import {
  DEAL_STAGES, DEAL_STAGE_LABELS, DEAL_STAGE_COLORS,
  DEAL_STAGE_PROBABILITIES, DEAL_STATUS_LABELS, DEAL_STATUS_COLORS,
} from '../lib/constants';
import { cn, formatCurrency, formatDate } from '../lib/utils';

// --- Skeleton for loading state ---
function SkeletonColumn() {
  return (
    <div className="flex min-w-[280px] max-w-[320px] flex-shrink-0 animate-pulse flex-col rounded-lg border border-gray-200 bg-gray-50">
      <div className="rounded-t-lg border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="h-4 w-20 rounded bg-gray-200" />
          <div className="h-5 w-5 rounded-full bg-gray-200" />
        </div>
        <div className="mt-2 h-3 w-16 rounded bg-gray-100" />
      </div>
      <div className="space-y-2 p-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 rounded-lg bg-gray-200" />
        ))}
      </div>
    </div>
  );
}

// --- Metric card ---
function MetricCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex items-center gap-2">
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', color || 'bg-gray-100')}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500 truncate">{label}</p>
          <p className="text-lg font-bold text-gray-900">{value}</p>
          {sub && <p className="text-xs text-gray-400">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

// --- Pipeline Forecast ---
function PipelineForecast({ deals, metrics }) {
  const forecast = useMemo(() => {
    const now = new Date();
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0);

    let thisMonthWeighted = 0;
    let nextMonthWeighted = 0;

    for (const d of deals) {
      if (d.status !== 'pending') continue;
      const val = Number(d.value) || 0;
      const prob = (DEAL_STAGE_PROBABILITIES[d.deal_stage] || 0) / 100;
      const closeDate = d.close_date ? new Date(d.close_date) : null;

      if (closeDate && closeDate <= thisMonthEnd) {
        thisMonthWeighted += val * prob;
      } else if (closeDate && closeDate <= nextMonthEnd) {
        nextMonthWeighted += val * prob;
      } else {
        // No close date — attribute to this month
        thisMonthWeighted += val * prob;
      }
    }

    return { thisMonthWeighted, nextMonthWeighted };
  }, [deals]);

  return (
    <div className="mb-4 rounded-lg border border-indigo-100 bg-indigo-50/50 p-4">
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-indigo-500" />
          <span className="text-sm font-semibold text-gray-900">Pipeline Forecast</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-gray-500">This month (weighted):</span>
          <span className="text-sm font-bold text-indigo-700">{formatCurrency(forecast.thisMonthWeighted, { compact: true })}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-gray-500">Next month (weighted):</span>
          <span className="text-sm font-bold text-gray-700">{formatCurrency(forecast.nextMonthWeighted, { compact: true })}</span>
        </div>
        {metrics?.win_rate > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-gray-500">Win rate:</span>
            <span className="text-sm font-bold text-emerald-600">{metrics.win_rate}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Deal aging helper ---
function DealAgingBadge({ updatedAt }) {
  if (!updatedAt) return null;
  const days = Math.floor((Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24));
  if (days < 14) return null;
  const isRed = days >= 30;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
        isRed ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
      )}
      title={`Last updated ${days} days ago`}
    >
      <AlertCircle className="h-3 w-3" />
      {days}d
    </span>
  );
}

// --- Table view ---
function DealTableView({ deals, onCardClick }) {
  const [sortField, setSortField] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');

  const sorted = useMemo(() => {
    const list = [...deals];
    list.sort((a, b) => {
      let av = a[sortField], bv = b[sortField];
      if (sortField === 'value') { av = Number(av) || 0; bv = Number(bv) || 0; }
      if (sortField === 'created_at' || sortField === 'updated_at') {
        av = new Date(av).getTime(); bv = new Date(bv).getTime();
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [deals, sortField, sortDir]);

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const SortHeader = ({ field, children, className }) => (
    <th
      className={cn('cursor-pointer select-none px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-700', className)}
      onClick={() => toggleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortField === field && (
          <ChevronDown className={cn('h-3 w-3 transition-transform', sortDir === 'asc' && 'rotate-180')} />
        )}
      </span>
    </th>
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <SortHeader field="title">Title</SortHeader>
            <SortHeader field="value" className="text-right">Value</SortHeader>
            <SortHeader field="deal_stage">Stage</SortHeader>
            <SortHeader field="status">Status</SortHeader>
            <SortHeader field="created_at">Created</SortHeader>
            <SortHeader field="updated_at">Updated</SortHeader>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Age</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">No deals match your filters.</td>
            </tr>
          ) : (
            sorted.map((d) => {
              const stageC = DEAL_STAGE_COLORS[d.deal_stage] || {};
              const statusC = DEAL_STATUS_COLORS[d.status] || DEAL_STATUS_COLORS.pending;
              return (
                <tr
                  key={d.id}
                  className="cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => onCardClick(d)}
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{d.title}</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">{formatCurrency(d.value)}</td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', stageC.bg, stageC.text)}>
                      {DEAL_STAGE_LABELS[d.deal_stage] || d.deal_stage}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', statusC.bg, statusC.text)}>
                      {DEAL_STATUS_LABELS[d.status] || d.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatDate(d.created_at)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatDate(d.updated_at)}</td>
                  <td className="px-4 py-3"><DealAgingBadge updatedAt={d.updated_at} /></td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}


export default function Pipeline() {
  // View state
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'table'
  const [showFilters, setShowFilters] = useState(false);
  const [showWonLost, setShowWonLost] = useState(false);
  const [pipelineSearch, setPipelineSearch] = useState('');
  const [dateRange, setDateRange] = useState('all'); // 'all' | '7' | '30' | '90'
  const [valueMin, setValueMin] = useState('');
  const [valueMax, setValueMax] = useState('');

  // Drag state
  const [draggingId, setDraggingId] = useState(null);

  // Modal state
  const [detailDeal, setDetailDeal] = useState(null);
  const [quickAddStage, setQuickAddStage] = useState(null);
  const [addModalOpen, setAddModalOpen] = useState(false);

  // Data
  const listParams = showWonLost ? {} : { status: 'pending' };
  const { data: allDeals = [], isLoading } = useDeals(listParams);
  const { data: metrics } = useDealMetrics();
  const createDeal = useCreateDeal();
  const updateDeal = useUpdateDeal();
  const deleteDeal = useDeleteDeal();

  // Filter and search
  const filteredDeals = useMemo(() => {
    let list = allDeals;

    // Search
    if (pipelineSearch.trim()) {
      const q = pipelineSearch.trim().toLowerCase();
      list = list.filter(d =>
        (d.title || '').toLowerCase().includes(q) ||
        (d.company_name || '').toLowerCase().includes(q)
      );
    }

    // Date range
    if (dateRange !== 'all') {
      const days = Number(dateRange);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      list = list.filter(d => new Date(d.created_at) >= cutoff);
    }

    // Value range
    if (valueMin !== '') {
      const min = Number(valueMin);
      list = list.filter(d => (Number(d.value) || 0) >= min);
    }
    if (valueMax !== '') {
      const max = Number(valueMax);
      list = list.filter(d => (Number(d.value) || 0) <= max);
    }

    return list;
  }, [allDeals, pipelineSearch, dateRange, valueMin, valueMax]);

  // Group deals by stage for kanban
  const dealsByStage = useMemo(() => {
    const grouped = {};
    for (const stage of DEAL_STAGES) grouped[stage] = [];
    for (const deal of filteredDeals) {
      if (deal.status !== 'pending') continue; // Only pending deals in kanban columns
      if (grouped[deal.deal_stage]) grouped[deal.deal_stage].push(deal);
    }
    return grouped;
  }, [filteredDeals]);

  // Counts of won/lost (for the toggle label)
  const wonLostCount = useMemo(() => {
    if (!showWonLost) return 0;
    return filteredDeals.filter(d => d.status === 'won' || d.status === 'lost').length;
  }, [filteredDeals, showWonLost]);

  const hasActiveFilters = dateRange !== 'all' || valueMin !== '' || valueMax !== '';

  const clearFilters = () => {
    setDateRange('all');
    setValueMin('');
    setValueMax('');
  };

  const handleCardClick = useCallback((deal) => {
    setDetailDeal(deal);
  }, []);

  const handleDealUpdate = useCallback(({ id, data }) => {
    updateDeal.mutate({ id, data }, {
      onSuccess: () => {
        // Refresh the detail modal data if it's the same deal
        if (detailDeal && String(detailDeal.id) === String(id)) {
          // Re-fetch by refetching the list
        }
      },
    });
  }, [updateDeal, detailDeal]);

  const handleDropDeal = (id, stage) => {
    setDraggingId(null);
    updateDeal.mutate({ id, data: { deal_stage: stage } });
  };

  const handleQuickAdd = (stage) => {
    setQuickAddStage(stage);
    setAddModalOpen(true);
  };

  const handleCreateDeal = (payload) => {
    if (quickAddStage) payload.deal_stage = quickAddStage;
    createDeal.mutate(payload, {
      onSuccess: () => {
        setAddModalOpen(false);
        setQuickAddStage(null);
      },
    });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Pipeline Metrics Bar */}
      {metrics && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <MetricCard
            icon={DollarSign}
            label="Pipeline Value"
            value={formatCurrency(metrics.total_pipeline_value, { compact: true })}
            color="bg-blue-500"
          />
          <MetricCard
            icon={TrendingUp}
            label="Weighted Value"
            value={formatCurrency(metrics.weighted_pipeline_value, { compact: true })}
            color="bg-indigo-500"
          />
          <MetricCard
            icon={Target}
            label="Avg Deal Size"
            value={formatCurrency(metrics.average_deal_size, { compact: true })}
            color="bg-purple-500"
          />
          <MetricCard
            icon={BarChart3}
            label="Active Deals"
            value={metrics.deal_count}
            color="bg-teal-500"
          />
          <MetricCard
            icon={Award}
            label="Win Rate"
            value={`${metrics.win_rate}%`}
            color="bg-green-500"
          />
          <MetricCard
            icon={Clock}
            label="Avg Days to Close"
            value={`${metrics.avg_days_to_close}d`}
            color="bg-amber-500"
          />
        </div>
      )}

      {/* Pipeline Forecast */}
      {!isLoading && allDeals.length > 0 && (
        <PipelineForecast deals={allDeals} metrics={metrics} />
      )}

      {/* Top Bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* View toggle */}
        <div className="inline-flex rounded-lg border border-gray-300 bg-white p-0.5">
          <button
            type="button"
            onClick={() => setViewMode('kanban')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              viewMode === 'kanban' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Board
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              viewMode === 'table' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'
            )}
          >
            <List className="h-3.5 w-3.5" />
            Table
          </button>
        </div>

        {/* Filters button */}
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
            showFilters || hasActiveFilters
              ? 'border-blue-300 bg-blue-50 text-blue-700'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
          )}
        >
          <Filter className="h-4 w-4" />
          Filters
          {hasActiveFilters && (
            <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs font-bold text-white">
              {[dateRange !== 'all', valueMin !== '', valueMax !== ''].filter(Boolean).length}
            </span>
          )}
        </button>

        {hasActiveFilters && (
          <button type="button" onClick={clearFilters} className="text-sm text-gray-500 hover:text-gray-700">
            Clear all
          </button>
        )}

        {/* Search */}
        <div className="relative" style={{ minWidth: '200px', maxWidth: '300px' }}>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search deals..."
            value={pipelineSearch}
            onChange={(e) => setPipelineSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Show Won/Lost toggle */}
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showWonLost}
            onChange={(e) => setShowWonLost(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Show Won/Lost
          {wonLostCount > 0 && <span className="text-xs text-gray-400">({wonLostCount})</span>}
        </label>

        {/* Add deal button */}
        <button
          type="button"
          onClick={() => { setQuickAddStage(null); setAddModalOpen(true); }}
          className="ml-auto inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-600"
        >
          <Plus className="h-4 w-4" />
          Add Deal
        </button>
      </div>

      {/* Filter Row */}
      {showFilters && (
        <div className="mb-4 flex flex-wrap items-end gap-4 rounded-lg border border-gray-200 bg-white p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Created</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All Time</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Min Value ($)</label>
            <input
              type="number"
              min="0"
              placeholder="0"
              value={valueMin}
              onChange={(e) => setValueMin(e.target.value)}
              className="h-9 w-28 rounded-md border border-gray-300 px-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Max Value ($)</label>
            <input
              type="number"
              min="0"
              placeholder="No limit"
              value={valueMax}
              onChange={(e) => setValueMax(e.target.value)}
              className="h-9 w-28 rounded-md border border-gray-300 px-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {/* Main content */}
      {viewMode === 'kanban' ? (
        <div className="flex-1 overflow-x-auto pb-4">
          <div className="inline-flex gap-4" style={{ minWidth: 'max-content' }}>
            {isLoading ? (
              DEAL_STAGES.map((stage) => <SkeletonColumn key={stage} />)
            ) : (
              DEAL_STAGES.map((stage) => (
                <DealPipelineColumn
                  key={stage}
                  stage={stage}
                  deals={dealsByStage[stage] || []}
                  onCardClick={handleCardClick}
                  draggingId={draggingId}
                  onCardDragStart={(deal) => setDraggingId(deal.id)}
                  onCardDragEnd={() => setDraggingId(null)}
                  onDropDeal={handleDropDeal}
                  onQuickAdd={handleQuickAdd}
                />
              ))
            )}
          </div>

          {/* Won/Lost sections below kanban when toggled */}
          {showWonLost && !isLoading && (
            <div className="mt-6 space-y-4">
              {['won', 'lost'].map((status) => {
                const statusDeals = filteredDeals.filter(d => d.status === status);
                if (statusDeals.length === 0) return null;
                const statusC = DEAL_STATUS_COLORS[status];
                return (
                  <div key={status} className={cn('rounded-lg border p-4', statusC.border, statusC.bg)}>
                    <h3 className={cn('mb-3 text-sm font-semibold', statusC.text)}>
                      {DEAL_STATUS_LABELS[status]} ({statusDeals.length}) - {formatCurrency(statusDeals.reduce((s, d) => s + (Number(d.value) || 0), 0), { compact: true })}
                    </h3>
                    <div className="flex flex-wrap gap-3">
                      {statusDeals.map((deal) => (
                        <div
                          key={deal.id}
                          onClick={() => handleCardClick(deal)}
                          className="cursor-pointer rounded-lg border border-white/60 bg-white p-3 shadow-sm transition hover:shadow-md"
                          style={{ minWidth: '200px', maxWidth: '260px' }}
                        >
                          <p className="text-sm font-bold text-gray-900 truncate">{deal.title}</p>
                          <p className="mt-1 text-lg font-semibold text-gray-900">{formatCurrency(deal.value)}</p>
                          {deal.lost_reason && (
                            <p className="mt-1 text-xs text-red-600">Reason: {deal.lost_reason}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pb-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
            </div>
          ) : (
            <DealTableView deals={filteredDeals} onCardClick={handleCardClick} />
          )}
        </div>
      )}

      {/* Deal Detail Modal */}
      <DealDetailModal
        open={!!detailDeal}
        onClose={() => setDetailDeal(null)}
        deal={detailDeal}
        onUpdate={handleDealUpdate}
        onDelete={(id) => { deleteDeal.mutate(id); setDetailDeal(null); }}
        updating={updateDeal.isPending}
      />

      {/* Add Deal Modal */}
      <DealModal
        open={addModalOpen}
        onClose={() => { setAddModalOpen(false); setQuickAddStage(null); }}
        onSubmit={handleCreateDeal}
        saving={createDeal.isPending}
      />
    </div>
  );
}
