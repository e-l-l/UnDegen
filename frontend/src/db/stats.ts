import { supabase } from "@/utils/supabase"
import { groupActivityRevisions } from "./activityRevisions"
import {
  mondayIndex,
  nowTimeLocal,
  parseLocalDate,
  recursOn,
  startOfWeekMonday,
  todayLocal,
  weekdayOf,
} from "./recurrence"
import { sessionDaySlices } from "./sessionSlices"
import type { Activity, ActivityRevision, Completion, Day, DayActivity, WorkSession } from "./types"
import { deltaDir } from "@/features/stats/types"
import type {
  ActivityStatRow,
  CompletionRecord,
  SessionRecord,
  StatsDetail,
  StatsOverview,
  WeekStripCell,
} from "@/features/stats/types"

// Stats data layer — direct Supabase reads aggregated in memory. Nothing here
// writes. Produces the exact
// StatsOverview / StatsDetail shapes the Stats UI consumes. At this scale the
// full-scan approach is fine (no timestamp indexes; see db/CONTEXT.md).
//
// Windows: "this week" = the Mon–Sun calendar week containing today; delta vs the
// prior calendar week. The current week is partial — counts elapsed days only
// (Mon→today); future days aren't counted as planned (see adherence/reminderTally).
// The heatmap is all-time. Archived rule: amount stats (focus banked, trend,
// heatmap) include archived history; rate stats (showed-up ÷ planned, adherence,
// most-avoided) are active-only. Completed long-task amount/showed-up buckets are
// split across local day boundaries, so a session started yesterday still credits
// the minutes actually done today. Timestamps are UTC ISO → new Date() renders
// them device-local, which is what we bucket/display by.

const TREND_WEEKS = 8
const FLAKE_WEEKS = 8
const SPARK_SESSIONS = 5
const MOST_AVOIDED_MIN_PLANNED = 2 // floor so a 0/1 fluke can't be "most avoided"
const LOG_LIMIT = 14

// ── date helpers ──────────────────────────────────────────────────────────────
// Lexicographic compare for ISO timestamps — equivalent to comparing parsed
// Date.getTime() but with no per-element Date allocation inside sort comparators.
const cmpStr = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

function shiftDate(date: string, delta: number): string {
  const d = parseLocalDate(date)
  d.setDate(d.getDate() + delta)
  return todayLocal(d)
}
// `count` dates ending at `endDate` (inclusive), chronological (oldest→newest)
function rangeDates(endDate: string, count: number): string[] {
  const out: string[] = []
  for (let i = count - 1; i >= 0; i--) out.push(shiftDate(endDate, -i))
  return out
}
// Memoised weekdayOf — the same ~60 dates are tested by recursOn across every
// window loop (adherence, weeksDown, flake, per-activity rows). A date string
// always maps to the same weekday, so this cache is deterministic and bounded
// by the number of distinct dates ever seen. Pass wd(date) into recursOn to skip
// its internal re-parse.
const weekdayCache = new Map<string, number>()
function wd(date: string): number {
  let w = weekdayCache.get(date)
  if (w === undefined) {
    w = weekdayOf(date)
    weekdayCache.set(date, w)
  }
  return w
}

// The Mon–Sun calendar week `w` weeks back from the week containing `today`
// (w=0 = current week), oldest→newest. rangeDates(sunday, 7) yields Mon..Sun.
// The current week may include future days (elapsed-only counting is enforced by
// the `date > l.today` guards in adherence/reminderTally).
const weekWindow = (today: string, w: number): string[] =>
  rangeDates(shiftDate(startOfWeekMonday(today), 6 - 7 * w), 7)
// `count` calendar weeks, oldest→newest (last entry is the current week).
function weekWindows(today: string, count: number): string[][] {
  const out: string[][] = []
  for (let w = count - 1; w >= 0; w--) out.push(weekWindow(today, w))
  return out
}

// "Jul 3" — fixed English MMM D (app is English-only; keeps the design format
// locale-stable, since toLocaleDateString would flip to "3 Jul" under en-GB etc.)
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const fmtMonthDay = (d: Date): string => `${MONTHS[d.getMonth()]} ${d.getDate()}`

// ── loaded-and-indexed snapshot of one user's rows ────────────────────────────
interface Loaded {
  today: string
  activities: Activity[]
  revisionsByActivity: Map<string, ActivityRevision[]>
  // (activity_id|date) → instantiated state for that occurrence
  completionByKey: Map<string, Completion>
  // activity_id → true if it has any completion row (archived-with-history test)
  activitiesWithCompletion: Set<string>
  // completed sessions as whole-session facts (heatmap / sparkline / detail)
  facts: SessionFact[]
  // facts pre-grouped by activity_id (sparkline / detail — avoids re-filtering)
  factsByActivity: Map<string, SessionFact[]>
  // focus secs pre-bucketed by date, and by activity_id→date, so a windowed sum
  // is a handful of lookups instead of a full facts scan per call
  secsByDate: Map<string, number>
  secsByActDate: Map<string, Map<string, number>>
}

interface SessionFact {
  activityId: string
  date: string // owner occurrence date; day-bucketed amount stats use sessionDaySlices
  secs: number
  startedAt: string
  goalMet: boolean
}

async function load(userId: string): Promise<Loaded> {
  const [activityResult, revisionResult, dayResult, dayActivityResult] = await Promise.all([
    supabase.from("activities").select("*").eq("user_id", userId),
    supabase.from("activity_revisions").select("*"),
    supabase.from("days").select("*").eq("user_id", userId),
    supabase.from("day_activities").select("*"),
  ])
  for (const result of [activityResult, revisionResult, dayResult, dayActivityResult]) {
    if (result.error) throw new Error(result.error.message)
  }
  const activities = (activityResult.data ?? []) as Activity[]
  const allRevisions = (revisionResult.data ?? []) as ActivityRevision[]
  const days = (dayResult.data ?? []) as Day[]
  const allDayActs = (dayActivityResult.data ?? []) as DayActivity[]
  const activityIds = new Set(activities.map((activity) => activity.id))
  const revisionsByActivity = groupActivityRevisions(
    allRevisions.filter((revision) => activityIds.has(revision.activity_id))
  )
  const dateByDayId = new Map(days.map((d) => [d.id, d.date]))
  const dayIds = new Set(days.map((d) => d.id))

  const dayActs = allDayActs.filter((da) => dayIds.has(da.day_id))
  const daIds = dayActs.map((da) => da.id)
  const dateByDaId = new Map(dayActs.map((da) => [da.id, dateByDayId.get(da.day_id)!]))
  const activityByDaId = new Map(dayActs.map((da) => [da.id, da.activity_id]))

  const [completionResult, sessionResult] = daIds.length
    ? await Promise.all([
        supabase.from("completions").select("*").in("day_activity_id", daIds),
        supabase.from("work_sessions").select("*").in("day_activity_id", daIds),
      ])
    : [{ data: [], error: null }, { data: [], error: null }]
  if (completionResult.error) throw new Error(completionResult.error.message)
  if (sessionResult.error) throw new Error(sessionResult.error.message)
  const completions = (completionResult.data ?? []) as Completion[]
  const sessions = (sessionResult.data ?? []) as WorkSession[]

  const completionByKey = new Map<string, Completion>()
  const activitiesWithCompletion = new Set<string>()
  for (const c of completions) {
    const activityId = activityByDaId.get(c.day_activity_id)
    const date = dateByDaId.get(c.day_activity_id)
    if (activityId && date) {
      completionByKey.set(`${activityId}|${date}`, c)
      activitiesWithCompletion.add(activityId)
    }
  }

  const facts: SessionFact[] = []
  const factsByActivity = new Map<string, SessionFact[]>()
  const secsByDate = new Map<string, number>()
  const secsByActDate = new Map<string, Map<string, number>>()
  for (const s of sessions) {
    const activityId = activityByDaId.get(s.day_activity_id)
    const date = dateByDaId.get(s.day_activity_id)
    if (!activityId || !date) continue
    if (s.status === "completed") {
      const secs = s.total_secs ?? 0
      const fact: SessionFact = { activityId, date, secs, startedAt: s.started_at, goalMet: s.goal_met === true }
      facts.push(fact)
      const fa = factsByActivity.get(activityId) ?? []
      fa.push(fact)
      factsByActivity.set(activityId, fa)
      for (const slice of sessionDaySlices(s.started_at, secs)) {
        secsByDate.set(slice.date, (secsByDate.get(slice.date) ?? 0) + slice.secs)
        let m = secsByActDate.get(activityId)
        if (!m) {
          m = new Map()
          secsByActDate.set(activityId, m)
        }
        m.set(slice.date, (m.get(slice.date) ?? 0) + slice.secs)
      }
    }
  }

  return {
    today: todayLocal(),
    activities,
    revisionsByActivity,
    completionByKey,
    activitiesWithCompletion,
    facts,
    factsByActivity,
    secsByDate,
    secsByActDate,
  }
}

// ── per-occurrence predicates ─────────────────────────────────────────────────
function reminderDone(l: Loaded, activityId: string, date: string): boolean {
  return l.completionByKey.get(`${activityId}|${date}`)?.status === "done"
}
function longTaskShowed(l: Loaded, activityId: string, date: string): boolean {
  return l.secsByActDate.get(activityId)?.has(date) === true
}
function showedUp(l: Loaded, a: Activity, date: string): boolean {
  return a.type === "reminder" ? reminderDone(l, a.id, date) : longTaskShowed(l, a.id, date)
}
function plannedOn(l: Loaded, a: Activity, date: string): boolean {
  return recursOn(a, date, wd(date), l.revisionsByActivity.get(a.id) ?? [])
}

// showed-up ÷ planned over a date window, active activities only (rate stat)
function adherence(l: Loaded, dates: string[]): { showedUp: number; planned: number } {
  let planned = 0
  let showed = 0
  for (const a of l.activities) {
    if (a.archived) continue
    for (const date of dates) {
      if (date > l.today) continue // future occurrence — not yet plannable-as-missed
      if (!plannedOn(l, a, date)) continue
      planned++
      if (showedUp(l, a, date)) showed++
    }
  }
  return { showedUp: showed, planned }
}

// focus minutes over a date window, all activities incl. archived (amount stat)
function focusMins(l: Loaded, dates: string[]): number {
  let secs = 0
  for (const date of dates) secs += l.secsByDate.get(date) ?? 0
  return Math.round(secs / 60)
}

// weeks-in-a-row the showed-up rate has declined (for the escalating roast).
// Scored over *completed* weeks only — the current week (w=0) is partial, so
// letting one missed Monday morning escalate the roast against a full prior week
// would punish at week start, against the app's non-punishing intent.
function weeksDown(l: Loaded): number {
  const rateAt = (w: number) => {
    const a = adherence(l, weekWindow(l.today, w))
    return { rate: a.planned ? a.showedUp / a.planned : 0, planned: a.planned }
  }
  let n = 0
  let cur = rateAt(1) // last completed week
  for (let w = 1; w < TREND_WEEKS; w++) {
    const prev = rateAt(w + 1) // carried into next iteration's `cur` — each week scored once
    if (cur.planned && prev.planned && cur.rate < prev.rate) n++
    else break
    cur = prev
  }
  return n
}

// per-activity reminder done/planned over a window
function reminderTally(l: Loaded, a: Activity, dates: string[]): { done: number; planned: number } {
  let done = 0
  let planned = 0
  for (const date of dates) {
    if (date > l.today) continue // future occurrence — not yet plannable-as-missed
    if (!plannedOn(l, a, date)) continue
    planned++
    if (reminderDone(l, a.id, date)) done++
  }
  return { done, planned }
}

// per-activity long-task focus minutes over a window
function activityFocusMins(l: Loaded, activityId: string, dates: string[]): number {
  const m = l.secsByActDate.get(activityId)
  if (!m) return 0
  let secs = 0
  for (const date of dates) secs += m.get(date) ?? 0
  return Math.round(secs / 60)
}

// 7-cell chronological strip for the calendar week, Mon→Sun (oldest→newest)
function weekStrip(l: Loaded, a: Activity, weekDates: string[]): WeekStripCell[] {
  return weekDates.map((date): WeekStripCell => {
    if (!plannedOn(l, a, date)) return "pending" // no occurrence that day
    if (date >= l.today) return reminderDone(l, a.id, date) ? "done" : "pending" // today not yet due-as-missed
    return reminderDone(l, a.id, date) ? "done" : "notdone"
  })
}

// weekly focus series over the last N weeks, oldest→newest
function focusTrend(l: Loaded, activityId?: string): { mins: number }[] {
  return weekWindows(l.today, TREND_WEEKS).map((dates) => ({
    mins: activityId ? activityFocusMins(l, activityId, dates) : focusMins(l, dates),
  }))
}

// buckets[weekday 0=Mon..6=Sun][hour 0..23] = minutes, from completed sessions.
// Minutes are SPREAD across every wall-clock hour the session actually spanned
// (start → start+total_secs), not dumped into the start hour — a noon→4pm session
// fills 12/1/2/3pm rather than spiking at noon and leaving the rest empty. Walks
// hour boundaries, so it rolls weekday at midnight (a late-night session lands on
// both days) and stays DST-safe. Summed minutes are unchanged — still exactly the
// focus-trend/amount total, just distributed instead of point-massed.
function heatmapBuckets(facts: SessionFact[]): number[][] {
  const b = Array.from({ length: 7 }, () => Array(24).fill(0))
  for (const f of facts) {
    let remaining = f.secs
    let cursor = new Date(f.startedAt).getTime()
    while (remaining > 0) {
      const cur = new Date(cursor)
      const nextHour = new Date(cursor)
      nextHour.setMinutes(0, 0, 0)
      nextHour.setHours(nextHour.getHours() + 1)
      const slice = Math.min(remaining, (nextHour.getTime() - cursor) / 1000)
      b[mondayIndex(cur.getDay())][cur.getHours()] += slice / 60
      cursor += slice * 1000
      remaining -= slice
    }
  }
  return b
}

// ── overview ──────────────────────────────────────────────────────────────────
export async function getStatsOverview(userId: string): Promise<StatsOverview> {
  const l = await load(userId)
  const weekDates = weekWindow(l.today, 0)
  const prevWeekDates = weekWindow(l.today, 1)

  const week = { ...adherence(l, weekDates), focusMins: focusMins(l, weekDates) }
  const prevWeek = { ...adherence(l, prevWeekDates), focusMins: focusMins(l, prevWeekDates) }

  // most-avoided: active reminder with the biggest done-gap this week (floored)
  let mostAvoided: StatsOverview["mostAvoided"] = null
  let bestGap = 0
  for (const a of l.activities) {
    if (a.archived || a.type !== "reminder") continue
    const { done, planned } = reminderTally(l, a, weekDates)
    if (planned < MOST_AVOIDED_MIN_PLANNED) continue
    const gap = planned - done
    if (gap > bestGap) {
      bestGap = gap
      mostAvoided = { activityId: a.id, name: a.name, type: a.type, done, planned }
    }
  }

  // weekday flake: not-done ÷ planned per weekday over the last N weeks (reminders).
  // Deliberately a rolling FLAKE_WEEKS*7-day window, NOT calendar-week-aligned like
  // the rest of stats: this is a per-weekday distribution, so week boundaries are
  // irrelevant — a trailing window just needs even, fresh samples per weekday.
  const flakeDates = rangeDates(l.today, FLAKE_WEEKS * 7)
  const flakePlanned = Array(7).fill(0)
  const flakeNotDone = Array(7).fill(0)
  for (const a of l.activities) {
    if (a.archived || a.type !== "reminder") continue
    for (const date of flakeDates) {
      const w = wd(date)
      if (!recursOn(a, date, w, l.revisionsByActivity.get(a.id) ?? []) || date >= l.today) continue // exclude today (not yet resolvable)
      const mi = mondayIndex(w)
      flakePlanned[mi]++
      if (!reminderDone(l, a.id, date)) flakeNotDone[mi]++
    }
  }
  const weekdayFlake = flakePlanned.map((p, i) => (p ? flakeNotDone[i] / p : 0))

  // per-activity rows: active (by position) then archived-with-history (by position)
  const active = l.activities.filter((a) => !a.archived).sort((a, b) => a.position - b.position)
  const archived = l.activities
    .filter((a) => a.archived)
    .filter((a) => l.factsByActivity.has(a.id) || l.activitiesWithCompletion.has(a.id))
    .sort((a, b) => a.position - b.position)

  const rows: ActivityStatRow[] = [
    ...active.map((a) => activeRow(l, a, weekDates, prevWeekDates)),
    ...archived.map(
      (a): ActivityStatRow => ({ activityId: a.id, name: a.name, type: a.type, archived: true, delta: "flat" }),
    ),
  ]

  return {
    week,
    prevWeek,
    weeksDown: weeksDown(l),
    mostAvoided,
    weekdayFlake,
    focusTrend: focusTrend(l),
    heatmap: heatmapBuckets(l.facts),
    activities: rows,
  }
}

function activeRow(l: Loaded, a: Activity, weekDates: string[], prevWeekDates: string[]): ActivityStatRow {
  if (a.type === "reminder") {
    const cur = reminderTally(l, a, weekDates)
    const prev = reminderTally(l, a, prevWeekDates)
    return {
      activityId: a.id,
      name: a.name,
      type: "reminder",
      archived: false,
      delta: deltaDir(cur.done, prev.done),
      done: cur.done,
      planned: cur.planned,
      weekStrip: weekStrip(l, a, weekDates),
    }
  }
  const cur = activityFocusMins(l, a.id, weekDates)
  const prev = activityFocusMins(l, a.id, prevWeekDates)
  const spark = (l.factsByActivity.get(a.id) ?? [])
    .slice() // don't mutate the shared grouped array
    .sort((x, y) => cmpStr(x.startedAt, y.startedAt)) // ISO strings sort chronologically
    .slice(-SPARK_SESSIONS)
    .map((f) => Math.round(f.secs / 60))
  return {
    activityId: a.id,
    name: a.name,
    type: "long_task",
    archived: false,
    delta: deltaDir(cur, prev),
    focusMins: cur,
    sparkline: spark,
  }
}

// ── per-activity detail ───────────────────────────────────────────────────────
export async function getStatsDetail(userId: string, activityId: string): Promise<StatsDetail | null> {
  const l = await load(userId)
  const a = l.activities.find((x) => x.id === activityId)
  if (!a) return null

  const weekDates = weekWindow(l.today, 0)
  const prevWeekDates = weekWindow(l.today, 1)

  const base = { activityId: a.id, name: a.name, type: a.type, archived: a.archived } as const

  if (a.type === "long_task") {
    const activityFacts = (l.factsByActivity.get(a.id) ?? [])
      .slice() // don't mutate the shared grouped array
      .sort((x, y) => cmpStr(y.startedAt, x.startedAt)) // newest first (ISO strings)
    const allSecs = activityFacts.reduce((s, f) => s + f.secs, 0)
    const sessionCount = activityFacts.length
    const allMins = Math.round(allSecs / 60)
    const sessions: SessionRecord[] = activityFacts.map((f) => {
      const d = new Date(f.startedAt)
      return {
        id: f.startedAt + f.activityId,
        date: fmtMonthDay(d),
        time: nowTimeLocal(d),
        mins: Math.round(f.secs / 60),
        goalMet: f.goalMet,
      }
    })
    return {
      ...base,
      week: { focusMins: activityFocusMins(l, a.id, weekDates) },
      prevWeek: { focusMins: activityFocusMins(l, a.id, prevWeekDates) },
      allTime: { focusMins: allMins, sessionCount, avgMins: sessionCount ? Math.round(allMins / sessionCount) : 0 },
      focusTrend: focusTrend(l, a.id),
      heatmap: heatmapBuckets(activityFacts),
      sessions,
    }
  }

  // reminder detail: adherence + completion log
  const cur = reminderTally(l, a, weekDates)
  const prev = reminderTally(l, a, prevWeekDates)
  const adherenceTrend = weekWindows(l.today, TREND_WEEKS).map((dates) => {
    const t = reminderTally(l, a, dates)
    return t.planned ? t.done / t.planned : 0
  })

  // walk back day-by-day collecting resolved occurrences (excludes today)
  const completionLog: CompletionRecord[] = []
  for (let i = 1; completionLog.length < LOG_LIMIT && i <= 365; i++) {
    const date = shiftDate(l.today, -i)
    if (date < a.recurrence_start) break
    if (!plannedOn(l, a, date)) continue
    const status = l.completionByKey.get(`${a.id}|${date}`)?.status ?? "missed"
    completionLog.push({ id: date, date: fmtMonthDay(parseLocalDate(date)), status })
  }

  return {
    ...base,
    weekAdherence: { done: cur.done, planned: cur.planned },
    prevWeekAdherence: { done: prev.done, planned: prev.planned },
    adherenceTrend,
    completionLog,
  }
}
