import type { DayItem } from "@/db/dayView"
import type { WorkSession } from "@/db/types"
import { ActiveSessionCard } from "./ActiveSessionCard"
import { IdleGoalCard } from "./IdleGoalCard"
import { IdleZenCard } from "./IdleZenCard"
import { TaskActions } from "./TaskActions"

interface LongTaskCardProps {
  item: DayItem
  onStart: () => void
  onStop: (session: WorkSession) => void
  userId: string
  date: string
}

// Delegates entirely: an in_progress session owns the shell (ActiveSessionCard);
// otherwise the card is picked by the activity's fixed mode — goal mode gets a
// banked-progress bar, zen mode gets a session-length sparkline. Mode is set
// once at creation (activity.default_mode) and never changes per session, so
// there's no third branch to consider here. TaskActions wraps the whole card so
// the ⋮ menu (passed into each card's header) shares one delete dialog; the
// `group` wrapper is the hover target that reveals the kebab.
export function LongTaskCard({ item, onStart, onStop, userId, date }: LongTaskCardProps) {
  const { activity, sessions } = item
  const active = sessions.find((s) => s.status === "in_progress")

  return (
    <TaskActions activity={activity} date={date} userId={userId}>
      {(kebab) => (
        <div className="group">
          {active ? (
            <ActiveSessionCard activity={activity} session={active} onStop={onStop} menu={kebab} />
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
