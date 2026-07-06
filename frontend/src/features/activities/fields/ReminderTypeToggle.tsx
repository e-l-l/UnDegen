import type { ReminderType } from "@/db/types"
import { SegmentedToggle } from "./shared"

type ReminderTypeToggleProps = {
  value: ReminderType
  onChange: (value: ReminderType) => void
}

export function ReminderTypeToggle({ value, onChange }: ReminderTypeToggleProps) {
  return (
    <SegmentedToggle
      label="Reminder style"
      value={value}
      onChange={onChange}
      options={[
        { value: "strict", label: "Strict" },
        { value: "soft", label: "Soft" },
        { value: "random", label: "Random" },
      ]}
      caption={
        (value === "soft" || value === "random") && (
          <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink-faint">
            {value === "soft"
              ? "Nudges you across a window until it's done."
              : "Fires once at a random time in the window — you won't know when."}
          </p>
        )
      }
    />
  )
}
