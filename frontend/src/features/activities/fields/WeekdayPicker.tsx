import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import { FieldError, SectionLabel } from "./shared"

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"] // index = JS Date.getDay()

const PRESETS = [
  { label: "Every day", days: [0, 1, 2, 3, 4, 5, 6] },
  { label: "Weekdays", days: [1, 2, 3, 4, 5] },
  { label: "Weekends", days: [0, 6] },
] as const

function setsEqual(a: number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false
  const bs = new Set(b)
  return a.every((d) => bs.has(d))
}

type WeekdayPickerProps = {
  value: number[]
  onChange: (value: number[]) => void
  error?: string
}

// "Custom" has no chip of its own — it's just the fallthrough look when the
// current selection doesn't set-equal any preset (confirmed by the handoff).
export function WeekdayPicker({ value, onChange, error }: WeekdayPickerProps) {
  return (
    <div>
      <SectionLabel>Repeat on</SectionLabel>
      <ToggleGroup
        type="multiple"
        value={value.map(String)}
        onValueChange={(v) => onChange(v.map(Number).sort((a, b) => a - b))}
        className="gap-1.75"
      >
        {DAY_LABELS.map((label, day) => (
          <ToggleGroupItem
            key={day}
            value={String(day)}
            aria-label={label}
            className="aspect-square flex-1 rounded-[11px] border border-edge-chip text-[13px] data-[state=on]:border-transparent lg:rounded-[10px] lg:text-[12.5px]"
          >
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="mt-2.75 flex gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => onChange([...preset.days])}
            className={cn(
              "rounded-full border px-3.25 py-1.75 text-[12.5px] font-medium transition-colors",
              setsEqual(value, preset.days)
                ? "border-[#2e2e2e] bg-[#222222] text-ink-soft"
                : "border-edge-chip text-ink-dim"
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <FieldError msg={error} />
    </div>
  )
}
