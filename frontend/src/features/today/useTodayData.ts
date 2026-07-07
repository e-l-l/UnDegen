import { useEffect, useMemo, useState } from "react"
import { useLiveQuery } from "dexie-react-hooks"

import { getDayItems, type DayItem } from "@/db/dayView"
import { addDays, formatMonthDay, parseLocalDate, todayLocal } from "@/db/recurrence"

export interface ReminderBucket {
  item: DayItem
  timeLabel: string
  anchorMinutes: number
}

export interface TodayData {
  loading: boolean
  // Whether the viewed day is real today. Off-today the screen renders read-only
  // (see TodayScreen) and uses the flat `reminders` list + `totalCount` rather than
  // the Earlier/NOW/Up-next split, which only makes sense with "now" inside the day.
  isToday: boolean
  title: string // relative day label: Today / Yesterday / Tomorrow / weekday
  eyebrow: string
  doneCount: number
  toGoCount: number // outstanding today
  totalCount: number // all reminders that day — for the off-today "X of Y done"
  earlier: ReminderBucket[] // today only
  upNext: ReminderBucket[] // today only
  reminders: ReminderBucket[] // flat, time-ordered — the off-today list
  longTasks: DayItem[]
  now: Date
  nowLabel: string
  streak: number
}

// Relative label for the header title. Uses addDays (not ms math) so it's DST-safe.
// Beyond ±1 day, falls back to the weekday name. Exported for FocusScreen, which
// reads getDayItems directly (not this hook) but wants the same day label.
export function relativeTitle(date: string, realToday: string): string {
  if (date === realToday) return "Today"
  if (date === addDays(realToday, -1)) return "Yesterday"
  if (date === addDays(realToday, 1)) return "Tomorrow"
  return parseLocalDate(date).toLocaleDateString(undefined, { weekday: "long" })
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

// The time text on the row. A random reminder hides its time entirely — not even
// the window range (surprise is the point, and the range read as clutter). It
// just says "RANDOM"; everything else shows its single anchor time.
function timeLabelFor(activity: DayItem["activity"], anchor: number): string {
  if (activity.reminder_type === "random") {
    return "RANDOM"
  }
  return formatTimeLabel(anchor)
}

// The one Today read: a live Dexie query over getDayItems for the viewed `date`,
// plus a minute-tick clock. Writes (markReminder, startWorkSession) go through
// repo.ts and hit the same Dexie tables, so useLiveQuery re-runs this
// automatically — no manual refresh wiring needed. The date comes from the
// SelectedDayProvider (day switcher); when it isn't real today the Earlier/Up-next
// split is skipped in favour of the flat `reminders` list.
export function useTodayData(userId: string, date: string): TodayData {
  const [now, setNow] = useState(() => new Date())

  // Minute tick — only when viewing real today, where the clock drives the
  // Earlier/NOW/Up-next split and nowLabel. Off-today none of the output depends
  // on `now`, so ticking there would re-derive + re-render every 60s for nothing.
  useEffect(() => {
    if (date !== todayLocal()) return
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [date])

  const items = useLiveQuery(() => getDayItems(userId, date), [userId, date])

  return useMemo(() => {
    const loading = items === undefined
    const all = items ?? []
    const reminderItems = all.filter((i) => i.activity.type === "reminder")
    const longTasks = all.filter((i) => i.activity.type === "long_task")

    const realToday = todayLocal(now)
    const isToday = date === realToday

    // All reminders as time-ordered buckets — this flat list is what an off-today
    // day renders. Today additionally splits it around the live clock below.
    const flat: ReminderBucket[] = []
    for (const item of reminderItems) {
      const anchor = anchorMinutesFor(item.activity)
      if (anchor === null) continue
      flat.push({ item, timeLabel: timeLabelFor(item.activity, anchor), anchorMinutes: anchor })
    }
    flat.sort((a, b) => a.anchorMinutes - b.anchorMinutes)

    const nowMinutes = now.getHours() * 60 + now.getMinutes()
    const earlier = isToday ? flat.filter((b) => b.anchorMinutes <= nowMinutes) : []
    const upNext = isToday ? flat.filter((b) => b.anchorMinutes > nowMinutes) : []

    const doneCount = reminderItems.filter((i) => i.completion?.status === "done").length
    // A "Missed it" (skipped) occurrence is resolved, not outstanding — exclude it
    // from "to go" (so done + toGo need not sum to the total; dismissed ones are neither).
    const toGoCount = reminderItems.filter(
      (i) => i.completion?.status !== "done" && i.completion?.status !== "skipped"
    ).length

    // Eyebrow tracks the viewed day (from the live clock when today, else the date).
    const labelDate = isToday ? now : parseLocalDate(date)
    const weekday = labelDate.toLocaleDateString(undefined, { weekday: "long" })
    const monthDay = formatMonthDay(labelDate)

    return {
      loading,
      isToday,
      title: relativeTitle(date, realToday),
      eyebrow: `${weekday} · ${monthDay}`,
      doneCount,
      toGoCount,
      totalCount: reminderItems.length,
      earlier,
      upNext,
      reminders: flat,
      longTasks,
      now,
      nowLabel: formatTimeLabel(nowMinutes),
      streak: 0, // stub — real derived-streak calc is a follow-up task; consumed by stats page, not Today UI
    }
  }, [items, now, date])
}
