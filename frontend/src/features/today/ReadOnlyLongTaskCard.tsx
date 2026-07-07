import { Check } from "lucide-react"

import type { DayItem } from "@/db/dayView"
import { iconForActivity } from "./iconForActivity"

// Compact per-day logged form — "45m" / "1h 05m" (minutes zero-padded once hours
// appear). Deliberately terser than lib/utils' formatDuration ("45 min" / "1 hr
// 5 min"): the review card's meta line reads as a glance, not a sentence.
function formatLogged(totalSecs: number) {
  const mins = Math.round(totalSecs / 60)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, "0")}m`
}

// Long-task card for a review-only (non-today) day. Shows what happened ON that
// day — time logged from that day's sessions (goal-met flagged with a check),
// or a calm "Planned" (future / not yet) / "Not logged" (past, none). No Start,
// no live timer, no kebab: the day is read-only. Unlike the idle cards it reads
// the viewed day's own `item.sessions` (per-day), not all-time history.
//
// Same idle-card shell language (18px radius on mobile, 16px in the desktop
// rail; #1a1a1a fill) minus the interactive bits; the meta line sits under the
// title inside the text column (not a full-width row below the icon).
export function ReadOnlyLongTaskCard({ item }: { item: DayItem }) {
  const { activity, sessions, state } = item
  const Icon = iconForActivity(activity)
  const loggedSecs = sessions.reduce((sum, s) => sum + (s.total_secs ?? 0), 0)
  const goalMet = activity.default_mode === "goal" && sessions.some((s) => s.goal_met)

  return (
    <div className="rounded-[18px] border border-[#242424] bg-surface p-4.5 lg:rounded-2xl">
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-[11px] border border-[#2e2e2e] bg-surface lg:size-[38px]">
          <Icon className="size-[19px] text-[#8a8a8a] lg:size-[18px]" strokeWidth={1.7} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15.5px] font-medium text-[#d8d8d8] lg:text-[14.5px]">{activity.name}</div>
          {loggedSecs > 0 ? (
            <div className="mt-[5px] flex items-center gap-1.5 text-[12.5px] text-[#8a8a8a] lg:text-[12px]">
              {goalMet && <Check className="size-[13px] shrink-0 lg:size-3" strokeWidth={2.2} />}
              <span className="truncate">
                {formatLogged(loggedSecs)} logged{goalMet ? " · goal met" : ""}
              </span>
            </div>
          ) : (
            <div className="mt-[5px] text-[12.5px] text-[#6e6e6e] lg:text-[12px]">
              {state === "missed" ? "Not logged" : "Planned"}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
