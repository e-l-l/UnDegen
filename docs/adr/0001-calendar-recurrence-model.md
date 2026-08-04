# 1. Calendar-style recurrence — derive occurrences, don't pre-materialise

Date: 2026-07-01
Status: Accepted

## Context

Undegen's core objects (`activities`) recur — "gym Mon/Wed/Fri", "meds daily 9am". We
needed to decide how a recurring activity's **per-day instances** come into being, since
`completions` and `work_sessions` foreign-key to a `day_activities` row.

Three models were on the table:

- **A — on-open, today-only:** create today's `day_activities` when the app opens.
- **B — windowed pre-materialise:** batch-create rows for the week ahead.
- **C — calendar model:** keep the recurrence rule on the activity; **derive** occurrences
  on read; persist a `day_activities` row only when an instance diverges/gains state
  (like a calendar persisting only overrides of a recurring event).

Two constraints shaped the choice:
1. The project rule "compute derived values on read, don't store them" (streaks, rates).
2. Reminders must **alarm even on days the app is never opened** — so notification firing
   cannot depend on any per-day row existing.

## Decision

Adopt **model C**.

- `activities` plus its date-effective `activity_revisions` are the source of truth
  for recurrence. No occurrences are stored in advance. (ADR 0004 supersedes the
  original single-row configuration detail.)
- A date's view is **derived** by expanding the rules over that date and left-joining
  whatever state already exists.
- A `day_activities` row (and its parent `days` row) is **lazily instantiated only when an
  instance gains state**: completing a reminder, starting a work session, or manually
  adding an activity to a date it doesn't recur on.
- **"Skip" = `completion.status = 'skipped'`** (a cancelled-occurrence override). **"Missed"
  is derived, never written by the client** (due-by-rule on a past date with no
  completion-bearing row).
- `days` is **sparse / engagement-based** — created only when a date acquires state.
- The **alarm is server-side** (`pg_cron` + Edge Function) reading `activities` directly,
  independent of materialisation.

## Consequences

**Positive**
- Matches "derive on read"; no empty-row bloat or scheduled batch-materialise trigger.
- `activities` is the one source both the view (client) and the alarm (server) expand from.
- Sparse `days`/`day_activities` stay honest — a row means real engagement.

**Negative / accepted trade-offs**
- The view expands rules on every read (trivial for a handful of activities; rows are fetched from Supabase).
- Schedule edits are date-effective and do not rewrite earlier derived history. See
  ADR 0004. `recurrence_start` remains the immutable lower bound.
- The `missed` enum value is unused by the client (reserved for a possible future server sweep).

## Alternatives rejected

- **A (today-only):** past unopened days have no rows, so missed-detection still needs
  rule-replay anyway — C generalises this cleanly to any date.
- **B (windowed pre-materialise):** creates empty future rows (the same derive-on-read
  violation, pointed forward) and adds unnecessary lifecycle/background-trigger work.
