import type { Table } from "dexie"

import { requestFlush } from "@/sync/syncEngine"
import { db } from "./db"
import type {
  Activity,
  Completion,
  Day,
  DayActivity,
  SyncOp,
  TableName,
  WorkSession,
} from "./types"

// The write half of the local-first layer: every mutation writes Dexie AND
// enqueues its sync intent in a single transaction, so the local store and the
// pending-sync list can never diverge. Reads still come straight from Dexie.

type RowFor = {
  activities: Activity
  days: Day
  day_activities: DayActivity
  completions: Completion
  work_sessions: WorkSession
}

export function newId(): string {
  return crypto.randomUUID()
}

export function nowIso(): string {
  return new Date().toISOString()
}

// Apply the change locally + append a SyncQueueItem, atomically. Then nudge the
// sync engine (no-ops if offline / already flushing).
async function applyAndQueue<T extends TableName>(
  table: T,
  op: SyncOp,
  rowId: string,
  row?: RowFor[T]
): Promise<void> {
  await db.transaction("rw", db.table(table), db.syncQueue, async () => {
    const t = db.table(table) as Table<RowFor[T], string>
    if (op === "delete") {
      await t.delete(rowId)
    } else if (row) {
      await t.put(row)
    }
    await db.syncQueue.add({
      table,
      op,
      rowId,
      payload: op === "delete" ? undefined : (row as unknown as Record<string, unknown>),
      createdAt: nowIso(),
      attempts: 0,
    })
  })
  void requestFlush()
}

// ── Generic write API ────────────────────────────────────────────────────────
// Callers mint the id (newId()) so the same UUID is used locally and in Supabase.

export function createRow<T extends TableName>(table: T, row: RowFor[T]): Promise<void> {
  return applyAndQueue(table, "insert", (row as { id: string }).id, row)
}

export function updateRow<T extends TableName>(table: T, row: RowFor[T]): Promise<void> {
  return applyAndQueue(table, "update", (row as { id: string }).id, row)
}

export function deleteRow<T extends TableName>(table: T, id: string): Promise<void> {
  return applyAndQueue(table, "delete", id)
}

// ── Convenience builders for the rows that carry user_id + stamps ────────────
// (day_activities / completions / work_sessions own no user_id — RLS resolves
//  their ownership via join — so they go through the generic API with an id set
//  by the caller, e.g. day-materialisation.)

export async function newActivity(
  userId: string,
  input: Omit<Activity, "id" | "user_id" | "created_at" | "updated_at">
): Promise<Activity> {
  const now = nowIso()
  const row: Activity = {
    ...input,
    id: newId(),
    user_id: userId,
    created_at: now,
    updated_at: now,
  }
  await createRow("activities", row)
  return row
}

export async function newDay(
  userId: string,
  date: string,
  note: string | null = null
): Promise<Day> {
  const row: Day = { id: newId(), user_id: userId, date, note, created_at: nowIso() }
  await createRow("days", row)
  return row
}
