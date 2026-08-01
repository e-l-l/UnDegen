import { useState } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useNavigate } from "react-router"

import { resolveActivity } from "@/db/activityRevisions"
import { db } from "@/db/db"
import { todayLocal } from "@/db/recurrence"
import type { Activity, ActivityRevision } from "@/db/types"
import { activitySummary } from "@/features/activities/activitySummary"
import { EditActivityDialog } from "@/features/activities/EditActivityDialog"
import { DesktopIsland } from "@/features/today/DesktopIsland"
import { iconForActivity } from "@/features/today/iconForActivity"
import { MobileTabBar } from "@/features/today/MobileTabBar"

async function loadActivities(userId: string): Promise<Activity[]> {
  const activities = await db.activities.where("user_id").equals(userId).and((activity) => !activity.archived).sortBy("position")
  const revisions = activities.length
    ? await db.activity_revisions.where("activity_id").anyOf(activities.map((activity) => activity.id)).toArray()
    : []
  const byActivity = new Map<string, ActivityRevision[]>()
  for (const revision of revisions) {
    const list = byActivity.get(revision.activity_id) ?? []
    list.push(revision)
    byActivity.set(revision.activity_id, list)
  }
  const today = todayLocal()
  return activities.map((activity) =>
    resolveActivity(activity, byActivity.get(activity.id) ?? [], today < activity.recurrence_start ? activity.recurrence_start : today) ?? activity
  )
}

function ActivityList({ activities, onEdit }: { activities: Activity[]; onEdit: (activity: Activity) => void }) {
  if (activities.length === 0) {
    return <div className="mt-20 text-center text-[14px] text-ink-muted">No active activities yet.</div>
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-[#232323] bg-[#141414]">
      {activities.map((activity, index) => {
        const Icon = iconForActivity(activity)
        const future = todayLocal() < activity.recurrence_start
        const start = future ? new Date(`${activity.recurrence_start}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : null
        return (
          <button key={activity.id} type="button" onClick={() => onEdit(activity)} className={`flex w-full items-center gap-3.5 px-4 py-4 text-left hover:bg-[#181818] ${index ? "border-t border-[#222222]" : ""}`}>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[11px] border border-[#2b2b2b] bg-[#1a1a1a]"><Icon className="size-5 text-[#8a8a8a]" strokeWidth={1.7} /></div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-medium text-[#dedede]">{activity.name}</div>
              <div className="mt-1 truncate text-[12.5px] text-[#717171]">{activitySummary(activity)}</div>
              {start && <div className="mt-1 text-[12px] text-[#5e5e5e]">Starts {start}</div>}
            </div>
            <ChevronRight className="size-4.5 shrink-0 text-[#555]" />
          </button>
        )
      })}
    </div>
  )
}

export function ActivitiesScreen({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const activities = useLiveQuery(() => loadActivities(userId), [userId])
  const [editing, setEditing] = useState<Activity | null>(null)
  const list = activities ?? []
  const header = (
    <div>
      <button type="button" onClick={() => navigate("/you")} className="flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink"><ChevronLeft className="size-4" /> Back to You</button>
      <h1 className="mt-4 text-[28px] font-semibold tracking-[-0.02em] text-ink">Activities</h1>
      <p className="mt-1.5 text-[13.5px] text-ink-muted">{activities === undefined ? "Loading…" : `${list.length} active`}</p>
    </div>
  )
  return (
    <>
      <div className="flex h-svh flex-col bg-background lg:hidden">
        <div className="shrink-0 px-5.5 pt-[calc(env(safe-area-inset-top)+0.75rem)]">{header}</div>
        <div className="flex-1 overflow-auto px-5.5 pt-6 pb-5"><ActivityList activities={list} onEdit={setEditing} /></div>
        <MobileTabBar />
      </div>
      <div className="relative hidden h-svh overflow-hidden bg-background lg:block">
        <DesktopIsland />
        <div className="h-full overflow-auto px-10 pt-[calc(var(--island-h)+1rem)] pb-10"><div className="mx-auto max-w-[620px]">{header}<div className="mt-7"><ActivityList activities={list} onEdit={setEditing} /></div></div></div>
      </div>
      {editing && <EditActivityDialog activity={editing} onClose={() => setEditing(null)} />}
    </>
  )
}
