import React, { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { MessageSquarePlus, Loader2, X } from 'lucide-react';
import { feedbackApi } from '../api/client';

// "/dialtone/send-timing/42" → "Dialtone / Send Timing" — the fallback when the
// current route isn't a named nav item.
export function pageNameFromPath(pathname) {
  const parts = (pathname || '/')
    .split('/')
    .filter((p) => p && !/^[0-9a-f-]{6,}$/i.test(p) && !/^\d+$/.test(p))
    .map((p) => p.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
  return parts.length ? parts.join(' / ') : 'Dashboard';
}

// Floating bottom-right feedback button + compact modal. The page/feature name
// is detected from the route so feedback arrives with its context attached.
export default function FeedbackWidget({ pageName }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const textRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    textRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const submit = useMutation({
    mutationFn: () => feedbackApi.submit({ page_name: pageName, feedback_text: text.trim() }),
    onSuccess: () => {
      toast.success('Thanks — feedback sent');
      setText('');
      setOpen(false);
    },
    onError: () => toast.error('Could not send feedback. Please try again.'),
  });

  const canSubmit = text.trim().length > 0 && !submit.isPending;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Send feedback"
        title="Send feedback"
        className="fixed bottom-5 right-5 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-white opacity-80 shadow-lg transition hover:opacity-100 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2"
      >
        <MessageSquarePlus className="h-5 w-5" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-title"
          className="fixed bottom-20 right-5 z-50 w-[calc(100vw-2.5rem)] max-w-sm rounded-xl border border-gray-200 bg-white shadow-2xl"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) submit.mutate();
            }}
            className="p-4"
          >
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h2 id="feedback-title" className="text-sm font-semibold text-gray-900">
                  Share feedback
                </h2>
                <span className="mt-1 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                  {pageName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close feedback"
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <label htmlFor="feedback-text" className="sr-only">
              Your feedback
            </label>
            <textarea
              id="feedback-text"
              ref={textRef}
              rows={4}
              maxLength={5000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What's working, what's confusing, what's missing?"
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <div className="mt-3 flex justify-end">
              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submit.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Submit
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
