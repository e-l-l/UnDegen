import { forwardRef } from "react"

import { iconForActivity } from "./iconForActivity"
import { NowDivider } from "./NowDivider"
import { ReminderRow } from "./ReminderRow"
import type { ReminderBucket } from "./useTodayData"

interface TimelineProps {
  earlier: ReminderBucket[]
  upNext: ReminderBucket[]
  reminders: ReminderBucket[] // flat list rendered in the off-today layout
  nowLabel: string
  // Off-today: render a single flat, time-ordered list — no NOW divider, no
  // Earlier/Up-next headers (there's no "now" inside another day). Rows drop
  // every interactive control except past-day completion corrections (see
  // canUpdateReminders and ReminderRow).
  offTodayLayout: boolean
  // Past reminder rows keep the flat off-today layout but expose their done
  // toggle. Future rows remain fully review-only.
  canUpdateReminders: boolean
  // Calm line for a review-only day with nothing on it (pre-history past / empty
  // future); read-only, so it's a statement, not a prompt to act.
  emptyMessage?: string
  onToggleDone: (activityId: string, done: boolean) => void
  onToggleMissed: (activityId: string, missed: boolean) => void
  userId: string
  date: string
}

// The one shared timeline body for both breakpoints — mobile/desktop only
// differ in the surrounding chrome (header, nav, rail), not in how rows
// render, so unlike the header/nav blocks this isn't duplicated per lg:.
export const Timeline = forwardRef<HTMLDivElement, TimelineProps>(function Timeline(
  {
    earlier,
    upNext,
    reminders,
    nowLabel,
    offTodayLayout,
    canUpdateReminders,
    emptyMessage,
    onToggleDone,
    onToggleMissed,
    userId,
    date,
  },
  nowRef
) {
  const rows = (buckets: ReminderBucket[]) =>
    buckets.map(({ item, timeLabel }) => {
      // done/skipped are read off the single derived `state`; kept here only to
      // tell the toggle callbacks the current value (done → clear, else mark).
      const done = item.state === "done"
      const skipped = item.state === "skipped"
      return (
        <ReminderRow
          key={item.activity.id}
          time={timeLabel}
          title={item.activity.name}
          Icon={iconForActivity(item.activity)}
          state={item.state}
          offTodayLayout={offTodayLayout}
          canToggleCompletion={canUpdateReminders}
          onToggle={() => onToggleDone(item.activity.id, done)}
          onToggleMissed={() => onToggleMissed(item.activity.id, skipped)}
          activity={item.activity}
          date={date}
          userId={userId}
        />
      )
    })

  if (offTodayLayout)
    return reminders.length ? (
      <>{rows(reminders)}</>
    ) : emptyMessage ? (
      <div className="mt-16 text-center text-[14px] text-ink-muted">{emptyMessage}</div>
    ) : null

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
