import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Newspaper,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  Building2,
  Tag,
  Clock,
  Sparkles,
  Filter,
} from 'lucide-react';
import EmptyState from '../components/EmptyState';
import { useNews, useCheckAllNews, useMarkActioned } from '../hooks/useNews';
import { cn, formatDate } from '../lib/utils';

const CATEGORY_COLORS = {
  funding: 'bg-green-100 text-green-700 border-green-200',
  expansion: 'bg-blue-100 text-blue-700 border-blue-200',
  leadership_change: 'bg-purple-100 text-purple-700 border-purple-200',
  acquisition: 'bg-orange-100 text-orange-700 border-orange-200',
  product_launch: 'bg-teal-100 text-teal-700 border-teal-200',
  partnership: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  award: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  hiring: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  general: 'bg-gray-100 text-gray-700 border-gray-200',
};

const CATEGORY_BORDER = {
  funding: 'border-l-green-500',
  expansion: 'border-l-blue-500',
  leadership_change: 'border-l-purple-500',
  acquisition: 'border-l-orange-500',
  product_launch: 'border-l-teal-500',
  partnership: 'border-l-indigo-500',
  award: 'border-l-yellow-500',
  hiring: 'border-l-cyan-500',
  general: 'border-l-gray-400',
};

function formatCategory(cat) {
  if (!cat) return 'General';
  return cat.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

function RelevanceDots({ score }) {
  const maxDots = 10;
  const filled = Math.min(Math.max(Math.round(score || 0), 0), maxDots);
  return (
    <div className="flex items-center gap-0.5" title={`Relevance: ${score}/10`}>
      {[...Array(maxDots)].map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            i < filled ? 'bg-blue-500' : 'bg-gray-200'
          )}
        />
      ))}
      <span className="ml-1.5 text-xs text-gray-400">{score}/10</span>
    </div>
  );
}

function NewsCard({ article, onMarkDone }) {
  const category = article.category || 'general';
  const isActioned = article.actioned;
  const isActionable = article.actionable && !isActioned;

  return (
    <div
      className={cn(
        'rounded-lg border bg-white p-4 transition-colors border-l-4',
        isActioned && 'opacity-50',
        isActionable
          ? CATEGORY_BORDER[category] || CATEGORY_BORDER.general
          : 'border-l-transparent border-gray-200'
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
              CATEGORY_COLORS[category] || CATEGORY_COLORS.general
            )}
          >
            <Tag className="h-3 w-3" />
            {formatCategory(category)}
          </span>
          <Link
            to={`/companies/${article.company_id}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-gray-900 hover:text-blue-600"
          >
            <Building2 className="h-3.5 w-3.5 text-gray-400" />
            {article.company_name || 'Unknown Company'}
          </Link>
        </div>
        {isActioned && (
          <span className="inline-flex items-center gap-1 text-xs text-green-600">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Done
          </span>
        )}
      </div>

      <h3 className="mt-2 text-sm font-semibold text-gray-900">
        {article.url ? (
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-blue-600"
          >
            {article.title}
            <ExternalLink className="h-3 w-3 flex-shrink-0 text-gray-400" />
          </a>
        ) : (
          article.title
        )}
      </h3>

      {article.summary && (
        <p className="mt-1.5 text-sm text-gray-600 line-clamp-3">{article.summary}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-400">
        {article.source && (
          <span className="inline-flex items-center gap-1">
            <Newspaper className="h-3 w-3" />
            {article.source}
          </span>
        )}
        {article.published_at && (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDate(article.published_at)}
          </span>
        )}
        {article.relevance_score != null && (
          <RelevanceDots score={article.relevance_score} />
        )}
      </div>

      {isActionable && article.suggested_action && (
        <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
          <Sparkles className="h-4 w-4 flex-shrink-0 text-amber-500 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-amber-800">Suggested Action</p>
            <p className="text-xs text-amber-700 mt-0.5">{article.suggested_action}</p>
          </div>
          <button
            type="button"
            onClick={() => onMarkDone(article.id)}
            className="flex-shrink-0 inline-flex items-center gap-1 rounded-md bg-green-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-600"
          >
            <CheckCircle2 className="h-3 w-3" />
            Mark Done
          </button>
        </div>
      )}
    </div>
  );
}

export default function NewsFeed() {
  const [actionableOnly, setActionableOnly] = useState(false);
  const params = actionableOnly ? { actionable_only: true } : {};
  const { data, isLoading } = useNews(params);
  const checkAll = useCheckAllNews();
  const markActioned = useMarkActioned();

  const articles = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Company News</h1>
          <p className="mt-1 text-sm text-gray-500">
            Latest news and events from your tracked companies
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Actionable toggle */}
          <button
            type="button"
            onClick={() => setActionableOnly(!actionableOnly)}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
              actionableOnly
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            )}
          >
            <Filter className="h-4 w-4" />
            Actionable only
          </button>
          {/* Check All */}
          <button
            type="button"
            onClick={() => checkAll.mutate(5)}
            disabled={checkAll.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-600 disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', checkAll.isPending && 'animate-spin')} />
            {checkAll.isPending ? 'Checking...' : 'Check All Companies'}
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-5 w-16 rounded-full bg-gray-200" />
                <div className="h-4 w-32 rounded bg-gray-200" />
              </div>
              <div className="h-4 w-3/4 rounded bg-gray-200 mb-2" />
              <div className="h-3 w-full rounded bg-gray-100 mb-1" />
              <div className="h-3 w-2/3 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      ) : articles.length === 0 ? (
        <EmptyState
          icon={Newspaper}
          title="No news yet"
          description="Click 'Check All Companies' to scan for news."
          action={{
            label: 'Check All Companies',
            onClick: () => checkAll.mutate(5),
          }}
        />
      ) : (
        <div className="space-y-4">
          {articles.map((article) => (
            <NewsCard
              key={article.id}
              article={article}
              onMarkDone={(id) => markActioned.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
