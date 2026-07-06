// Pure scheduling logic for the notification alarm — no I/O, no Deno APIs beyond
// Intl. Kept separate so it's unit-testable (see schedule.test.ts) and mirrors the
// frontend's recurrence semantics (frontend/src/db/recurrence.ts + useTodayData.ts).
//
// The whole model is wall-clock local time. Each tick we ask, per user in their
// IANA timezone: what local date/minute is it, does this reminder recur today, and
// which of its slots fall in the recent lookback window.

export type ReminderKind = "strict" | "soft" | "random"

// Subset of the activities row the scheduler needs. Postgres `time` columns arrive
// as 'HH:MM:SS' strings via PostgREST.
export interface ReminderActivity {
  id: string
  user_id: string
  name: string
  reminder_type: ReminderKind | null
  strict_time: string | null
  soft_start: string | null
  soft_interval_mins: number | null
  soft_end: string | null
  recurrence_days: number[] // JS getDay(): 0=Sun..6=Sat
  recurrence_start: string // 'YYYY-MM-DD'
  exception_dates: string[] // 'YYYY-MM-DD' dates the rule skips ("delete this day only")
}

export interface LocalContext {
  date: string // 'YYYY-MM-DD' in the user's zone
  minutes: number // minutes since local midnight
  weekday: number // JS getDay(): 0=Sun..6=Sat
}

const pad = (n: number) => String(n).padStart(2, "0")

// The user's local calendar date, minute-of-day, and weekday for a given instant.
// DST is handled for free: Intl resolves the zone's actual offset at `now`.
export function localContext(now: Date, timeZone: string): LocalContext {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now)

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0"
  const y = Number(get("year"))
  const mo = Number(get("month"))
  const d = Number(get("day"))
  let h = Number(get("hour"))
  const mi = Number(get("minute"))
  if (h === 24) h = 0 // some runtimes emit '24' for local midnight under hour12:false

  return {
    date: `${y}-${pad(mo)}-${pad(d)}`,
    minutes: h * 60 + mi,
    // weekday of the local calendar date (UTC math on the y/m/d avoids zone drift)
    weekday: new Date(Date.UTC(y, mo - 1, d)).getUTCDay(),
  }
}

// 'HH:MM' or 'HH:MM:SS' → minutes since midnight. Returns null on garbage.
export function parseHHMM(value: string | null): number | null {
  if (!value) return null
  const [h, m] = value.split(":").map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return h * 60 + m
}

export function formatHHMM(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`
}

// FNV-1a 32-bit — a tiny deterministic string hash (pure arithmetic, no crypto).
// Used to place a 'random' reminder's single fire minute: seeding on
// `${activity.id}|${localDate}` makes the minute stable across every cron tick of
// that day (so notification_log dedupes it) yet different each day. Not for
// security — just an unpredictable-to-the-user, reproducible-to-the-server pick.
export function hash32(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

// Same predicate as the frontend's recursOn, evaluated in the user's local date.
// A local date in exception_dates is a single-occurrence removal ("delete this
// day only") — skip it so no push fires for a deleted day. (archived is filtered
// upstream in the activities query; ?? [] guards a mis-shaped fixture.)
export function recursOn(activity: ReminderActivity, ctx: LocalContext): boolean {
  return (
    activity.recurrence_start <= ctx.date &&
    activity.recurrence_days.includes(ctx.weekday) &&
    !(activity.exception_dates ?? []).includes(ctx.date)
  )
}

// Slot minutes due within the lookback window (nowMinutes - lookback, nowMinutes].
// strict → the single strict_time. soft → every soft_start + k·interval ≤ soft_end.
// random → one seeded minute inside [soft_start, soft_end] (needs localDate for the
// seed). The lookback tolerates cron jitter / a brief outage; the notification_log
// stops any slot from firing twice.
export function dueSlots(
  activity: ReminderActivity,
  nowMinutes: number,
  lookbackMins: number,
  localDate: string
): number[] {
  const inWindow = (m: number) => m <= nowMinutes && m > nowMinutes - lookbackMins

  if (activity.reminder_type === "strict") {
    const s = parseHHMM(activity.strict_time)
    return s !== null && inWindow(s) ? [s] : []
  }

  if (activity.reminder_type === "soft") {
    const start = parseHHMM(activity.soft_start)
    const end = parseHHMM(activity.soft_end)
    const interval = activity.soft_interval_mins
    if (start === null || end === null || !interval || interval <= 0 || start > end) {
      return []
    }
    const slots: number[] = []
    for (let m = start; m <= end; m += interval) {
      if (inWindow(m)) slots.push(m)
    }
    return slots
  }

  if (activity.reminder_type === "random") {
    // Fires once at a minute derived from (activity.id, localDate) inside the
    // soft window. Deterministic → every tick this day computes the same slot, so
    // the notification_log unique key dedupes it exactly like strict.
    const start = parseHHMM(activity.soft_start)
    const end = parseHHMM(activity.soft_end)
    if (start === null || end === null || start > end) return []
    const m = start + (hash32(`${activity.id}|${localDate}`) % (end - start + 1))
    return inWindow(m) ? [m] : []
  }

  return []
}

// Notification copy — templated by type, dry brand voice. No per-activity custom
// copy in v1. `tag` collapses re-nudges of the same occurrence in the OS tray.
export function buildPayload(
  activity: ReminderActivity,
  slotMinutes: number,
  localDate: string
) {
  const body =
    activity.reminder_type === "strict"
      ? `It's ${formatHHMM(slotMinutes)}. You said you would.`
      : activity.reminder_type === "random"
        ? `Surprise. It's time.`
        : `Still on the list. It's on you.`
  return {
    title: activity.name,
    body,
    url: "/",
    tag: `${activity.id}:${localDate}`,
  }
}
