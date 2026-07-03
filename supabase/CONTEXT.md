# CONTEXT — `supabase/`

The cloud backend. There is **no custom server** — the app talks to Supabase directly via `supabase-js` (Auth + PostgREST), and RLS does the access control. Root context in `/CLAUDE.md`.

```
/ (CLAUDE.md)
└── supabase/   ← YOU ARE HERE
    ├── config.toml   → Supabase CLI config (Edge Functions)
    ├── migrations/   → SQL migrations (schema lives here)
    └── functions/    → Deno Edge Functions (the Web Push sender)
```

## Contents

- `migrations/0001_initial_schema.sql` — the entire schema so far: 6 enums, the `set_updated_at()` trigger helper, the data tables, indexes, and **all RLS policies**. Applied transactionally (`begin`/`commit`).
- `migrations/0002_drop_goal_unit_value.sql` — drops `activities.goal_unit`/`goal_value` (dead — reserved for a cut reps/km/pages goal axis, never built; `goal_duration_mins` already covers the only goal type in scope, time, and is untouched) and updates `long_task_config_only_on_long_task` accordingly. **`work_sessions.goal_unit`/`goal_target`/`goal_actual` are deliberately untouched** — that table isn't built out yet (no focus-session feature); don't assume symmetry was intended, revisit when it lands.
- `migrations/0003_notifications.sql` — the notification alarm's tables: `user_settings`, `push_subscriptions`, `notification_log` (+ RLS). See the alarm section below.
- `migrations/0004_notifications_cron.sql` — enables `pg_cron`/`pg_net`, stores the function URL + cron secret in Vault, and schedules the every-minute invocation (+ a nightly `notification_log` prune). **One-time setup with placeholders**; run after deploying the function.
- `functions/send-notifications/` — the Web Push sender (Deno). `index.ts` (handler) + `schedule.ts` (pure due-ness/slot logic, mirrors the frontend's `recurrence.ts`) + `schedule.test.ts` (`deno test`).

## What the schema encodes

Six tables. `users` is Supabase Auth's `auth.users` (no custom columns). The other five:

```
activities ──→ day_activities ←── days
                    │
              ┌─────┴─────┐
          completions   work_sessions
```

Decisions baked into the SQL (don't relitigate — see CLAUDE.md):
- Activity config = **nullable columns on `activities`**, guarded by two check constraints (`reminder_config_only_on_reminder`, `long_task_config_only_on_long_task`) so config can only be set on the matching `type`.
- `day_activities` has **no `type` column** (inferred via join).
- **No stored derived values** (streaks/rates computed on read).
- `work_sessions` goal fields are **snapshots** at session start (immutable history).
- `recurrence_days` uses JS `Date.getDay()` (0=Sun..6=Sat), constrained `<@ {0..6}`.

## RLS — the security model (critical)

Every data table has RLS enabled with an owner-only `for all` policy. Two ownership patterns:

- `activities`, `days` carry `user_id` directly → `user_id = auth.uid()`.
- `day_activities`, `completions`, `work_sessions` have **no `user_id`** → ownership resolves via **join back to `days.user_id`** inside the policy (an `exists (...)` subquery).

**Implication for new tables:** any new table reachable per-user must get RLS enabled + a policy in the same migration, following whichever pattern fits. A table without a policy is invisible to the client (RLS default-deny). Don't forget the `with check` clause — `using` alone guards reads/deletes but not inserts/updates.

**Applying migrations:** `0001` was applied via the dashboard SQL editor. `0002` is written but **not yet applied to the remote project** — apply it (and then `0003`, `0004`) before relying on the newer schema. The repo now **uses the Supabase CLI for Edge Functions** (`config.toml` present); SQL migrations may still be applied via the dashboard SQL editor or `supabase db push`. `0004` has placeholders (function URL, cron secret) — fill them in and run it once, after deploying the function.

## The notification alarm (Web Push)

Server-side reminders. Full rationale in **ADR 0003**; the shape:

- **`pg_cron`** fires the **`send-notifications`** Edge Function every minute (a dumb
  heartbeat — no schedule logic in SQL). The function derives who is due *now*.
- The function reads `activities` + `user_settings.timezone` + `push_subscriptions`, computes
  due **slots** in each user's local wall-clock, **claims** each in `notification_log`
  (`insert … on conflict do nothing` = at-most-once), then sends Web Push via `npm:web-push`.
- **Timezone is load-bearing** and lives in `user_settings` (one IANA zone per user). Without
  it a user gets no notifications — a zoneless `strict_time` can't be placed. Captured
  client-side; last-device-wins.
- **Soft reminders are completion-aware**: nudges stop once the occurrence is done/skipped
  today (the function left-joins `completions`). Strict fires once.
- **Dead subscriptions self-clean**: a `410 Gone`/`404` from the push service deletes that
  `push_subscriptions` row.

These three tables are **cloud-only**: written direct to Supabase by the client (never through
Dexie/`syncQueue`) and read only by the function (service-role). Still RLS owner-only.

**Glossary** (shared with the frontend recurrence model):
- **alarm** — the server-side trigger (this function + cron).
- **occurrence** — a derived instance of a recurring activity on a date (`recursOn`).
- **slot** — the wall-clock minute a notification is due (a `strict_time`, or one soft nudge);
  the idempotency unit `(activity_id, local_date, slot)`.
- **nudge** — a single soft-reminder firing; a soft reminder emits many across its window.

**Deploying the function (CLI):** `supabase link --project-ref <ref>` →
`supabase functions deploy send-notifications` → `supabase secrets set VAPID_PUBLIC_KEY=…
VAPID_PRIVATE_KEY=… VAPID_SUBJECT=mailto:… CRON_SECRET=…` (generate VAPID keys with
`npx web-push generate-vapid-keys`; `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are injected).
`config.toml` sets `verify_jwt = false` for the function.

## Migration conventions

- One numbered SQL file per change (`0001_`, `0002_`, …). Never edit a migration that has already been applied to a real environment — add a new one.
- Wrap DDL in `begin`/`commit`.
- Schema changes here **must** be mirrored in `frontend/src/db/types.ts` (interfaces) and, if indexes/uniqueness change, `frontend/src/db/db.ts`. Local Dexie and cloud Postgres are kept in lockstep.

## Not yet here (planned — see CLAUDE.md Open Questions)

- **`activities.exception_dates date[]`** — skip a recurrence on a specific date without archiving.
- **Server-side `missed` sweep** — the `missed` enum value is still reserved (ADR 0001), no cron writes it yet.
- **Notification preferences** — `user_settings.quiet_hours_start/end` columns exist but nothing reads them; global mute / per-activity mute have no UI (deferred until a settings screen).

Landed: `push_subscriptions`, `user_settings`, `notification_log`, the `send-notifications` Edge Function, and `pg_cron`/`pg_net` (migrations 0003–0004). See the alarm section above.
