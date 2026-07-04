import { useState } from "react"

import { createActivity } from "@/db/repo"
import { nextHourLocal, nowTimeLocal, todayLocal } from "@/db/recurrence"
import type { Activity, ActivityType, ReminderType, TaskMode } from "@/db/types"

type FieldErrors = {
  name?: string
  recurrenceDays?: string
  strictTime?: string
  softWindow?: string
  goalDuration?: string
  form?: string
}

// All create-activity state/validation/submit, no JSX — mirrors useAuthForm.ts.
// One hook backs both the mobile and desktop layouts so state survives a
// resize across the lg breakpoint while the dialog is open.
export function useNewActivityForm(userId: string, onCreated: (type: ActivityType) => void) {
  const [name, setName] = useState("")
  const [type, setType] = useState<ActivityType>("reminder")
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6])
  const [recurrenceStart, setRecurrenceStart] = useState(todayLocal())

  const [reminderType, setReminderType] = useState<ReminderType>("strict")
  const [strictTime, setStrictTime] = useState(nextHourLocal())
  const [softStart, setSoftStart] = useState("08:00")
  const [softEnd, setSoftEnd] = useState("20:00")
  const [softIntervalMins, setSoftIntervalMins] = useState(60)
  const [softIntervalCustom, setSoftIntervalCustom] = useState(false)

  const [defaultMode, setDefaultMode] = useState<TaskMode>("goal")
  const [goalDurationMins, setGoalDurationMins] = useState(30)
  const [goalDurationCustom, setGoalDurationCustom] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})

  const isStrict = type === "reminder" && reminderType === "strict"
  const isSoft = type === "reminder" && reminderType === "soft"

  // A reminder that starts today can't fire earlier than now; a future start
  // date lifts the floor entirely (undefined = no restriction).
  const strictMinTime = recurrenceStart === todayLocal() ? nowTimeLocal() : undefined

  function validate(): boolean {
    const next: FieldErrors = {}
    if (!name.trim()) next.name = "Required"
    if (recurrenceDays.length === 0) next.recurrenceDays = "Pick at least one day"
    if (isStrict) {
      if (!strictTime) next.strictTime = "Pick a time"
      else if (strictMinTime && strictTime < strictMinTime) next.strictTime = "That time's already passed"
    }
    if (isSoft) {
      if (!softIntervalMins || softIntervalMins <= 0) next.softWindow = "Pick an interval"
      else if (softStart >= softEnd) next.softWindow = "Until must be after From"
    }
    if (type === "long_task" && defaultMode === "goal" && (!goalDurationMins || goalDurationMins <= 0)) {
      next.goalDuration = "Pick a duration"
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function submit() {
    if (submitting || !validate()) return
    setSubmitting(true)
    try {
      const input: Omit<Activity, "id" | "user_id" | "created_at" | "updated_at" | "position" | "archived"> = {
        name: name.trim(),
        type,
        recurrence_days: recurrenceDays,
        recurrence_start: recurrenceStart,
        reminder_type: type === "reminder" ? reminderType : null,
        strict_time: isStrict ? strictTime : null,
        soft_start: isSoft ? softStart : null,
        soft_end: isSoft ? softEnd : null,
        soft_interval_mins: isSoft ? softIntervalMins : null,
        default_mode: type === "long_task" ? defaultMode : null,
        goal_duration_mins: type === "long_task" && defaultMode === "goal" ? goalDurationMins : null,
      }
      await createActivity(userId, input)
      onCreated(type)
    } catch (err) {
      setErrors({
        form: err instanceof Error ? err.message : "Something went wrong. Try again.",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return {
    name,
    setName,
    type,
    setType,
    recurrenceDays,
    setRecurrenceDays,
    recurrenceStart,
    setRecurrenceStart,

    reminderType,
    setReminderType,
    strictTime,
    setStrictTime,
    strictMinTime,
    softStart,
    setSoftStart,
    softEnd,
    setSoftEnd,
    softIntervalMins,
    setSoftIntervalMins,
    softIntervalCustom,
    setSoftIntervalCustom,

    defaultMode,
    setDefaultMode,
    goalDurationMins,
    setGoalDurationMins,
    goalDurationCustom,
    setGoalDurationCustom,

    submitting,
    errors,
    submit,
  }
}

export type NewActivityForm = ReturnType<typeof useNewActivityForm>
