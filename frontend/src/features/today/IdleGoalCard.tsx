import type { ReactNode } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { Play } from "lucide-react"

import { Button } from "@/components/ui/button"
import { getCompletedSessions } from "@/db/taskHistory"
import type { Activity } from "@/db/types"
import { formatDuration } from "@/lib/utils"
import { iconForActivity } from "./iconForActivity"

interface IdleGoalCardProps {
  activity: Activity
  onStart: () => void
  menu?: ReactNode
}

// Goal mode idle → progress-bar card. Progress is banked across every
// completed session this activity has ever had, not scoped to today — a
// goal is worked toward over multiple sittings, so 0% is just the natural
// low end of the bar rather than a separate empty state.
export function IdleGoalCard({ activity, onStart, menu }: IdleGoalCardProps) {
  const Icon = iconForActivity(activity)
  const sessions = useLiveQuery(() => getCompletedSessions(activity.id), [activity.id])
  const bankedSecs = (sessions ?? []).reduce((sum, s) => sum + (s.total_secs ?? 0), 0)
  const goalSecs = (activity.goal_duration_mins ?? 0) * 60
  const pct = goalSecs > 0 ? Math.min(1, bankedSecs / goalSecs) : 0
  const started = bankedSecs > 0

  return (
    <div className="rounded-[18px] border border-idle-border bg-idle-bg p-4.5">
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-[11px] border border-idle-icon-border bg-idle-icon-bg">
          <Icon className="size-4.75 text-ink-body" strokeWidth={1.7} />
        </div>
        <div className="min-w-0 flex-1 truncate text-[15.5px] font-medium text-idle-title">{activity.name}</div>
        <span className="shrink-0 text-[11px] font-medium tracking-[0.04em] text-idle-label uppercase">Idle</span>
        {menu}
      </div>

      <div className="relative mt-4.5 h-1.5 rounded-full bg-idle-track">
        {started && (
          <>
            <div className="h-full rounded-full bg-pink" style={{ width: `${pct * 100}%` }} />
            <div
              className="absolute top-1/2 size-2.25 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pink shadow-[0_0_0_3px_var(--idle-bg)]"
              style={{ left: `${pct * 100}%` }}
            />
          </>
        )}
      </div>

      <div className="mt-2.5 text-[12.5px] text-idle-caption">
        {started ? (
          <>
            <span className="font-medium text-idle-caption-strong">{Math.round(pct * 100)}%</span> of{" "}
            {formatDuration(activity.goal_duration_mins ?? 0)} goal
          </>
        ) : (
          `${formatDuration(activity.goal_duration_mins ?? 0)} goal · not started`
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={onStart}
        className="mt-4 h-11.5 w-full rounded-[13px] border-pink/32 bg-pink/6 text-[14.5px] font-semibold text-pink hover:border-pink/40 hover:bg-pink/10 hover:text-pink lg:h-11 lg:rounded-xl"
      >
        <Play className="size-3.25 fill-current" strokeWidth={0} />
        Start session
      </Button>
    </div>
  )
}
