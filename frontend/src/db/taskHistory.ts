import { supabase } from "@/utils/supabase"
import type { WorkSession } from "./types"

// Cross-day read for a long_task activity's completed sessions. dayView.ts is
// scoped to a single date; the idle cards need the full history across every
// day_activity the activity has ever materialised (banked goal progress, the
// zen sparkline, "logged this week"). Sorted oldest → newest.
export async function getCompletedSessions(activityId: string): Promise<WorkSession[]> {
  const { data: dayActivities, error: dayActivityError } = await supabase
    .from("day_activities")
    .select("id")
    .eq("activity_id", activityId)
  if (dayActivityError) throw new Error(dayActivityError.message)
  const daIds = (dayActivities ?? []).map((da) => da.id)
  if (!daIds.length) return []

  const { data, error } = await supabase
    .from("work_sessions")
    .select("*")
    .in("day_activity_id", daIds)
    .eq("status", "completed")
    .order("started_at", { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as WorkSession[]
}
