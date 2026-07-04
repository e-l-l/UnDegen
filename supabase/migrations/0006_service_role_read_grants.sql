-- Undegen — grant service_role SELECT on the tables the alarm reads.
--
-- The send-notifications Edge Function runs as service_role and reads activities
-- (every tick) plus days / day_activities / completions (soft-reminder
-- completion check). Those tables had SELECT for `authenticated` (so the client
-- app worked) but NOT for `service_role` — they only carried
-- REFERENCES/TRIGGER/TRUNCATE. PostgREST checks the base-table grant before RLS,
-- so the function's `from("activities").select(...)` was denied; the handler
-- swallows the error (`data ?? []`), so `due` came back empty and every cron tick
-- returned {"sent":0} with no error and an empty notification_log. Reminders
-- never fired.
--
-- Same failure class as 0005 (missing grants), different tables: 0005 covered the
-- three 0003 notification tables; this covers the pre-existing data tables the
-- function reads. service_role bypasses RLS but still needs the table grant.
-- SELECT only — the function never writes these tables.

begin;

grant select
  on public.activities, public.days, public.day_activities, public.completions
  to service_role;

commit;
