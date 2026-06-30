# CONTEXT — `frontend/`

Local context for this node. Root context (product, tone, settled decisions) lives in `/CLAUDE.md` — read that first. This file covers what's actually in `frontend/` right now and the behaviours a session must respect.

```
/ (CLAUDE.md)
└── frontend/   ← YOU ARE HERE — the whole app, a React PWA (Vite)
    └── src/
        ├── db/            → see frontend/src/db/CONTEXT.md  (local-first data layer)
        ├── utils/         → supabase client (covered below)
        ├── lib/           → cn() util (shadcn)
        ├── components/ui/ → shadcn primitives (button, input, label)
        ├── features/auth/ → auth screens (covered below)
        └── hooks/         → useSession (covered below)
/supabase/        → see supabase/CONTEXT.md  (schema, RLS, push)
```

## What this is

The entire Undegen app. There is no other frontend. React + TypeScript + Vite, Tailwind v4 (via `@tailwindcss/vite`, not a PostCSS config), shipped as an offline-first PWA.

Import alias: **`@/` → `src/`** (set in `vite.config.ts` + `tsconfig.app.json`/`tsconfig.json`). Prefer it for cross-dir imports.

## Commands

- `npm run dev` — Vite dev server. Note: PWA `devOptions.enabled = false`, so the **service worker does not run in dev**. Test SW / offline / install behaviour against a build.
- `npm run build` — `tsc -b && vite build`. Typecheck is part of the build; a type error fails the build.
- `npm run preview` — serve the build (use this to exercise the SW).
- `npm run lint` — ESLint.

Package manager is **npm**. Do not introduce pnpm/yarn lockfiles.

## Current state — read before assuming

What **is** real and load-bearing:

- `src/db/` — the Dexie local-first data layer. See its CONTEXT.md.
- `src/utils/supabase.ts` — the Supabase client.
- `src/index.css` — the **design system** (see below), imported by `main.tsx`. (A root-level `index.css` used to hold `@import "tailwindcss"` but nothing imported it — deleted. The live stylesheet is `src/index.css`.)
- `src/App.tsx` — the **auth gate**: `useSession()` → blank while loading, `<AuthScreen/>` when signed out, a placeholder "Today" (email + sign-out) when signed in. The placeholder is temporary until the real Today screen exists.
- `src/components/ui/`, `src/features/auth/`, `src/hooks/` — see below.
- `src/sw.ts` — service worker (see PWA note below).
- `vite.config.ts`, `pwa-assets.config.ts` — PWA wiring.

Still scaffold / not real: `src/PWABadge.tsx` + `.css` (kept — SW update prompt), `src/App.css` (now **unused**, not imported), `src/assets/`, `public/favicon.svg`.

## Design system — `src/index.css`

Tailwind v4 `@theme`. **Grayscale + a single pastel-pink accent**, app is always dark (tokens on `:root`, no light mode). Hard rule from the design: **pink is the only signal — the primary CTA and the brand mark are the only pink things.** Never tint inputs, secondary buttons, links, or hovers pink (a faint pink *focus ring* is the one sanctioned exception).

- shadcn semantic tokens (`--background`, `--foreground`, `--primary` = the pink, `--border`, `--input`, `--ring`, …) carry the handoff hex values, so shadcn components inherit the look.
- Plus a named Undegen scale exposed as utilities: `bg-surface`/`bg-surface-raised`/`bg-panel`, `text-ink`/`text-ink-soft`/`text-ink-body`/`text-ink-muted`/`text-ink-dim`/`text-ink-faint`, `text-pink`/`bg-pink`/`hover:bg-pink-hover`, `border-edge-chip`/`border-edge-panel`/`border-hairline`.
- Font: **Inter**, bundled via `@fontsource-variable/inter` (imported in `main.tsx`) — **not** a CDN, because offline is a core feature.

## UI primitives — `src/components/ui/` (shadcn)

shadcn "new-york", set up manually (deterministic; `components.json` keeps `npx shadcn add <x>` working). `button.tsx` (cva; `default` = the pink CTA + glow, `outline` = grayscale secondary), `input.tsx` (base = mobile sizing; desktop tweaks applied at call site), `label.tsx`. `cn()` lives in `src/lib/utils.ts`.

## Auth — `src/features/auth/` + `src/hooks/useSession.ts`

Email+password (Supabase Auth). Recreates the `design_handoff_auth` spec, rebranded to Undegen; social buttons + "or" divider omitted (we chose email+password only); "Forgot?" link present but not wired.

- **One responsive component, not a mobile/desktop split.** Mobile and desktop share the whole form; desktop only *adds* the `BrandPanel` (`hidden lg:flex`) and nudges sizing. Breakpoint is Tailwind `lg` (1024px).
- `useAuthForm.ts` — all auth logic/state (no JSX); both layouts consume it. `AuthScreen.tsx` owns it so state survives a resize across `lg`. `AuthForm.tsx` = the form column (breakpoint-specific copy via show/hide spans). `BrandPanel.tsx` = desktop-only left pane. `icons.tsx` = inline line icons.
- `useSession.ts` gates the app. **Don't `await` other supabase calls inside its `onAuthStateChange` callback** (documented deadlock).
- **Dashboard prereq:** Auth → URL Configuration Site URL `http://localhost:5173` (+ redirect `/**`); "Confirm email" **off** in dev so signup returns a session immediately.

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
