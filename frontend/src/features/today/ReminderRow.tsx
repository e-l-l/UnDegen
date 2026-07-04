import { Check, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

interface ReminderRowProps {
  time: string
  title: string
  Icon: LucideIcon
  done: boolean
  onToggle: () => void
}

// A reminder is only dimmed/checked once actually completed. A reminder whose
// time has passed without being marked done still renders at full opacity
// with a tappable empty circle — root CLAUDE.md bans punishing "missed"
// states, so a late reminder stays actionable rather than styled as a failure.
// The toggle stays clickable when done so an accidental completion can be
// undone (onToggle clears the completion — see TodayScreen.toggleDone).
export function ReminderRow({ time, title, Icon, done, onToggle }: ReminderRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b border-edge-panel py-[13px] lg:gap-3.5 lg:px-0.5",
        done && "opacity-50"
      )}
    >
      <div
        className={cn(
          "w-14 shrink-0 text-right text-[12.5px] whitespace-nowrap tabular-nums lg:w-16 lg:text-[13px]",
          done ? "text-ink-faint" : "text-ink-dim"
        )}
      >
        {time}
      </div>
      <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-edge-chip bg-surface lg:size-[38px] lg:rounded-[11px]">
        <Icon className={cn("size-[18px]", done ? "text-ink-faint" : "text-ink-body")} strokeWidth={1.7} />
      </div>
      <div className={cn("min-w-0 flex-1 text-[15px] font-[450]", done ? "text-ink-body" : "text-[#d6d6d6]")}>
        {title}
      </div>
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
  )
}
