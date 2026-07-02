import type { ReactNode } from "react"
import { Play, Square, type LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { DayItem } from "@/db/dayView"
import { iconForActivity } from "./iconForActivity"

interface LongTaskCardProps {
  item: DayItem
  now: Date
  onStart: () => void
  onStop: () => void
}

// There's no stored session-count target anywhere in the schema (Activity has
// only a single duration goal; WorkSession is scoped to one day_activity,
// i.e. one calendar day — no cross-day cumulative query exists today).
// Progress is scoped to *today's* sessions only, which getDayItems already
// returns, rather than fabricating an all-time stat.
export function LongTaskCard({ item, now, onStart, onStop }: LongTaskCardProps) {
  const { activity, sessions } = item
  const Icon = iconForActivity(activity)
  const active = sessions.find((s) => s.status === "in_progress")
  const completedSecs = sessions
    .filter((s) => s.status === "completed")
    .reduce((sum, s) => sum + (s.total_secs ?? 0), 0)

  const goalSecs = (activity.goal_duration_mins ?? 0) * 60

  if (active) {
    const elapsedSecs = (now.getTime() - new Date(active.started_at).getTime()) / 1000
    const progress = goalSecs > 0 ? Math.min(1, elapsedSecs / goalSecs) : 0
    return (
      <Card
        icon={Icon}
        name={activity.name}
        progress={progress}
        meta={`In progress · ${Math.round(elapsedSecs / 60)}m elapsed`}
      >
        <Button type="button" variant="outline" onClick={onStop} className="mt-3.5 h-11 w-full rounded-xl text-[14.5px]">
          <Square className="size-2.75 fill-current" strokeWidth={0} />
          Stop session
        </Button>
      </Card>
    )
  }

  if (completedSecs > 0) {
    const progress = goalSecs > 0 ? Math.min(1, completedSecs / goalSecs) : 1
    return (
      <Card icon={Icon} name={activity.name} progress={progress} meta={`${Math.round(completedSecs / 60)}m done today`}>
        <Button type="button" onClick={onStart} className="mt-3.5 h-11 w-full rounded-xl text-[14.5px]">
          <Play className="size-3.25 fill-current" strokeWidth={0} />
          Start session
        </Button>
      </Card>
    )
  }

  return (
    <Card icon={Icon} name={activity.name} progress={0} meta="Not started today">
      <Button
        type="button"
        variant="outline"
        onClick={onStart}
        className="mt-3.5 h-11 w-full rounded-xl text-[14.5px] text-ink-body"
      >
        <Play className="size-3.25 fill-current" strokeWidth={0} />
        Start
      </Button>
    </Card>
  )
}

interface CardProps {
  icon: LucideIcon
  name: string
  progress: number
  meta: string
  children: ReactNode
}

function Card({ icon: Icon, name, progress, meta, children }: CardProps) {
  return (
    <div className="rounded-2xl border border-[#242424] bg-surface p-[18px]">
      <div className="flex items-center gap-3">
        <div className="flex size-9.5 shrink-0 items-center justify-center rounded-[11px] border border-[#2e2e2e] bg-surface">
          <Icon className="size-4.5 text-ink-body" strokeWidth={1.7} />
        </div>
        <div className="min-w-0 flex-1 text-[14.5px] font-medium text-[#d8d8d8]">{name}</div>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#2a2a2a]">
        <div className="h-full rounded-full bg-pink" style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="mt-2.25 text-[12px] text-ink-dim">{meta}</div>
      {children}
    </div>
  )
}
