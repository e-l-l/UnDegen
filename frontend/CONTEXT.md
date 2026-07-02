# CONTEXT — `frontend/`

Local context for this node. Root context (product, tone, settled decisions) lives in `/CLAUDE.md` — read that first. This file covers what's actually in `frontend/` right now and the behaviours a session must respect.

```
/ (CLAUDE.md)
└── frontend/   ← YOU ARE HERE — the whole app, a React PWA (Vite)
    └── src/
        ├── db/            → see frontend/src/db/CONTEXT.md  (data layer + write API: repo.ts)
        ├── sync/          → syncEngine.ts — drains syncQueue → Supabase (covered below)
        ├── utils/         → supabase client (covered below)
        ├── lib/           → cn() util (shadcn)
        ├── components/ui/ → shadcn primitives (button, input, label, dialog, toggle-group, popover, calendar)
        ├── features/auth/ → auth screens (covered below)
        ├── features/activities/ → create-activity flow (covered below)
        ├── features/today/ → the Today screen (covered below)
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
- `src/App.tsx` — the **auth gate**: `useSession()` → blank while loading, `<AuthScreen/>` when signed out, `<TodayScreen/>` when signed in. No placeholder left — the real Today screen is live.
- `src/components/ui/`, `src/features/auth/`, `src/features/activities/`, `src/features/today/`, `src/hooks/` — see below.
- `src/sw.ts` — service worker (see PWA note below).
- `vite.config.ts`, `pwa-assets.config.ts` — PWA wiring.

Still scaffold / not real: `src/PWABadge.tsx` + `.css` (kept — SW update prompt), `src/App.css` (now **unused**, not imported), `src/assets/`, `public/favicon.svg`.

## Design system — `src/index.css`

Tailwind v4 `@theme`. **Grayscale + a single pastel-pink accent**, app is always dark (tokens on `:root`, no light mode). Hard rule from the design: **pink is the only signal — the primary CTA and the brand mark are the only pink things.** Never tint inputs, secondary buttons, links, or hovers pink (a faint pink *focus ring* is the one sanctioned exception).

- shadcn semantic tokens (`--background`, `--foreground`, `--primary` = the pink, `--border`, `--input`, `--ring`, …) carry the hex values above, so shadcn components inherit the look.
- Plus a named Undegen scale exposed as utilities: `bg-surface`/`bg-surface-raised`/`bg-panel`, `text-ink`/`text-ink-soft`/`text-ink-body`/`text-ink-muted`/`text-ink-dim`/`text-ink-faint`, `text-pink`/`bg-pink`/`hover:bg-pink-hover`, `border-edge-chip`/`border-edge-panel`/`border-hairline`.
- Font: **Inter**, bundled via `@fontsource-variable/inter` (imported in `main.tsx`) — **not** a CDN, because offline is a core feature.

## UI primitives — `src/components/ui/` (shadcn)

shadcn "new-york", set up manually (deterministic; `components.json` keeps `npx shadcn add <x>` working). `button.tsx` (cva; `default` = the pink CTA + glow, `outline` = grayscale secondary), `input.tsx` (base = mobile sizing; desktop tweaks applied at call site), `label.tsx`. `cn()` lives in `src/lib/utils.ts`.

Also `dialog.tsx` (wraps `@radix-ui/react-dialog`; deliberately unopinionated on sizing/position — that's a call-site concern, since the create-activity flow uses the same Dialog for a full-screen mobile sheet and a centered desktop card, which differ too much to bake into the primitive), `toggle-group.tsx` (wraps `@radix-ui/react-toggle-group`; bakes in the **grayscale-only selected state** — `bg-elevated`/`lg:bg-elevated-lg`, never pink — since every segmented control/weekday-cell/chip in the app is one of these), `popover.tsx` (wraps `@radix-ui/react-popover`), `calendar.tsx` (wraps `react-day-picker`'s `DayPicker`, same grayscale-selection rule). The `--elevated`/`--elevated-lg` tokens (`#2a2a2a`/`#303030`) live in `src/index.css` — the named "selected/elevated fill" signal, distinct from `--surface`/`--surface-raised` (which are input backgrounds, not selection states).

## Auth — `src/features/auth/` + `src/hooks/useSession.ts`

Email+password only (Supabase Auth) — social buttons and an "or" divider were considered and dropped. "Forgot?" link present but not wired.

- **One responsive component, not a mobile/desktop split.** Mobile and desktop share the whole form; desktop only *adds* the `BrandPanel` (`hidden lg:flex`) and nudges sizing. Breakpoint is Tailwind `lg` (1024px).
- `useAuthForm.ts` — all auth logic/state (no JSX); both layouts consume it. `AuthScreen.tsx` owns it so state survives a resize across `lg`. `AuthForm.tsx` = the form column (breakpoint-specific copy via show/hide spans). `BrandPanel.tsx` = desktop-only left pane. `icons.tsx` = inline line icons.
- `useSession.ts` gates the app. **Don't `await` other supabase calls inside its `onAuthStateChange` callback** (documented deadlock).
- **Dashboard prereq:** Auth → URL Configuration Site URL `http://localhost:5173` (+ redirect `/**`); "Confirm email" **off** in dev so signup returns a session immediately.

## Create activity — `src/features/activities/`

The "New activity" creation flow (reminder / long_task fork). Same shape as the auth feature: `useNewActivityForm.ts` owns all state/validation/submit (no JSX); `NewActivityDialog.tsx` owns the responsive shell.

- **One Radix Dialog, not two implementations.** `NewActivityDialog.tsx` renders a single `<Dialog>`/`<DialogContent>` tree; `lg:` classes switch the content from a full-screen mobile takeover to a centered 620px desktop card with a dimmed backdrop. Header and footer are small duplicated blocks (`lg:hidden` / `hidden lg:flex`) since their structure genuinely differs (mobile: back-chevron · title, single full-width CTA; desktop: title · ✕, right-aligned Cancel + CTA) — same precedent as `AuthForm`'s breakpoint-conditional copy.
- **`NewActivityFormBody.tsx`** is the one shared scrollable body for both breakpoints — only the "Repeat on"/"Starts" pairing changes shape (stacked → row) via `lg:` classes on a single wrapper, not a duplicated block.
- **`fields/`** — one component per form field (`TypeToggle`, `WeekdayPicker`, `StartsDateField`, `ReminderTypeToggle`, `StrictTimeField`, `SoftWindowFields`, `SoftIntervalChips`, `DefaultModeToggle`, `GoalDurationChips`, `MinuteStepper`, plus `shared.tsx` for the tiny `SectionLabel`/`FieldError` helpers). `MinuteStepper` is shared by both `GoalDurationChips` (goal_duration_mins) and `SoftIntervalChips` (soft_interval_mins) — same custom-stepper pattern, decided to apply to both.
- **`TimePicker.tsx`** — a custom themed Popover + 15-min-increment list (no time-picker library exists; native inputs were explicitly rejected in favour of a themed control). Reused for `strict_time`, `soft_start`, `soft_end`. **`StartsDateField`** uses the `calendar.tsx` primitive for `recurrence_start`, reusing `todayLocal()` from `src/db/recurrence.ts` both as the default and to format a selected `Date` back to the `'YYYY-MM-DD'` string the schema stores.
- **`icons.tsx`** — hand-rolled inline SVGs (bell, concentric circles, chevron-left, x, calendar, clock, plus/minus), matching `features/auth/icons.tsx`'s convention. (`features/today/` made the opposite call and adopted `lucide-react` instead — see below; the two conventions currently coexist.)
- Writes go through `src/db/repo.ts`'s `createActivity` (stamps `position`/`archived`, delegates to `newActivity`) — never straight to Dexie/Supabase from this feature.
- Mounted from `features/today/TodayScreen.tsx` (mobile FAB + desktop header "+" button both open it) — no longer mounted from `App.tsx`.

## Today screen — `src/features/today/`

The screen that replaced `App.tsx`'s old placeholder: a time-ordered timeline of today's reminders (done / NOW / up next) plus, on desktop, a Long-tasks rail. Same design system as the rest of the app (grayscale + single pink accent, see `src/index.css` above).

- **`useTodayData.ts`** — the one data hook: `useLiveQuery` (from `dexie-react-hooks`, first real usage in the repo) over `src/db/dayView.ts`'s `getDayItems`, plus a minute-tick clock. Writes via `repo.ts` (`markReminder`, `startWorkSession`) auto-refresh it — no manual invalidation anywhere in this feature. Also derives the earlier/up-next time buckets (anchored on `strict_time` or `soft_start`) and the header counts. `streak` is a **hardcoded stub** — real derived-streak calculation isn't built (see `db/CONTEXT.md`).
- **`TodayScreen.tsx`** — top-level responsive shell; literally duplicates the mobile/desktop blocks (`lg:hidden` / `hidden lg:flex`, same precedent as `NewActivityDialog.tsx`) since the two chromes (bottom tab bar + FAB vs. floating island + rail) genuinely differ. Owns the NOW-marker scroll-into-view: a manually computed `scrollTop` on mount, **not** `scrollIntoView` — mixing a scroll container with a flex-1 body has been unreliable for this elsewhere in the codebase too (see `NewActivityDialog.tsx`'s own note on `h-auto` + flex).
- **`Timeline.tsx`** — the one shared timeline body for both breakpoints (rows don't structurally differ, only the surrounding chrome does — same shared-body precedent as `NewActivityFormBody.tsx`).
- **`ReminderRow.tsx`** — a reminder only renders dimmed/checked once `completion.status === "done"`. A reminder whose time has passed with no completion still renders at full opacity with a tappable empty circle, **not** styled as a failure — root `CLAUDE.md` bans punishing "missed" states, so a late reminder stays actionable rather than showing as a failure.
- **`LongTaskCard.tsx`** — there's no stored session-count target anywhere in the schema (`Activity` has only a single `goal_duration_mins`; `WorkSession` is scoped to one `day_activity`, i.e. one calendar day, with no cross-day cumulative query), so progress is scoped to **today's sessions only**: idle (no sessions today) → "Start" (outline); active/`in_progress` → live elapsed-time progress bar + a working **"Stop session"** button (`repo.ts`'s `completeWorkSession`) — this exists specifically so a `zen`-mode session (no duration goal, open-ended) isn't stuck forever with no way to end it; done-today (only `completed` sessions) → "Start session" (pink) to start another. Only one `in_progress` session at a time per `day_activity` — nothing else guards against a second concurrent start, so don't add a second "start" entry point without checking for an existing active session first.
- **`iconForActivity.ts`** — the CLAUDE.md-settled "icon derived from type + name, frontend string map, no picker" utility. Keyword-matches `activity.name`, falls back per `activity.type`. Uses `lucide-react` (installed since `components.json` was set up, but unused elsewhere in `src/` until this feature).
- **`MobileTabBar.tsx`/`DesktopIsland.tsx`** — Focus/Stats/You render styled but **non-functional** (no `onClick`, no navigation) — no router is installed anywhere in this repo, and only Today is built. Desktop drops the mobile Focus tab: on desktop, long tasks/focus sessions already have a home in the Long-tasks rail on Today, so a separate Focus destination would be redundant there; mobile has no side rail to put long tasks in, so it keeps its own Focus tab. A fake macOS window frame (traffic lights, rounded/bordered outer border) was considered and rejected: this is a browser-tab PWA, not Electron, and the real browser window already supplies window chrome — see the comment in `DesktopIsland.tsx`.
- Sign-out has no home in the new design; kept as a small temporary text link at the end of the primary scroll content (mobile: bottom of the timeline; desktop: bottom of the rail) until a "You" screen exists to own it.

## `src/utils/supabase.ts` — the cloud edge

Six lines: `createClient(VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY)`. Needs those two env vars (`.env`, gitignored).

**Behaviour to respect:** this client is the *only* path to the cloud, and per the architecture it must **never be read from in the UI critical path** — UI reads come from Dexie. The cloud is written to only by the sync engine (`src/sync/syncEngine.ts`) draining the queue; feature code mutates via `src/db/repo.ts`, never by calling `supabase` directly.

## PWA — `vite.config.ts` + `src/sw.ts`

- Strategy `injectManifest` with a custom `src/sw.ts` (chosen because we need custom push + background-sync listeners that `generateSW` can't express).
- `registerType: 'prompt'` — **never silently auto-update the SW.** App is write-heavy (timers, offline writes); a silent reload would kill a session. Prompt the user.
- `injectRegister: false` — registration is wired manually (currently via `PWABadge.tsx`).
- **Periodic SW update:** enabled, 1h interval — users keep the app open all day; navigation-only checks aren't enough.
- **Offline-ready prompt:** enabled, auto-dismiss — offline is a core feature, users need to know it's ready.
- **Icon generation:** `@vite-pwa/assets-generator` `minimal-2023` preset (`pwa-assets.config.ts`) — one source SVG → all iOS/Android/favicon sizes.

**`src/sw.ts` current state:** still essentially the vite-pwa template — precache + `cleanupOutdatedCaches` + a navigation fallback + a `SKIP_WAITING` message handler. The planned **`push` event listener and background-sync handlers are NOT here yet.** Add them here when Web Push / offline-flush land.

## Conventions

- TypeScript throughout; types for the data model live in `src/db/types.ts` and mirror the SQL schema 1:1.
- Tailwind utility classes; no separate CSS modules expected for new work.
