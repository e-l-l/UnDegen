# CONTEXT — `frontend/src/db/`

The Supabase-backed application data layer. Supabase Postgres is the single
persisted source of truth; there is no Dexie/IndexedDB mirror, local sync queue,
or offline write path. Root context lives in `/CLAUDE.md`; app-level context is
in `frontend/CONTEXT.md`.

## Files

- `types.ts` — TypeScript interfaces matching the Supabase tables and enums.
- `repo.ts` — mutation API. All user-data writes go directly through
  `supabase-js`, wait for PostgREST success, then invalidate mounted reads.
- `useSupabaseQuery.ts` — the small React query/invalidation bridge. It returns
  `undefined` for the initial load, keeps the last successful value during a
  refresh, and refetches after mutations, reconnect, or app foreground.
- `activityRevisions.ts` — pure date-effective configuration selection.
- `activityQueries.ts` — small activity list/count/date-resolved server reads.
- `recurrence.ts` — pure recurrence/date helpers.
- `dayView.ts` — direct Supabase read API for a calendar day; expands recurrence
  and joins sparse occurrence state in memory.
- `taskHistory.ts` — direct Supabase read for a long task's completed sessions.
- `stats.ts` — direct Supabase reads plus in-memory Stats aggregation.
- `sessionSlices.ts` — pure cross-midnight session splitting.

## Core contract

1. **Supabase is authoritative.** Read functions query PostgREST directly. A
   query may hold response data in React component state while mounted, but
   nothing is persisted locally and there is no second writable source.
2. **Writes go through `repo.ts`.** Mutations wait for the server. On success,
   `invalidateSupabaseData()` makes mounted queries refetch. Do not add optimistic
   local persistence or a retry queue.
3. **RLS is part of every access path.** Direct-owner tables are also filtered by
   `user_id` where available; join-owned tables rely on their existing RLS
   policies. Every Supabase error must be checked and surfaced.
4. **No stored derived values.** Streaks, missed state, completion rates, and
   analytics remain computed on read.
5. **The service worker is not a data layer.** It exists for Web Push/update
   prompting and does not cache application assets or queue requests.

## Data shape and identity

- Domain IDs are app-generated UUIDs (`crypto.randomUUID()`). Postgres defaults
  also support UUIDs, but callers build related rows before sending them.
- Objects use the JSON shape returned by `supabase-js`: dates/timestamps are ISO
  strings, Postgres `time` values are strings, and `recurrence_days` uses JS
  `Date.getDay()` (0=Sun..6=Sat).
- `day_activities` has no `type`; resolve it through its `activity`.
- Type-specific schedule/config lives in `activity_revisions`. The nullable
  mirror columns on `activities` remain for compatibility with older clients.
- `WorkSession` goal fields are snapshots taken at session start.

## Calendar model

`getDayItems(userId, date)` expands non-archived recurring activities whose
date-effective revision applies, then left-joins the sparse `days` →
`day_activities` → completion/session state fetched from Supabase. A
`day_activity` is created lazily only when an occurrence gets state. On real
today, a still-running long-task session from an earlier owner date is surfaced
so it can be stopped after midnight without moving its history.

Reminder `missed` remains derived from an absent completion on a past due date;
the client never writes it. The Today “Missed it” action writes `skipped`.

`repo.ensureDay` and `repo.ensureDayActivity` handle unique-key races by reading
the row another tab/device created. Completion creation similarly retries as an
update if another writer won the one-per-occurrence race. Postgres cascade
deletes completion/session children when an occurrence is removed.

## Stats

`stats.ts` loads the user's RLS-scoped row sets from Supabase, indexes them in
memory, and produces the `features/stats` DTOs. The existing rules remain:
amount stats include archived history; rate stats are active-only; completed
cross-midnight sessions are split across local calendar days for amount/showed-up
buckets, while logs and sparklines retain whole sessions.

## Known limits

- Multi-call mutations such as activity identity + initial revision use a
  compensating delete on failure, because PostgREST calls are separate
  transactions. If stronger all-or-nothing semantics become necessary, move the
  operation into a narrowly scoped Postgres function rather than adding a local
  transaction layer.
- `useSupabaseQuery` refreshes on successful local mutations and when the app
  returns to the foreground/reconnects. It does not subscribe to Realtime.
- Streak calculation is still a UI-side stub (`useTodayData.ts` returns `0`).
- `in_progress` sessions have no timeout/abandon sweep.

## Schema discipline

`types.ts` mirrors the Supabase migrations through
`0009_activity_revisions.sql`. Schema changes must update migrations, these
types, and the affected query/mutation code together. There is no local schema
version to bump.
