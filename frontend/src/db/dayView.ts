import { supabase } from "@/utils/supabase"
import { groupActivityRevisions, resolveActivity } from "./activityRevisions"
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
// been instantiated for that date. Nothing here writes; Supabase is the source.

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
  const { data: activityRows, error: activityError } = await supabase
    .from("activities")
    .select("*")
    .eq("user_id", userId)
  if (activityError) throw new Error(activityError.message)
  const activities = (activityRows ?? []) as Activity[]
  const { data: revisionRows, error: revisionError } = activities.length
    ? await supabase.from("activity_revisions").select("*").in("activity_id", activities.map((a) => a.id))
    : { data: [], error: null }
  if (revisionError) throw new Error(revisionError.message)
  const revisions = (revisionRows ?? []) as import("./types").ActivityRevision[]
  const revisionsByActivity = groupActivityRevisions(revisions)
  const resolvedFor = (activity: Activity, itemDate: string) =>
    resolveActivity(activity, revisionsByActivity.get(activity.id) ?? [], itemDate)
  const dueActivities = activities.flatMap((activity) => {
    const activityRevisions = revisionsByActivity.get(activity.id) ?? []
    const resolved = resolvedFor(activity, date)
    return resolved && recursOn(activity, date, undefined, activityRevisions) ? [resolved] : []
  })

  // 2. Any state already instantiated for this date (sparse — may be nothing).
  const { data: day, error: dayError } = await supabase
    .from("days")
    .select("*")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle()
  if (dayError) throw new Error(dayError.message)
  let dayActs: DayActivity[] = []
  const completionByDa = new Map<string, Completion>()
  const sessionsByDa = new Map<string, WorkSession[]>()
  if (day) {
    const { data, error } = await supabase.from("day_activities").select("*").eq("day_id", day.id)
    if (error) throw new Error(error.message)
    dayActs = (data ?? []) as DayActivity[]
    const daIds = dayActs.map((da) => da.id)
    if (daIds.length) {
      const [{ data: completionRows, error: completionError }, { data: sessionRows, error: sessionError }] =
        await Promise.all([
          supabase.from("completions").select("*").in("day_activity_id", daIds),
          supabase.from("work_sessions").select("*").in("day_activity_id", daIds),
        ])
      if (completionError) throw new Error(completionError.message)
      if (sessionError) throw new Error(sessionError.message)
      for (const c of (completionRows ?? []) as Completion[]) {
        completionByDa.set(c.day_activity_id, c)
      }
      for (const s of (sessionRows ?? []) as WorkSession[]) {
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
    const { data: activeRows, error: activeError } = await supabase
      .from("work_sessions")
      .select("*")
      .eq("status", "in_progress")
    if (activeError) throw new Error(activeError.message)
    const activeSessions = (activeRows ?? []) as WorkSession[]
    const activeByActivity = new Map<string, DayItem>()

    const activeDaIds = activeSessions.map((session) => session.day_activity_id)
    const { data: activeDaRows, error: activeDaError } = activeDaIds.length
      ? await supabase.from("day_activities").select("*").in("id", activeDaIds)
      : { data: [], error: null }
    if (activeDaError) throw new Error(activeDaError.message)
    const activeDayActivities = (activeDaRows ?? []) as DayActivity[]
    const activeDaById = new Map(activeDayActivities.map((da) => [da.id, da]))
    const ownerDayIds = [...new Set(activeDayActivities.map((da) => da.day_id))]
    const { data: ownerDayRows, error: ownerDayError } = ownerDayIds.length
      ? await supabase.from("days").select("*").eq("user_id", userId).in("id", ownerDayIds)
      : { data: [], error: null }
    if (ownerDayError) throw new Error(ownerDayError.message)
    const ownerDayById = new Map(((ownerDayRows ?? []) as import("./types").Day[]).map((ownerDay) => [ownerDay.id, ownerDay]))

    for (const session of activeSessions) {
      const da = activeDaById.get(session.day_activity_id)
      if (!da) continue
      const ownerDay = ownerDayById.get(da.day_id)
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
