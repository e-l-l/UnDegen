import { useState } from "react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { ClockIcon } from "./icons"

// Custom themed time control (no time-picker library exists in this repo) —
// a Popover with a scrollable 15-min-increment list, reused for strict_time,
// soft_start, soft_end. 'HH:MM' string in/out, matching how the schema stores
// `time` columns.
const TIMES = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4)
  const m = (i % 4) * 15
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
})

type TimePickerProps = {
  value: string
  onChange: (value: string) => void
  className?: string
}

export function TimePicker({ value, onChange, className }: TimePickerProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-12.5 w-full items-center justify-between rounded-[13px] border border-input bg-surface px-3.75 text-[15px] text-ink-soft outline-none transition-colors",
            "focus-visible:border-[#3a3a3a] focus-visible:ring-[3px] focus-visible:ring-ring/20",
            className
          )}
        >
          {value || "--:--"}
          <ClockIcon className="size-4.5 text-ink-muted" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-64 w-32 overflow-y-auto p-1">
        {TIMES.map((t) => {
          const selected = t === value
          return (
            <button
              key={t}
              type="button"
              ref={selected ? (el) => el?.scrollIntoView({ block: "center" }) : undefined}
              onClick={() => {
                onChange(t)
                setOpen(false)
              }}
              className={cn(
                "block w-full rounded-md px-3 py-1.75 text-left text-[13.5px] transition-colors hover:bg-surface",
                selected ? "bg-elevated font-semibold text-ink lg:bg-elevated-lg" : "text-ink-body"
              )}
            >
              {t}
            </button>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}
