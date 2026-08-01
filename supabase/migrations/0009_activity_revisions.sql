-- Date-effective activity schedule/configuration (ADR 0004).
-- Legacy configuration columns remain on activities as the latest mirror for
-- older installed PWAs; new clients resolve this table first.
begin;

create table activity_revisions (
  id                  uuid primary key default gen_random_uuid(),
  activity_id         uuid not null references activities (id) on delete cascade,
  effective_from      date not null,
  recurrence_days     integer[] not null,
  reminder_type       reminder_type,
  strict_time         time,
  soft_start          time,
  soft_interval_mins  integer,
  soft_end            time,
  default_mode        task_mode,
  goal_duration_mins  integer,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  unique (activity_id, effective_from),
  constraint activity_revision_recurrence_days_valid check (
    cardinality(recurrence_days) > 0
    and recurrence_days <@ array[0,1,2,3,4,5,6]
  ),
  constraint activity_revision_config_shape check (
    (
      reminder_type = 'strict'
      and strict_time is not null
      and soft_start is null and soft_interval_mins is null and soft_end is null
      and default_mode is null and goal_duration_mins is null
    ) or (
      reminder_type = 'soft'
      and strict_time is null
      and soft_start is not null and soft_interval_mins is not null
      and soft_interval_mins > 0 and soft_end is not null
      and soft_start < soft_end
      and default_mode is null and goal_duration_mins is null
    ) or (
      reminder_type = 'random'
      and strict_time is null
      and soft_start is not null and soft_interval_mins is null and soft_end is not null
      and soft_start < soft_end
      and default_mode is null and goal_duration_mins is null
    ) or (
      reminder_type is null and strict_time is null
      and soft_start is null and soft_interval_mins is null and soft_end is null
      and (
        (default_mode = 'goal' and goal_duration_mins is not null and goal_duration_mins > 0)
        or (default_mode = 'zen' and goal_duration_mins is null)
      )
    )
  )
);

create index activity_revisions_activity_date_idx
  on activity_revisions (activity_id, effective_from desc);

-- One initial revision for every existing activity. Preserve its historical
-- timestamps; the save-time trigger is installed after this backfill.
insert into activity_revisions (
  activity_id, effective_from, recurrence_days,
  reminder_type, strict_time, soft_start, soft_interval_mins, soft_end,
  default_mode, goal_duration_mins, created_at, updated_at
)
select
  id, recurrence_start, recurrence_days,
  reminder_type, strict_time, soft_start, soft_interval_mins, soft_end,
  default_mode, goal_duration_mins, created_at, updated_at
from activities;

create or replace function validate_activity_revision() returns trigger
language plpgsql as $$
declare
  parent_type activity_type;
  parent_start date;
begin
  select type, recurrence_start into parent_type, parent_start
  from activities where id = new.activity_id;

  if parent_type is null then
    raise exception 'activity % does not exist', new.activity_id;
  end if;
  if new.effective_from < parent_start then
    raise exception 'activity revision cannot predate original start';
  end if;
  if parent_type = 'reminder' and new.reminder_type is null then
    raise exception 'reminder revision requires reminder configuration';
  end if;
  if parent_type = 'long_task' and new.default_mode is null then
    raise exception 'long-task revision requires mode configuration';
  end if;

  if tg_op = 'INSERT' then
    new.created_at = now();
  else
    new.created_at = old.created_at;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create trigger activity_revisions_validate_and_stamp
  before insert or update on activity_revisions
  for each row execute function validate_activity_revision();

alter table activity_revisions enable row level security;

create policy activity_revisions_owner on activity_revisions
  for all using (
    exists (
      select 1 from activities a
      where a.id = activity_revisions.activity_id and a.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from activities a
      where a.id = activity_revisions.activity_id and a.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on activity_revisions to authenticated, service_role;

commit;
