-- Undegen — notifications (Web Push) schema
-- Adds the three tables the server-side alarm needs (see docs/adr/0003):
--   user_settings      — one IANA timezone per user; the server can't fire a
--                        zoneless 'HH:MM' strict_time without it. Reserved columns
--                        for quiet-hours (no UI yet).
--   push_subscriptions — Web Push subscription objects per user (the send targets).
--   notification_log   — one row per fired (activity, local_date, slot); the
--                        claim-then-send idempotency key so we never double-send.
--
-- All three are CLOUD-ONLY: written direct to Supabase (never through Dexie /
-- syncQueue) and read only by the Edge Function (service-role). Still RLS
-- owner-only so a client can never see another user's rows.
--
-- Reuses set_updated_at() from 0001. Depends on 0002 being applied first.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- user_settings — per-user config. timezone is load-bearing for the alarm.
-- ─────────────────────────────────────────────────────────────────────────────
create table user_settings (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  timezone           text not null,  -- IANA, e.g. 'Asia/Kolkata' (captured client-side)

  -- reserved for later; no UI yet (see CLAUDE.md open questions)
  quiet_hours_start  time,
  quiet_hours_end    time,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger user_settings_set_updated_at
  before update on user_settings
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- push_subscriptions — Web Push endpoints. A user may have several (phone,
-- laptop, …). endpoint is globally unique → upsert on re-subscribe.
-- ─────────────────────────────────────────────────────────────────────────────
create table push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);

create index push_subscriptions_user_id_idx on push_subscriptions (user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- notification_log — idempotency ledger. The unique key is the "slot": one
-- notification-event per (activity, local calendar date, wall-clock minute).
-- The function claims a slot with `insert … on conflict do nothing` and only
-- sends if it won the insert. An event record, not a derived-value cache.
-- ─────────────────────────────────────────────────────────────────────────────
create table notification_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  activity_id uuid not null references activities (id) on delete cascade,
  local_date  date not null,
  slot        time not null,   -- strict_time, or the soft nudge time
  sent_at     timestamptz not null default now(),
  status      text,            -- 'sent' | 'failed' | 'no_subscription'
  error       text,

  unique (activity_id, local_date, slot)
);

create index notification_log_user_date_idx on notification_log (user_id, local_date);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security — owner-only. The Edge Function uses the service role,
-- which bypasses RLS; these policies exist so a normal client can only ever
-- touch its own rows.
-- ─────────────────────────────────────────────────────────────────────────────
alter table user_settings      enable row level security;
alter table push_subscriptions enable row level security;
alter table notification_log   enable row level security;

create policy user_settings_owner on user_settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy push_subscriptions_owner on push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy notification_log_owner on notification_log
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

commit;
