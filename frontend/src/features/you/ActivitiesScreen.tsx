import { useState } from "react"
import { ChevronLeft, ChevronRight, MoreVertical } from "lucide-react"
import { useNavigate } from "react-router"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getActiveActivities } from "@/db/activityQueries"
import { todayLocal } from "@/db/recurrence"
import type { Activity } from "@/db/types"
import { useSupabaseQuery } from "@/db/useSupabaseQuery"
import { activitySummary } from "@/features/activities/activitySummary"
import { EditActivityDialog } from "@/features/activities/EditActivityDialog"
import { DesktopIsland } from "@/features/today/DesktopIsland"
import { iconForActivity } from "@/features/today/iconForActivity"
import { MobileTabBar } from "@/features/today/MobileTabBar"
import { DeleteActivityDialog } from "./DeleteActivityDialog"

async function loadActivities(userId: string): Promise<Activity[]> {
  return getActiveActivities(userId, todayLocal())
}

function ActivityList({
  activities,
  onEdit,
  onDelete,
}: {
  activities: Activity[]
  onEdit: (activity: Activity) => void
  onDelete: (activity: Activity) => void
}) {
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
          <div key={activity.id} className={`flex items-center ${index ? "border-t border-[#222222]" : ""}`}>
            <Button type="button" variant="ghost" onClick={() => onEdit(activity)} className="h-auto min-w-0 flex-1 justify-start gap-3.5 rounded-none px-4 py-4 pr-2 text-left hover:bg-[#181818]">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-[11px] border border-[#2b2b2b] bg-[#1a1a1a]"><Icon className="size-5 text-[#8a8a8a]" strokeWidth={1.7} /></div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-medium text-[#dedede]">{activity.name}</div>
                <div className="mt-1 truncate text-[12.5px] text-[#717171]">{activitySummary(activity)}</div>
                {start && <div className="mt-1 text-[12px] text-[#5e5e5e]">Starts {start}</div>}
              </div>
              <ChevronRight className="size-4.5 shrink-0 text-[#555]" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Actions for ${activity.name}`}
                  className="mr-2 text-ink-faint hover:bg-[#1d1d1d] hover:text-ink-body"
                >
                  <MoreVertical className="size-4.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-40">
                <DropdownMenuItem onSelect={() => onEdit(activity)}>Edit activity</DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={() => onDelete(activity)}>
                  Delete activity…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      })}
    </div>
  )
}

export function ActivitiesScreen({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const activities = useSupabaseQuery(() => loadActivities(userId), [userId])
  const [editing, setEditing] = useState<Activity | null>(null)
  const [deleting, setDeleting] = useState<Activity | null>(null)
  const list = activities ?? []
  const header = (
    <div>
      <Button type="button" variant="ghost" onClick={() => navigate("/you")} className="h-auto gap-1.5 p-0 text-[13px] text-ink-muted hover:bg-transparent hover:text-ink"><ChevronLeft className="size-4" /> Back to You</Button>
      <h1 className="mt-4 text-[28px] font-semibold tracking-[-0.02em] text-ink">Activities</h1>
      <p className="mt-1.5 text-[13.5px] text-ink-muted">{activities === undefined ? "Loading…" : `${list.length} active`}</p>
    </div>
  )
  return (
    <>
      <div className="flex h-svh flex-col bg-background lg:hidden">
        <div className="shrink-0 px-5.5 pt-[calc(env(safe-area-inset-top)+0.75rem)]">{header}</div>
        <div className="flex-1 overflow-auto px-5.5 pt-6 pb-5"><ActivityList activities={list} onEdit={setEditing} onDelete={setDeleting} /></div>
        <MobileTabBar />
      </div>
      <div className="relative hidden h-svh overflow-hidden bg-background lg:block">
        <DesktopIsland />
        <div className="h-full overflow-auto px-10 pt-[calc(var(--island-h)+1rem)] pb-10"><div className="mx-auto max-w-[620px]">{header}<div className="mt-7"><ActivityList activities={list} onEdit={setEditing} onDelete={setDeleting} /></div></div></div>
      </div>
      {editing && <EditActivityDialog activity={editing} onClose={() => setEditing(null)} />}
      {deleting && <DeleteActivityDialog activity={deleting} open onOpenChange={(open) => !open && setDeleting(null)} />}
    </>
  )
}
