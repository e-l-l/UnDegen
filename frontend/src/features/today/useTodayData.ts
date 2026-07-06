import { useEffect, useMemo, useState } from "react"
import { useLiveQuery } from "dexie-react-hooks"

import { getDayItems, type DayItem } from "@/db/dayView"
import { todayLocal } from "@/db/recurrence"

export interface ReminderBucket {
  item: DayItem
  timeLabel: string
  anchorMinutes: number
}

export interface TodayData {
  loading: boolean
  eyebrow: string
  doneCount: number
  toGoCount: number
  earlier: ReminderBucket[]
  upNext: ReminderBucket[]
  longTasks: DayItem[]
  now: Date
  nowLabel: string
  streak: number
}

function parseHHMM(value: string): number {
  const [h, m] = value.split(":").map(Number)
  return h * 60 + m
}

// Anchor minute a reminder row sorts by. strict → its time. random → the window
// END, so a not-yet-fired surprise stays in "up next" for its whole window
// instead of jumping to "earlier" the moment the window opens. soft → the window
// start (v1 anchors on the first nudge, not every one).
function anchorMinutesFor(activity: DayItem["activity"]): number | null {
  const time =
    activity.reminder_type === "strict"
      ? activity.strict_time
      : activity.reminder_type === "random"
        ? activity.soft_end
        : activity.soft_start
  return time ? parseHHMM(time) : null
}

function formatTimeLabel(minutes: number): string {
  const h24 = Math.floor(minutes / 60)
  const m = minutes % 60
  const period = h24 >= 12 ? "PM" : "AM"
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(m).padStart(2, "0")} ${period}`
}

// The time text on the row. A random reminder shows its window as a range — the
// exact fire minute stays hidden (surprise is the point); everything else shows
// its single anchor time.
function timeLabelFor(activity: DayItem["activity"], anchor: number): string {
  if (activity.reminder_type === "random" && activity.soft_start) {
    // anchor is already soft_end (see anchorMinutesFor), so only soft_start needs
    // parsing. Newline-separated so the row renders it as two stacked lines (the
    // fixed time column is too narrow for a one-line range). See ReminderRow.
    return `${formatTimeLabel(parseHHMM(activity.soft_start))}\n–${formatTimeLabel(anchor)}`
  }
  return formatTimeLabel(anchor)
}

// The one Today read: a live Dexie query over getDayItems, plus a minute-tick
// clock. Writes (markReminder, startWorkSession) go through repo.ts and hit the
// same Dexie tables, so useLiveQuery re-runs this automatically — no manual
// refresh wiring needed.
export function useTodayData(userId: string): TodayData {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const date = todayLocal(now)
  const items = useLiveQuery(() => getDayItems(userId, date), [userId, date])

  return useMemo(() => {
    const loading = items === undefined
    const all = items ?? []
    const reminders = all.filter((i) => i.activity.type === "reminder")
    const longTasks = all.filter((i) => i.activity.type === "long_task")

    const nowMinutes = now.getHours() * 60 + now.getMinutes()
    const earlier: ReminderBucket[] = []
    const upNext: ReminderBucket[] = []
    for (const item of reminders) {
      const anchor = anchorMinutesFor(item.activity)
      if (anchor === null) continue
      const bucket: ReminderBucket = {
        item,
        timeLabel: timeLabelFor(item.activity, anchor),
        anchorMinutes: anchor,
      }
      if (anchor <= nowMinutes) earlier.push(bucket)
      else upNext.push(bucket)
    }
    earlier.sort((a, b) => a.anchorMinutes - b.anchorMinutes)
    upNext.sort((a, b) => a.anchorMinutes - b.anchorMinutes)

    const doneCount = reminders.filter((i) => i.completion?.status === "done").length
    // A "Missed it" (skipped) occurrence is resolved, not outstanding — exclude it
    // from "to go" (so done + toGo need not sum to the total; dismissed ones are neither).
    const toGoCount = reminders.filter(
      (i) => i.completion?.status !== "done" && i.completion?.status !== "skipped"
    ).length

    const weekday = now.toLocaleDateString(undefined, { weekday: "long" })
    const monthDay = now.toLocaleDateString(undefined, { month: "short", day: "numeric" })

    return {
      loading,
      eyebrow: `${weekday} · ${monthDay}`,
      doneCount,
      toGoCount,
      earlier,
      upNext,
      longTasks,
      now,
      nowLabel: formatTimeLabel(nowMinutes),
      streak: 0, // stub — real derived-streak calc is a follow-up task; consumed by stats page, not Today UI
    }
  }, [items, now])
}
