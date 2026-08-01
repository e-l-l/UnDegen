import { useMemo, useState } from "react"

import { activityConfig } from "@/db/activityRevisions"
import { editActivity } from "@/db/repo"
import { todayLocal } from "@/db/recurrence"
import type { Activity, ActivityRevisionConfig, ReminderType, TaskMode } from "@/db/types"

type FieldErrors = {
  name?: string
  recurrenceDays?: string
  strictTime?: string
  softWindow?: string
  goalDuration?: string
  form?: string
}

function sameDraft(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function useEditActivityForm(activity: Activity, onSaved: () => void) {
  const initial = useMemo(() => {
    const config = activityConfig(activity)
    return {
      name: activity.name,
      recurrence_days: config.recurrence_days,
      reminder_type: activity.type === "reminder" ? (config.reminder_type ?? "strict") : null,
      strict_time: activity.type === "reminder" && config.reminder_type === "strict" ? config.strict_time : null,
      soft_start: activity.type === "reminder" && config.reminder_type !== "strict" ? config.soft_start : null,
      soft_interval_mins: activity.type === "reminder" && config.reminder_type === "soft" ? config.soft_interval_mins : null,
      soft_end: activity.type === "reminder" && config.reminder_type !== "strict" ? config.soft_end : null,
      default_mode: activity.type === "long_task" ? (config.default_mode ?? "goal") : null,
      goal_duration_mins: activity.type === "long_task" && config.default_mode === "goal" ? config.goal_duration_mins : null,
    }
  }, [activity])
  const [name, setName] = useState(activity.name)
  const [recurrenceDays, setRecurrenceDays] = useState([...activity.recurrence_days])
  const [reminderType, setReminderType] = useState<ReminderType>(activity.reminder_type ?? "strict")
  const [strictTime, setStrictTime] = useState(activity.strict_time ?? "09:00")
  const [softStart, setSoftStart] = useState(activity.soft_start ?? "09:00")
  const [softEnd, setSoftEnd] = useState(activity.soft_end ?? "17:00")
  const [softIntervalMins, setSoftIntervalMins] = useState(activity.soft_interval_mins ?? 60)
  const [softIntervalCustom, setSoftIntervalCustom] = useState(false)
  const [defaultMode, setDefaultMode] = useState<TaskMode>(activity.default_mode ?? "goal")
  const [goalDurationMins, setGoalDurationMins] = useState(activity.goal_duration_mins ?? 30)
  const [goalDurationCustom, setGoalDurationCustom] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})

  const isStrict = activity.type === "reminder" && reminderType === "strict"
  const isSoft = activity.type === "reminder" && reminderType === "soft"
  const usesSoftWindow = activity.type === "reminder" && reminderType !== "strict"
  const config: ActivityRevisionConfig = {
    recurrence_days: recurrenceDays,
    reminder_type: activity.type === "reminder" ? reminderType : null,
    strict_time: isStrict ? strictTime : null,
    soft_start: usesSoftWindow ? softStart : null,
    soft_interval_mins: isSoft ? softIntervalMins : null,
    soft_end: usesSoftWindow ? softEnd : null,
    default_mode: activity.type === "long_task" ? defaultMode : null,
    goal_duration_mins:
      activity.type === "long_task" && defaultMode === "goal" ? goalDurationMins : null,
  }
  const draft = { name: name.trim(), ...config }

  function currentFieldErrors(): FieldErrors {
    const next: FieldErrors = {}
    if (!name.trim()) next.name = "Required"
    if (recurrenceDays.length === 0) next.recurrenceDays = "Pick at least one day"
    if (isStrict && !strictTime) next.strictTime = "Pick a time"
    if (usesSoftWindow) {
      if (isSoft && (!softIntervalMins || softIntervalMins <= 0)) next.softWindow = "Pick an interval"
      else if (softStart >= softEnd) next.softWindow = "Until must be after From"
    }
    if (activity.type === "long_task" && defaultMode === "goal" && goalDurationMins <= 0) {
      next.goalDuration = "Pick a duration"
    }
    return next
  }

  const dirty = !sameDraft(initial, draft)
  const liveErrors = currentFieldErrors()
  const valid = Object.keys(liveErrors).length === 0

  async function submit() {
    if (!dirty || !valid || submitting) return
    setSubmitting(true)
    try {
      await editActivity(activity.id, { name, config }, todayLocal())
      onSaved()
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : "Something went wrong. Try again." })
    } finally {
      setSubmitting(false)
    }
  }

  return {
    activity, name, setName, recurrenceDays, setRecurrenceDays,
    reminderType, setReminderType, strictTime, setStrictTime,
    softStart, setSoftStart, softEnd, setSoftEnd,
    softIntervalMins, setSoftIntervalMins, softIntervalCustom, setSoftIntervalCustom,
    defaultMode, setDefaultMode, goalDurationMins, setGoalDurationMins,
    goalDurationCustom, setGoalDurationCustom,
    errors: { ...errors, ...liveErrors }, dirty, valid, submitting, submit,
  }
}

export type EditActivityForm = ReturnType<typeof useEditActivityForm>
