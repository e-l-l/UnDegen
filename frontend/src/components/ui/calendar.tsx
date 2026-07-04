import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"

// Thin line chevron for the month nav — react-day-picker's default glyph
// renders as a heavy black arrow that fights the calm/minimal aesthetic.
function Chevron({ orientation }: { orientation?: "left" | "right" | "up" | "down" }) {
  const Icon = orientation === "right" ? ChevronRight : ChevronLeft
  return <Icon className="size-4" />
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1)
}

function clampMonth(date: Date, startMonth?: Date, endMonth?: Date): Date {
  if (startMonth && date < startOfMonth(startMonth)) return startOfMonth(startMonth)
  if (endMonth && date > startOfMonth(endMonth)) return startOfMonth(endMonth)
  return date
}

const TRANSITION_MS = 200
const noop = () => {}

// Wraps react-day-picker. Selected day = grayscale elevated fill (never pink,
// per the hard "pink is CTA-only" rule); "today" gets a ring, not a fill, so
// it never competes with an actual selection.
function Calendar({
  className,
  classNames,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const { month: monthProp, onMonthChange: onMonthChangeProp, defaultMonth, startMonth, endMonth } = props

  const [month, setMonth] = React.useState(() => startOfMonth(monthProp ?? defaultMonth ?? new Date()))
  // The outgoing month, kept mounted just long enough to play its slide-out
  // animation while the new month slides in underneath.
  const [outgoing, setOutgoing] = React.useState<{ month: Date } | null>(null)
  const isAnimating = React.useRef(false)
  const outgoingFallbackTimeout = React.useRef<number | null>(null)
  const dir = outgoing ? (outgoing.month.getTime() < month.getTime() ? 1 : -1) : null

  React.useEffect(() => {
    if (monthProp) setMonth(startOfMonth(monthProp))
  }, [monthProp])

  React.useEffect(() => {
    return () => {
      if (outgoingFallbackTimeout.current !== null) window.clearTimeout(outgoingFallbackTimeout.current)
    }
  }, [])

  function finishOutgoing() {
    if (outgoingFallbackTimeout.current !== null) {
      window.clearTimeout(outgoingFallbackTimeout.current)
      outgoingFallbackTimeout.current = null
    }
    setOutgoing(null)
    isAnimating.current = false
  }

  // Mobile swipe changes the visible month — react-day-picker only exposes
  // this via arrow-button clicks.
  function changeMonth(delta: number) {
    if (isAnimating.current) return
    const next = clampMonth(addMonths(month, delta), startMonth, endMonth)
    if (next.getTime() === month.getTime()) return
    isAnimating.current = true
    setOutgoing({ month })
    setMonth(next)
    onMonthChangeProp?.(next)
    // Safety net: if the CSS animation never fires an "animationend" (e.g.
    // prefers-reduced-motion drops the animation, or the event gets missed),
    // this still releases the lock instead of leaving it stuck forever.
    outgoingFallbackTimeout.current = window.setTimeout(finishOutgoing, TRANSITION_MS + 50)
  }

  const touchStart = React.useRef<{ x: number; y: number } | null>(null)
  const SWIPE_THRESHOLD = 40

  function handleTouchStart(e: React.TouchEvent) {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current
    touchStart.current = null
    if (!start) return
    const dx = e.changedTouches[0].clientX - start.x
    const dy = e.changedTouches[0].clientY - start.y
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      changeMonth(dx < 0 ? 1 : -1)
    }
  }

  const dayPickerClassNames = React.useMemo(
    () => ({
      months: "relative flex flex-col",
      month: "flex flex-col gap-3",
      month_caption: "flex items-center justify-center h-9 relative pointer-events-none",
      caption_label: "text-[13px] font-medium text-ink",
      nav: "flex items-center justify-between absolute inset-x-0 top-0 h-9",
      button_previous:
        "size-7 flex items-center justify-center rounded-md text-ink-dim hover:text-ink hover:bg-surface disabled:opacity-40 disabled:pointer-events-none",
      button_next:
        "size-7 flex items-center justify-center rounded-md text-ink-dim hover:text-ink hover:bg-surface disabled:opacity-40 disabled:pointer-events-none",
      month_grid: "w-full border-collapse",
      weekdays: "flex",
      weekday: "size-8 text-center text-[11px] font-medium text-ink-faint",
      week: "flex w-full mt-1",
      day: "size-8 p-0 text-center",
      day_button:
        "flex size-8 items-center justify-center rounded-[9px] text-[13px] text-ink-body transition-colors hover:bg-surface",
      today: "[&>button]:ring-1 [&>button]:ring-inset [&>button]:ring-border",
      selected: "[&>button]:bg-elevated [&>button]:text-ink [&>button]:font-semibold lg:[&>button]:bg-elevated-lg",
      outside: "[&>button]:text-ink-faint/60",
      disabled: "[&>button]:text-ink-faint/40 [&>button]:pointer-events-none",
      ...classNames,
    }),
    [classNames]
  )

  function renderPicker(pickerMonth: Date, onMonthChangeFn: (m: Date) => void, extraClassName?: string) {
    return (
      <DayPicker
        className={cn("p-3", extraClassName, className)}
        classNames={dayPickerClassNames}
        components={{ Chevron }}
        {...props}
        month={pickerMonth}
        onMonthChange={onMonthChangeFn}
      />
    )
  }

  return (
    <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="relative overflow-hidden">
        {outgoing && (
          <div
            key={outgoing.month.getTime()}
            aria-hidden
            className={cn("absolute inset-0 z-10 bg-inherit", "animate-out", dir === 1 ? "slide-out-to-left" : "slide-out-to-right")}
            style={{ animationDuration: `${TRANSITION_MS}ms`, animationFillMode: "forwards" }}
            onAnimationEnd={finishOutgoing}
          >
            {renderPicker(outgoing.month, noop, "pointer-events-none")}
          </div>
        )}
        <div
          key={month.getTime()}
          className={cn("bg-inherit", outgoing && "animate-in", outgoing && (dir === 1 ? "slide-in-from-right" : "slide-in-from-left"))}
          style={outgoing ? { animationDuration: `${TRANSITION_MS}ms` } : undefined}
        >
          {renderPicker(month, (m) => {
            setMonth(startOfMonth(m))
            onMonthChangeProp?.(m)
          })}
        </div>
      </div>
    </div>
  )
}

export { Calendar }
