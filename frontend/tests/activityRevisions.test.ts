import assert from "node:assert/strict"
import test from "node:test"

import { effectiveEditDate, resolveActivity, selectActivityRevision } from "../src/db/activityRevisions.ts"
import { recursOn } from "../src/db/recurrence.ts"
import type { Activity, ActivityRevision } from "../src/db/types.ts"

const activity: Activity = {
  id: "a1", user_id: "u1", name: "Gym", type: "reminder",
  recurrence_days: [1], recurrence_start: "2026-08-10", exception_dates: [],
  archived: false, position: 0, reminder_type: "strict", strict_time: "08:00",
  created_at: "2026-08-01T00:00:00Z", updated_at: "2026-08-01T00:00:00Z",
}

const revision = (id: string, effective_from: string, days: number[], time: string): ActivityRevision => ({
  id, activity_id: activity.id, effective_from, recurrence_days: days,
  reminder_type: "strict", strict_time: time, soft_start: null,
  soft_interval_mins: null, soft_end: null, default_mode: null,
  goal_duration_mins: null, created_at: `${effective_from}T00:00:00Z`, updated_at: `${effective_from}T00:00:00Z`,
})

test("revision selection uses the latest configuration effective on the viewed date", () => {
  const revisions = [revision("r1", "2026-08-10", [1], "08:00"), revision("r2", "2026-08-17", [3], "09:00")]
  assert.equal(selectActivityRevision(revisions, "2026-08-16")?.id, "r1")
  assert.equal(selectActivityRevision(revisions, "2026-08-17")?.id, "r2")
  assert.equal(resolveActivity(activity, revisions, "2026-08-17")?.strict_time, "09:00")
})

test("dates before the immutable original start produce no resolved activity", () => {
  assert.equal(resolveActivity(activity, [revision("r1", "2026-08-10", [1], "08:00")], "2026-08-09"), undefined)
})

test("legacy configuration remains the fallback when no revision exists", () => {
  assert.equal(resolveActivity(activity, [], "2026-08-10")?.strict_time, "08:00")
})

test("a future activity edits its initial revision; a started activity edits today", () => {
  assert.equal(effectiveEditDate(activity, "2026-08-01"), "2026-08-10")
  assert.equal(effectiveEditDate(activity, "2026-08-12"), "2026-08-12")
})

test("recurrence uses the revision for each historical date while preserving exceptions and archive state", () => {
  const revisions = [
    revision("r1", "2026-08-10", [1], "08:00"),
    revision("r2", "2026-08-17", [2], "09:00"),
  ]
  assert.equal(recursOn(activity, "2026-08-10", 1, revisions), true)
  assert.equal(recursOn(activity, "2026-08-17", 1, revisions), false)
  assert.equal(recursOn(activity, "2026-08-18", 2, revisions), true)
  assert.equal(recursOn({ ...activity, exception_dates: ["2026-08-18"] }, "2026-08-18", 2, revisions), false)
  assert.equal(recursOn({ ...activity, archived: true }, "2026-08-18", 2, revisions), false)
})
