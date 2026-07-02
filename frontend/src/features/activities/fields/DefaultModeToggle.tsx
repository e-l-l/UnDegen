import type { TaskMode } from "@/db/types"
import { SegmentedToggle } from "./shared"

type DefaultModeToggleProps = {
  value: TaskMode
  onChange: (value: TaskMode) => void
}

export function DefaultModeToggle({ value, onChange }: DefaultModeToggleProps) {
  return (
    <SegmentedToggle
      label="Mode"
      value={value}
      onChange={onChange}
      options={[
        { value: "goal", label: "Goal" },
        { value: "zen", label: "Zen" },
      ]}
      caption={
        <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink-faint">
          Track toward a target. Zen just logs elapsed time.
        </p>
      }
    />
  )
}
