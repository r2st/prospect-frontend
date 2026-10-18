import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { PDF_OPTIONS } from './pdf';

describe('pdf.js options', () => {
  // Found live: under the app's CSP the campaign brief (plain Helvetica, no
  // embedded fonts) previewed with no text at all until these were set.
  it('runs without eval and without installing fonts (the CSP allows neither)', () => {
    expect(PDF_OPTIONS.isEvalSupported).toBe(false);
    expect(PDF_OPTIONS.disableFontFace).toBe(true);
  });

  it('can draw standard non-embedded fonts from same-origin data', () => {
    expect(PDF_OPTIONS.standardFontDataUrl).toBe('/pdfjs/standard_fonts/');
    expect(PDF_OPTIONS.cMapUrl).toBe('/pdfjs/cmaps/');
    // The build copies these from the package; they must exist there.
    expect(existsSync('node_modules/pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf')).toBe(true);
    expect(existsSync('node_modules/pdfjs-dist/cmaps')).toBe(true);
  });
});
