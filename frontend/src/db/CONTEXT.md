# CONTEXT — `frontend/src/db/`

The local-first data layer. This is the **source of truth for all reads** in the app. Root context in `/CLAUDE.md`; app-level context in `frontend/CONTEXT.md`.

```
frontend/src/
└── db/   ← YOU ARE HERE — Dexie (IndexedDB) store + the TS data model
```

## Contents

- `db.ts` — the Dexie database instance (`UndegenDB`), schema version, and index definitions.
- `types.ts` — TypeScript interfaces for the six domain tables + the local-only `syncQueue`, plus the Postgres enum types as string unions.

## The core contract (do not break)

1. **All reads come from Dexie. Never from Supabase in the UI critical path.** Supabase is the cloud mirror, not the read source.
2. **Write path:** write to Dexie (instant) → enqueue a `SyncQueueItem` → flush to Supabase when online. The flush logic is **not written yet** — `syncQueue` exists but nothing drains it.
3. **No stored derived values** (streaks, completion rates). Compute on read.

## Things that are non-obvious and load-bearing

- **IDs are app-generated UUIDs** (`crypto.randomUUID()`), not auto-increment. Same UUID is used locally and in Supabase → rows are 1:1 across both stores, so sync needs no id mapping. The **only** auto-increment is `syncQueue.id` (`++id`).
- **Dexie table property names equal the Supabase table names** (`activities`, `days`, `day_activities`, `completions`, `work_sessions`). This is deliberate: the future sync flush resolves a target table generically from `SyncQueueItem.table` (a `TableName` union). Don't rename one side without the other.
- **Stored objects mirror the JSON shape `supabase-js` returns** — dates/timestamps are ISO strings, `time` columns are `'HH:MM'` strings, `recurrence_days` is `number[]` using JS `Date.getDay()` (0=Sun..6=Sat). Keeping the shapes identical means **zero conversion** between Dexie and Supabase. Preserve this; don't introduce a separate local representation.
- **The `stores()` string lists indexed fields only** — the full object is still stored regardless. `&` = unique index, `[a+b]` = compound index. Current indexes encode real constraints: `&[user_id+date]` on `days` (one row per date per user), `&[day_id+activity_id]` on `day_activities` (an activity appears at most once per day), `&day_activity_id` on `completions` (one completion per day_activity).
- **`day_activities` has no `type` field** — inferred via join to `Activity`. Do not add one (drift risk; see CLAUDE.md).
- **Type-specific config is nullable columns on `Activity`**, not extension tables. Reminder fields are null when `type === 'long_task'` and vice versa (the SQL enforces this with check constraints).
- **`WorkSession` goal fields are snapshots** taken at session start. Editing an `Activity` later must not mutate existing sessions.

## Not built yet (expect to add here / nearby)

- Sync flush: drain `syncQueue` → `supabase-js` upsert/delete, with retry using `attempts`/`lastError`, and background-sync trigger from `src/sw.ts`.
- Day materialisation on app open (create today's `days` row + matching `day_activities`) — see Open Questions in CLAUDE.md; not yet designed.
- Schema migrations: bump `db.version(n)` and add an `.upgrade()` when the shape changes; never edit `version(1)` in place once data exists in the wild.

## Mirror discipline

`types.ts` and `db.ts` mirror `supabase/migrations/0001_initial_schema.sql`. A change to the SQL schema **must** be reflected here (and vice versa), or local and cloud drift.
