import { addDays, parseLocalDate, todayLocal } from "./recurrence"

// Split a work session into local-calendar-day slices. This keeps display and
// stats honest for cross-midnight sessions: minutes are credited to the day when
// they were actually spent, not only the day the session started.
export function sessionDaySlices(startedAt: string, totalSecs: number | null | undefined): { date: string; secs: number }[] {
  const out: { date: string; secs: number }[] = []
  let cursor = new Date(startedAt).getTime()
  const secs = Math.max(0, totalSecs ?? 0)

  if (!Number.isFinite(cursor)) return out
  if (secs === 0) return [{ date: todayLocal(new Date(cursor)), secs: 0 }]

  const end = cursor + secs * 1000

  while (cursor < end) {
    const date = todayLocal(new Date(cursor))
    const nextMidnight = parseLocalDate(addDays(date, 1)).getTime()
    const next = Math.min(end, nextMidnight)
    out.push({ date, secs: (next - cursor) / 1000 })
    cursor = next
  }

  return out
}
