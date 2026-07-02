-- Undegen — drop dead goal_unit/goal_value columns on activities.
-- These were reserved for a cut reps/km/pages goal axis, never built.
-- goal_duration_mins already covers the only goal type in scope (time) and is
-- untouched. work_sessions.goal_unit/goal_target/goal_actual are explicitly
-- OUT of scope here — that table isn't built out yet; revisit when it is.

begin;

alter table activities
  drop constraint long_task_config_only_on_long_task;

alter table activities
  drop column goal_unit,
  drop column goal_value;

alter table activities
  add constraint long_task_config_only_on_long_task check (
    type = 'long_task' or (
      default_mode is null and goal_duration_mins is null
    )
  );

commit;
