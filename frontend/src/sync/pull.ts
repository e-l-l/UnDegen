import type { TableName } from "@/db/types"
import { db } from "@/db/db"
import { supabase } from "@/utils/supabase"
import { flushQueue } from "./syncEngine"

// Sync-down: hydrate Dexie from Supabase — the reverse of syncEngine's flush.
// Reads still come from Dexie (via useLiveQuery); this just keeps that local copy
// current with what other devices wrote. See docs/adr/0002-sync-down-full-set-pull.md.
//
// Full-set, not incremental: 4 of 5 tables have no updated_at watermark and there
// are no delete tombstones, so "what changed since X" is unanswerable — we re-read
// the whole set each time. Volume is tiny (one user's rows; RLS scopes every
// select('*') to auth.uid()), so this is cheap.

// Parent → child order so bulkPut lands parents before children within the txn.
const TABLES: TableName[] = [
  "activities",
  "days",
  "day_activities",
  "completions",
  "work_sessions",
]

let pulling = false

// Pull the current user's rows into Dexie and reconcile.
//
// Conflict posture (server-authoritative, except unflushed local writes):
//   • flush first — best-effort; shrinks the protected set and freshens the server.
//   • a row with a pending syncQueue entry is locally authoritative — never
//     overwritten and never reconcile-deleted (else an offline create is eaten).
//   • everything else: server wins. A local row absent from the server set is a
//     remote delete → drop it. Combined with syncEngine using .update() (not
//     upsert) for edits, a delete is terminal: no edit resurrects a deleted row.
//
// No userId arg: RLS filters select('*') to the current user, and the three
// join-scoped tables have no user_id column to filter on locally anyway.
export async function pullAll(): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return
  if (pulling) return
  pulling = true
  try {
    await flushQueue()

    // Fetch every table up front. Abort on any error — a partial snapshot would
    // read as mass deletions to the reconcile step below.
    const results = await Promise.all(TABLES.map((t) => supabase.from(t).select("*")))
    const failed = results.find((r) => r.error)
    if (failed?.error) {
      console.warn(`[pull] aborted: ${failed.error.message}`)
      return
    }

    const pending = await db.syncQueue.toArray()
    const pendingIds = new Set(pending.map((q) => q.rowId))

    await db.transaction(
      "rw",
      TABLES.map((t) => db.table(t)),
      async () => {
        for (let i = 0; i < TABLES.length; i++) {
          const rows = (results[i].data ?? []) as Array<{ id: string }>
          const table = db.table(TABLES[i])
          const serverIds = new Set(rows.map((r) => r.id))

          // Server wins — except rows we haven't flushed yet.
          const toPut = rows.filter((r) => !pendingIds.has(r.id))
          if (toPut.length) await table.bulkPut(toPut)

          // Reconcile-delete: local rows the server no longer has, guarding pending ids.
          const localIds = (await table.toCollection().primaryKeys()) as string[]
          const toDelete = localIds.filter((id) => !serverIds.has(id) && !pendingIds.has(id))
          if (toDelete.length) await table.bulkDelete(toDelete)
        }
      }
    )
  } catch (err) {
    console.warn(`[pull] failed: ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    pulling = false
  }
}
