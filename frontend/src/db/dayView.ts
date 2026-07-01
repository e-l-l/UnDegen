import { db } from "./db"
import { recursOn, todayLocal } from "./recurrence"
import type {
  Activity,
  Completion,
  DayActivity,
  DayActivitySource,
  WorkSession,
} from "./types"

// Derived view of a single date (the calendar model — see ADR 0001). Occurrences
// are expanded from the activity rules, then left-joined with whatever state has
// been instantiated for that date. Nothing here writes; it's a pure read of Dexie.

export type DayItemState = "done" | "skipped" | "missed" | "pending"

export interface DayItem {
  activity: Activity
  dayActivity?: DayActivity
  completion?: Completion
  sessions: WorkSession[]
  source: DayActivitySource
  state: DayItemState
}

function deriveState(
  activity: Activity,
  date: string,
  today: string,
  completion: Completion | undefined,
  sessions: WorkSession[]
): DayItemState {
  if (activity.type === "reminder") {
    if (completion) return completion.status // done | skipped | missed
    return date < today ? "missed" : "pending"
  }
  // long_task: driven by work_sessions, not completions
  if (sessions.some((s) => s.status === "completed" || s.goal_met)) return "done"
  if (sessions.some((s) => s.status === "in_progress")) return "pending"
  return date < today ? "missed" : "pending"
}

export async function getDayItems(userId: string, date: string): Promise<DayItem[]> {
  const today = todayLocal()

  // 1. Rules that produce an occurrence on this date.
  const dueActivities = await db.activities
    .where("user_id")
    .equals(userId)
    .and((a) => recursOn(a, date))
    .toArray()

  // 2. Any state already instantiated for this date (sparse — may be nothing).
  const day = await db.days.where("[user_id+date]").equals([userId, date]).first()
  let dayActs: DayActivity[] = []
  const completionByDa = new Map<string, Completion>()
  const sessionsByDa = new Map<string, WorkSession[]>()
  if (day) {
    dayActs = await db.day_activities.where("day_id").equals(day.id).toArray()
    const daIds = dayActs.map((da) => da.id)
    if (daIds.length) {
      for (const c of await db.completions.where("day_activity_id").anyOf(daIds).toArray()) {
        completionByDa.set(c.day_activity_id, c)
      }
      for (const s of await db.work_sessions.where("day_activity_id").anyOf(daIds).toArray()) {
        const arr = sessionsByDa.get(s.day_activity_id) ?? []
        arr.push(s)
        sessionsByDa.set(s.day_activity_id, arr)
      }
    }
  }
  const daByActivity = new Map(dayActs.map((da) => [da.activity_id, da]))

  const build = (activity: Activity, da: DayActivity | undefined, source: DayActivitySource): DayItem => {
    const completion = da ? completionByDa.get(da.id) : undefined
    const sessions = da ? (sessionsByDa.get(da.id) ?? []) : []
    return {
      activity,
      dayActivity: da,
      completion,
      sessions,
      source,
      state: deriveState(activity, date, today, completion, sessions),
    }
  }

  // 3. Due (recurring) occurrences, plus manual adds whose activity didn't recur today.
  const items: DayItem[] = []
  const seen = new Set<string>()
  for (const activity of dueActivities) {
    items.push(build(activity, daByActivity.get(activity.id), "recurring"))
    seen.add(activity.id)
  }
  for (const da of dayActs) {
    if (seen.has(da.activity_id)) continue
    const activity = await db.activities.get(da.activity_id)
    if (activity) items.push(build(activity, da, da.source))
  }

  // 4. Stable order by the activity's global position.
  items.sort((a, b) => a.activity.position - b.activity.position)
  return items
}
