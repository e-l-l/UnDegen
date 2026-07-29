import assert from "node:assert/strict"
import test from "node:test"

import { dayAccess } from "../src/features/today/dayAccess.ts"

test("past days allow reminder completion updates without enabling session starts", () => {
  assert.deepEqual(dayAccess("2026-07-28", "2026-07-29"), {
    canUpdateReminders: true,
    canRunSessions: false,
  })
})

test("today allows reminder completion updates and session starts", () => {
  assert.deepEqual(dayAccess("2026-07-29", "2026-07-29"), {
    canUpdateReminders: true,
    canRunSessions: true,
  })
})

test("future days remain fully review-only", () => {
  assert.deepEqual(dayAccess("2026-07-30", "2026-07-29"), {
    canUpdateReminders: false,
    canRunSessions: false,
  })
})
