import { db } from "./db"
import type { WorkSession } from "./types"

// Cross-day read for a long_task activity's completed sessions. dayView.ts is
// scoped to a single date; the idle cards need the full history across every
// day_activity the activity has ever materialised (banked goal progress, the
// zen sparkline, "logged this week"). Sorted oldest → newest.
export async function getCompletedSessions(activityId: string): Promise<WorkSession[]> {
  const dayActivities = await db.day_activities.where("activity_id").equals(activityId).toArray()
  const daIds = dayActivities.map((da) => da.id)
  if (!daIds.length) return []

  const sessions = await db.work_sessions
    .where("day_activity_id")
    .anyOf(daIds)
    .and((s) => s.status === "completed")
    .toArray()
  sessions.sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime())
  return sessions
}
