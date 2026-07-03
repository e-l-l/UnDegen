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

// Anchor time for a reminder row. Soft reminders can re-nudge across a window
// (soft_start..soft_end) — v1 only anchors on the first nudge, not every one.
function anchorMinutesFor(activity: DayItem["activity"]): number | null {
  const time = activity.reminder_type === "strict" ? activity.strict_time : activity.soft_start
  return time ? parseHHMM(time) : null
}

function formatTimeLabel(minutes: number): string {
  const h24 = Math.floor(minutes / 60)
  const m = minutes % 60
  const period = h24 >= 12 ? "PM" : "AM"
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(m).padStart(2, "0")} ${period}`
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
      const bucket: ReminderBucket = { item, timeLabel: formatTimeLabel(anchor), anchorMinutes: anchor }
      if (anchor <= nowMinutes) earlier.push(bucket)
      else upNext.push(bucket)
    }
    earlier.sort((a, b) => a.anchorMinutes - b.anchorMinutes)
    upNext.sort((a, b) => a.anchorMinutes - b.anchorMinutes)

    const doneCount = reminders.filter((i) => i.completion?.status === "done").length
    const toGoCount = reminders.length - doneCount

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
