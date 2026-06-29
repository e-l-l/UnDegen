"""Pydantic models for the Undegen data layer.

Mirrors backend/migrations/0001_initial_schema.sql. Three variants per entity:
  - ...Base   shared writable fields
  - ...Create payload accepted on insert (no server-generated id/timestamps)
  - <Entity>  full row as read back from the DB

`users` is Supabase Auth (auth.users) — no model here; reference user_id (UUID).
Config lives as nullable fields on Activity (no extension models), matching the DB.
"""

from __future__ import annotations

from datetime import date, datetime, time
from decimal import Decimal
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


# ── Enums (match the Postgres enum types) ────────────────────────────────────
class ActivityType(str, Enum):
    reminder = "reminder"
    long_task = "long_task"


class ReminderType(str, Enum):
    strict = "strict"
    soft = "soft"


class TaskMode(str, Enum):
    goal = "goal"
    zen = "zen"


class DayActivitySource(str, Enum):
    recurring = "recurring"
    manual = "manual"


class CompletionStatus(str, Enum):
    done = "done"
    skipped = "skipped"
    missed = "missed"


class WorkSessionStatus(str, Enum):
    in_progress = "in_progress"
    completed = "completed"
    abandoned = "abandoned"


# ── activities ───────────────────────────────────────────────────────────────
class ActivityBase(BaseModel):
    name: str
    type: ActivityType
    # JS Date.getDay() convention: 0=Sunday .. 6=Saturday
    recurrence_days: list[int] = Field(default_factory=list)
    recurrence_start: date
    archived: bool = False
    position: int = 0

    # reminder-specific (null when type == long_task)
    reminder_type: ReminderType | None = None
    strict_time: time | None = None
    soft_start: time | None = None
    soft_interval_mins: int | None = None
    soft_end: time | None = None

    # long_task-specific (null when type == reminder)
    default_mode: TaskMode | None = None
    goal_duration_mins: int | None = None
    goal_unit: str | None = None
    goal_value: Decimal | None = None

    @model_validator(mode="after")
    def _config_matches_type(self) -> "ActivityBase":
        if not all(0 <= d <= 6 for d in self.recurrence_days):
            raise ValueError("recurrence_days must be in 0..6")
        reminder_fields = (
            self.reminder_type,
            self.strict_time,
            self.soft_start,
            self.soft_interval_mins,
            self.soft_end,
        )
        long_task_fields = (
            self.default_mode,
            self.goal_duration_mins,
            self.goal_unit,
            self.goal_value,
        )
        if self.type is ActivityType.reminder and any(f is not None for f in long_task_fields):
            raise ValueError("long_task config set on a reminder activity")
        if self.type is ActivityType.long_task and any(f is not None for f in reminder_fields):
            raise ValueError("reminder config set on a long_task activity")
        return self


class ActivityCreate(ActivityBase):
    user_id: UUID


class Activity(ActivityBase):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime


# ── days ───────────────────────────────────────────────────────────────────
class DayBase(BaseModel):
    date: date
    note: str | None = None


class DayCreate(DayBase):
    user_id: UUID


class Day(DayBase):
    id: UUID
    user_id: UUID
    created_at: datetime


# ── day_activities ───────────────────────────────────────────────────────────
# No `type` field — inferred via join to Activity.
class DayActivityBase(BaseModel):
    day_id: UUID
    activity_id: UUID
    source: DayActivitySource
    position: int = 0


class DayActivityCreate(DayActivityBase):
    pass


class DayActivity(DayActivityBase):
    id: UUID


# ── completions ───────────────────────────────────────────────────────────────
class CompletionBase(BaseModel):
    day_activity_id: UUID
    status: CompletionStatus
    completed_at: datetime | None = None
    note: str | None = None


class CompletionCreate(CompletionBase):
    pass


class Completion(CompletionBase):
    id: UUID


# ── work_sessions ───────────────────────────────────────────────────────────
class WorkSessionBase(BaseModel):
    day_activity_id: UUID
    mode: TaskMode
    # goal config snapshotted at session start (null in zen mode)
    goal_duration_mins: int | None = None
    goal_unit: str | None = None
    goal_target: Decimal | None = None
    goal_actual: Decimal | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None
    total_secs: int | None = None
    status: WorkSessionStatus = WorkSessionStatus.in_progress
    goal_met: bool | None = None
    note: str | None = None


class WorkSessionCreate(WorkSessionBase):
    pass


class WorkSession(WorkSessionBase):
    id: UUID
    started_at: datetime
