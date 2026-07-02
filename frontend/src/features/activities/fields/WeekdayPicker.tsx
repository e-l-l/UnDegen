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
// current selection doesn't set-equal any preset.
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
      <ToggleGroup
        type="single"
        value={PRESETS.find((preset) => setsEqual(value, preset.days))?.label ?? ""}
        onValueChange={(v) => {
          const preset = PRESETS.find((p) => p.label === v)
          if (preset) onChange([...preset.days])
        }}
        className="mt-2.75 gap-2"
      >
        {PRESETS.map((preset) => (
          <ToggleGroupItem
            key={preset.label}
            value={preset.label}
            className={cn(
              "rounded-full border border-edge-chip px-3.25 py-1.75 text-[12.5px]",
              "data-[state=on]:border-[#2e2e2e] data-[state=on]:bg-[#222222] data-[state=on]:text-ink-soft"
            )}
          >
            {preset.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <FieldError msg={error ?? (value.length === 0 ? "Pick at least one day" : undefined)} />
    </div>
  )
}
