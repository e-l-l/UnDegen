import { MinutesChipPicker } from "./MinutesChipPicker"
import { MiniLabel } from "./shared"

const PRESETS = [30, 60, 90] as const

type SoftIntervalChipsProps = {
  minutes: number
  isCustom: boolean
  onSelectPreset: (mins: number) => void
  onSelectCustom: () => void
  onCustomChange: (mins: number) => void
}

// "Every" — re-nudge cadence across the soft window. Custom mirrors the
// Goal-duration chips' custom-stepper pattern exactly (decided with the user) —
// both now share that pattern via MinutesChipPicker.
export function SoftIntervalChips(props: SoftIntervalChipsProps) {
  return (
    <MinutesChipPicker
      label={<MiniLabel>Every</MiniLabel>}
      presets={PRESETS}
      itemClassName="h-11 flex-1 rounded-[11px] border border-edge-chip text-[14px] data-[state=on]:border-transparent"
      {...props}
    />
  )
}
