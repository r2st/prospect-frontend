import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, MessageSquare } from 'lucide-react';
import { feedbackApi } from '../api/client';

export default function AdminFeedback() {
  const [page, setPage] = useState('');
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ['feedback'],
    queryFn: () => feedbackApi.list({ limit: 500 }),
  });

  const pages = useMemo(() => [...new Set(data.map((f) => f.page_name))].sort(), [data]);
  const rows = page ? data.filter((f) => f.page_name === page) : data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Feedback</h1>
          <p className="mt-1 text-sm text-gray-500">
            What users said from the in-app feedback button, newest first.
          </p>
        </div>
        {pages.length > 1 && (
          <select
            value={page}
            onChange={(e) => setPage(e.target.value)}
            aria-label="Filter by page"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All pages ({data.length})</option>
            {pages.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
        </div>
      ) : isError ? (
        <p className="text-sm text-red-600">Could not load feedback.</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-12 text-center">
          <MessageSquare className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-2 text-sm text-gray-500">No feedback yet.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((f) => (
            <li key={f.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <span className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-700">
                  {f.page_name}
                </span>
                <span>{f.user_email || 'Unknown user'}</span>
                <span>·</span>
                <time dateTime={f.created_at}>{new Date(f.created_at).toLocaleString()}</time>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">{f.feedback_text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
