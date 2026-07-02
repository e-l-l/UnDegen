import { Minus, Plus } from "../icons"

// Shared by GoalDurationChips + SoftIntervalChips — the manual minutes row
// revealed when "Custom" is selected. No desktop-specific styling was
// designed for this sub-state, so it keeps the same token treatment at every
// breakpoint.
type MinuteStepperProps = {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
}

const stepButtonClassName =
  "flex size-8.5 items-center justify-center rounded-[9px] border border-[#2e2e2e] bg-[#242424] text-[#9a9a9a] transition-colors hover:text-ink-soft"

export function MinuteStepper({ value, onChange, min = 5, max = 240, step = 5 }: MinuteStepperProps) {
  return (
    <div className="mt-2.75 flex h-12 items-center gap-3 rounded-xl border border-border bg-surface pr-2 pl-3.75">
      <span className="flex-1 text-[15px] text-ink-soft">{value}</span>
      <span className="text-[14px] text-ink-dim">min</span>
      <div className="flex gap-1">
        <button
          type="button"
          aria-label="Decrease"
          onClick={() => onChange(Math.max(min, value - step))}
          className={stepButtonClassName}
        >
          <Minus className="size-3.75" />
        </button>
        <button
          type="button"
          aria-label="Increase"
          onClick={() => onChange(Math.min(max, value + step))}
          className={stepButtonClassName}
        >
          <Plus className="size-3.75" />
        </button>
      </div>
    </div>
  )
}
