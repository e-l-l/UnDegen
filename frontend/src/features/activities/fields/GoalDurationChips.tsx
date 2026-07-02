import { MinutesChipPicker } from "./MinutesChipPicker"
import { SectionLabel } from "./shared"

const PRESETS = [15, 30, 45] as const

type GoalDurationChipsProps = {
  minutes: number
  isCustom: boolean
  onSelectPreset: (mins: number) => void
  onSelectCustom: () => void
  onCustomChange: (mins: number) => void
}

export function GoalDurationChips(props: GoalDurationChipsProps) {
  return <MinutesChipPicker label={<SectionLabel>Target duration</SectionLabel>} presets={PRESETS} {...props} />
}
