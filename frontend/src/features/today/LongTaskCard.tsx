import type { DayItem } from "@/db/dayView"
import type { WorkSession } from "@/db/types"
import { ActiveSessionCard } from "./ActiveSessionCard"
import { IdleGoalCard } from "./IdleGoalCard"
import { IdleZenCard } from "./IdleZenCard"

interface LongTaskCardProps {
  item: DayItem
  onStart: () => void
  onStop: (session: WorkSession) => void
}

// Delegates entirely: an in_progress session owns the shell (ActiveSessionCard);
// otherwise the card is picked by the activity's fixed mode — goal mode gets a
// banked-progress bar, zen mode gets a session-length sparkline. Mode is set
// once at creation (activity.default_mode) and never changes per session, so
// there's no third branch to consider here.
export function LongTaskCard({ item, onStart, onStop }: LongTaskCardProps) {
  const { activity, sessions } = item
  const active = sessions.find((s) => s.status === "in_progress")

  if (active) {
    return <ActiveSessionCard activity={activity} session={active} onStop={onStop} />
  }

  return activity.default_mode === "goal" ? (
    <IdleGoalCard activity={activity} onStart={onStart} />
  ) : (
    <IdleZenCard activity={activity} onStart={onStart} />
  )
}
