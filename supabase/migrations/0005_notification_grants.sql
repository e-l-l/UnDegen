-- Undegen — grant DML on the notification tables (fix for missing grants).
--
-- 0003 created user_settings / push_subscriptions / notification_log with RLS
-- owner-only policies, but the tables never received table-level DML grants for
-- the PostgREST roles. PostgREST checks the base-table GRANT *before* RLS, so
-- every authenticated client write returned 403 (Forbidden), and the service-role
-- Edge Function could not read them either. RLS still restricts every row to its
-- owner (auth.uid()); these grants only make the tables reachable at all.
--
-- Why 0003 missed them: 0001's tables received these grants via Supabase's
-- default-privilege auto-grant; 0003 was applied through a path where that didn't
-- fire. Granting explicitly here so correctness never depends on that again — new
-- environments should apply 0003 then 0005.

begin;

grant select, insert, update, delete
  on public.user_settings, public.push_subscriptions, public.notification_log
  to authenticated, service_role;

commit;
