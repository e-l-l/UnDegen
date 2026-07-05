import { Check, type LucideIcon } from "lucide-react"

import type { Activity } from "@/db/types"
import { cn } from "@/lib/utils"
import { TaskActions } from "./TaskActions"

interface ReminderRowProps {
  time: string
  title: string
  Icon: LucideIcon
  done: boolean
  // The occurrence carries a `skipped` completion — user tapped "Missed it".
  // Rendered as a calm, user-chosen dismissal (dimmed + strikethrough), which is
  // distinct from the banned system-"missed" styling since it's deliberate.
  missed: boolean
  onToggle: () => void
  onToggleMissed: () => void
  activity: Activity
  date: string
  userId: string
}

// A reminder is only dimmed/checked once actually completed. A reminder whose
// time has passed without being marked done still renders at full opacity
// with a tappable empty circle — root CLAUDE.md bans punishing "missed"
// states, so a late reminder stays actionable rather than styled as a failure.
// The toggle stays clickable when done so an accidental completion can be
// undone (onToggle clears the completion — see TodayScreen.toggleDone).
// `missed` is the one exception: a user-chosen "Missed it" dismissal dims the
// row and strikes the title (reversible via the menu's Undo). done and missed
// are mutually exclusive (one completion; status is done | skipped).
export function ReminderRow({ time, title, Icon, done, missed, onToggle, onToggleMissed, activity, date, userId }: ReminderRowProps) {
  const faded = done || missed
  return (
    <TaskActions activity={activity} date={date} userId={userId} missed={missed} onToggleMissed={onToggleMissed}>
      {(kebab) => (
        <div
          className={cn(
            "group flex items-center gap-3 border-b border-edge-panel py-[13px] lg:gap-3.5 lg:px-0.5",
            faded && "opacity-50"
          )}
        >
          <div
            className={cn(
              "w-14 shrink-0 text-right text-[12.5px] whitespace-nowrap tabular-nums lg:w-16 lg:text-[13px]",
              faded ? "text-ink-faint" : "text-ink-dim"
            )}
          >
            {time}
          </div>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-edge-chip bg-surface lg:size-[38px] lg:rounded-[11px]">
            <Icon className={cn("size-[18px]", faded ? "text-ink-faint" : "text-ink-body")} strokeWidth={1.7} />
          </div>
          <div
            className={cn(
              "min-w-0 flex-1 text-[15px] font-[450]",
              faded ? "text-ink-body" : "text-[#d6d6d6]",
              missed && "line-through"
            )}
          >
            {title}
          </div>
          {kebab}
          <button
            type="button"
            onClick={onToggle}
            aria-label={done ? `Mark ${title} not done` : `Mark ${title} done`}
            className={cn(
              "flex size-[22px] shrink-0 items-center justify-center rounded-full",
              done ? "bg-pink" : "border-[1.6px] border-[#383838]"
            )}
          >
            {done && <Check className="size-3 text-on-pink" strokeWidth={3.2} />}
          </button>
        </div>
      )}
    </TaskActions>
  )
}
