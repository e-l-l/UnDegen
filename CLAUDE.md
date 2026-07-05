# CLAUDE.md — Undegen

Project context for Claude Code. Read this before touching anything.

---

## What This Is

**Undegen** ("un-degenerate") — a recurring-activity accountability app. Not a todo app. Specifically for the things you keep choosing to avoid: gym, meds, deep work, laundry. The app's premise is that you have an avoidance problem, not an organisation problem.

**Tone:** self-aware, dry, honest. No gamification, no confetti, no streaks as the hero metric, no punishing "missed" states. The UI reflects this — minimal, dark, calm. **One scoped exception:** the **Stats** surface roasts the *gap* (dry/sarcastic missed-state copy) — see the Key Decisions row. It targets the not-done, never the user, never needles a good week, and stays contained to Stats; everywhere else (especially Today) missed states stay non-punishing.

---

## Repo Structure

```
/
├── frontend/    # React PWA (Vite) — the whole app
├── supabase/    # DB migrations + Edge Functions (Web Push)
└── CLAUDE.md
```

---

## Context Files (`CONTEXT.md`)

Substantial nodes in the repo carry a local `CONTEXT.md` documenting that node's contents and the non-obvious behaviours/contracts a session must respect. This file is the root context; node files are the local detail. Current files: `frontend/`, `frontend/src/db/`, `supabase/`.

**Always:**
- **Read** the relevant `CONTEXT.md` before working in a directory that has one.
- **Update** the relevant `CONTEXT.md` in the same change whenever a change invalidates what it says — e.g. new/removed files, a changed contract or behaviour, a schema change, new build/dev commands, or something moving from "not built yet" to built. Treat the doc as part of the change, not a follow-up.
- Keep node files local — don't duplicate this root doc; link back to it instead. Add a new `CONTEXT.md` when a directory grows into a substantial node of its own.

---

## Tech Stack

### Frontend (`/frontend`)
- **React + TypeScript + Vite**
- **Tailwind CSS** — utility-first styling
- **shadcn/ui** — component layer; use shadcn components for UI, don't hand-roll primitives
- **Recharts** — charts and analytics graphs
- **Dexie.js** — IndexedDB wrapper; local-first data layer, source of truth for all reads
- **vite-plugin-pwa** — service worker, web manifest, asset generation (`injectManifest` strategy)
- **@vite-pwa/assets-generator** — generates all icon sizes from a single source SVG

### Backend — Supabase (no custom server)
- **Supabase** — Postgres + Auth. The client talks to Supabase **directly** via `supabase-js`: Auth for login/JWTs, PostgREST for data. **RLS** enforces per-user ownership (see migration) — no app server sits in the data path.
- **Web Push** — the only genuine server-side need. A **Supabase Edge Function** (Deno) signs and sends Web Push, triggered on schedule by **`pg_cron`** (+ `pg_net`). Nothing standalone to host.
- **Dropped FastAPI** — redundant with PostgREST for CRUD, plus an extra deploy target and secret surface. See Key Decisions.

### Hosting
- Frontend → **Vercel** (deploys on GitHub push)
- Data + Auth + Push → **Supabase** (Postgres, Auth, Edge Functions, `pg_cron`). No separate backend service.

### Package manager
- Frontend: **npm** (not pnpm, not yarn)

---

## Architecture — Offline First

```
User action
    ↓
Write to Dexie (local, instant)
    ↓
Queue write (syncQueue)
    ↓
Online?  → flush to Supabase directly via supabase-js (RLS-scoped)
Offline? → flush when connection returns (background sync via service worker)
```

- **All reads come from Dexie.** Never read from the API in the critical path.
- **Supabase Postgres is the cloud mirror**, not the source of truth.
- Static assets are precached on first load — app opens fully offline.

---

## PWA Configuration

Implementation detail lives with the code — see `frontend/CONTEXT.md` (PWA section) for SW strategy, update cadence, offline prompt, and icon generation. Root-level constraint only: **never silently auto-update the SW** (write-heavy app; prompt instead).

---

## Data Model

Six tables. Central relationship:

```
activities ──→ day_activities ←── days
                    │
              ┌─────┴─────┐
          completions   work_sessions
```

### `users`
Managed by Supabase Auth. No custom columns. Per-user app config lives in a **separate `user_settings` table** (keyed by `auth.users.id`) — currently the user's IANA `timezone` (load-bearing for server-side notification firing; see ADR 0003), plus reserved quiet-hours columns.

### notification tables (`user_settings`, `push_subscriptions`, `notification_log`)
Cloud-only, added by migration `0003` for Web Push (ADR 0003). Not mirrored in Dexie — the client writes them **direct** to Supabase (see What Not To Do), and the Edge Function reads them via service-role. `notification_log` is the claim-then-send idempotency ledger, unique on `(activity_id, local_date, slot)`.

### `activities`
Template/definition of a trackable thing. Two types: `reminder` and `long_task`. Type-specific config lives as nullable columns on this table (no extension tables).

Key columns: `id`, `user_id`, `name`, `type`, `recurrence_days` (int[]), `recurrence_start` (date), `exception_dates` (date[] — dates the rule skips; "delete this day only", migration `0007`), `archived` (soft-delete; "delete entire event"), `position`

Reminder-specific (null if long_task): `reminder_type` (`strict`|`soft`), `strict_time`, `soft_start`, `soft_interval_mins`, `soft_end`

Long-task-specific (null if reminder): `default_mode` (`goal`|`zen`), `goal_duration_mins`, `goal_unit`, `goal_value`

### `days`
One row per calendar date per user. **Sparse / engagement-based** — created lazily when a date first acquires state (a `note`, or the first `day_activity` instantiated on it), *not* for every calendar day. Container for the daily view.

Key columns: `id`, `user_id`, `date` (unique per user), `note`

### `day_activities`
**Override row, calendar-style** — *not* pre-created for every occurrence. A recurring activity's occurrences are **derived on read** by expanding `recurrence_days`/`recurrence_start` over the viewed date(s). A `day_activities` row is **lazily instantiated only when an instance acquires state** — a completion, a work session, or a manual add. Think of it as a calendar's per-instance override, not the schedule itself.

Key columns: `id`, `day_id`, `activity_id`, `source` (`recurring`|`manual`), `position`

**No `type` column** — always inferrable via join to `activities`. Removing it eliminates drift risk.

### `completions`
Completion record for a reminder-type `day_activity`. One row per `day_activity`.

Key columns: `id`, `day_activity_id` (unique FK), `status` (`done`|`skipped`|`missed`), `completed_at`, `note`

### `work_sessions`
Execution record for a long_task-type `day_activity`. Multiple sessions per `day_activity` allowed (morning + evening = two rows).

Goal fields are snapshotted at session start — editing an activity later doesn't mutate history.

Key columns: `id`, `day_activity_id`, `mode` (`goal`|`zen`), `goal_duration_mins`, `goal_unit`, `goal_target`, `goal_actual`, `started_at`, `ended_at`, `total_secs`, `status` (`in_progress`|`completed`|`abandoned`), `goal_met`, `note`

### Dexie (local) schema
Mirrors all six Supabase tables, plus one local-only table: `syncQueue` — pending write operations to flush when back online.

---

## Key Decisions (settled — don't re-debate)

| Decision | Choice | Reason |
|---|---|---|
| PWA vs native | PWA | No App Store, no $99/yr, Web Push solves notifications on iOS 16.4+ |
| Backend service | None — Supabase-direct | `supabase-js` covers auth + CRUD with RLS; only Web Push needs a server, done via Edge Function + `pg_cron`. Dropped FastAPI (redundant, extra host + secret surface) |
| Local DB | Dexie.js | Clean async/await API over raw IndexedDB, TypeScript support, schema versioning |
| Data strategy | Local-first | Offline is a core feature; Supabase is cloud mirror only |
| Config storage | Nullable columns on `activities` | Avoids multi-table joins for every config read; ~10 nullables is fine for this scale |
| `day_activities.type` | Removed | Inferrable from join; storing it creates drift risk |
| Recurrence model | Calendar-style (derive, don't pre-store) | Occurrences expanded on read from `activities` recurrence; `day_activities` are override rows instantiated lazily when an instance gains state; `days` are sparse/engagement-based. Alarms fire server-side from `activities`, independent of materialisation |
| Deleting a task | Day → `exception_dates`; event → `archived` | "Delete this day only" appends the date to `activities.exception_dates` (both `recursOn`s skip it) and wipes that date's instantiated state; "delete entire event" flips `archived` (hides everywhere, keeps `completions`/`work_sessions` for history). Both one-way from the UI in v0. `repo.removeOccurrence` / `repo.archiveActivity` |
| Ad-hoc tasks (v0) | Not supported | All `day_activities` have an `activity_id`; everything comes from a template |
| Pause/resume (v0) | Not supported | Adds timer + sync + analytics complexity; `total_secs` is a simple diff for now |
| Goal snapshot | At session start | Immutable history even if activity config changes later |
| Streak calculation | Derived on read | Computed from `completions`; not stored |
| Missed detection | Derived on read, never written | No cron flip, no stored `missed` status; view computes it (`frontend/src/db/`: `recurrence.ts`, `dayView.ts`, `repo.ts`). ADR 0001 |
| "Missed it" action | Deliberate skip → stores `skipped`, reminders only | The Today per-occurrence menu ("Missed it", `TaskActions.tsx`) writes `completions.status = 'skipped'` via `markReminder(…, "skipped")` — *not* the derived `missed`, which stays unwritten (ADR 0001). Silences that occurrence's notifications (soft nudges **and** the strict fire). Reversible via "Undo" (`clearReminder`). Renders dimmed+struck on Today (user-chosen dismissal, not banned system-missed styling) and unified as "Missed" in Stats. Sole source of `skipped` completions |
| Stats roast (tone) | Sarcastic missed-state copy, **Stats surface only** | The honest-mirror motivational engine. Overrides the global "no punishing missed states" rule, scoped to Stats. Targets the *gap* (not the user), never needles a good week; a great week gets a plain nod. Lives in `frontend/src/features/stats/copy.ts` (threshold-driven), not in JSX. Contained — Today etc. stay non-punishing |
| Notification firing | Poll-and-compute, server-side | `pg_cron` (1/min) → `send-notifications` Edge Function derives who's due now from `activities` + tz; no stored schedule. Claim-then-send via `notification_log` (at-most-once). A `done`/`skipped` completion for the occurrence suppresses its send — **both** types (soft stops remaining nudges, strict is pre-empted before its single fire). Best-effort: reads Supabase, so an offline/unsynced mark near fire-time may still let one through. ADR 0003 |
| Timezone | Per-user IANA in `user_settings` | Needed to place zoneless `strict_time`; last-device-wins; DST-safe via `AT TIME ZONE`. Not per-device/per-activity. ADR 0003 |
| Notification writes | Direct to Supabase | `push_subscriptions`/`user_settings` bypass Dexie/`syncQueue` — cloud-only, online-only, never read from Dexie. The one write exception |
| Activity icons | Frontend string map | No icon/emoji column in DB; icon derived from `type` + `name` on the FE |
| Navigation / routing | react-router v7 (declarative `BrowserRouter`) | Introduced for the Stats page. Routes `/today`, `/focus` (mobile-only — redirects to `/today` at ≥`lg`), `/stats`, `/stats/:activityId`, catch-all → `/today`. Screens own their chrome (no shared layout route — Today's desktop rail differs from Stats'). SW notification-click → `/today`; `frontend/vercel.json` SPA rewrite so deep links don't 404. **Stats is built end-to-end** — UI + data layer, live Dexie data (`frontend/src/features/stats/` + `frontend/src/db/stats.ts`, see `frontend/CONTEXT.md`). `recharts` v3 installed (first usage, `FocusTrend` only; heatmap/flake hand-rolled) |
| Package manager | npm | Solo project; familiarity over marginal speed gains |

---

## Open Questions (unresolved — flag before implementing)

- **Un-archive / restore** — deleting a task is one-way from the UI. "Delete entire event" sets `archived`; "delete this day" appends to `exception_dates`. Nothing reverses either (no undo toast, no manage/archived screen), so an archived activity or a removed day can't be brought back in-app yet. Restoring needs a settings/manage screen — same gap as notification preferences below.
- **Notification preferences UI** — global mute / quiet hours / per-activity mute have no screen. `user_settings.quiet_hours_*` columns are reserved but unread; enabling/disabling is only reachable via the post-create ask (no re-enable once granted/blocked) until a settings screen exists.

*(Resolved: **push_subscriptions** — landed in migration `0003` alongside `user_settings` + `notification_log`; Web Push is built. See ADR 0003. **Recurrence exceptions** — single-occurrence removal landed via `activities.exception_dates` (migration `0007`), honored by both `recursOn`s; see `repo.removeOccurrence`.)*

---

## What Not To Do

- Don't read from the API in the UI critical path — always read from Dexie
- Don't route cloud-only notification state (`push_subscriptions`, `user_settings`) through Dexie/`syncQueue` — write it direct to Supabase (the one documented write exception; see ADR 0003)
- Don't store derived values (streaks, completion rates) — compute on read
- Don't add a `type` column to `day_activities` — it's inferrable and creates drift
- Don't add extension tables for activity config — use nullable columns on `activities`
- Don't use gamification patterns (streaks as hero metric, confetti, points, levels)
- Don't auto-update the service worker silently — always prompt
- Don't land a change that invalidates a `CONTEXT.md` without updating that file in the same change