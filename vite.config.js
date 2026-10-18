/// <reference types="vitest/config" />
import { cpSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// pdf.js draws glyphs itself (the CSP's font-src 'self' refuses the blob: fonts
// it would otherwise install — see src/lib/pdf.js), and for the standard
// non-embedded fonts (Helvetica, Times…) that needs these data files. Without
// them a PDF's text simply doesn't render: the campaign brief, set in plain
// Helvetica, previewed with its images and none of its words. Copied next to
// the build, served from our own origin, fetched only when a PDF needs them.
function pdfjsAssets() {
  let outDir = 'dist';
  return {
    name: 'pdfjs-assets',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      for (const dir of ['standard_fonts', 'cmaps']) {
        cpSync(
          fileURLToPath(new URL(`./node_modules/pdfjs-dist/${dir}`, import.meta.url)),
          `${outDir}/pdfjs/${dir}`,
          { recursive: true },
        );
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), pdfjsAssets()],
    server: {
      port: Number(process.env.PORT) || 3000,
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:8000',
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.js',
      css: false,
      include: ['src/**/*.{test,spec}.{js,jsx}'],
    },
  };
});
