import type { ActivityType } from "@/db/types"
import { Bell, ConcentricCircles } from "../icons"
import { SegmentedToggle } from "./shared"

type TypeToggleProps = {
  value: ActivityType
  onChange: (value: ActivityType) => void
}

export function TypeToggle({ value, onChange }: TypeToggleProps) {
  return (
    <SegmentedToggle
      label="Type"
      value={value}
      onChange={onChange}
      itemClassName="h-10 flex-1 gap-2 rounded-[10px] text-[14px] lg:h-11 lg:text-[14.5px]"
      options={[
        { value: "reminder", label: "Reminder", icon: Bell },
        { value: "long_task", label: "Long task", icon: ConcentricCircles },
      ]}
    />
  )
}
