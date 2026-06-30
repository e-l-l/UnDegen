import { Dexie, type EntityTable } from "dexie"

import type {
  Activity,
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

export { db }
