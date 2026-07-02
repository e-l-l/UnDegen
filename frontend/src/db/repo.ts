import type { Table } from "dexie"

import { requestFlush } from "@/sync/syncEngine"
import { db } from "./db"
import { recursOn } from "./recurrence"
import type {
  Activity,
  Completion,
  CompletionStatus,
  Day,
  DayActivity,
  DayActivitySource,
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

// Next position for a new activity — append to the end of the user's list.
// activities.position is already indexed (db.ts: "id, user_id, archived, position").
export async function nextActivityPosition(userId: string): Promise<number> {
  const activities = await db.activities.where("user_id").equals(userId).toArray()
  return activities.length === 0 ? 0 : Math.max(...activities.map((a) => a.position)) + 1
}

// Convenience wrapper for the create-activity flow: stamps position (append to
// end) and archived (false), then delegates to newActivity.
export async function createActivity(
  userId: string,
  input: Omit<Activity, "id" | "user_id" | "created_at" | "updated_at" | "position" | "archived">
): Promise<Activity> {
  const position = await nextActivityPosition(userId)
  return newActivity(userId, { ...input, position, archived: false })
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

// ── Lazy instantiation (calendar model — see ADR 0001) ───────────────────────
// day / day_activity rows are born only when an instance gains state. All are
// idempotent get-or-create, keyed on the schema's unique indexes.

export async function ensureDay(userId: string, date: string): Promise<Day> {
  const existing = await db.days.where("[user_id+date]").equals([userId, date]).first()
  return existing ?? (await newDay(userId, date))
}

export async function ensureDayActivity(
  userId: string,
  date: string,
  activityId: string
): Promise<DayActivity> {
  const day = await ensureDay(userId, date)
  const existing = await db.day_activities
    .where("[day_id+activity_id]")
    .equals([day.id, activityId])
    .first()
  if (existing) return existing
  // source falls out of the rule: recurring if it occurs on this date, else a manual add.
  const activity = await db.activities.get(activityId)
  const source: DayActivitySource = activity && recursOn(activity, date) ? "recurring" : "manual"
  const row: DayActivity = { id: newId(), day_id: day.id, activity_id: activityId, source, position: 0 }
  await createRow("day_activities", row)
  return row
}

// Mark a reminder done/skipped for a date. One completion per day_activity, so
// this upserts. ("missed" is derived, never written here — see ADR 0001.)
export async function markReminder(
  userId: string,
  date: string,
  activityId: string,
  status: Extract<CompletionStatus, "done" | "skipped">,
  note: string | null = null
): Promise<Completion> {
  const da = await ensureDayActivity(userId, date, activityId)
  const existing = await db.completions.where("day_activity_id").equals(da.id).first()
  const row: Completion = {
    id: existing?.id ?? newId(),
    day_activity_id: da.id,
    status,
    completed_at: status === "done" ? nowIso() : null,
    note,
  }
  await (existing ? updateRow : createRow)("completions", row)
  return row
}

// Add an existing activity to a date it doesn't recur on (source becomes 'manual').
export function addManual(userId: string, date: string, activityId: string): Promise<DayActivity> {
  return ensureDayActivity(userId, date, activityId)
}
