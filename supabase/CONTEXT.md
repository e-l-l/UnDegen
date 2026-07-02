# CONTEXT — `supabase/`

The cloud backend. There is **no custom server** — the app talks to Supabase directly via `supabase-js` (Auth + PostgREST), and RLS does the access control. Root context in `/CLAUDE.md`.

```
/ (CLAUDE.md)
└── supabase/   ← YOU ARE HERE
    └── migrations/   → SQL migrations (schema lives here)
```

## Contents

- `migrations/0001_initial_schema.sql` — the entire schema so far: 6 enums, the `set_updated_at()` trigger helper, the data tables, indexes, and **all RLS policies**. Applied transactionally (`begin`/`commit`).
- `migrations/0002_drop_goal_unit_value.sql` — drops `activities.goal_unit`/`goal_value` (dead — reserved for a cut reps/km/pages goal axis, never built; `goal_duration_mins` already covers the only goal type in scope, time, and is untouched) and updates `long_task_config_only_on_long_task` accordingly. **`work_sessions.goal_unit`/`goal_target`/`goal_actual` are deliberately untouched** — that table isn't built out yet (no focus-session feature); don't assume symmetry was intended, revisit when it lands.

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

**Applying migrations:** no CLI is installed/linked in this repo and no MCP server is connected — `0001` was applied some other way (likely the dashboard SQL editor). `0002` is written but **not yet applied to the remote project**; run it via the Supabase dashboard SQL editor (or link the CLI yourself) before relying on the schema change.

## Migration conventions

- One numbered SQL file per change (`0001_`, `0002_`, …). Never edit a migration that has already been applied to a real environment — add a new one.
- Wrap DDL in `begin`/`commit`.
- Schema changes here **must** be mirrored in `frontend/src/db/types.ts` (interfaces) and, if indexes/uniqueness change, `frontend/src/db/db.ts`. Local Dexie and cloud Postgres are kept in lockstep.

## Not yet here (planned — see CLAUDE.md Open Questions)

- **`push_subscriptions`** table — Web Push subscription objects per user (needed before push works).
- **`activities.exception_dates date[]`** — skip a recurrence on a specific date without archiving.
- **Edge Functions** (Deno) — the Web Push sender. The repo structure reserves `supabase/` for these; none exist yet.
- **`pg_cron` + `pg_net`** — schedule that triggers the push Edge Function, and (one option for) end-of-day `missed` detection. Not set up.

The end of `0001_initial_schema.sql` lists the deferred items in a comment block — keep that in sync as they land.
