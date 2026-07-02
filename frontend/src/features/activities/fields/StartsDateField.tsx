import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { parseLocalDate, todayLocal } from "@/db/recurrence"
import { CalendarIcon } from "../icons"
import { SectionLabel } from "./shared"

function formatShort(date: string): string {
  return parseLocalDate(date).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

type StartsDateFieldProps = {
  value: string
  onChange: (value: string) => void
}

// recurrence_start. todayLocal(d) doubles as "format any Date as the local
// YYYY-MM-DD string" — reused here for the Calendar's onSelect, not just for
// the hook's initial default.
export function StartsDateField({ value, onChange }: StartsDateFieldProps) {
  const isToday = value === todayLocal()
  const short = formatShort(value)

  return (
    <div>
      <SectionLabel>Starts</SectionLabel>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex h-12.5 w-full items-center justify-between rounded-[13px] border border-input bg-surface px-3.75 text-[15px] text-ink-soft outline-none transition-colors focus-visible:border-[#3a3a3a] focus-visible:ring-[3px] focus-visible:ring-ring/20 lg:h-11 lg:rounded-[11px]"
          >
            <span className="lg:hidden">{isToday ? `Today · ${short}` : short}</span>
            <span className="hidden lg:inline">{short}</span>
            <CalendarIcon className="size-4.5 text-ink-muted lg:size-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start">
          <Calendar mode="single" selected={parseLocalDate(value)} onSelect={(d) => d && onChange(todayLocal(d))} />
        </PopoverContent>
      </Popover>
    </div>
  )
}
