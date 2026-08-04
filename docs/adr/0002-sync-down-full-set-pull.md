# 2. Sync-down — full-set pull, reconcile, delete-terminal

Date: 2026-07-03
Status: Superseded on 2026-08-04

## Original decision

The original offline-first client wrote to Dexie, queued changes for Supabase,
and periodically pulled the user's complete server row set back into IndexedDB.
Pending local writes were protected during reconciliation and deletes were made
terminal by using updates rather than upserts for queued edits.

## Superseding decision

The offline-first architecture has been removed. Supabase Postgres is now the
single persisted source of truth:

- all application reads query Supabase directly through `supabase-js`;
- all writes wait for PostgREST success;
- successful mutations invalidate mounted server queries;
- reconnect/app-foreground invalidates mounted queries to pick up remote changes;
- Dexie, IndexedDB schema/versioning, `syncQueue`, push flush, full-set pull, and
  local reconciliation no longer exist;
- the service worker remains only for Web Push and explicit update prompting. It
  does not cache the app shell or queue network requests.

## Consequences

- There is no dual-source conflict policy, queued-write poison item, stale local
  account data, or local/server reconciliation path.
- The app requires connectivity to load or mutate application data. React keeps
  only mounted response state; it is not a persistent/offline source.
- Cross-device freshness is eventual on the next mutation, reconnect, or app
  foreground. Realtime remains unconfigured.
- Multi-row operations made through separate PostgREST requests use narrow
  compensating writes where needed. If strict atomicity becomes necessary, the
  operation should move into a scoped Postgres function.
