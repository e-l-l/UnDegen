import type { Activity } from "./types"

// Pure recurrence helpers, shared by the derived day-view and the write path.
// Dates are local 'YYYY-MM-DD' strings; weekday is JS getDay() (0=Sun..6=Sat),
// matching what activities.recurrence_days stores.

export function todayLocal(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function parseLocalDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number)
  return new Date(y, m - 1, d)
}

export function weekdayOf(date: string): number {
  return parseLocalDate(date).getDay()
}

// Current local wall-clock as an 'HH:MM' (24hr) string — same shape as the
// zoneless `time` columns (strict_time etc.), so it compares lexicographically.
export function nowTimeLocal(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0")
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}

// The next full hour as 'HH:MM' (capped at 23:00 so it never rolls past today),
// used as the default reminder time so a fresh activity that starts today isn't
// pre-set to a moment that's already gone.
export function nextHourLocal(d: Date = new Date()): string {
  const h = Math.min(d.getHours() + 1, 23)
  return `${String(h).padStart(2, "0")}:00`
}

// Does this activity's rule produce an occurrence on `date`?
export function recursOn(activity: Activity, date: string): boolean {
  return (
    !activity.archived &&
    activity.recurrence_start <= date &&
    activity.recurrence_days.includes(weekdayOf(date))
  )
}
