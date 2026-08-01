// Data model — mirrors supabase/migrations/0001_initial_schema.sql.
// ids = uuid strings; dates/timestamps = ISO strings; `time` cols = 'HH:MM' strings.
// Keeping everything as the JSON shape supabase-js returns means zero conversion
// between Dexie (local) and Supabase (cloud).

// ── Enums (match the Postgres enum types) ────────────────────────────────────
export type ActivityType = 'reminder' | 'long_task'
export type ReminderType = 'strict' | 'soft' | 'random'
export type TaskMode = 'goal' | 'zen'
export type DayActivitySource = 'recurring' | 'manual'
export type CompletionStatus = 'done' | 'skipped' | 'missed'
export type WorkSessionStatus = 'in_progress' | 'completed' | 'abandoned'

// ── activities — template/definition of a trackable thing ────────────────────
export interface Activity {
  id: string
  user_id: string
  name: string
  type: ActivityType
  recurrence_days: number[] // JS Date.getDay(): 0=Sun .. 6=Sat
  recurrence_start: string // date
  exception_dates: string[] // dates the rule skips — 'YYYY-MM-DD' ("delete this day only")
  archived: boolean
  position: number

  // reminder-specific (null when type === 'long_task')
  reminder_type?: ReminderType | null
  strict_time?: string | null // 'HH:MM'
  // soft_start/soft_end double as the window bounds when reminder_type === 'random'
  // (fires once at a seeded-random minute inside them); soft_interval_mins is then null.
  soft_start?: string | null // 'HH:MM'
  soft_interval_mins?: number | null
  soft_end?: string | null // 'HH:MM'

  // long_task-specific (null when type === 'reminder')
  default_mode?: TaskMode | null
  goal_duration_mins?: number | null

  created_at: string
  updated_at: string
}

// Date-effective schedule/configuration. Activity identity (name/type/start,
// ordering, archive state and exceptions) remains on Activity; revisions are
// selected by local calendar date and overlaid on the legacy/latest mirror.
export interface ActivityRevision {
  id: string
  activity_id: string
  effective_from: string // date
  recurrence_days: number[]
  reminder_type?: ReminderType | null
  strict_time?: string | null
  soft_start?: string | null
  soft_interval_mins?: number | null
  soft_end?: string | null
  default_mode?: TaskMode | null
  goal_duration_mins?: number | null
  created_at: string
  updated_at: string
}

export type ActivityRevisionConfig = Omit<
  ActivityRevision,
  "id" | "activity_id" | "effective_from" | "created_at" | "updated_at"
>

export type DateResolvedActivity = Activity & {
  revision_effective_from?: string
  revision_updated_at?: string
}

// Fields a caller supplies to create an activity; the rest (id, ownership,
// timestamps, position, archived, exception_dates) are stamped by
// repo.createActivity. Shared so callers and the repo can't drift on the shape.
export type NewActivityInput = Omit<
  Activity,
  "id" | "user_id" | "created_at" | "updated_at" | "position" | "archived" | "exception_dates"
>

// ── days — one row per calendar date per user ────────────────────────────────
export interface Day {
  id: string
  user_id: string
  date: string // date, unique per user
  note?: string | null
  created_at: string
}

// ── day_activities — an activity materialised on a specific day ──────────────
// No `type` field — inferred via join to Activity.
export interface DayActivity {
  id: string
  day_id: string
  activity_id: string
  source: DayActivitySource
  position: number
}

// ── completions — completion record for a reminder day_activity (one per da) ──
export interface Completion {
  id: string
  day_activity_id: string
  status: CompletionStatus
  completed_at?: string | null
  note?: string | null
}

// ── work_sessions — execution record for a long_task day_activity (many per da)
// Goal fields are snapshotted at session start.
export interface WorkSession {
  id: string
  day_activity_id: string
  mode: TaskMode
  goal_duration_mins?: number | null
  goal_unit?: string | null
  goal_target?: number | null
  goal_actual?: number | null
  started_at: string
  ended_at?: string | null
  total_secs?: number | null
  status: WorkSessionStatus
  goal_met?: boolean | null
  note?: string | null
}

// ── Cloud-only tables (Supabase only — NOT mirrored in Dexie) ────────────────
// Written direct to Supabase, bypassing the syncQueue: they're server-facing,
// only exist while online, and are never read from Dexie in the UI critical
// path. Mirrors supabase/migrations/0003_notifications.sql. See the push module.

export interface UserSettings {
  user_id: string
  timezone: string // IANA, e.g. 'Asia/Kolkata'
  quiet_hours_start?: string | null // reserved, no UI yet
  quiet_hours_end?: string | null // reserved, no UI yet
  created_at: string
  updated_at: string
}

export interface PushSubscriptionRow {
  id: string
  user_id: string
  endpoint: string // globally unique
  p256dh: string
  auth: string
  user_agent?: string | null
  created_at: string
  last_seen: string
}

export interface NotificationLog {
  id: string
  user_id: string
  activity_id: string
  local_date: string // date
  slot: string // 'HH:MM' — strict_time or a soft nudge time
  sent_at: string
  status?: string | null
  error?: string | null
}

// ── syncQueue (local-only) — pending writes to flush to Supabase ─────────────
export type TableName =
  | 'activities'
  | 'activity_revisions'
  | 'days'
  | 'day_activities'
  | 'completions'
  | 'work_sessions'

export type SyncOp = 'insert' | 'update' | 'delete'

export interface SyncQueueItem {
  id?: number // Dexie auto-increment (++id)
  table: TableName
  op: SyncOp
  rowId: string // uuid of the affected row
  payload?: Record<string, unknown> // row data for insert/update; omit for delete
  createdAt: string
  attempts: number
  lastError?: string
}
