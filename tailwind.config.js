import defaultColors from 'tailwindcss/colors';
import plugin from 'tailwindcss/plugin';

// Theming. The app is written in plain light-mode utilities (bg-white,
// text-gray-900, bg-indigo-50…) across ~100 pages, so rather than adding a
// `dark:` twin to every class, the colours that carry the theme are CSS
// variables that flip under `html.dark`:
//
// - the whole gray scale inverts (gray-50 page → near-black, gray-900 text →
//   near-white), so surfaces, borders and body text follow;
// - the pale tints of the accent families (50/100/200 — badge and chip
//   backgrounds, soft borders) become translucent-dark tints;
// - deep text shades (700/800/900) are lifted by the overrides in
//   `darkOverrides` below, since those same shades are also used as button
//   backgrounds and can't flip as a colour.
//
// Mid shades (300–600) are left alone: they are the accent colours themselves
// and read on both backgrounds.
const hex = (h) => {
  const n = parseInt(h.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

const GRAY_SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
// Dark gray scale, faintly violet so it sits with the indigo accent.
const DARK_GRAY = {
  50: '#0c0b16', 100: '#1b1930', 200: '#2b2843', 300: '#3d3a58', 400: '#77739a',
  500: '#9793b3', 600: '#b9b6cf', 700: '#d4d2e3', 800: '#e6e5ef', 900: '#f3f2f8',
  950: '#fafafc',
};
const TINT_FAMILIES = [
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan',
  'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
];
const TINT_SHADES = [50, 100, 200];
const DEEP_TEXT = { 700: 300, 800: 200, 900: 100 };

const colors = { gray: {} };
for (const s of GRAY_SHADES) colors.gray[s] = v(`gray-${s}`);
for (const f of TINT_FAMILIES) {
  colors[f] = { ...defaultColors[f] };
  for (const s of TINT_SHADES) colors[f][s] = v(`${f}-${s}`);
}

const lightVars = {};
const darkVars = {};
for (const s of GRAY_SHADES) {
  lightVars[`--c-gray-${s}`] = hex(defaultColors.gray[s]);
  darkVars[`--c-gray-${s}`] = hex(DARK_GRAY[s]);
}
for (const f of TINT_FAMILIES) {
  const mid = defaultColors[f][500];
  // Mix the family's 500 into the dark surface: a solid colour (not alpha) so
  // `bg-indigo-50/60` style opacity modifiers still compose.
  const mix = (a, b, t) =>
    hex(a).split(' ').map((c, i) => Math.round(c * (1 - t) + hex(b).split(' ')[i] * t)).join(' ');
  for (const s of TINT_SHADES) lightVars[`--c-${f}-${s}`] = hex(defaultColors[f][s]);
  darkVars[`--c-${f}-50`] = mix(DARK_GRAY[100], mid, 0.14);
  darkVars[`--c-${f}-100`] = mix(DARK_GRAY[100], mid, 0.24);
  darkVars[`--c-${f}-200`] = mix(DARK_GRAY[200], mid, 0.32);
}

const darkOverrides = {};
for (const f of TINT_FAMILIES) {
  for (const [from, to] of Object.entries(DEEP_TEXT)) {
    const sel = `text-${f}-${from}`;
    darkOverrides[`.dark .${sel}, .dark .hover\\:${sel}:hover`] = { color: defaultColors[f][to] };
  }
}
// Surfaces: `white` stays white for text on accent buttons; only white
// *backgrounds* and borders become the dark card surface.
const SURFACE = '#15132a';
darkOverrides['.dark .bg-white, .dark .hover\\:bg-white:hover'] = { 'background-color': SURFACE };
// Only the frosted-panel opacities: low ones (white/5–white/50) are lifts on
// already-dark or coloured surfaces and stay white.
for (const a of [60, 70, 80, 90, 95]) {
  darkOverrides[`.dark .bg-white\\/${a}`] = { 'background-color': `rgb(21 19 42 / ${a / 100})` };
}
darkOverrides['.dark .border-white'] = { 'border-color': SURFACE };
darkOverrides['.dark .to-white'] = { '--c-gradient-to': `${SURFACE} var(--c-gradient-to-position)` };
// The few dark chips (tooltips, toggles, code blocks) would invert to
// near-white; keep them dark, a step above the surface.
darkOverrides['.dark .bg-gray-900, .dark .bg-gray-800'] = { 'background-color': '#2b2843' };
darkOverrides['.dark .hover\\:bg-gray-700:hover'] = { 'background-color': '#3d3a58' };
for (const a of [40, 50, 60, 70, 80]) {
  darkOverrides[`.dark .bg-gray-900\\/${a}`] = { 'background-color': `rgb(0 0 0 / ${a / 100 + 0.1})` };
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ...colors,
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(16, 24, 40, 0.04), 0 1px 3px 0 rgba(16, 24, 40, 0.06)',
      },
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      // In base, not utilities: `.dark .bg-white` (two classes) already outranks
      // `.bg-white`, while a later `hover:bg-gray-50:hover` still wins on hover.
      addBase({ ':root': lightVars, '.dark': darkVars, ...darkOverrides });
    }),
  ],
};
