import type { Activity } from "@/db/types"
import { formatDuration } from "@/lib/utils"

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export function repeatSummary(days: number[]): string {
  if (days.length === 7) return "Every day"
  if (days.join(",") === "1,2,3,4,5") return "Weekdays"
  if (days.join(",") === "0,6") return "Weekends"
  return [...days].sort((a, b) => a - b).map((day) => DAYS[day]).join(", ")
}

function timeLabel(value: string | null | undefined): string {
  if (!value) return "No time"
  const [hour, minute] = value.split(":").map(Number)
  const period = hour >= 12 ? "PM" : "AM"
  const h = hour % 12 || 12
  return `${h}:${String(minute).padStart(2, "0")} ${period}`
}

export function activitySummary(activity: Activity): string {
  const repeat = repeatSummary(activity.recurrence_days)
  if (activity.type === "reminder") {
    if (activity.reminder_type === "random") return `${repeat} · Random reminder`
    if (activity.reminder_type === "soft") {
      return `${repeat} · ${timeLabel(activity.soft_start)}–${timeLabel(activity.soft_end)}`
    }
    return `${repeat} · ${timeLabel(activity.strict_time)}`
  }
  return activity.default_mode === "goal"
    ? `${repeat} · ${formatDuration(activity.goal_duration_mins ?? 0)} goal`
    : `${repeat} · Zen`
}
