import type { DayItem } from "@/db/dayView"
import type { WorkSession } from "@/db/types"
import { ActiveSessionCard } from "./ActiveSessionCard"
import { IdleGoalCard } from "./IdleGoalCard"
import { IdleZenCard } from "./IdleZenCard"
import { ReadOnlyLongTaskCard } from "./ReadOnlyLongTaskCard"
import { TaskActions } from "./TaskActions"

interface LongTaskCardProps {
  item: DayItem
  onStart: () => void
  onStop: (session: WorkSession) => void
  userId: string
  // Review-only (non-today) day: a read-only per-day summary, never a live timer
  // or Start. No TaskActions wrapper (no kebab/delete) — the day is read-only.
  readOnly?: boolean
}

// Delegates entirely: an in_progress session owns the shell (ActiveSessionCard);
// otherwise the card is picked by the occurrence's date-resolved mode — goal
// gets a banked-progress bar, zen gets a session-length sparkline. Running
// sessions render their own snapshot, so later edits cannot change them.
// TaskActions wraps the whole card so
// the ⋮ menu (passed into each idle card's header) shares one delete dialog; the
// `group` wrapper is the hover target that reveals the kebab. The active-session
// card omits the visible kebab — its bordered "In session" pill owns the header's
// right edge, so delete falls to the shared right-click / long-press context menu
// (still wired via the TaskActions wrapper, independent of the kebab).
export function LongTaskCard({ item, onStart, onStop, userId, readOnly }: LongTaskCardProps) {
  const { activity, sessions } = item

  if (readOnly) return <ReadOnlyLongTaskCard item={item} />

  const active = sessions.find((s) => s.status === "in_progress")

  return (
    <TaskActions activity={activity} date={item.date} userId={userId}>
      {(kebab) => (
        <div className="group">
          {active ? (
            <ActiveSessionCard activity={activity} session={active} onStop={onStop} />
          ) : activity.default_mode === "goal" ? (
            <IdleGoalCard activity={activity} onStart={onStart} menu={kebab} />
          ) : (
            <IdleZenCard activity={activity} onStart={onStart} menu={kebab} />
          )}
        </div>
      )}
    </TaskActions>
  )
}
