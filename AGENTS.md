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

## Architecture — Supabase as the Source of Truth

```
User action
    ↓
Read/write through supabase-js (RLS-scoped)
    ↓
Supabase Postgres
```

- **Supabase Postgres is the single persisted source of truth** for application data.
- UI read functions query Supabase directly; writes complete on the server before the UI refetches.
- There is no Dexie/IndexedDB mirror, sync queue, offline write path, or asset precache.

---

## PWA Configuration

Implementation detail lives with the code — see `frontend/CONTEXT.md` (PWA section) for the Web Push worker, update cadence, and icon generation. Root-level constraint only: **never silently auto-update the SW** (a reload can interrupt an active timer; prompt instead).

---

## Data Model

Seven tables. Central relationship:

```
activities ──→ activity_revisions
     │
     └──────→ day_activities ←── days
                    │
              ┌─────┴─────┐
          completions   work_sessions
```

### `users`
Managed by Supabase Auth. No custom columns. Per-user app config lives in a **separate `user_settings` table** (keyed by `auth.users.id`) — currently the user's IANA `timezone` (load-bearing for server-side notification firing; see ADR 0003), plus reserved quiet-hours columns.

### notification tables (`user_settings`, `push_subscriptions`, `notification_log`)
Added by migration `0003` for Web Push (ADR 0003). The client writes `user_settings` and `push_subscriptions` to Supabase, and the Edge Function reads them via service-role. `notification_log` is the claim-then-send idempotency ledger, unique on `(activity_id, local_date, slot)`.

### `activities`
Stable identity of a trackable thing. Two immutable types: `reminder` and `long_task`. Schedule/config columns remain as a legacy/latest mirror so older installed PWAs keep working; date-aware reads prefer `activity_revisions`.

Key columns: `id`, `user_id`, `name`, `type`, `recurrence_days` (int[]), `recurrence_start` (date), `exception_dates` (date[] — dates the rule skips; "delete this day only", migration `0007`), `archived` (soft-delete; "delete entire event"), `position`

Reminder-specific (null if long_task): `reminder_type` (`strict`|`soft`|`random`), `strict_time`, `soft_start`, `soft_interval_mins`, `soft_end`. **`soft_start`/`soft_end` do double duty**: the soft-nudge window for `soft`, and the fire-window for `random` (then `soft_interval_mins` is null). `random` added by migration `0008` — see Key Decisions.

Long-task-specific (null if reminder): `default_mode` (`goal`|`zen`), `goal_duration_mins`, `goal_unit`, `goal_value`

### `activity_revisions`
Date-effective schedule/configuration, unique on `(activity_id, effective_from)`. The latest revision whose `effective_from <= viewed date` configures that date; before the activity's immutable `recurrence_start`, no occurrence exists. Editing a started activity upserts today's revision; editing a future activity replaces its initial future revision. Names remain on `activities`, so renames intentionally relabel all history. See ADR 0004.

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

## Key Decisions (settled — don't re-debate)

| Decision | Choice | Reason |
|---|---|---|
| PWA vs native | PWA | No App Store, no $99/yr, Web Push solves notifications on iOS 16.4+ |
| Backend service | None — Supabase-direct | `supabase-js` covers auth + CRUD with RLS; only Web Push needs a server, done via Edge Function + `pg_cron`. Dropped FastAPI (redundant, extra host + secret surface) |
| Local DB | None | No IndexedDB mirror or sync queue; avoid dual-source conflict semantics |
| Data strategy | Supabase-first | Supabase Postgres is the single source of truth; UI reads and writes use `supabase-js` directly |
| Config storage | Date-effective `activity_revisions`; legacy/latest mirror on `activities` | Schedule edits apply from a local date without rewriting history; the mirror keeps older installed PWAs compatible. ADR 0004 supersedes the single-row portion of the earlier choice |
| `day_activities.type` | Removed | Inferrable from join; storing it creates drift risk |
| Recurrence model | Calendar-style (derive, don't pre-store) | Occurrences expand the date-effective activity revision (legacy fallback); `day_activities` remain lazy override rows and `days` remain sparse. Alarms resolve the same revision server-side |
| Deleting a task | Day → `exception_dates`; event → `archived` | "Delete this day only" appends the date to `activities.exception_dates` (both `recursOn`s skip it) and wipes that date's instantiated state; "delete entire event" flips `archived` (hides everywhere, keeps `completions`/`work_sessions` for history). Both one-way from the UI in v0. `repo.removeOccurrence` / `repo.archiveActivity` |
| Ad-hoc tasks (v0) | Not supported | All `day_activities` have an `activity_id`; everything comes from a template |
| Pause/resume (v0) | Not supported | Adds timer-state + analytics complexity; `total_secs` is a simple diff for now |
| Goal snapshot | At session start | Immutable history even if activity config changes later |
| Streak calculation | Derived on read | Computed from `completions`; not stored |
| Missed detection | Derived on read, never written | No cron flip, no stored `missed` status; view computes it (`frontend/src/db/`: `recurrence.ts`, `dayView.ts`, `repo.ts`). ADR 0001 |
| "Missed it" action | Deliberate skip → stores `skipped`, reminders only | The Today per-occurrence menu ("Missed it", `TaskActions.tsx`) writes `completions.status = 'skipped'` via `markReminder(…, "skipped")` — *not* the derived `missed`, which stays unwritten (ADR 0001). Silences that occurrence's notifications (soft nudges **and** the strict fire). Reversible via "Undo" (`clearReminder`). Renders dimmed+struck on Today (user-chosen dismissal, not banned system-missed styling) and unified as "Missed" in Stats. Sole source of `skipped` completions |
| Stats roast (tone) | Sarcastic missed-state copy, **Stats surface only** | The honest-mirror motivational engine. Overrides the global "no punishing missed states" rule, scoped to Stats. Targets the *gap* (not the user), never needles a good week; a great week gets a plain nod. Lives in `frontend/src/features/stats/copy.ts` (threshold-driven), not in JSX. Contained — Today etc. stay non-punishing |
| Notification firing | Poll-and-compute, server-side | `pg_cron` (1/min) resolves `activity_revisions` for each user's local date (legacy fallback), then derives due slots. A same-day edit never replays slots at/before its server save minute; remaining slots may fire. Claim-then-send and done/skipped suppression are unchanged. ADRs 0003–0004 |
| `random` reminder subtype | Single fire at a **seeded-random** minute in a window; time hidden | Third `reminder_type` (migration `0008`). Reuses `soft_start`/`soft_end` as the window (`soft_interval_mins` null) — no new columns, no CHECK change. Fire minute = `hash32(activity_id + local_date)` mapped into `[start,end]`, computed in `schedule.ts` `dueSlots` every tick — **deterministic per (activity, day)** so `notification_log` dedupes it exactly like strict; **never stored** (derive-on-read, ADR 0001). Unpredictable to the user *is the point* (surprise → can't pre-arrange avoidance): Today hides the time entirely — the row just reads "RANDOM", never the window or the minute (the range read as clutter); anchored at `soft_end` so a pending one stays in "up next". Push copy "Surprise. It's time." Must stay deterministic — a per-tick `Math.random()` would change the slot every minute and fire repeatedly |
| Timezone | Per-user IANA in `user_settings` | Needed to place zoneless `strict_time`; last-device-wins; DST-safe via `AT TIME ZONE`. Not per-device/per-activity. ADR 0003 |
| Notification writes | Direct to Supabase | `push_subscriptions`/`user_settings` are server-facing notification state, protected by owner RLS |
| Activity icons | Frontend string map | No icon/emoji column in DB; icon derived from `type` + `name` on the FE |
| Navigation / routing | react-router v7 (declarative `BrowserRouter`) | Routes `/today`, `/focus` (mobile-only), `/stats`, `/stats/:activityId`, `/you`, `/you/activities`, catch-all → `/today`. Nav entries remain Today/Focus/Stats/You on mobile and Today/Stats/You on desktop; the Activities manager is a You subpage. Screens own their chrome. SW notification-click → `/today`; `frontend/vercel.json` handles SPA deep links. |
| Day switcher / viewed day | Past reminder corrections, real today ±7, shared context | Today **and** Focus step through days (chevrons only, no calendar/swipe) within real today ±7 to see that day's view. **Past reminders can be marked done or undone** so a forgotten completion can be corrected; future reminders remain review-only. Long tasks stay review-only off-today because starting a timer later would record the wrong wall-clock time. Skipping, starting/stopping sessions, and deleting remain today-only. The **viewed day** lives in `SelectedDayProvider` (context above the routes) so it persists across Today↔Focus; resets to today on cold start + notification tap (`sw.ts` posts `notification-click`). Off-today: flat reminder list (no NOW/Earlier/Up-next), relative title (Yesterday/Tomorrow/weekday) + neutral `X of Y done`, calm state labels, and read-only long-task cards showing that day's logged time / `Planned`. No schema change — the existing lazy `markReminder`/`clearReminder` write path already accepts a date, while `dayView.deriveState` resolves past→`missed`/future→`pending`. Plumbing lives in `frontend/src/features/today/`; UI spec in that folder's `DESIGN_HANDOFF_day_switcher.md` |
| Package manager | npm | Solo project; familiarity over marginal speed gains |

---

## Open Questions (unresolved — flag before implementing)

- **Un-archive / restore** — deleting a task is one-way from the UI. "Delete entire event" sets `archived`; "delete this day" appends to `exception_dates`. Nothing reverses either (no undo toast, no archived screen), so an archived activity or a removed day can't be brought back in-app yet. The **You → Activities** manager can archive active activities but cannot list or restore them; restoring needs an archived-management surface (declined for v0).
- **Notification preferences UI** — the You screen now offers **reallow** (re-enable + live status) any time, closing the "no re-enable once granted/blocked" gap. Still open: an **off toggle**, global mute, quiet hours (`user_settings.quiet_hours_*` reserved-but-unread), and per-activity mute — none have a screen. Sign-out does **not** remove the device's `push_subscriptions` row, so a signed-out device can still receive a push until it re-subscribes — revisit with the full prefs screen.

*(Resolved: **push_subscriptions** — landed in migration `0003` alongside `user_settings` + `notification_log`; Web Push is built. See ADR 0003. **Recurrence exceptions** — single-occurrence removal landed via `activities.exception_dates` (migration `0007`), honored by both `recursOn`s; see `repo.removeOccurrence`.)*

---

## What Not To Do

- Don't add a local database, IndexedDB mirror, sync queue, or offline write path — Supabase is the single source of truth
- Keep application data access in `frontend/src/db/`; UI hooks should consume that layer rather than inventing another cache/persistence path
- Don't store derived values (streaks, completion rates) — compute on read
- Don't add a `type` column to `day_activities` — it's inferrable and creates drift
- Don't add arbitrary type-extension tables; date-effective activity config belongs in the settled `activity_revisions` table and its legacy mirror
- Don't use gamification patterns (streaks as hero metric, confetti, points, levels)
- Don't auto-update the service worker silently — always prompt
- Don't land a change that invalidates a `CONTEXT.md` without updating that file in the same change
