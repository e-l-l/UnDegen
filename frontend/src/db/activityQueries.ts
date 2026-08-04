import { supabase } from "@/utils/supabase"
import { groupActivityRevisions, resolveActivity } from "./activityRevisions"
import type { Activity, ActivityRevision } from "./types"

export async function getResolvedActivity(activityId: string, date: string): Promise<Activity | undefined> {
  const { data: activity, error: activityError } = await supabase
    .from("activities")
    .select("*")
    .eq("id", activityId)
    .maybeSingle()
  if (activityError) throw new Error(activityError.message)
  if (!activity) return undefined

  const { data: revisions, error: revisionError } = await supabase
    .from("activity_revisions")
    .select("*")
    .eq("activity_id", activity.id)
  if (revisionError) throw new Error(revisionError.message)
  return resolveActivity(activity as Activity, (revisions ?? []) as ActivityRevision[], date) ?? (activity as Activity)
}

export async function getActiveActivities(userId: string, date: string): Promise<Activity[]> {
  const { data: activityRows, error: activityError } = await supabase
    .from("activities")
    .select("*")
    .eq("user_id", userId)
    .eq("archived", false)
    .order("position", { ascending: true })
  if (activityError) throw new Error(activityError.message)
  const activities = (activityRows ?? []) as Activity[]

  const { data: revisionRows, error: revisionError } = activities.length
    ? await supabase.from("activity_revisions").select("*").in("activity_id", activities.map((activity) => activity.id))
    : { data: [], error: null }
  if (revisionError) throw new Error(revisionError.message)
  const byActivity = groupActivityRevisions((revisionRows ?? []) as ActivityRevision[])
  return activities.map((activity) => {
    const resolveDate = date < activity.recurrence_start ? activity.recurrence_start : date
    return resolveActivity(activity, byActivity.get(activity.id) ?? [], resolveDate) ?? activity
  })
}

export async function getActiveActivityCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("activities")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("archived", false)
  if (error) throw new Error(error.message)
  return count ?? 0
}
