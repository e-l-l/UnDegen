import type {
  Activity,
  ActivityRevision,
  ActivityRevisionConfig,
  DateResolvedActivity,
} from "./types"

const configKeys = [
  "recurrence_days",
  "reminder_type",
  "strict_time",
  "soft_start",
  "soft_interval_mins",
  "soft_end",
  "default_mode",
  "goal_duration_mins",
] as const satisfies readonly (keyof ActivityRevisionConfig)[]

export function activityConfig(activity: Activity): ActivityRevisionConfig {
  return Object.fromEntries(configKeys.map((key) => [key, activity[key]])) as ActivityRevisionConfig
}

export function revisionConfig(revision: ActivityRevision): ActivityRevisionConfig {
  return Object.fromEntries(configKeys.map((key) => [key, revision[key]])) as ActivityRevisionConfig
}

export function selectActivityRevision(
  revisions: readonly ActivityRevision[],
  date: string
): ActivityRevision | undefined {
  let selected: ActivityRevision | undefined
  for (const revision of revisions) {
    if (revision.effective_from <= date && (!selected || revision.effective_from > selected.effective_from)) {
      selected = revision
    }
  }
  return selected
}

export function groupActivityRevisions(
  revisions: readonly ActivityRevision[]
): Map<string, ActivityRevision[]> {
  const grouped = new Map<string, ActivityRevision[]>()
  for (const revision of revisions) {
    const list = grouped.get(revision.activity_id) ?? []
    list.push(revision)
    grouped.set(revision.activity_id, list)
  }
  return grouped
}

// Before the immutable original start there is no configuration/occurrence.
// Rows without revisions use the legacy columns for installed-client compatibility.
export function resolveActivity(
  activity: Activity,
  revisions: readonly ActivityRevision[],
  date: string
): DateResolvedActivity | undefined {
  if (date < activity.recurrence_start) return undefined
  const revision = selectActivityRevision(revisions, date)
  if (!revision) return activity
  return {
    ...activity,
    ...revisionConfig(revision),
    revision_effective_from: revision.effective_from,
    revision_updated_at: revision.updated_at,
  }
}

export function effectiveEditDate(activity: Activity, today: string): string {
  return today < activity.recurrence_start ? activity.recurrence_start : today
}
