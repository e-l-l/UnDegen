import { Dexie, type EntityTable } from "dexie"

import type {
  Activity,
  ActivityRevision,
  Completion,
  Day,
  DayActivity,
  SyncQueueItem,
  WorkSession,
} from "./types"

// Local-first store. Mirrors the Supabase tables (same uuid ids → 1:1 sync),
// plus the local-only syncQueue. Table property names match the Supabase table
// names so the sync flush can resolve a table generically from SyncQueueItem.table.
const db = new Dexie("UndegenDB") as Dexie & {
  activities: EntityTable<Activity, "id">
  activity_revisions: EntityTable<ActivityRevision, "id">
  days: EntityTable<Day, "id">
  day_activities: EntityTable<DayActivity, "id">
  completions: EntityTable<Completion, "id">
  work_sessions: EntityTable<WorkSession, "id">
  syncQueue: EntityTable<SyncQueueItem, "id">
}

// Indexed fields only (full object still stored). & = unique, [a+b] = compound.
// Domain ids are uuids we generate (crypto.randomUUID()); only syncQueue auto-increments.
db.version(1).stores({
  activities: "id, user_id, archived, position",
  days: "id, date, &[user_id+date]",
  day_activities: "id, day_id, activity_id, &[day_id+activity_id]",
  completions: "id, &day_activity_id",
  work_sessions: "id, day_activity_id, status",
  syncQueue: "++id, createdAt",
})

db.version(2)
  .stores({
    activities: "id, user_id, archived, position",
    activity_revisions: "id, activity_id, effective_from, &[activity_id+effective_from]",
    days: "id, date, &[user_id+date]",
    day_activities: "id, day_id, activity_id, &[day_id+activity_id]",
    completions: "id, &day_activity_id",
    work_sessions: "id, day_activity_id, status",
    syncQueue: "++id, createdAt",
  })
  .upgrade(async (tx) => {
    const activities = await tx.table<Activity>("activities").toArray()
    const revisions = activities.map((activity): ActivityRevision => ({
      id: crypto.randomUUID(),
      activity_id: activity.id,
      effective_from: activity.recurrence_start,
      recurrence_days: activity.recurrence_days,
      reminder_type: activity.reminder_type ?? null,
      strict_time: activity.strict_time ?? null,
      soft_start: activity.soft_start ?? null,
      soft_interval_mins: activity.soft_interval_mins ?? null,
      soft_end: activity.soft_end ?? null,
      default_mode: activity.default_mode ?? null,
      goal_duration_mins: activity.goal_duration_mins ?? null,
      created_at: activity.created_at,
      updated_at: activity.updated_at,
    }))
    if (revisions.length) await tx.table<ActivityRevision>("activity_revisions").bulkAdd(revisions)
  })

export { db }
