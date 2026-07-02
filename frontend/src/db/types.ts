// Data model — mirrors supabase/migrations/0001_initial_schema.sql.
// ids = uuid strings; dates/timestamps = ISO strings; `time` cols = 'HH:MM' strings.
// Keeping everything as the JSON shape supabase-js returns means zero conversion
// between Dexie (local) and Supabase (cloud).

// ── Enums (match the Postgres enum types) ────────────────────────────────────
export type ActivityType = 'reminder' | 'long_task'
export type ReminderType = 'strict' | 'soft'
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
  archived: boolean
  position: number

  // reminder-specific (null when type === 'long_task')
  reminder_type?: ReminderType | null
  strict_time?: string | null // 'HH:MM'
  soft_start?: string | null // 'HH:MM'
  soft_interval_mins?: number | null
  soft_end?: string | null // 'HH:MM'

  // long_task-specific (null when type === 'reminder')
  default_mode?: TaskMode | null
  goal_duration_mins?: number | null

  created_at: string
  updated_at: string
}

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

// ── syncQueue (local-only) — pending writes to flush to Supabase ─────────────
export type TableName =
  | 'activities'
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
