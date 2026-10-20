# CLAUDE.md

This file tells any Claude Code session everything it needs to know to work in this repo.

## Project Overview
Landline is a B2B lead generation and client management platform. React frontend with Vite, React Router, Tailwind-style CSS.

## Tech Stack
- React 18, Vite, React Router v6
- CSS with Tailwind-style utility classes
- recharts for data visualization
- Deployed to AWS Amplify (manual deploy, NOT git-connected)

## Code Structure
- `src/pages/` — Page components (Companies, Contacts, Sequences, Outreach, CardScanner, Demos, Settings, Clients, ClientDashboard, Tasks, Reports, Dashboard)
- `src/components/` — Reusable components (CommandPalette, TopBar, Sidebar, CompanyDetail tabs, modals)
- `src/hooks/` — Custom hooks (useCompanies, useContacts, useDeals, useTasks, useHealth, useInteractions, useReports, useClients)
- `src/api/client.js` — API client with axios
- `src/lib/` — Utilities and constants
- `src/App.jsx` — Router setup

## Common Tasks

### Dev server
```bash
npm run dev
```

### Production build
```bash
npm run build
```

### Add a new page
1. Create `src/pages/NewPage.jsx`
2. Add route in `src/App.jsx`
3. Add nav item in Sidebar component
4. Add to CommandPalette search

## Deploy
Push to main. Frontend is deployed to Amplify app `d1wnx5ebf5zf0f` via manual zip upload (not git-connected).
Build → zip `dist/` → create-deployment → upload → start-deployment.

## Conventions
- Push directly to main, no PRs
- All API calls use try/catch with graceful empty states
- API endpoints are relative `/api/v1/*` (proxied by Amplify)
- New pages need: route, sidebar nav entry, command palette entry
- Use existing component patterns (see `Companies.jsx` for table pattern, `CompanyDetail` for tabs)
- Mobile responsive (test at 375px)
- Accent color: Pulse teal (written as `indigo-*`, see Theming)

## Platform credentials are rotated from the UI, and the copy has to be careful

`/platform/credentials` (platform_admin only) edits the deployment's API keys —
the Google OAuth client, the LLM providers, Apollo — so an operator no longer
needs SSH to rotate one. Three things the page does deliberately:

- **Provenance is a first-class field.** `Set here` / `From deploy` /
  `Not configured` come from the API's `source`. A page that just listed values
  would give no way to tell whether reverting one is safe.
- **The copy names the propagation delay.** A save applies at once on the API
  worker that served it and reaches the others on a 5-minute refresh beat. An
  operator who assumes otherwise concludes the rotation failed and rotates
  again.
- **Secrets have no reveal affordance**, because there is nothing to reveal: the
  API returns a mask and never the value. Client *IDs* are shown in full — they
  are in the consent URL every user sees, and confirming which Google project is
  live is the point of the screen.

The action buttons carry `aria-label`s naming the credential (`Set Hunter.io API
Key`), not just `Set`. Nine of them share the page, so the visible label alone
identifies none of them to a screen reader — or to a test, which is how the
first version of `PlatformCredentials.test.jsx` failed.

## Theming (System / Light / Dark)
The toggle sits in the sidebar footer and on the sign-in page; the choice is
`localStorage['prospect-theme']` and the resolved theme is `html.dark`. Pages
are written in plain light utilities — **don't add `dark:` twins**. Instead
`tailwind.config.js` makes the gray scale and the 50/100/200 tints CSS
variables that flip under `.dark`, and lifts deep text shades (700–900).
Consequences: `bg-gray-900` is not "always dark" (it's overridden to a dark
chip); a surface that must stay dark in both themes (the sign-in hero) uses
fixed hex + `white/…` alphas, never grays.
Both themes follow Pulse (DoAide's shared theme). Light: white canvas
(`bg-canvas`), white cards with `gray-200` borders, Tailwind grays for text.
Dark: neutral near-black canvas, `#141417` cards with thin borders, no shadow.
The accent is Pulse **teal** in both — the whole `indigo` family (and `brand`)
is variables that resolve to teal, so keep writing `indigo-*` for the accent.
The sign-in page is near-black + teal in both themes, as Pulse's is: its root
carries the `dark` class, so the themed classes inside resolve dark. It has
Pulse's floating, blinking robot (`HeroRobot` in `Login.jsx`, keyframes in
`index.css`). Fonts: Inter, Instrument Serif (`font-serif`), IBM Plex Mono
(`font-mono`). `public/theme-init.js` applies the
theme before paint — external because the CSP is `script-src 'self'`.

## Key Patterns
- Pipeline stages shown as kanban: New Lead → Researching → Outreach → Engaged → Negotiating → Client → Churned
- Health badges: green (healthy), yellow (at_risk), red (churned)
- Priority colors: urgent=red, high=orange, medium=yellow, low=gray
- Command palette: ⌘K, searches companies, contacts, tasks, deals, and quick actions
