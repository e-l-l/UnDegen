import { useLiveQuery } from "dexie-react-hooks"

import { getStatsDetail, getStatsOverview } from "@/db/stats"

// Live Stats reads over Dexie (via db/stats.ts). useLiveQuery re-runs whenever
// any read table changes, so completing a reminder or ending a session refreshes
// the stats with no manual invalidation. Returns undefined while loading; the
// detail hook returns null when the activity id doesn't resolve.

export function useStatsOverview(userId: string) {
  return useLiveQuery(() => getStatsOverview(userId), [userId])
}

export function useStatsDetail(userId: string, activityId: string | undefined) {
  return useLiveQuery(
    () => (activityId ? getStatsDetail(userId, activityId) : Promise.resolve(null)),
    [userId, activityId],
  )
}
