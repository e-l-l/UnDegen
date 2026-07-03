-- Undegen — notification alarm schedule (see docs/adr/0003).
--
-- Runs the send-notifications Edge Function once a minute. The function is a dumb
-- heartbeat target: pg_cron fires it, the function computes who's due. Auth is a
-- shared secret in the x-cron-secret header (validated inside the function).
--
-- ⚠️ ONE-TIME SETUP, run AFTER `supabase functions deploy send-notifications`.
-- It references your project's function URL and a secret, so the two <PLACEHOLDER>
-- values below must be filled in. The cron_secret here MUST equal the CRON_SECRET
-- you set with `supabase secrets set CRON_SECRET=…`.
--
-- Re-applying: cron.schedule upserts by job name; vault.create_secret errors if the
-- name already exists — use vault.update_secret to change a value.

-- ── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ── Secrets (Vault) — keep the URL and cron secret out of the job definition ──
-- Replace both placeholders before running.
select vault.create_secret(
  'https://<YOUR-PROJECT-REF>.supabase.co/functions/v1/send-notifications',
  'send_notifications_url'
);
select vault.create_secret(
  '<YOUR-CRON-SECRET>',  -- must match `supabase secrets set CRON_SECRET=…`
  'cron_secret'
);

-- ── Schedule: every minute ───────────────────────────────────────────────────
select cron.schedule(
  'fire-notifications',
  '* * * * *',
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'send_notifications_url'),
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body    := jsonb_build_object('invoked_at', now()),
    timeout_milliseconds := 5000
  );
  $$
);

-- ── Housekeeping: prune the idempotency ledger nightly (keep ~14 days) ────────
select cron.schedule(
  'prune-notification-log',
  '17 3 * * *',
  $$ delete from notification_log where local_date < (current_date - interval '14 days'); $$
);
