# CONTEXT — `frontend/`

Local context for this node. Root context (product, tone, settled decisions) lives in `/CLAUDE.md` — read that first. This file covers what's actually in `frontend/` right now and the behaviours a session must respect.

```
/ (CLAUDE.md)
└── frontend/   ← YOU ARE HERE — the whole app, a React PWA (Vite)
    └── src/
        ├── db/            → see frontend/src/db/CONTEXT.md  (data layer + write API: repo.ts)
        ├── sync/          → push (syncEngine.ts) + pull (pull.ts/useSync.ts) — Dexie ⇄ Supabase (covered below)
        ├── utils/         → supabase client (covered below)
        ├── lib/           → cn() util (shadcn)
        ├── components/ui/ → shadcn primitives (button, input, label, dialog, toggle-group, popover, calendar, scroll-area)
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
- `src/components/ui/`, `src/features/auth/`, `src/features/activities/`, `src/features/today/`, `src/features/notifications/`, `src/hooks/` — see below.
- `src/push/` — Web Push client (permission, subscribe, timezone capture). See the Notifications section.
- `src/sw.ts` — service worker (see PWA note below).
- `vite.config.ts`, `pwa-assets.config.ts` — PWA wiring.

Still scaffold / not real: `src/PWABadge.tsx` + `.css` (kept — SW update prompt), `src/App.css` (now **unused**, not imported), `src/assets/`, `public/favicon.svg`.

## Design system — `src/index.css`

Tailwind v4 `@theme`. **Grayscale + a single pastel-pink accent**, app is always dark (tokens on `:root`, no light mode). Hard rule from the design: **pink is a signal, not decoration** — sanctioned uses are the primary CTA, the brand mark, progress-fill, and (as of the active-session card) a **live/active-session indicator** (icon stroke, live pill, ambient glow, ping ring — see `ActiveSessionCard.tsx` below). Never tint inputs, secondary buttons, links, or hovers pink outside those cases (a faint pink *focus ring* is the one other sanctioned exception).

Custom looping/decorative animations (breathing shadow, ping, pulse, shimmer) are defined as `--animate-*` tokens + nested `@keyframes` in a plain `@theme { }` block in `src/index.css` (Tailwind v4's native pattern — no animation library needed). Apply them via the `motion-safe:` variant at the call site so `prefers-reduced-motion: reduce` disables the loop for free (layout/colors stay, only the animation utility doesn't apply) — no JS media-query branching required.

- shadcn semantic tokens (`--background`, `--foreground`, `--primary` = the pink, `--border`, `--input`, `--ring`, …) carry the hex values above, so shadcn components inherit the look.
- Plus a named Undegen scale exposed as utilities: `bg-surface`/`bg-surface-raised`/`bg-panel`, `text-ink`/`text-ink-soft`/`text-ink-body`/`text-ink-muted`/`text-ink-dim`/`text-ink-faint`, `text-pink`/`bg-pink`/`hover:bg-pink-hover`, `border-edge-chip`/`border-edge-panel`/`border-hairline`. Plus two card-specific palettes, each dedicated rather than reusing the generic scale above (so a card's own redesign can't accidentally ripple elsewhere): `session-*` (bg/border/icon-bg/track/timer/title/muted) for `ActiveSessionCard.tsx`, and `idle-*` (bg/border/icon-bg/icon-border/title/label/track/caption/caption-strong) for `IdleGoalCard.tsx`/`IdleZenCard.tsx`.
- Font: **Inter**, bundled via `@fontsource-variable/inter` (imported in `main.tsx`) — **not** a CDN, because offline is a core feature.

## UI primitives — `src/components/ui/` (shadcn)

shadcn "new-york", set up manually (deterministic; `components.json` keeps `npx shadcn add <x>` working). `button.tsx` (cva; `default` = the pink CTA + glow, `outline` = grayscale secondary), `input.tsx` (base = mobile sizing; desktop tweaks applied at call site), `label.tsx`. `cn()` lives in `src/lib/utils.ts`.

Also `dialog.tsx` (wraps `@radix-ui/react-dialog`; deliberately unopinionated on sizing/position — that's a call-site concern, since the create-activity flow uses the same Dialog for a full-screen mobile sheet and a centered desktop card, which differ too much to bake into the primitive), `toggle-group.tsx` (wraps `@radix-ui/react-toggle-group`; bakes in the **grayscale-only selected state** — `bg-elevated`/`lg:bg-elevated-lg`, never pink — since every segmented control/weekday-cell/chip in the app is one of these), `popover.tsx` (wraps `@radix-ui/react-popover`), `calendar.tsx` (wraps `react-day-picker`'s `DayPicker`, same grayscale-selection rule), `scroll-area.tsx` (wraps `@radix-ui/react-scroll-area`; used for reliable custom-scrollbar lists, e.g. `TimePicker`'s quick-pick list — plain `overflow-y-auto` divs are fine elsewhere but this one needed a real scrollbar affordance). The `--elevated`/`--elevated-lg` tokens (`#2a2a2a`/`#303030`) live in `src/index.css` — the named "selected/elevated fill" signal, distinct from `--surface`/`--surface-raised` (which are input backgrounds, not selection states).

**`dialog.tsx` + `popover.tsx` — nested-scroll fix:** Radix Dialog's modal scroll-lock (`react-remove-scroll`) only exempts wheel/touch scroll for DOM descendants of `Dialog.Content`; anything portaled straight to `document.body` (a Popover/Select's default) is a DOM *sibling*, so the lock swallows wheel/touch scroll over it — only a scrollbar-thumb drag still works, since that sets `scrollTop` via JS rather than firing a native wheel/touchmove event. Fix: `dialog.tsx`'s `DialogContent` renders a `display:contents` div inside its own subtree and exposes it via `useDialogPortalContainer()`; `popover.tsx`'s `PopoverContent` reads that context and passes it as `Popover.Portal`'s `container` when present (falls back to `document.body` outside a Dialog). This makes any Popover-in-Dialog scroll correctly app-wide, not just `TimePicker`'s — don't special-case future Popover-in-Dialog usages, they get this for free.

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
- **`TimePicker.tsx`** — no time-picker library exists; native inputs were explicitly rejected in favour of a themed control. Three always-editable segments (HH / MM / AM-PM) that can be typed into directly or stepped with arrow keys cover arbitrary times, plus a secondary clock-icon button opens a Popover with a 15-min-increment quick-pick list (`ScrollArea`-based, see `dialog.tsx`/`popover.tsx`'s nested-scroll fix above — this is the component that surfaced that bug) for fast common selection. Reused for `strict_time`, `soft_start`, `soft_end`. **`StartsDateField`** uses the `calendar.tsx` primitive for `recurrence_start`, reusing `todayLocal()` from `src/db/recurrence.ts` both as the default and to format a selected `Date` back to the `'YYYY-MM-DD'` string the schema stores.
- **`icons.tsx`** — hand-rolled inline SVGs (bell, concentric circles, chevron-left, x, calendar, clock, plus/minus), matching `features/auth/icons.tsx`'s convention. (`features/today/` made the opposite call and adopted `lucide-react` instead — see below; the two conventions currently coexist.)
- Writes go through `src/db/repo.ts`'s `createActivity` (stamps `position`/`archived`, delegates to `newActivity`) — never straight to Dexie/Supabase from this feature.
- Mounted from `features/today/TodayScreen.tsx` (mobile FAB + desktop header "+" button both open it) — no longer mounted from `App.tsx`.

## Today screen — `src/features/today/`

The screen that replaced `App.tsx`'s old placeholder: a time-ordered timeline of today's reminders (done / NOW / up next) plus, on desktop, a Long-tasks rail. Same design system as the rest of the app (grayscale + single pink accent, see `src/index.css` above).

- **`useTodayData.ts`** — the one data hook: `useLiveQuery` (from `dexie-react-hooks`, first real usage in the repo) over `src/db/dayView.ts`'s `getDayItems`, plus a minute-tick clock. Writes via `repo.ts` (`markReminder`, `startWorkSession`) auto-refresh it — no manual invalidation anywhere in this feature. Also derives the earlier/up-next time buckets (anchored on `strict_time` or `soft_start`) and the header counts. `streak` is a **hardcoded stub** — real derived-streak calculation isn't built (see `db/CONTEXT.md`).
- **`TodayScreen.tsx`** — top-level responsive shell; literally duplicates the mobile/desktop blocks (`lg:hidden` / `hidden lg:flex`, same precedent as `NewActivityDialog.tsx`) since the two chromes (bottom tab bar + FAB vs. floating island + rail) genuinely differ. Owns the NOW-marker scroll-into-view: a manually computed `scrollTop` on mount, **not** `scrollIntoView` — mixing a scroll container with a flex-1 body has been unreliable for this elsewhere in the codebase too (see `NewActivityDialog.tsx`'s own note on `h-auto` + flex).
- **`Timeline.tsx`** — the one shared timeline body for both breakpoints (rows don't structurally differ, only the surrounding chrome does — same shared-body precedent as `NewActivityFormBody.tsx`).
- **`ReminderRow.tsx`** — a reminder only renders dimmed/checked once `completion.status === "done"`. A reminder whose time has passed with no completion still renders at full opacity with a tappable empty circle, **not** styled as a failure — root `CLAUDE.md` bans punishing "missed" states, so a late reminder stays actionable rather than showing as a failure.
- **`LongTaskCard.tsx`** — pure router, no layout of its own: an `in_progress` session delegates to `ActiveSessionCard.tsx` (below); otherwise the card is picked by the activity's fixed `default_mode` — `IdleGoalCard.tsx` for goal mode, `IdleZenCard.tsx` for zen mode. Mode is set once at creation and never changes per session, so there's no third branch. Only one `in_progress` session at a time per `day_activity` — nothing else guards against a second concurrent start, so don't add a second "start" entry point without checking for an existing active session first.
- **`IdleGoalCard.tsx`** — goal-mode idle: a progress bar banked **across every completed session the activity has ever had**, not scoped to today (a goal is worked toward over multiple sittings). Reads via `db/taskHistory.ts`'s `getCompletedSessions` (a `useLiveQuery`, so a `Stop session` elsewhere refreshes it automatically). 0% and "not started" are the same component at the natural low end, not a separate empty state — see the design handoff's own framing of this in `design_handoff_long_task_cards/`.
- **`IdleZenCard.tsx`** — zen-mode idle: a 6-bar greyscale sparkline of the most recent completed sessions (by length, never pink — no goal means no session is "the target") plus a caption rolling up today's total (bolded via `idle-caption-strong`, same emphasis pattern as `IdleGoalCard`'s percentage) and the trailing-7-day total. Today's boundary uses `db/recurrence.ts`'s `todayLocal()` (local calendar day, not a rolling 24h window) so it matches the rest of the app's day semantics. Sparkline, "today", and "this week" are all independently derived from the same `getCompletedSessions` read — the visible bars aren't necessarily all from the last 7 days. No sparkline at all (not an empty/flat one) when the activity has zero completed sessions ever; caption becomes "No limit · not started".
- **`db/taskHistory.ts`** — cross-day companion to `dayView.ts`: `getCompletedSessions(activityId)` walks every `day_activity` the activity has ever materialised (`day_activities.activity_id` index) and returns its `completed` `work_sessions`, oldest→newest. This is the one place in the app that reads a `long_task`'s history beyond a single date; both idle cards depend on it.
- **`ActiveSessionCard.tsx`** — the in-session state, structurally independent from the idle cards (header row with icon-ring + live pill, big ticking timer, mode-conditional progress bar vs. breathing baseline, single action button). Reads `mode`/`goal_duration_mins` off the **`WorkSession` row itself** (snapshotted at start), not `activity.default_mode` — matches the goal-snapshot rule so a later activity edit can't retroactively change how a past/running session renders. Owns its own 1s `setInterval` (elapsed derived from `Date.now() - started_at` on each tick, not a naive counter) so the timer ticks independently of the app-wide minute-tick clock in `useTodayData.ts`, which is too coarse for a live `M:SS` display. Single action button — `Finish session` (checkmark icon, pink-tinted pill at rest, identical copy in both modes per the design handoff's correction over an earlier goal/zen-split label) — the design handoff's Pause button was dropped: `CLAUDE.md` settles no pause/resume in v0, and `repo.ts` has no paused state to back it. Currently only mounted from the desktop rail (`TodayScreen.tsx`'s "Long tasks" panel); the mobile "Focus" tab it'd also belong on per the handoff is still an unwired stub (`MobileTabBar.tsx`) with no screen behind it yet.
- **`iconForActivity.ts`** — the CLAUDE.md-settled "icon derived from type + name, frontend string map, no picker" utility. Keyword-matches `activity.name`, falls back per `activity.type`. Uses `lucide-react` (installed since `components.json` was set up, but unused elsewhere in `src/` until this feature).
- **`MobileTabBar.tsx`/`DesktopIsland.tsx`** — Focus/Stats/You render styled but **non-functional** (no `onClick`, no navigation) — no router is installed anywhere in this repo, and only Today is built. Desktop drops the mobile Focus tab: on desktop, long tasks/focus sessions already have a home in the Long-tasks rail on Today, so a separate Focus destination would be redundant there; mobile has no side rail to put long tasks in, so it keeps its own Focus tab. A fake macOS window frame (traffic lights, rounded/bordered outer border) was considered and rejected: this is a browser-tab PWA, not Electron, and the real browser window already supplies window chrome — see the comment in `DesktopIsland.tsx`.
- Sign-out has no home in the new design; kept as a small temporary text link at the end of the primary scroll content (mobile: bottom of the timeline; desktop: bottom of the rail) until a "You" screen exists to own it.

## `src/utils/supabase.ts` — the cloud edge

Six lines: `createClient(VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY)`. Needs those two env vars (`.env`, gitignored). Web Push adds a third, `VITE_VAPID_PUBLIC_KEY` (the VAPID public key — safe to ship; the private key lives in Supabase function secrets).

**Behaviour to respect:** this client is the *only* path to the cloud, and per the architecture it must **never be read from in the UI critical path** — UI reads come from Dexie. Two background flows use it, both in `src/sync/` (see next section): **push** drains the queue → Supabase, **pull** reads Supabase → reconciles into Dexie. The pull reads the cloud but hydrates Dexie, not the render path, so the contract holds. Feature code mutates via `src/db/repo.ts` and reads via Dexie, never by calling `supabase` directly.

**One documented exception:** `src/push/` writes `push_subscriptions` and `user_settings` **direct** to Supabase, bypassing Dexie/`syncQueue`. These are cloud-only, server-facing rows (the Edge Function reads them), acquired only while online, and never read from Dexie — so the offline-first write path doesn't apply. This is the *only* place feature code calls `supabase` for writes.

## Sync — `src/sync/`

Two directions, both background, both off the render path (UI always reads Dexie):

- **push / flush** — `syncEngine.ts`: drains `syncQueue` → Supabase. `startSync()` (called in `main.tsx`) runs the first flush and re-flushes on `online`. `update` ops use `.update().eq` (not `upsert`) so a queued edit can't resurrect a row another device deleted.
- **pull / hydrate** — `pull.ts` `pullAll()`: re-reads the user's full row set (RLS-scoped) and reconciles into Dexie — server wins except rows with a pending `syncQueue` entry; local rows absent server-side are deleted (**a delete is terminal**). `useSync(userId)` (mounted in `App`'s signed-in subtree) fires it on session-active + `online` + app-foreground. Full contract in `db/CONTEXT.md`; rationale in ADR 0002.

Glossary: **push/flush** = Dexie→Supabase · **pull/hydrate** = Supabase→Dexie · **sync** = the pair. Note `startSync` is push-only despite the generic name — pull is wired separately through `useSync` because it needs a `userId` and an auth-ready trigger that `main.tsx`'s pre-render `startSync()` can't supply.

## PWA — `vite.config.ts` + `src/sw.ts`

- Strategy `injectManifest` with a custom `src/sw.ts` (chosen because we need custom push + background-sync listeners that `generateSW` can't express).
- `registerType: 'prompt'` — **never silently auto-update the SW.** App is write-heavy (timers, offline writes); a silent reload would kill a session. Prompt the user.
- `injectRegister: false` — registration is wired manually (currently via `PWABadge.tsx`).
- **Periodic SW update:** enabled, 1h interval — users keep the app open all day; navigation-only checks aren't enough.
- **Offline-ready prompt:** enabled, auto-dismiss — offline is a core feature, users need to know it's ready.
- **Icon generation:** `@vite-pwa/assets-generator` `minimal-2023` preset (`pwa-assets.config.ts`) — one source SVG → all iOS/Android/favicon sizes.
- **Edge-to-edge / safe areas:** `index.html` sets `viewport-fit=cover` (+ `apple-mobile-web-app-capable`, `theme-color #0f0f0f`). `viewport-fit=cover` is what makes `env(safe-area-inset-*)` report real values; `theme-color` tints the opaque status bar so, on a dark app, it reads as seamless. **Deliberately NOT using `apple-mobile-web-app-status-bar-style=black-translucent`** — on standalone iOS it shortens the usable viewport at the bottom (top-anchored layouts then show dead space below the tab bar); the opaque `#0f0f0f` bar looks identical here without the quirk. Consequence: any full-bleed or `fixed`/edge element must pad itself with `env(safe-area-inset-*)` (see the mobile header, `MobileTabBar`, and the FAB in `features/today/`) — a hardcoded top/bottom pad will be wrong per-device. Metas are read at launch, so the installed PWA must be re-added to the home screen to pick up changes.

**`src/sw.ts` current state:** the vite-pwa template (precache + `cleanupOutdatedCaches` + navigation fallback + `SKIP_WAITING`) **plus Web Push handlers**: `push` (shows the notification), `notificationclick` (focuses an open tab or opens `/` — Today; no router yet, so no per-activity deep link), and `pushsubscriptionchange` (silently re-subscribes; the app persists the new row on next open via `reconcileSubscription`). `src/sw.ts` is compiled by Vite, so `import.meta.env.VITE_VAPID_PUBLIC_KEY` is available there. The **background-sync handler is still NOT here** — `syncQueue` only drains while the app is alive (see `db/CONTEXT.md`).

## Notifications — `src/push/` + `src/features/notifications/`

Client half of the Web Push feature (server half: `supabase/` alarm — ADR 0003).

- `push/subscribe.ts` — `enableNotifications(userId)` (permission from a user gesture →
  `pushManager.subscribe` → upsert `push_subscriptions` direct), `disableNotifications`,
  `reconcileSubscription` (no-prompt refresh on session-active), `currentPermission`,
  `isSubscribed`.
- `push/timezone.ts` — `captureTimezone(userId)`: writes the device IANA zone to
  `user_settings` (the server can't fire a zoneless reminder without it).
- `push/platform.ts` — `pushSupported`, `isIOS`, `isStandalone`, `needsInstallFirst` (iOS
  only does Web Push once the PWA is installed to the home screen).
- `push/ask.ts` — `shouldOfferAsk()`: gate for the contextual prompt.
- `push/useReconcile.ts` — `useReconcileNotifications(userId)`, called beside `useSync` in
  `App`'s signed-in subtree (same triggers: mount / online / foreground).
- `features/notifications/NotificationAsk.tsx` — the contextual permission dialog, shown by
  `TodayScreen` **after a reminder is created** (`NewActivityDialog`'s `onCreated` →
  `shouldOfferAsk()`). Three shapes: iOS "add to home screen" guidance, the real ask, and a
  "blocked" state. **This is the only entry point** — there's no settings screen yet, so no
  toggle to re-enable once granted/blocked (deferred).

## Conventions

- TypeScript throughout; types for the data model live in `src/db/types.ts` and mirror the SQL schema 1:1.
- Tailwind utility classes; no separate CSS modules expected for new work.
