import { useEffect, useRef, useState } from "react"
import type { ChangeEvent, KeyboardEvent, RefObject } from "react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { ClockIcon } from "./icons"

// Custom themed time control (no time-picker library exists in this repo) —
// segmented HH/MM/AM-PM inputs for direct typing of any time, plus a Popover
// quick-pick list (15-min increments, ScrollArea for reliable scroll) for
// fast common selection. Reused for strict_time, soft_start, soft_end.
// 'HH:MM' 24hr string in/out, matching how the schema stores `time` columns;
// segments display 12hr to match the AM/PM convention used elsewhere (see
// useTodayData.ts's formatTimeLabel).

const QUICK_TIMES = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4)
  const m = (i % 4) * 15
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
})

type Period = "AM" | "PM"

function parseTime(value: string) {
  const [hStr, mStr] = value.split(":")
  const h24 = Number(hStr) || 0
  const minute = Number(mStr) || 0
  const period: Period = h24 >= 12 ? "PM" : "AM"
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return { h12, minute, period }
}

function toValue(h12: number, minute: number, period: Period) {
  const h24 = period === "PM" ? (h12 % 12) + 12 : h12 % 12
  return `${String(h24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

function formatQuickLabel(t: string) {
  const { h12, minute, period } = parseTime(t)
  return `${h12}:${String(minute).padStart(2, "0")} ${period}`
}

const pad = (n: number) => String(n).padStart(2, "0")

type DigitResult = { commit: number | null; complete: boolean } | null

// A lone "1" could still become 10/11/12, so it's held pending; 2-9 can't
// extend into a valid hour, so they commit immediately. "0" alone isn't a
// real 12-hour value, so it's shown but not pushed upstream until a second
// digit resolves it.
function interpretHour(digits: string): DigitResult {
  if (digits.length === 1) {
    const d = Number(digits)
    if (d === 0) return { commit: null, complete: false }
    if (d === 1) return { commit: 1, complete: false }
    return { commit: d, complete: true }
  }
  if (digits.length === 2) {
    const n = Number(digits)
    return n >= 1 && n <= 12 ? { commit: n, complete: true } : null
  }
  return null
}

// A first digit of 0-5 could still extend to a second digit (00-59 always
// valid from there); 6-9 can only ever be a ones digit, so it commits alone.
function interpretMinute(digits: string): DigitResult {
  if (digits.length === 1) {
    const d = Number(digits)
    return d <= 5 ? { commit: d, complete: false } : { commit: d, complete: true }
  }
  if (digits.length === 2) {
    const n = Number(digits)
    return n <= 59 ? { commit: n, complete: true } : null
  }
  return null
}

type TimeSegmentProps = {
  value: number
  min: number
  max: number
  interpret: (digits: string) => DigitResult
  onCommit: (next: number) => void
  focusNext: () => void
  ariaLabel: string
  inputRef: RefObject<HTMLInputElement | null>
}

// Hour/minute segment: typing replaces the (auto-selected) value like a
// native segmented input, arrow keys step it, and an invalid keystroke is
// silently dropped — React's controlled-value snapback undoes the browser's
// tentative DOM edit before it's ever visible.
function TimeSegment({ value, min, max, interpret, onCommit, focusNext, ariaLabel, inputRef }: TimeSegmentProps) {
  const [pending, setPending] = useState<string | null>(null)

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "").slice(-2)
    if (!digits) {
      setPending(null)
      return
    }
    const result = interpret(digits)
    if (!result) return
    setPending(digits)
    if (result.commit !== null) onCommit(result.commit)
    if (result.complete) {
      setPending(null)
      focusNext()
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return
    e.preventDefault()
    setPending(null)
    const span = max - min + 1
    const delta = e.key === "ArrowUp" ? 1 : -1
    onCommit((((value - min + delta) % span) + span) % span + min)
  }

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      maxLength={2}
      aria-label={ariaLabel}
      value={pending ?? pad(value)}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={() => setPending(null)}
      className="w-6 shrink-0 rounded-sm bg-transparent text-center text-[15px] text-ink-soft tabular-nums outline-none focus:bg-elevated"
    />
  )
}

function PeriodToggle({ value, onChange, buttonRef }: { value: Period; onChange: (p: Period) => void; buttonRef: RefObject<HTMLButtonElement | null> }) {
  const toggle = () => onChange(value === "AM" ? "PM" : "AM")
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label="AM or PM"
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault()
          toggle()
        } else if (e.key.toLowerCase() === "a") {
          onChange("AM")
        } else if (e.key.toLowerCase() === "p") {
          onChange("PM")
        }
      }}
      className="ml-1 shrink-0 rounded-sm px-1 text-[12px] font-semibold tracking-wide text-ink-muted outline-none transition-colors hover:text-ink-soft focus:bg-elevated focus:text-ink"
    >
      {value}
    </button>
  )
}

type TimePickerProps = {
  value: string
  onChange: (value: string) => void
  className?: string
  // Lower bound as 'HH:MM' (24hr). When set, the quick-pick list hides any
  // earlier slot; typed/stepped values below it are snapped up to it on blur.
  // Used to stop scheduling a reminder in the past when it starts today.
  minTime?: string
}

export function TimePicker({ value, onChange, className, minTime }: TimePickerProps) {
  const { h12, minute, period } = parseTime(value)
  const [open, setOpen] = useState(false)
  const quickTimes = minTime ? QUICK_TIMES.filter((t) => t >= minTime) : QUICK_TIMES
  const hourRef = useRef<HTMLInputElement>(null)
  const minuteRef = useRef<HTMLInputElement>(null)
  const periodRef = useRef<HTMLButtonElement>(null)
  const selectedRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) selectedRef.current?.scrollIntoView({ block: "center" })
  }, [open])

  return (
    <div
      className={cn(
        "flex h-12.5 w-full items-center rounded-[13px] border border-input bg-surface px-3.75 text-[15px] outline-none transition-colors",
        "focus-within:border-[#3a3a3a] focus-within:ring-[3px] focus-within:ring-ring/20",
        className
      )}
      // Snap a below-minimum time up once focus fully leaves the control (not
      // while tabbing between segments) — keeps typed/stepped input honest.
      onBlur={(e) => {
        if (minTime && value < minTime && !e.currentTarget.contains(e.relatedTarget as Node | null)) {
          onChange(minTime)
        }
      }}
    >
      <TimeSegment
        value={h12}
        min={1}
        max={12}
        interpret={interpretHour}
        onCommit={(h) => onChange(toValue(h, minute, period))}
        focusNext={() => minuteRef.current?.focus()}
        ariaLabel="Hour"
        inputRef={hourRef}
      />
      <span className="text-ink-muted">:</span>
      <TimeSegment
        value={minute}
        min={0}
        max={59}
        interpret={interpretMinute}
        onCommit={(m) => onChange(toValue(h12, m, period))}
        focusNext={() => periodRef.current?.focus()}
        ariaLabel="Minute"
        inputRef={minuteRef}
      />
      <PeriodToggle value={period} onChange={(p) => onChange(toValue(h12, minute, p))} buttonRef={periodRef} />
      <div className="flex-1" />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Quick-pick a time"
            className="shrink-0 text-ink-muted transition-colors hover:text-ink-soft"
          >
            <ClockIcon className="size-4.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-36 p-1">
          <ScrollArea className="h-64">
            {quickTimes.map((t) => {
              const selected = t === value
              return (
                <button
                  key={t}
                  type="button"
                  ref={selected ? selectedRef : undefined}
                  onClick={() => {
                    onChange(t)
                    setOpen(false)
                  }}
                  className={cn(
                    "block w-full rounded-md px-3 py-1.75 text-left text-[13.5px] transition-colors hover:bg-surface",
                    selected ? "bg-elevated font-semibold text-ink lg:bg-elevated-lg" : "text-ink-body"
                  )}
                >
                  {formatQuickLabel(t)}
                </button>
              )
            })}
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  )
}
