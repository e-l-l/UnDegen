# CONTEXT — `frontend/`

Local context for this node. Root context (product, tone, settled decisions) lives in `/CLAUDE.md` — read that first. This file covers what's actually in `frontend/` right now and the behaviours a session must respect.

```
/ (CLAUDE.md)
└── frontend/   ← YOU ARE HERE — the whole app, a React PWA (Vite)
    └── src/
        ├── db/     → see frontend/src/db/CONTEXT.md  (local-first data layer)
        └── utils/  → supabase client (covered below)
/supabase/        → see supabase/CONTEXT.md  (schema, RLS, push)
```

## What this is

The entire Undegen app. There is no other frontend. React + TypeScript + Vite, Tailwind v4 (via `@tailwindcss/vite`, not a PostCSS config), shipped as an offline-first PWA.

## Commands

- `npm run dev` — Vite dev server. Note: PWA `devOptions.enabled = false`, so the **service worker does not run in dev**. Test SW / offline / install behaviour against a build.
- `npm run build` — `tsc -b && vite build`. Typecheck is part of the build; a type error fails the build.
- `npm run preview` — serve the build (use this to exercise the SW).
- `npm run lint` — ESLint.

Package manager is **npm**. Do not introduce pnpm/yarn lockfiles.

## Current state — read before assuming

Most of `src/` is still Vite template scaffold, not real app code:

- `src/App.tsx` — **boilerplate** (the count button + Vite/React logos). Not the real UI. Don't treat its structure as intentional.
- `src/main.tsx`, `src/PWABadge.tsx`, `src/PWABadge.css`, `src/App.css`, `index.css` — template-generated.
- `src/assets/`, `public/favicon.svg` — placeholder assets.

What **is** real and load-bearing:

- `src/db/` — the Dexie local-first data layer. The most developed part. See its CONTEXT.md.
- `src/utils/supabase.ts` — the Supabase client.
- `src/sw.ts` — service worker (see PWA note below).
- `vite.config.ts`, `pwa-assets.config.ts` — PWA wiring.

## `src/utils/supabase.ts` — the cloud edge

Six lines: `createClient(VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY)`. Needs those two env vars (`.env`, gitignored).

**Behaviour to respect:** this client is the *only* path to the cloud, and per the architecture it must **never be read from in the UI critical path** — UI reads come from Dexie. This file (or a sibling) is where the sync-flush logic will live; it is not written yet.

## PWA — `vite.config.ts` + `src/sw.ts`

- Strategy `injectManifest` with a custom `src/sw.ts` (chosen because we need custom push + background-sync listeners that `generateSW` can't express).
- `registerType: 'prompt'` — **never silently auto-update the SW.** App is write-heavy (timers, offline writes); a silent reload would kill a session. Prompt the user.
- `injectRegister: false` — registration is wired manually (currently via `PWABadge.tsx`).

**`src/sw.ts` current state:** still essentially the vite-pwa template — precache + `cleanupOutdatedCaches` + a navigation fallback + a `SKIP_WAITING` message handler. The planned **`push` event listener and background-sync handlers are NOT here yet.** Add them here when Web Push / offline-flush land.

## Conventions

- TypeScript throughout; types for the data model live in `src/db/types.ts` and mirror the SQL schema 1:1.
- Tailwind utility classes; no separate CSS modules expected for new work.
