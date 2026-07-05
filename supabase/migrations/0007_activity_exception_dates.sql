-- 0007_activity_exception_dates.sql
-- Single-occurrence removal ("delete this day only"). A date listed here is
-- skipped by the recurrence expansion — the occurrence stops deriving on that
-- date without touching the rule or archiving the whole activity.
--
-- Evaluated per-user against the *local* date in both the app
-- (frontend/src/db/recurrence.ts) and the notification Edge Function
-- (send-notifications/schedule.ts recursOn) — never as a server-side WHERE,
-- since each user's "today" differs by timezone. Resolves the exception_dates
-- open question earmarked in 0001 / CLAUDE.md.

alter table activities
  add column exception_dates date[] not null default '{}';
