import * as React from "react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"

// Thin line chevron for the month nav — react-day-picker's default glyph
// renders as a heavy black arrow that fights the calm/minimal aesthetic.
function Chevron({ orientation }: { orientation?: "left" | "right" | "up" | "down" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
    >
      {orientation === "right" ? <path d="M9 18l6-6-6-6" /> : <path d="M15 18l-6-6 6-6" />}
    </svg>
  )
}

// Wraps react-day-picker. Selected day = grayscale elevated fill (never pink,
// per the hard "pink is CTA-only" rule); "today" gets a ring, not a fill, so
// it never competes with an actual selection.
function Calendar({
  className,
  classNames,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col",
        month: "flex flex-col gap-3",
        month_caption: "flex items-center justify-center pt-1 pb-2 relative",
        caption_label: "text-[13px] font-medium text-ink",
        nav: "flex items-center justify-between absolute inset-x-0 top-0",
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
      }}
      components={{ Chevron }}
      {...props}
    />
  )
}

export { Calendar }
