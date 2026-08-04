import { supabase } from "@/utils/supabase"
import { activityConfig, effectiveEditDate, resolveActivity } from "./activityRevisions"
import { recursOn } from "./recurrence"
import type {
  Activity,
  ActivityRevision,
  ActivityRevisionConfig,
  Completion,
  CompletionStatus,
  Day,
  DayActivity,
  DayActivitySource,
  NewActivityInput,
  TableName,
  WorkSession,
} from "./types"
import { invalidateSupabaseData } from "./useSupabaseQuery"

// Supabase is the only persisted store. Every mutation waits for PostgREST and
// invalidates mounted queries only after the server accepts the change.

type RowFor = {
  activities: Activity
  activity_revisions: ActivityRevision
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

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message)
}

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === "23505"
}

async function createRow<T extends TableName>(table: T, row: RowFor[T]): Promise<RowFor[T]> {
  const { data, error } = await supabase.from(table).insert(row).select("*").single()
  fail(error)
  return data as RowFor[T]
}

async function updateRow<T extends TableName>(table: T, row: RowFor[T]): Promise<RowFor[T]> {
  const { data, error } = await supabase
    .from(table)
    .update(row)
    .eq("id", (row as { id: string }).id)
    .select("*")
    .maybeSingle()
  fail(error)
  if (!data) throw new Error(`${table} row no longer exists`)
  return data as RowFor[T]
}

async function deleteRow(table: TableName, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq("id", id)
  fail(error)
}

async function getActivity(activityId: string): Promise<Activity | undefined> {
  const { data, error } = await supabase.from("activities").select("*").eq("id", activityId).maybeSingle()
  fail(error)
  return (data as Activity | null) ?? undefined
}

async function getActivityRevisions(activityId: string): Promise<ActivityRevision[]> {
  const { data, error } = await supabase.from("activity_revisions").select("*").eq("activity_id", activityId)
  fail(error)
  return (data ?? []) as ActivityRevision[]
}

export async function nextActivityPosition(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from("activities")
    .select("position")
    .eq("user_id", userId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle()
  fail(error)
  return data ? data.position + 1 : 0
}

export async function createActivity(userId: string, input: NewActivityInput): Promise<Activity> {
  const now = nowIso()
  const activity: Activity = {
    ...input,
    id: newId(),
    user_id: userId,
    position: await nextActivityPosition(userId),
    archived: false,
    exception_dates: [],
    created_at: now,
    updated_at: now,
  }
  const created = await createRow("activities", activity)
  const revision: ActivityRevision = {
    id: newId(),
    activity_id: created.id,
    effective_from: created.recurrence_start,
    ...activityConfig(created),
    created_at: created.created_at,
    updated_at: created.updated_at,
  }

  try {
    await createRow("activity_revisions", revision)
  } catch (error) {
    // Keep the two-row create all-or-nothing from the caller's perspective.
    await deleteRow("activities", created.id)
    throw error
  }

  invalidateSupabaseData()
  return created
}

export type EditActivityInput = { name: string; config: ActivityRevisionConfig }

export async function editActivity(
  activityId: string,
  input: EditActivityInput,
  today: string
): Promise<Activity> {
  const activity = await getActivity(activityId)
  if (!activity || activity.archived) throw new Error("Activity not found")

  const revisions = await getActivityRevisions(activity.id)
  const effectiveFrom = effectiveEditDate(activity, today)
  const existing = revisions.find((revision) => revision.effective_from === effectiveFrom)

  // Preserve the old compatibility mirror as history for a legacy-created row.
  if (revisions.length === 0 && effectiveFrom > activity.recurrence_start) {
    const historical: ActivityRevision = {
      id: newId(),
      activity_id: activity.id,
      effective_from: activity.recurrence_start,
      ...activityConfig(activity),
      created_at: activity.created_at,
      updated_at: activity.updated_at,
    }
    const { error } = await supabase.from("activity_revisions").insert(historical)
    if (error && !isUniqueViolation(error)) fail(error)
  }

  const name = input.name.trim()
  const { error: nameError } = await supabase.from("activities").update({ name }).eq("id", activity.id)
  fail(nameError)

  const now = nowIso()
  const revision: ActivityRevision = {
    id: existing?.id ?? newId(),
    activity_id: activity.id,
    effective_from: effectiveFrom,
    ...input.config,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  }

  try {
    if (existing) {
      await updateRow("activity_revisions", revision)
    } else {
      const { error } = await supabase.from("activity_revisions").insert(revision)
      if (isUniqueViolation(error)) {
        const { error: retryError } = await supabase
          .from("activity_revisions")
          .update({ ...input.config, updated_at: now })
          .eq("activity_id", activity.id)
          .eq("effective_from", effectiveFrom)
        fail(retryError)
      } else {
        fail(error)
      }
    }
  } catch (error) {
    // Compensate the independent name write when the revision is rejected.
    await supabase.from("activities").update({ name: activity.name }).eq("id", activity.id)
    throw error
  }

  const updated = await getActivity(activity.id)
  if (!updated) throw new Error("Activity no longer exists")
  invalidateSupabaseData()
  return updated
}

async function newDay(userId: string, date: string, note: string | null = null): Promise<Day> {
  return createRow("days", { id: newId(), user_id: userId, date, note, created_at: nowIso() })
}

export async function ensureDay(userId: string, date: string): Promise<Day> {
  const { data, error } = await supabase
    .from("days")
    .select("*")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle()
  fail(error)
  if (data) return data as Day

  try {
    return await newDay(userId, date)
  } catch (insertError) {
    // Another tab/device may have won the unique (user_id,date) race.
    const { data: raced, error: readError } = await supabase
      .from("days")
      .select("*")
      .eq("user_id", userId)
      .eq("date", date)
      .maybeSingle()
    fail(readError)
    if (raced) return raced as Day
    throw insertError
  }
}

export async function ensureDayActivity(
  userId: string,
  date: string,
  activityId: string
): Promise<DayActivity> {
  const day = await ensureDay(userId, date)
  const { data, error } = await supabase
    .from("day_activities")
    .select("*")
    .eq("day_id", day.id)
    .eq("activity_id", activityId)
    .maybeSingle()
  fail(error)
  if (data) return data as DayActivity

  const activity = await getActivity(activityId)
  const revisions = activity ? await getActivityRevisions(activity.id) : []
  const source: DayActivitySource = activity && recursOn(activity, date, undefined, revisions) ? "recurring" : "manual"
  const row: DayActivity = { id: newId(), day_id: day.id, activity_id: activityId, source, position: 0 }
  try {
    return await createRow("day_activities", row)
  } catch (insertError) {
    const { data: raced, error: readError } = await supabase
      .from("day_activities")
      .select("*")
      .eq("day_id", day.id)
      .eq("activity_id", activityId)
      .maybeSingle()
    fail(readError)
    if (raced) return raced as DayActivity
    throw insertError
  }
}

export async function markReminder(
  userId: string,
  date: string,
  activityId: string,
  status: Extract<CompletionStatus, "done" | "skipped">,
  note: string | null = null
): Promise<Completion> {
  const da = await ensureDayActivity(userId, date, activityId)
  const { data, error } = await supabase
    .from("completions")
    .select("*")
    .eq("day_activity_id", da.id)
    .maybeSingle()
  fail(error)
  const existing = (data as Completion | null) ?? undefined
  const row: Completion = {
    id: existing?.id ?? newId(),
    day_activity_id: da.id,
    status,
    completed_at: status === "done" ? nowIso() : null,
    note,
  }

  let saved: Completion
  try {
    saved = existing ? await updateRow("completions", row) : await createRow("completions", row)
  } catch (writeError) {
    if (existing) throw writeError
    const { data: raced, error: retryReadError } = await supabase
      .from("completions")
      .select("*")
      .eq("day_activity_id", da.id)
      .maybeSingle()
    fail(retryReadError)
    if (!raced) throw writeError
    saved = await updateRow("completions", { ...row, id: raced.id })
  }
  invalidateSupabaseData()
  return saved
}

async function findDayActivity(
  userId: string,
  date: string,
  activityId: string
): Promise<DayActivity | undefined> {
  const { data: day, error: dayError } = await supabase
    .from("days")
    .select("id")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle()
  fail(dayError)
  if (!day) return undefined
  const { data, error } = await supabase
    .from("day_activities")
    .select("*")
    .eq("day_id", day.id)
    .eq("activity_id", activityId)
    .maybeSingle()
  fail(error)
  return (data as DayActivity | null) ?? undefined
}

async function findActiveWorkSession(userId: string, activityId: string): Promise<WorkSession | undefined> {
  const { data: sessions, error } = await supabase
    .from("work_sessions")
    .select("*")
    .eq("status", "in_progress")
  fail(error)
  const rows = (sessions ?? []) as WorkSession[]
  if (!rows.length) return undefined

  const { data: dayActivities, error: daError } = await supabase
    .from("day_activities")
    .select("id,day_id,activity_id")
    .in("id", rows.map((session) => session.day_activity_id))
    .eq("activity_id", activityId)
  fail(daError)
  const matching = dayActivities ?? []
  if (!matching.length) return undefined

  const { data: days, error: dayError } = await supabase
    .from("days")
    .select("id")
    .eq("user_id", userId)
    .in("id", matching.map((da) => da.day_id))
  fail(dayError)
  const ownedDayIds = new Set((days ?? []).map((day) => day.id))
  const matchingDaIds = new Set(matching.filter((da) => ownedDayIds.has(da.day_id)).map((da) => da.id))
  return rows.find((session) => matchingDaIds.has(session.day_activity_id))
}

export async function clearReminder(userId: string, date: string, activityId: string): Promise<void> {
  const da = await findDayActivity(userId, date, activityId)
  if (!da) return
  const { error } = await supabase.from("completions").delete().eq("day_activity_id", da.id)
  fail(error)
  invalidateSupabaseData()
}

export async function addManual(userId: string, date: string, activityId: string): Promise<DayActivity> {
  const row = await ensureDayActivity(userId, date, activityId)
  invalidateSupabaseData()
  return row
}

export async function startWorkSession(
  userId: string,
  date: string,
  activityId: string
): Promise<WorkSession> {
  const active = await findActiveWorkSession(userId, activityId)
  if (active) return active

  const da = await ensureDayActivity(userId, date, activityId)
  const activity = await getActivity(activityId)
  const revisions = activity ? await getActivityRevisions(activity.id) : []
  const resolved = activity ? resolveActivity(activity, revisions, date) : undefined
  const row: WorkSession = {
    id: newId(),
    day_activity_id: da.id,
    mode: resolved?.default_mode ?? "zen",
    goal_duration_mins: resolved?.goal_duration_mins ?? null,
    started_at: nowIso(),
    status: "in_progress",
  }
  const saved = await createRow("work_sessions", row)
  invalidateSupabaseData()
  return saved
}

export async function completeWorkSession(session: WorkSession): Promise<WorkSession> {
  const endedAt = nowIso()
  const totalSecs = Math.round((new Date(endedAt).getTime() - new Date(session.started_at).getTime()) / 1000)
  const goalMet =
    session.mode === "goal" && session.goal_duration_mins != null
      ? totalSecs >= session.goal_duration_mins * 60
      : null
  const saved = await updateRow("work_sessions", {
    ...session,
    ended_at: endedAt,
    total_secs: totalSecs,
    status: "completed",
    goal_met: goalMet,
  })
  invalidateSupabaseData()
  return saved
}

export async function archiveActivity(activityId: string): Promise<void> {
  const activity = await getActivity(activityId)
  if (!activity || activity.archived) return
  await updateRow("activities", { ...activity, archived: true, updated_at: nowIso() })
  invalidateSupabaseData()
}

export async function removeOccurrence(
  userId: string,
  date: string,
  activityId: string
): Promise<void> {
  const activity = await getActivity(activityId)
  if (!activity) return
  const [da, revisions] = await Promise.all([
    findDayActivity(userId, date, activityId),
    getActivityRevisions(activity.id),
  ])
  const shouldExcept = recursOn(activity, date, undefined, revisions) || da?.source === "recurring"
  const didExcept = shouldExcept && !(activity.exception_dates ?? []).includes(date)

  if (didExcept) {
    await updateRow("activities", {
      ...activity,
      exception_dates: [...(activity.exception_dates ?? []), date],
      updated_at: nowIso(),
    })
  }

  try {
    if (da) await deleteRow("day_activities", da.id) // Postgres cascades children.
  } catch (error) {
    if (didExcept) {
      await supabase
        .from("activities")
        .update({ exception_dates: activity.exception_dates ?? [] })
        .eq("id", activity.id)
    }
    throw error
  }

  invalidateSupabaseData()
}
