-- Undegen — initial schema
-- Supabase Postgres. Six tables; `users` is Supabase Auth (auth.users), no custom columns.
-- Central relationship:
--   activities ──→ day_activities ←── days
--                       │
--                 ┌─────┴─────┐
--             completions   work_sessions
--
-- Decisions enforced here (see CLAUDE.md):
--   - Activity config lives as nullable columns on `activities` (no extension tables).
--   - `day_activities` has NO `type` column — inferrable via join, storing it = drift risk.
--   - No stored derived values (streaks, rates) — computed on read.
--   - Goal fields are snapshotted onto `work_sessions` at session start (immutable history).

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────────────────────
create type activity_type        as enum ('reminder', 'long_task');
create type reminder_type        as enum ('strict', 'soft');
create type task_mode            as enum ('goal', 'zen');
create type day_activity_source  as enum ('recurring', 'manual');
create type completion_status    as enum ('done', 'skipped', 'missed');
create type work_session_status  as enum ('in_progress', 'completed', 'abandoned');

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at trigger helper
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- activities — template/definition of a trackable thing
-- ─────────────────────────────────────────────────────────────────────────────
create table activities (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  name                text not null,
  type                activity_type not null,

  -- recurrence_days: JS Date.getDay() convention, 0=Sunday .. 6=Saturday
  recurrence_days     integer[] not null default '{}',
  recurrence_start    date not null,
  archived            boolean not null default false,
  position            integer not null default 0,

  -- reminder-specific (null when type = 'long_task')
  reminder_type       reminder_type,
  strict_time         time,
  soft_start          time,
  soft_interval_mins  integer,
  soft_end            time,

  -- long_task-specific (null when type = 'reminder')
  default_mode        task_mode,
  goal_duration_mins  integer,
  goal_unit           text,
  goal_value          numeric,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint recurrence_days_valid
    check (recurrence_days <@ array[0,1,2,3,4,5,6]),

  -- config columns belong only to the matching type
  constraint reminder_config_only_on_reminder check (
    type = 'reminder' or (
      reminder_type is null and strict_time is null and soft_start is null
      and soft_interval_mins is null and soft_end is null
    )
  ),
  constraint long_task_config_only_on_long_task check (
    type = 'long_task' or (
      default_mode is null and goal_duration_mins is null
      and goal_unit is null and goal_value is null
    )
  )
);

create index activities_user_id_idx on activities (user_id) where not archived;

create trigger activities_set_updated_at
  before update on activities
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- days — one row per calendar date per user
-- ─────────────────────────────────────────────────────────────────────────────
create table days (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  date        date not null,
  note        text,
  created_at  timestamptz not null default now(),

  unique (user_id, date)
);

create index days_user_date_idx on days (user_id, date desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- day_activities — materialised instance of an activity on a specific day
-- NOTE: no `type` column — always inferred via join to activities.
-- ─────────────────────────────────────────────────────────────────────────────
create table day_activities (
  id           uuid primary key default gen_random_uuid(),
  day_id       uuid not null references days (id) on delete cascade,
  activity_id  uuid not null references activities (id) on delete cascade,
  source       day_activity_source not null,
  position     integer not null default 0,

  -- an activity appears at most once per day
  unique (day_id, activity_id)
);

create index day_activities_day_id_idx      on day_activities (day_id);
create index day_activities_activity_id_idx on day_activities (activity_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- completions — completion record for a reminder-type day_activity (one per da)
-- ─────────────────────────────────────────────────────────────────────────────
create table completions (
  id               uuid primary key default gen_random_uuid(),
  day_activity_id  uuid not null unique references day_activities (id) on delete cascade,
  status           completion_status not null,
  completed_at     timestamptz,
  note             text
);

-- ─────────────────────────────────────────────────────────────────────────────
-- work_sessions — execution record for a long_task-type day_activity (many per da)
-- Goal fields snapshotted at session start; editing the activity later does not
-- mutate history.
-- ─────────────────────────────────────────────────────────────────────────────
create table work_sessions (
  id                  uuid primary key default gen_random_uuid(),
  day_activity_id     uuid not null references day_activities (id) on delete cascade,
  mode                task_mode not null,

  -- snapshot of the activity's goal config at session start (null in zen mode)
  goal_duration_mins  integer,
  goal_unit           text,
  goal_target         numeric,
  goal_actual         numeric,

  started_at          timestamptz not null default now(),
  ended_at            timestamptz,
  total_secs          integer,
  status              work_session_status not null default 'in_progress',
  goal_met            boolean,
  note                text
);

create index work_sessions_day_activity_id_idx on work_sessions (day_activity_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security — every row is reachable only by its owning user.
-- activities/days carry user_id directly; the rest resolve ownership via join.
-- ─────────────────────────────────────────────────────────────────────────────
alter table activities     enable row level security;
alter table days           enable row level security;
alter table day_activities enable row level security;
alter table completions    enable row level security;
alter table work_sessions  enable row level security;

create policy activities_owner on activities
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy days_owner on days
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy day_activities_owner on day_activities
  for all using (
    exists (select 1 from days d where d.id = day_activities.day_id and d.user_id = auth.uid())
  ) with check (
    exists (select 1 from days d where d.id = day_activities.day_id and d.user_id = auth.uid())
  );

create policy completions_owner on completions
  for all using (
    exists (
      select 1 from day_activities da
      join days d on d.id = da.day_id
      where da.id = completions.day_activity_id and d.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from day_activities da
      join days d on d.id = da.day_id
      where da.id = completions.day_activity_id and d.user_id = auth.uid()
    )
  );

create policy work_sessions_owner on work_sessions
  for all using (
    exists (
      select 1 from day_activities da
      join days d on d.id = da.day_id
      where da.id = work_sessions.day_activity_id and d.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from day_activities da
      join days d on d.id = da.day_id
      where da.id = work_sessions.day_activity_id and d.user_id = auth.uid()
    )
  );

commit;

-- ─────────────────────────────────────────────────────────────────────────────
-- NOT YET INCLUDED (open questions in CLAUDE.md):
--   - push_subscriptions  — Web Push subscription objects per user (server-side trigger)
--   - activities.exception_dates date[]  — skip a recurrence on a specific date
-- Add via a later migration when those features land.
-- ─────────────────────────────────────────────────────────────────────────────
