import { getStatsDetail, getStatsOverview } from "@/db/stats"
import { useSupabaseQuery } from "@/db/useSupabaseQuery"

// Stats reads come directly from Supabase and refetch after accepted mutations.
// Returns undefined while loading; the
// detail hook returns null when the activity id doesn't resolve.

export function useStatsOverview(userId: string) {
  return useSupabaseQuery(() => getStatsOverview(userId), [userId])
}

export function useStatsDetail(userId: string, activityId: string | undefined) {
  return useSupabaseQuery(
    () => (activityId ? getStatsDetail(userId, activityId) : Promise.resolve(null)),
    [userId, activityId],
  )
}
