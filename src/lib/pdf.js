// pdf.js, loaded on first use so the ~1 MB library and worker only download
// when someone actually opens an attachment preview.
//
// Why pdf.js and not an <iframe>/<embed> of the file: the app's CSP has no
// frame-src (so a blob: frame is refused), object-src 'none' (no <embed>), and
// the API answers with X-Frame-Options: DENY. pdf.js draws to a <canvas>,
// which none of those govern. Its worker is served from our own origin
// (script-src 'self'); eval is off (no 'unsafe-eval' in the CSP) and glyphs
// are drawn as paths rather than loaded as fonts (font-src 'self' refuses the
// blob: fonts pdf.js would otherwise install).
let loading = null;

export function loadPdfjs() {
  if (!loading) {
    loading = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]).then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    });
  }
  return loading;
}

// Copied into the build by vite.config.js (pdfjsAssets). Needed because glyphs
// are drawn by pdf.js: a PDF set in a standard, non-embedded font (Helvetica)
// otherwise renders its images and none of its text.
export const PDF_OPTIONS = {
  isEvalSupported: false,
  disableFontFace: true,
  standardFontDataUrl: '/pdfjs/standard_fonts/',
  cMapUrl: '/pdfjs/cmaps/',
  cMapPacked: true,
};

export async function openPdf(data) {
  const pdfjs = await loadPdfjs();
  return pdfjs.getDocument({ data, ...PDF_OPTIONS }).promise;
}
