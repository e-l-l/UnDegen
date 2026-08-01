import { db } from "./db"
import { resolveActivity } from "./activityRevisions"
import { recursOn, todayLocal } from "./recurrence"
import type {
  Activity,
  Completion,
  DayActivity,
  DayActivitySource,
  WorkSession,
  ActivityRevision,
} from "./types"

// Derived view of a single date (the calendar model — see ADR 0001). Occurrences
// are expanded from the activity rules, then left-joined with whatever state has
// been instantiated for that date. Nothing here writes; it's a pure read of Dexie.

export type DayItemState = "done" | "skipped" | "missed" | "pending"

export interface DayItem {
  activity: Activity
  // Calendar date that owns this materialised occurrence. Usually this is the
  // requested view date, but a still-running prior-day session floats onto real
  // today so it can be finished after midnight.
  date: string
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
  const activities = await db.activities.where("user_id").equals(userId).toArray()
  const revisions = activities.length
    ? await db.activity_revisions.where("activity_id").anyOf(activities.map((a) => a.id)).toArray()
    : []
  const revisionsByActivity = new Map<string, ActivityRevision[]>()
  for (const revision of revisions) {
    const list = revisionsByActivity.get(revision.activity_id) ?? []
    list.push(revision)
    revisionsByActivity.set(revision.activity_id, list)
  }
  const resolvedFor = (activity: Activity, itemDate: string) =>
    resolveActivity(activity, revisionsByActivity.get(activity.id) ?? [], itemDate)
  const dueActivities = activities.flatMap((activity) => {
    const activityRevisions = revisionsByActivity.get(activity.id) ?? []
    const resolved = resolvedFor(activity, date)
    return resolved && recursOn(activity, date, undefined, activityRevisions) ? [resolved] : []
  })

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

  const build = (
    activity: Activity,
    itemDate: string,
    da: DayActivity | undefined,
    source: DayActivitySource
  ): DayItem => {
    const completion = da ? completionByDa.get(da.id) : undefined
    const sessions = da ? (sessionsByDa.get(da.id) ?? []) : []
    return {
      activity,
      date: itemDate,
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
    items.push(build(activity, date, daByActivity.get(activity.id), "recurring"))
    seen.add(activity.id)
  }
  for (const da of dayActs) {
    if (seen.has(da.activity_id)) continue
    const activity = activities.find((candidate) => candidate.id === da.activity_id)
    const resolved = activity && !activity.archived ? resolvedFor(activity, date) : undefined
    if (resolved) items.push(build(resolved, date, da, da.source))
  }

  // 4. Real today also surfaces still-running sessions that started on an
  // earlier materialised occurrence. The session remains owned by its start
  // date for history/stats; this just keeps the live control visible after
  // midnight.
  if (date === today) {
    const activeSessions = await db.work_sessions.where("status").equals("in_progress").toArray()
    const activeByActivity = new Map<string, DayItem>()

    for (const session of activeSessions) {
      const da = await db.day_activities.get(session.day_activity_id)
      if (!da) continue
      const ownerDay = await db.days.get(da.day_id)
      if (!ownerDay || ownerDay.user_id !== userId || ownerDay.date >= date) continue
      const activity = activities.find((candidate) => candidate.id === da.activity_id)
      if (!activity || activity.user_id !== userId || activity.type !== "long_task" || activity.archived) continue
      const resolved = resolvedFor(activity, ownerDay.date)
      if (!resolved) continue

      const existing = activeByActivity.get(resolved.id)
      if (existing) {
        existing.sessions.push(session)
        continue
      }

      activeByActivity.set(resolved.id, {
        activity: resolved,
        date: ownerDay.date,
        dayActivity: da,
        sessions: [session],
        source: da.source,
        state: deriveState(activity, ownerDay.date, today, undefined, [session]),
      })
    }

    for (const active of activeByActivity.values()) {
      const idx = items.findIndex((item) => item.activity.id === active.activity.id)
      if (idx >= 0) {
        items[idx] = active
      } else {
        items.push(active)
      }
    }
  }

  // 5. Stable order by the activity's global position.
  items.sort((a, b) => a.activity.position - b.activity.position)
  return items
}
