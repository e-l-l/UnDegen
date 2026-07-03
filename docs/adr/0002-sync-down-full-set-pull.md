# 2. Sync-down — full-set pull, reconcile, delete-terminal

Date: 2026-07-03
Status: Accepted

## Context

Sync was one-directional: `repo.ts` writes Dexie and `syncEngine.ts` flushes the
queue **up** to Supabase. Nothing read **down**. So an activity created on the
laptop reached Supabase but never appeared on the phone — each device's Dexie is an
isolated island, and a fresh device showed an empty app. Local-first stays (offline
writes are required); the missing half is a pull that hydrates Dexie from the cloud.

Two schema realities shaped how:

1. **No change-tracking on most tables.** Only `activities` has `updated_at` (+ trigger);
   `days` has `created_at` only; `day_activities` has no timestamps; `completions`/
   `work_sessions` have only domain timestamps. So "what changed since X?" is
   unanswerable for 4 of 5 tables — incremental delta pull is impossible without a migration.
2. **No delete tombstones.** All deletes are hard deletes (+ FK cascade). A deleted row
   leaves no trace, so a query can't discover "what was deleted since last sync."

RLS scopes every table to `auth.uid()`, so a bare `.select('*')` returns only the
current user's rows. There is no Realtime. Data volume per user is tiny.

## Decision

Add a pull that **re-reads the user's full row set and reconciles it into Dexie.**
(`src/sync/pull.ts` `pullAll()`, triggered by `src/sync/useSync.ts`.)

- **Full-set, not incremental.** `.select('*')` per table each pull; no `since` cursor.
  Cheap at this volume; sidesteps the missing `updated_at` columns. **No schema change**
  (rejected adding `updated_at`/tombstones everywhere — see below).
- **Reconcile, server-authoritative — except unflushed local writes.** `bulkPut` server
  rows (server wins); **delete local rows absent from the server set** (propagates remote
  deletes without tombstones). A row with a pending `syncQueue` entry is **never**
  overwritten or deleted — unflushed offline writes are locally authoritative until they flush.
- **Flush-first.** Each pull drains the queue before reading, to shrink the protected set
  and freshen the server; the per-row pending-guard still holds if the flush is partial.
- **A delete is terminal.** To make that true, `syncEngine`'s flush now uses **`.update().eq`
  (not `upsert`) for update ops**: an edit to a row another device deleted matches 0 rows and
  no-ops, so the delete stands. Without this, a queued edit would `upsert` the row back
  (resurrection). Inserts still `upsert` (retry-idempotent on the same uuid).
- **Triggers:** session becomes active, `online` (reconnect), and `visibilitychange`→visible
  (app-foreground — the "put down laptop, pick up phone" case). No polling, no Realtime.
- **Atomicity:** fetch all tables first (abort on any error — a partial snapshot reads as
  mass deletions); reconcile all tables in one Dexie transaction so `useLiveQuery` never
  renders a half-applied pull.

## Consequences

**Positive**
- Fixes cross-device convergence and fresh-device hydration with no schema migration.
- Reads stay Dexie-only; pulled rows render reactively via the existing `useLiveQuery`.
- Deterministic, understandable conflict rule; deletes can't silently come back.

**Negative / accepted trade-offs**
- **Edit-vs-edit is last-flush-wins, whole-row.** Two devices editing the *same* row while
  both offline: the later flush overwrites the earlier. No field-level merge — impossible
  without `updated_at`. Rare for a single user across ~2 devices; accepted.
- **Delete beats a concurrent edit** (not "newest action wins"). An accidental delete on one
  device beats a deliberate edit on another. "Newest wins" would need tombstones + `updated_at`.
- Re-fetches everything each trigger. Fine now; revisit if a user's history grows large.
- The pull flushes first, so a **poison queue item** (existing v0 gap) now also stalls fresh
  pulls behind it, not just further pushes.

## Alternatives rejected

- **Incremental delta pull (add `updated_at` + tombstones everywhere).** The "correct"
  long-term shape, but a real migration (0003), Dexie version bump, and type-mirror work —
  and `0002` (the SQL migration) isn't even applied to remote yet. Full-set is adequate at
  this volume; revisit when volume or delete-vs-edit recency actually demands it.
- **Realtime subscriptions.** Live propagation, but new infra (publication + channels), not
  configured, and heavier than a single-user app needs for v0.
- **Upsert-only pull (never delete locally).** Simplest and safe, but remote deletes never
  propagate — deleted rows linger on other devices forever. Divergence that only grows.
