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
// and read on both backgrounds — except for the accent family, below.
//
// The dark theme follows Pulse: a neutral near-black page, dark-gray cards with
// thin borders, and teal as the accent. Indigo is the accent in every page's
// classes, so the whole indigo family (and `brand`, which is indigo) is a set of
// variables: indigo in light, teal in dark. Violet and purple stay as they are —
// they carry status meaning in badges, not the accent.
const hex = (h) => {
  const n = parseInt(h.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

const GRAY_SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
// Dark gray scale: neutral near-black, as Pulse uses (no violet cast).
const DARK_GRAY = {
  50: '#0a0a0b', 100: '#1c1c1f', 200: '#27272b', 300: '#3a3a40', 400: '#71717a',
  500: '#a1a1aa', 600: '#c4c4cc', 700: '#d4d4d8', 800: '#e4e4e7', 900: '#f4f4f5',
  950: '#fafafa',
};
// Card surface (what `bg-white` becomes): a step above the page.
const SURFACE = '#141417';
const ACCENT = 'indigo';
const DARK_ACCENT = 'teal';
const ACCENT_SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
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
for (const s of ACCENT_SHADES) colors[ACCENT][s] = v(`${ACCENT}-${s}`);

const lightVars = {};
const darkVars = {};
for (const s of GRAY_SHADES) {
  lightVars[`--c-gray-${s}`] = hex(defaultColors.gray[s]);
  darkVars[`--c-gray-${s}`] = hex(DARK_GRAY[s]);
}
for (const f of TINT_FAMILIES) {
  const mid = defaultColors[f === ACCENT ? DARK_ACCENT : f][500];
  // Mix the family's 500 into the dark surface: a solid colour (not alpha) so
  // `bg-indigo-50/60` style opacity modifiers still compose.
  const mix = (a, b, t) =>
    hex(a).split(' ').map((c, i) => Math.round(c * (1 - t) + hex(b).split(' ')[i] * t)).join(' ');
  for (const s of TINT_SHADES) lightVars[`--c-${f}-${s}`] = hex(defaultColors[f][s]);
  darkVars[`--c-${f}-50`] = mix(DARK_GRAY[100], mid, 0.14);
  darkVars[`--c-${f}-100`] = mix(DARK_GRAY[100], mid, 0.24);
  darkVars[`--c-${f}-200`] = mix(DARK_GRAY[200], mid, 0.32);
}
for (const s of ACCENT_SHADES.filter((s) => !TINT_SHADES.includes(s))) {
  lightVars[`--c-${ACCENT}-${s}`] = hex(defaultColors[ACCENT][s]);
  darkVars[`--c-${ACCENT}-${s}`] = hex(defaultColors[DARK_ACCENT][s]);
}

const darkOverrides = {};
for (const f of TINT_FAMILIES) {
  for (const [from, to] of Object.entries(DEEP_TEXT)) {
    const sel = `text-${f}-${from}`;
    darkOverrides[`.dark .${sel}, .dark .hover\\:${sel}:hover`] = {
      color: defaultColors[f === ACCENT ? DARK_ACCENT : f][to],
    };
  }
}
// Accent links and labels (text-indigo-500/600) read as the bright teal Pulse
// uses for its highlights; teal-600 itself is a button colour, dim as text.
for (const s of [500, 600]) {
  const sel = `text-${ACCENT}-${s}`;
  darkOverrides[`.dark .${sel}, .dark .hover\\:${sel}:hover`] = { color: defaultColors[DARK_ACCENT][400] };
}
// Surfaces: `white` stays white for text on accent buttons; only white
// *backgrounds* and borders become the dark card surface.
darkOverrides['.dark .bg-white, .dark .hover\\:bg-white:hover'] = { 'background-color': SURFACE };
// Only the frosted-panel opacities: low ones (white/5–white/50) are lifts on
// already-dark or coloured surfaces and stay white.
for (const a of [60, 70, 80, 90, 95]) {
  darkOverrides[`.dark .bg-white\\/${a}`] = { 'background-color': `rgb(${hex(SURFACE)} / ${a / 100})` };
}
darkOverrides['.dark .border-white'] = { 'border-color': SURFACE };
darkOverrides['.dark .to-white'] = { '--c-gradient-to': `${SURFACE} var(--c-gradient-to-position)` };
// The few dark chips (tooltips, toggles, code blocks) would invert to
// near-white; keep them dark, a step above the surface.
darkOverrides['.dark .bg-gray-900, .dark .bg-gray-800'] = { 'background-color': DARK_GRAY[200] };
darkOverrides['.dark .hover\\:bg-gray-700:hover'] = { 'background-color': DARK_GRAY[300] };
// Cards are flat dark gray with a thin border, as on Pulse: no drop shadow.
// Only the shadow var, so rings drawn through box-shadow survive.
darkOverrides['.dark .shadow-card'] = { '--tw-shadow': '0 0 #0000', '--tw-shadow-colored': '0 0 #0000' };
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
        // Same as the accent: indigo in light, teal in dark.
        brand: colors[ACCENT],
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
