// Data shapes the Stats UI consumes. Produced by db/stats.ts and delivered via
// useStatsData; the screens read exactly these shapes. See
// features/stats/DESIGN_BRIEF.md §7 for the source spec.

import type { ActivityType } from "@/db/types"

export type DeltaDir = "up" | "down" | "flat"

// Direction of a period-over-period change (shared by the data layer and screens).
export const deltaDir = (cur: number, prev: number): DeltaDir =>
  cur > prev ? "up" : cur < prev ? "down" : "flat"

// ── /stats overview ──────────────────────────────────────────────────────────
export interface StatsOverview {
  // current Mon–Sun calendar week ("this week"), partial → elapsed days only;
  // planned/showedUp are active-only rate stats, focusMins is an amount stat
  // (includes archived).
  week: { showedUp: number; planned: number; focusMins: number }
  prevWeek: { showedUp: number; planned: number; focusMins: number } // for deltas
  // weeks the showed-up rate has declined in a row (drives the "Nth week down" roast)
  weeksDown: number
  mostAvoided: { activityId: string; name: string; type: ActivityType; done: number; planned: number } | null
  weekdayFlake: number[] // len 7, Mon..Sun, not-done rate 0..1
  focusTrend: { mins: number }[] // last N weeks, oldest→newest
  heatmap: number[][] // [weekday 0=Mon..6=Sun][hour 0..23] = minutes, all-time incl. archived
  activities: ActivityStatRow[] // active first, archived greyed at end
}

export interface ActivityStatRow {
  activityId: string
  name: string
  type: ActivityType
  archived: boolean
  delta: DeltaDir
  // reminder:
  done?: number
  planned?: number
  weekStrip?: WeekStripCell[] // 7 entries, current calendar week Mon→Sun (oldest→newest); future days render pending
  // long_task:
  focusMins?: number
  sparkline?: number[] // recent session minutes, oldest→newest
}

export type WeekStripCell = "done" | "notdone" | "pending"

// ── /stats/:activityId detail ────────────────────────────────────────────────
export interface StatsDetail {
  activityId: string
  name: string
  type: ActivityType
  archived: boolean
  category?: string | null // desktop badge suffix ("Long task · Personal"); optional
  // long_task fields (undefined for reminders)
  week?: { focusMins: number }
  prevWeek?: { focusMins: number }
  allTime?: { focusMins: number; sessionCount: number; avgMins: number }
  focusTrend?: { mins: number }[]
  heatmap?: number[][]
  sessions?: SessionRecord[]
  // reminder fields (undefined for long tasks)
  weekAdherence?: { done: number; planned: number }
  prevWeekAdherence?: { done: number; planned: number }
  adherenceTrend?: number[] // 0..1 rate per week, oldest→newest
  completionLog?: CompletionRecord[]
}

export interface SessionRecord {
  id: string
  date: string // 'Jul 3' — pre-formatted, device-local
  time: string // '18:12'
  mins: number
  goalMet: boolean
}

export interface CompletionRecord {
  id: string
  date: string // 'Jul 3'
  status: "done" | "skipped" | "missed"
}
