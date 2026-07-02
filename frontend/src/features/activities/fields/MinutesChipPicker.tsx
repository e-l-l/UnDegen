import type { ReactNode } from "react"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { MinuteStepper } from "./MinuteStepper"

type MinutesChipPickerProps = {
  label: ReactNode
  presets: readonly number[]
  minutes: number
  isCustom: boolean
  onSelectPreset: (mins: number) => void
  onSelectCustom: () => void
  onCustomChange: (mins: number) => void
  itemClassName?: string
}

// Shared preset-chips-plus-custom-stepper shell for GoalDurationChips and
// SoftIntervalChips — same "pick a preset or drop into MinuteStepper" pattern.
export function MinutesChipPicker({
  label,
  presets,
  minutes,
  isCustom,
  onSelectPreset,
  onSelectCustom,
  onCustomChange,
  itemClassName = "h-12 flex-1 rounded-xl border border-edge-chip text-[14px] data-[state=on]:border-transparent",
}: MinutesChipPickerProps) {
  return (
    <div>
      {label}
      <ToggleGroup
        type="single"
        value={isCustom ? "custom" : String(minutes)}
        onValueChange={(v) => {
          if (!v) return
          if (v === "custom") onSelectCustom()
          else onSelectPreset(Number(v))
        }}
        className="gap-1.75"
      >
        {presets.map((m) => (
          <ToggleGroupItem key={m} value={String(m)} className={itemClassName}>
            {m} min
          </ToggleGroupItem>
        ))}
        <ToggleGroupItem value="custom" className={itemClassName}>
          Custom
        </ToggleGroupItem>
      </ToggleGroup>
      {isCustom && <MinuteStepper value={minutes} onChange={onCustomChange} />}
    </div>
  )
}
