# 3. Server-side push firing engine — poll-and-compute, per-user timezone, claim-then-send

Date: 2026-07-04

## Context

ADR 0001 settled that reminder **alarms are server-side** (they must fire on days the app
is never opened) and read `activities` directly. This ADR settles *how* that engine works.

Three sub-decisions carried real trade-offs, and the design cuts against instincts a future
reader will have — hence recording them.

Two hard facts forced the shape:
1. A reminder's time is a **zoneless wall-clock string** (`strict_time = '08:00'`), and
   `pg_cron` runs in **UTC**. The server cannot place "08:00 *your* time" without knowing the
   user's timezone — and there was **no timezone anywhere** in the schema or client.
2. Web Push is best-effort and cron can jitter/retry, so "fire exactly once per occurrence"
   is not free.

## Decision

- **Timezone: a per-user IANA string in a new `user_settings` table.** Captured client-side
  via `Intl.DateTimeFormat().resolvedOptions().timeZone`, last-device-wins. IANA (not a UTC
  offset) so DST resolves for free via `AT TIME ZONE`. Not per-device (two devices in two
  zones make "08:00" ambiguous) and not per-activity (nobody sets per-reminder zones).

- **Engine: poll-and-compute, no stored schedule.** `pg_cron` fires the
  `send-notifications` Edge Function every minute as a dumb heartbeat; the function derives
  who is due *now* in each user's local time (porting the frontend's `recursOn`). This
  matches the project's "derive on read, don't store derived values" rule (ADR 0001) — a
  precomputed `next_fire_at` would be stored derived state to recompute on every activity
  edit, tz change, and DST transition.

- **Soft reminders are completion-aware.** Nudge slots step `soft_start → soft_end` by
  `soft_interval_mins`; the function silences remaining nudges once the occurrence is
  done/skipped that day (left-join to `completions`). Strict reminders fire once, regardless.

- **Idempotency: claim-then-send via `notification_log`.** Unique `(activity_id, local_date,
  slot)`. The function claims a slot with `insert … on conflict do nothing` and only sends if
  it won — *at-most-once*. A ~12-minute lookback window absorbs cron jitter / brief outages.

- **Auth: shared-secret, not user JWT.** `verify_jwt` is off; the cron sends an
  `x-cron-secret` header the function validates. The function uses the service role (bypasses
  RLS) to read across users.

## Consequences

**Positive**
- No stored schedule to keep consistent; the engine and the client expand the same rules.
- DST-correct without any timestamp recomputation.
- Duplicate suppression is a single unique constraint; a jittery or briefly-down cron
  self-heals on the next tick without double-sending.

**Negative / accepted trade-offs**
- The function does a small full scan of reminders-with-subscriptions every minute (trivial
  at this scale; optimise later if needed).
- *At-most-once* means a rare silent miss if a push send fails after the slot is claimed —
  chosen deliberately: a duplicate "go to the gym" erodes trust in a calm app more than a
  rare miss.
- A user with no `user_settings.timezone` gets no notifications until the client captures it
  (happens on app load / on subscribe).

## Alternatives rejected

- **Precompute `next_fire_at`:** stored derived state, against ADR 0001; must be rebuilt on
  every edit/tz-change/DST.
- **Timezone per-device or per-activity:** ambiguous "08:00", or needless config bloat.
- **Client-side local scheduling:** iOS PWAs can't schedule notifications while closed — the
  exact case that matters. See the plan's mechanism decision.
