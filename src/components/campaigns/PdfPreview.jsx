import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Loader2 } from 'lucide-react';
import { openPdf } from '../../lib/pdf';

/**
 * Renders a PDF (as bytes) one page at a time onto a canvas, with a download
 * link for the same bytes. See lib/pdf.js for why this isn't an <iframe>.
 */
export default function PdfPreview({ data, filename }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [doc, setDoc] = useState(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState(null);
  const [rendering, setRendering] = useState(true);
  const [href, setHref] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let opened = null;
    setDoc(null);
    setPage(1);
    setError(null);
    // pdf.js transfers the buffer to its worker, so give it a copy and keep
    // the original for the download link.
    openPdf(data.slice(0))
      .then((d) => {
        opened = d;
        if (cancelled) d.destroy();
        else setDoc(d);
      })
      .catch(() => !cancelled && setError('This PDF could not be displayed.'));
    const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
    setHref(url);
    return () => {
      cancelled = true;
      opened?.destroy();
      URL.revokeObjectURL(url);
    };
  }, [data]);

  useEffect(() => {
    if (!doc || !canvasRef.current) return undefined;
    let task = null;
    let cancelled = false;
    setRendering(true);
    doc.getPage(page).then((p) => {
      if (cancelled) return;
      const width = wrapRef.current?.clientWidth || 600;
      const base = p.getViewport({ scale: 1 });
      const ratio = window.devicePixelRatio || 1;
      const viewport = p.getViewport({ scale: (width / base.width) * ratio });
      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width / ratio}px`;
      task = p.render({ canvasContext: canvas.getContext('2d'), viewport });
      return task.promise;
    })
      .then(() => !cancelled && setRendering(false))
      .catch((e) => {
        if (!cancelled && e?.name !== 'RenderingCancelledException') setError('This page could not be displayed.');
      });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, page]);

  const pages = doc?.numPages || 0;
  return (
    <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50" data-testid="pdf-preview">
      <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-3 py-2 text-xs text-gray-600">
        <span className="truncate font-medium">{filename}</span>
        <div className="flex flex-shrink-0 items-center gap-1">
          {pages > 1 && (
            <>
              <button type="button" aria-label="Previous page" disabled={page <= 1}
                onClick={() => setPage((n) => n - 1)} className="rounded p-1 hover:bg-gray-200 disabled:opacity-40">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span data-testid="pdf-page">Page {page} of {pages}</span>
              <button type="button" aria-label="Next page" disabled={page >= pages}
                onClick={() => setPage((n) => n + 1)} className="rounded p-1 hover:bg-gray-200 disabled:opacity-40">
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}
          {href && (
            <a href={href} download={filename} className="ml-1 inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-gray-200">
              <Download className="h-3.5 w-3.5" /> Download
            </a>
          )}
        </div>
      </div>
      <div ref={wrapRef} className="relative max-h-[60vh] overflow-auto bg-white p-2">
        {error ? (
          <p className="py-6 text-center text-sm text-red-600">{error}</p>
        ) : (
          <>
            {(!doc || rendering) && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading preview…
              </div>
            )}
            <canvas ref={canvasRef} aria-label={`${filename}, page ${page}`} className="mx-auto block" />
          </>
        )}
      </div>
    </div>
  );
}
