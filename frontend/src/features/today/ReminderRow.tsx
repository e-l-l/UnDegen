import type { ReactNode } from "react"
import { Check, type LucideIcon } from "lucide-react"

import type { DayItem } from "@/db/dayView"
import type { Activity } from "@/db/types"
import { cn } from "@/lib/utils"
import { TaskActions } from "./TaskActions"

interface ReminderRowProps {
  time: string
  title: string
  Icon: LucideIcon
  onToggle: () => void
  onToggleMissed: () => void
  activity: Activity
  date: string
  userId: string
  // The occurrence's derived state (done | skipped | missed | pending — see
  // dayView.deriveState). The single source of truth for how the row renders:
  // `done`/`skipped` are read off this, not passed as separate booleans.
  // `skipped` is the user's deliberate "Missed it" dismissal (dimmed + struck),
  // distinct from the banned system-`missed` styling; `missed` (derived: past,
  // never marked) only surfaces in the off-today layout.
  state: DayItem["state"]
  // Off-today: drop the kebab/context-menu and show the derived state as a calm
  // right-aligned label. Past days may still expose only the done toggle via
  // canToggleCompletion; future days may not.
  offTodayLayout?: boolean
  canToggleCompletion?: boolean
}

// A reminder is only dimmed/checked once actually completed. A reminder whose
// time has passed without being marked done still renders at full opacity
// with a tappable empty circle — root CLAUDE.md bans punishing "missed"
// states, so a late reminder stays actionable rather than styled as a failure.
// The toggle stays clickable when done so an accidental completion can be
// undone (onToggle clears the completion — see TodayScreen.toggleDone).
// `skipped` is the one exception: a user-chosen "Missed it" dismissal dims the
// row and strikes the title (reversible via the menu's Undo). done and skipped
// are mutually exclusive (one completion; status is done | skipped).
export function ReminderRow({
  time,
  title,
  Icon,
  onToggle,
  onToggleMissed,
  activity,
  date,
  userId,
  state,
  offTodayLayout,
  canToggleCompletion,
}: ReminderRowProps) {
  const done = state === "done"
  const skipped = state === "skipped"
  const faded = done || skipped

  // The shared row skeleton — the interactive and review-only variants differ
  // only in per-cell text colour and what sits on the right edge; opacity (when
  // done/skipped) and the strikethrough (when skipped) are common to both.
  const body = (right: ReactNode, colors: { time: string; icon: string; title: string }) => (
    <div
      className={cn(
        "group flex items-center gap-3 border-b border-edge-panel py-[13px] lg:gap-3.5 lg:px-0.5",
        faded && "opacity-50"
      )}
    >
      {/* `time` is a clock time for strict/soft; a random reminder passes the
          literal "RANDOM" (its fire minute stays hidden — surprise is the
          point). See timeLabelFor in useTodayData. */}
      <div
        className={cn(
          "w-14 shrink-0 text-right text-[12.5px] leading-tight tabular-nums lg:w-16 lg:text-[13px]",
          colors.time
        )}
      >
        {time}
      </div>
      <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-edge-chip bg-surface lg:size-[38px] lg:rounded-[11px]">
        <Icon className={cn("size-[18px]", colors.icon)} strokeWidth={1.7} />
      </div>
      <div className={cn("min-w-0 flex-1 text-[15px] font-[450]", colors.title, skipped && "line-through")}>
        {title}
      </div>
      {right}
    </div>
  )

  const toggle = (
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
  )

  // Off-today: no kebab/context-menu — a flat row with a calm right-aligned
  // state. Past days append the completion toggle; future days remain purely
  // review-only. Three state treatments (DESIGN_HANDOFF §6 + the hi-fi mock):
  //   • done      → whole-row faded, plain "Done"
  //   • skipped   → whole-row faded + title struck (the deliberate "Missed it"
  //                 dismissal keeps its today treatment), "Missed" pill
  //   • derived   → past + never marked: FULL opacity "Missed" pill — quiet, not
  //     missed      an alarm (no-punishing rule). Never red, never struck.
  //   • pending   → future: nothing on the right (nothing to act on).
  if (offTodayLayout) {
    const showMissed = skipped || state === "missed"
    return body(
      <div className="flex shrink-0 items-center gap-2.5">
        {done ? (
          <span className="text-[12.5px] text-[#6e6e6e] lg:text-[13px]">Done</span>
        ) : showMissed ? (
          <span className="rounded-full border border-edge-chip bg-[#181818] px-[9px] py-[3px] text-[11.5px] font-medium text-[#8a8a8a] lg:px-2.5 lg:text-[12px]">
            Missed
          </span>
        ) : null}
        {canToggleCompletion && toggle}
      </div>,
      {
        time: done ? "text-[#5e5e5e]" : showMissed ? "text-[#6e6e6e]" : "text-[#777777]",
        icon: "text-[#5e5e5e]",
        title: done ? "text-[#8a8a8a]" : showMissed ? "text-[#aeaeae]" : "text-[#d6d6d6]",
      }
    )
  }

  return (
    <TaskActions activity={activity} date={date} userId={userId} missed={skipped} onToggleMissed={onToggleMissed}>
      {(kebab) =>
        body(
          <>
            {kebab}
            {toggle}
          </>,
          {
            time: faded ? "text-ink-faint" : "text-ink-dim",
            icon: faded ? "text-ink-faint" : "text-ink-body",
            title: faded ? "text-ink-body" : "text-[#d6d6d6]",
          }
        )
      }
    </TaskActions>
  )
}
