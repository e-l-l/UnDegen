import { useState } from "react"

import { createActivity } from "@/db/repo"
import { defaultStartTimeLocal, hourAfterLocal, nowTimeLocal, todayLocal } from "@/db/recurrence"
import type { ActivityType, NewActivityInput, ReminderType, TaskMode } from "@/db/types"

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
  const [strictTime, setStrictTime] = useState(() => defaultStartTimeLocal())
  const [softStart, setSoftStart] = useState(() => defaultStartTimeLocal())
  const [softEnd, setSoftEnd] = useState(() => hourAfterLocal(defaultStartTimeLocal()))
  const [softIntervalMins, setSoftIntervalMins] = useState(60)
  const [softIntervalCustom, setSoftIntervalCustom] = useState(false)

  const [defaultMode, setDefaultMode] = useState<TaskMode>("goal")
  const [goalDurationMins, setGoalDurationMins] = useState(30)
  const [goalDurationCustom, setGoalDurationCustom] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})

  const isStrict = type === "reminder" && reminderType === "strict"
  const isSoft = type === "reminder" && reminderType === "soft"
  // 'random' fires once at a seeded time inside a window — reuses the soft
  // window (soft_start/soft_end) but has no interval.
  const isRandom = type === "reminder" && reminderType === "random"
  // soft + random both store their bounds in soft_start/soft_end; only soft
  // also carries an interval.
  const usesSoftWindow = isSoft || isRandom

  // A reminder that starts today can't fire earlier than now; a future start
  // date lifts the floor entirely (undefined = no restriction). Shared by the
  // strict time and both ends of the soft window.
  const reminderMinTime = recurrenceStart === todayLocal() ? nowTimeLocal() : undefined

  function validate(): boolean {
    const next: FieldErrors = {}
    if (!name.trim()) next.name = "Required"
    if (recurrenceDays.length === 0) next.recurrenceDays = "Pick at least one day"
    if (isStrict) {
      if (!strictTime) next.strictTime = "Pick a time"
      else if (reminderMinTime && strictTime < reminderMinTime) next.strictTime = "That time's already passed"
    }
    if (usesSoftWindow) {
      if (isSoft && (!softIntervalMins || softIntervalMins <= 0)) next.softWindow = "Pick an interval"
      else if (softStart >= softEnd) next.softWindow = "Until must be after From"
      else if (reminderMinTime && softStart < reminderMinTime) next.softWindow = "That window's already started"
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
      const input: NewActivityInput = {
        name: name.trim(),
        type,
        recurrence_days: recurrenceDays,
        recurrence_start: recurrenceStart,
        reminder_type: type === "reminder" ? reminderType : null,
        strict_time: isStrict ? strictTime : null,
        soft_start: usesSoftWindow ? softStart : null,
        soft_end: usesSoftWindow ? softEnd : null,
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
    reminderMinTime,
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
