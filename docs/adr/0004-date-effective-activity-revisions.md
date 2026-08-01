# 4. Date-effective activity revisions

Date: 2026-08-01
Status: Accepted

## Context

ADR 0001 made recurring occurrences derived from an activity's rule. Keeping the
whole rule on one mutable `activities` row meant a schedule edit also changed every
unmaterialised historical date. That made historical Stats unstable and made it
impossible to say “use this schedule from today onward” without pre-materialising
occurrences.

The app must also remain compatible with installed PWAs that only understand the
original `activities` columns.

## Decision

- Stable identity remains on `activities`: ID, owner, name, immutable type,
  immutable original `recurrence_start`, position, archive state and activity-wide
  exception dates.
- Schedule and type-specific configuration lives in `activity_revisions`, unique
  on `(activity_id, effective_from)`. A read resolves the latest revision whose
  effective date is not after the calendar date being viewed.
- Before the immutable original start, the activity has no occurrence. A future
  activity edit updates its initial revision; a started activity edit upserts a
  revision effective today. Same-day cross-device saves use a compound-key upsert,
  so the last synced save wins.
- The original configuration columns stay on `activities` as a latest-value mirror.
  New reads prefer revisions and fall back to the mirror when none exists; new
  writes update both. Removing the mirror is a later installed-client compatibility
  cleanup.
- Names are not revised. Renaming intentionally relabels all history. Type and
  original start remain immutable. Exception dates remain activity-wide and are
  never removed by a later edit.
- A same-day revision applies to the whole date for recurrence and Stats. Existing
  completion/session rows stay attached. Running sessions retain their snapshotted
  goal; sessions started later snapshot the new revision.
- The notification alarm resolves the user's local-date revision. When that
  revision became effective today, slots at or before its server-side save minute
  are suppressed; remaining slots may fire. The random seed remains
  `(activity_id, local_date)` and `notification_log` remains the idempotency boundary.

This supersedes only ADR 0001's consequence that edits rewrite unmaterialised
history, and the earlier single-row configuration storage choice. The calendar
derive-on-read model itself is unchanged.

## Consequences

Historical planned dates and Stats are stable across later schedule edits, while
Today updates immediately and no occurrence rows are pre-created. Reads now need a
small revision lookup, and writes carry a compatibility mirror until old installed
clients can be retired.

## Alternatives rejected

- **Rewrite the activity row only:** preserves compatibility but keeps mutable history.
- **Copy occurrences forward:** violates derive-on-read and creates lifecycle/cleanup work.
- **Revise names and type too:** makes identity unstable and complicates historical joins;
  names are intentionally global labels and type changes are a different activity.
