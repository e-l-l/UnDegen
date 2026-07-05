import { forwardRef } from "react"

import { iconForActivity } from "./iconForActivity"
import { NowDivider } from "./NowDivider"
import { ReminderRow } from "./ReminderRow"
import type { ReminderBucket } from "./useTodayData"

interface TimelineProps {
  earlier: ReminderBucket[]
  upNext: ReminderBucket[]
  nowLabel: string
  onToggleDone: (activityId: string, done: boolean) => void
  onToggleMissed: (activityId: string, missed: boolean) => void
  userId: string
  date: string
}

// The one shared timeline body for both breakpoints — mobile/desktop only
// differ in the surrounding chrome (header, nav, rail), not in how rows
// render, so unlike the header/nav blocks this isn't duplicated per lg:.
export const Timeline = forwardRef<HTMLDivElement, TimelineProps>(function Timeline(
  { earlier, upNext, nowLabel, onToggleDone, onToggleMissed, userId, date },
  nowRef
) {
  const rows = (buckets: ReminderBucket[]) =>
    buckets.map(({ item, timeLabel }) => {
      const done = item.completion?.status === "done"
      const missed = item.completion?.status === "skipped"
      return (
        <ReminderRow
          key={item.activity.id}
          time={timeLabel}
          title={item.activity.name}
          Icon={iconForActivity(item.activity)}
          done={done}
          missed={missed}
          onToggle={() => onToggleDone(item.activity.id, done)}
          onToggleMissed={() => onToggleMissed(item.activity.id, missed)}
          activity={item.activity}
          date={date}
          userId={userId}
        />
      )
    })

  return (
    <>
      {earlier.length > 0 && (
        <div className="mb-0.5 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
          Earlier today
        </div>
      )}
      {rows(earlier)}
      <div ref={nowRef}>
        <NowDivider time={nowLabel} />
      </div>
      {upNext.length > 0 && (
        <div className="mb-0.5 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
          Up next
        </div>
      )}
      {rows(upNext)}
    </>
  )
})
