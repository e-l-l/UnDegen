import type { TableName } from "@/db/types"
import { db } from "@/db/db"
import { supabase } from "@/utils/supabase"

// Above this, failures escalate from warn → error in the log. We never drop the
// item (no silent data loss) — see the poison-item caveat in db/CONTEXT.md.
const MAX_ATTEMPTS = 8

let flushing = false
let rerun = false

// Drain syncQueue → Supabase. Single-flight; processes in ++id (insertion) order
// so parent rows (days, activities) land before children (day_activities), which
// keeps foreign keys satisfied. Stops at the first failure to preserve ordering;
// the next trigger resumes from where it left off.
export async function flushQueue(): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return
  if (flushing) {
    rerun = true // a mutation arrived mid-flush — run one more pass after
    return
  }
  flushing = true
  try {
    do {
      rerun = false
      await drainOnce()
    } while (rerun)
  } finally {
    flushing = false
  }
}

async function drainOnce(): Promise<void> {
  const items = await db.syncQueue.orderBy("id").toArray()
  for (const item of items) {
    const table = item.table as TableName
    try {
      // insert → upsert (retry-idempotent on the same uuid). update → .update().eq,
      // NOT upsert: if another device deleted the row, an upsert would resurrect it —
      // .update() matches 0 rows and no-ops, so the delete stands (delete is terminal).
      const { error } =
        item.op === "delete"
          ? await supabase.from(table).delete().eq("id", item.rowId)
          : item.op === "update"
            ? await supabase.from(table).update(item.payload ?? {}).eq("id", item.rowId)
            : await supabase.from(table).upsert(item.payload ?? {})
      if (error) throw new Error(error.message)
      await db.syncQueue.delete(item.id as number)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const attempts = item.attempts + 1
      await db.syncQueue.update(item.id as number, { attempts, lastError: message })
      const log = attempts >= MAX_ATTEMPTS ? console.error : console.warn
      log(`[sync] ${item.op} ${table}/${item.rowId} failed (attempt ${attempts}): ${message}`)
      // Stop on the first failure: preserves order and avoids syncing a child
      // before its parent. The next flush trigger retries this item.
      break
    }
  }
}

// Triggers: startup + reconnect. requestFlush() is the post-mutation hook the
// write path (db/repo.ts) calls. SW background-sync is deferred (see CLAUDE.md).
export function startSync(): void {
  void flushQueue()
  if (typeof window !== "undefined") {
    window.addEventListener("online", () => void flushQueue())
  }
}

export function requestFlush(): Promise<void> {
  return flushQueue()
}
