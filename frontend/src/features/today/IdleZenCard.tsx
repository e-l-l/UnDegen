import type { ReactNode } from "react"
import { Play } from "lucide-react"

import { Button } from "@/components/ui/button"
import { startOfWeekMonday, todayLocal } from "@/db/recurrence"
import { sessionDaySlices } from "@/db/sessionSlices"
import { getCompletedSessions } from "@/db/taskHistory"
import type { Activity } from "@/db/types"
import { useSupabaseQuery } from "@/db/useSupabaseQuery"
import { formatDuration } from "@/lib/utils"
import { iconForActivity } from "./iconForActivity"

// Closed palette of the exact greys from the design handoff — not an
// interpolation, so the sparkline never drifts to an unspecified shade.
const SPARK_SHADES = ["#282828", "#2c2c2c", "#333333", "#3a3a3a"]

function shadeFor(fraction: number): string {
  const idx = Math.min(SPARK_SHADES.length - 1, Math.floor(fraction * SPARK_SHADES.length))
  return SPARK_SHADES[idx]
}

interface IdleZenCardProps {
  activity: Activity
  onStart: () => void
  menu?: ReactNode
}

// Zen mode idle → data card. There's no goal to progress toward, so
// personality comes from a plain greyscale sparkline of recent session
// lengths (never tinted pink — no session is "the target") plus a weekly
// rollup. No percentage language anywhere, ever.
export function IdleZenCard({ activity, onStart, menu }: IdleZenCardProps) {
  const Icon = iconForActivity(activity)
  const sessions = useSupabaseQuery(() => getCompletedSessions(activity.id), [activity.id])
  const hasHistory = (sessions?.length ?? 0) > 0
  const recent = (sessions ?? []).slice(-6)
  const maxSecs = Math.max(1, ...recent.map((s) => s.total_secs ?? 0))
  const today = todayLocal()
  const monday = startOfWeekMonday(today) // this calendar week's Monday (design week start)
  // One pass: split each session across local day boundaries, then tally into
  // today and this-week (Mon→now). A yesterday-started/today-ended session should
  // still show the minutes actually done today.
  let weekSecs = 0
  let todaySecs = 0
  for (const s of sessions ?? []) {
    for (const slice of sessionDaySlices(s.started_at, s.total_secs)) {
      if (slice.date >= monday) weekSecs += slice.secs
      if (slice.date === today) todaySecs += slice.secs
    }
  }

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

      {hasHistory && (
        <div className="mt-4.5 flex h-11 items-end gap-2">
          {recent.map((s) => (
            <div
              key={s.id}
              className="flex-1 rounded-t-lg rounded-b-[2px]"
              style={{
                height: `${Math.max(12, ((s.total_secs ?? 0) / maxSecs) * 100)}%`,
                background: shadeFor((s.total_secs ?? 0) / maxSecs),
              }}
            />
          ))}
        </div>
      )}

      <div className={`text-[12.5px] text-idle-caption ${hasHistory ? "mt-3" : "mt-4.5"}`}>
        {hasHistory ? (
          <>
            <span className="font-medium text-idle-caption-strong">{formatDuration(todaySecs / 60)}</span> today ·{" "}
            {formatDuration(weekSecs / 60)} this week
          </>
        ) : (
          "No limit · not started"
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
