# CLAUDE.md — Undegen

Project context for Claude Code. Read this before touching anything.

---

## What This Is

**Undegen** ("un-degenerate") — a recurring-activity accountability app. Not a todo app. Specifically for the things you keep choosing to avoid: gym, meds, deep work, laundry. The app's premise is that you have an avoidance problem, not an organisation problem.

**Tone:** self-aware, dry, honest. No gamification, no confetti, no streaks as the hero metric, no punishing "missed" states. The UI reflects this — minimal, dark, calm.

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
Managed by Supabase Auth. No custom columns.

### `activities`
Template/definition of a trackable thing. Two types: `reminder` and `long_task`. Type-specific config lives as nullable columns on this table (no extension tables).

Key columns: `id`, `user_id`, `name`, `type`, `recurrence_days` (int[]), `recurrence_start` (date), `archived`, `position`

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
| Ad-hoc tasks (v0) | Not supported | All `day_activities` have an `activity_id`; everything comes from a template |
| Pause/resume (v0) | Not supported | Adds timer + sync + analytics complexity; `total_secs` is a simple diff for now |
| Goal snapshot | At session start | Immutable history even if activity config changes later |
| Streak calculation | Derived on read | Computed from `completions`; not stored |
| Missed detection | Derived on read, never written | No cron flip, no stored `missed` status; view computes it (`frontend/src/db/`: `recurrence.ts`, `dayView.ts`, `repo.ts`). ADR 0001 |
| Activity icons | Frontend string map | No icon/emoji column in DB; icon derived from `type` + `name` on the FE |
| Package manager | npm | Solo project; familiarity over marginal speed gains |

---

## Open Questions (unresolved — flag before implementing)

- **Recurrence exceptions** — a "skip" (`completion.status='skipped'`) marks an occurrence skipped but still *shows* it. Fully *removing* an occurrence from a date (hide it, don't archive the whole activity) is still unsolved; an `exception_dates: date[]` column on `activities` is the likely fix when needed.
- **push_subscriptions table** — required for Web Push but not yet in the schema. Stores Web Push subscription objects per user for server-side notification triggering.

---

## What Not To Do

- Don't read from the API in the UI critical path — always read from Dexie
- Don't store derived values (streaks, completion rates) — compute on read
- Don't add a `type` column to `day_activities` — it's inferrable and creates drift
- Don't add extension tables for activity config — use nullable columns on `activities`
- Don't use gamification patterns (streaks as hero metric, confetti, points, levels)
- Don't auto-update the service worker silently — always prompt
- Don't land a change that invalidates a `CONTEXT.md` without updating that file in the same change