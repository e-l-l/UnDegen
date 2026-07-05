// Deno tests for the pure scheduling logic. Run: deno test (from this dir).
import { assertEquals } from "@std/assert"

import {
  buildPayload,
  dueSlots,
  formatHHMM,
  localContext,
  parseHHMM,
  recursOn,
  type ReminderActivity,
} from "./schedule.ts"

function reminder(partial: Partial<ReminderActivity>): ReminderActivity {
  return {
    id: "a1",
    user_id: "u1",
    name: "Gym",
    reminder_type: "strict",
    strict_time: null,
    soft_start: null,
    soft_interval_mins: null,
    soft_end: null,
    recurrence_days: [0, 1, 2, 3, 4, 5, 6],
    recurrence_start: "2020-01-01",
    exception_dates: [],
    ...partial,
  }
}

Deno.test("localContext resolves zone-local date/minute/weekday", () => {
  // 2021-01-01T00:00Z in New York (UTC-5) is 2020-12-31 19:00, a Thursday (4).
  const ny = localContext(new Date("2021-01-01T00:00:00Z"), "America/New_York")
  assertEquals(ny.date, "2020-12-31")
  assertEquals(ny.minutes, 19 * 60)
  assertEquals(ny.weekday, 4)

  // Same instant +8:30 in UTC and Kolkata for a clean cross-check.
  const utc = localContext(new Date("2021-01-01T08:30:00Z"), "UTC")
  assertEquals(utc.date, "2021-01-01")
  assertEquals(utc.minutes, 8 * 60 + 30)
  assertEquals(utc.weekday, 5) // Friday
})

Deno.test("parseHHMM handles HH:MM and HH:MM:SS", () => {
  assertEquals(parseHHMM("08:00"), 480)
  assertEquals(parseHHMM("08:00:00"), 480)
  assertEquals(parseHHMM("23:59"), 1439)
  assertEquals(parseHHMM(null), null)
  assertEquals(parseHHMM(""), null)
})

Deno.test("formatHHMM zero-pads", () => {
  assertEquals(formatHHMM(0), "00:00")
  assertEquals(formatHHMM(480), "08:00")
  assertEquals(formatHHMM(1439), "23:59")
})

Deno.test("recursOn matches weekday and start date", () => {
  const a = reminder({ recurrence_days: [5], recurrence_start: "2021-01-01" })
  assertEquals(recursOn(a, { date: "2021-01-01", minutes: 0, weekday: 5 }), true)
  assertEquals(recursOn(a, { date: "2021-01-01", minutes: 0, weekday: 4 }), false)
  // before recurrence_start
  assertEquals(recursOn(a, { date: "2020-12-31", minutes: 0, weekday: 5 }), false)
})

Deno.test("recursOn skips a date in exception_dates (delete this day only)", () => {
  const a = reminder({ recurrence_days: [5], recurrence_start: "2021-01-01", exception_dates: ["2021-01-08"] })
  // The rule still fires on other matching dates…
  assertEquals(recursOn(a, { date: "2021-01-01", minutes: 0, weekday: 5 }), true)
  // …but the excepted date is skipped even though the weekday/start match.
  assertEquals(recursOn(a, { date: "2021-01-08", minutes: 0, weekday: 5 }), false)
})

Deno.test("dueSlots strict: single fire inside the lookback window", () => {
  const a = reminder({ reminder_type: "strict", strict_time: "08:00" })
  assertEquals(dueSlots(a, 480, 12), [480]) // exactly now
  assertEquals(dueSlots(a, 481, 12), [480]) // 1 min late — still caught
  assertEquals(dueSlots(a, 495, 12), []) // 15 min late — outside window
  assertEquals(dueSlots(a, 479, 12), []) // not yet due
})

Deno.test("dueSlots soft: nudge slots across the window", () => {
  const a = reminder({
    reminder_type: "soft",
    soft_start: "09:00",
    soft_interval_mins: 60,
    soft_end: "12:00",
  })
  assertEquals(dueSlots(a, 540, 12), [540]) // 09:00 slot
  assertEquals(dueSlots(a, 601, 12), [600]) // 10:00 slot, caught 1 min late
  assertEquals(dueSlots(a, 725, 12), [720]) // 12:00 end slot included
  assertEquals(dueSlots(a, 800, 12), []) // past the window
})

Deno.test("dueSlots soft: multiple slots can land in one window", () => {
  const a = reminder({
    reminder_type: "soft",
    soft_start: "10:00",
    soft_interval_mins: 5,
    soft_end: "11:00",
  })
  assertEquals(dueSlots(a, 610, 12), [600, 605, 610])
})

Deno.test("dueSlots soft: invalid config yields nothing (no infinite loop)", () => {
  assertEquals(
    dueSlots(reminder({ reminder_type: "soft", soft_start: "09:00", soft_interval_mins: 0, soft_end: "12:00" }), 600, 12),
    []
  )
  assertEquals(
    dueSlots(reminder({ reminder_type: "soft", soft_start: "12:00", soft_interval_mins: 30, soft_end: "09:00" }), 600, 12),
    []
  )
})

Deno.test("buildPayload: dry copy + occurrence tag", () => {
  const strict = buildPayload(reminder({ reminder_type: "strict", name: "Meds" }), 1200, "2026-07-04")
  assertEquals(strict.title, "Meds")
  assertEquals(strict.body, "It's 20:00. You said you would.")
  assertEquals(strict.tag, "a1:2026-07-04")

  const soft = buildPayload(reminder({ reminder_type: "soft" }), 600, "2026-07-04")
  assertEquals(soft.body, "Still on the list. It's on you.")
})
