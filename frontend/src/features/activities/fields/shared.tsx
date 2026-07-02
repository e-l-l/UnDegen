import type { ComponentType, ReactNode, SVGProps } from "react"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

// Presentational helpers shared by every field in this form. Kept local
// to this feature (not promoted to a shared components dir) until a third
// feature needs them — same call the auth feature made for its own FieldError.

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2.25 text-[11.5px] font-semibold tracking-[0.08em] text-ink-faint uppercase lg:text-ink-muted">
      {children}
    </div>
  )
}

// Sub-label for a control nested inside a section (e.g. "Every"/"From"/
// "Until" under a Reminder-style field) — lighter weight than SectionLabel,
// which marks the section itself.
export function MiniLabel({ children }: { children: ReactNode }) {
  return <div className="mb-1.75 text-[11.5px] text-ink-dim">{children}</div>
}

export function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return (
    <p className="mt-1.75 flex items-center gap-1.5 text-[11.5px] text-ink-faint">
      <span className="size-1 rounded-full bg-destructive/70" />
      {msg}
    </p>
  )
}

type SegmentedOption<T extends string> = {
  value: T
  label: ReactNode
  icon?: ComponentType<SVGProps<SVGSVGElement>>
}

type SegmentedToggleProps<T extends string> = {
  label: ReactNode
  value: T
  onChange: (value: T) => void
  options: SegmentedOption<T>[]
  itemClassName?: string
  caption?: ReactNode
}

// Shared shell for the form's two-option segmented controls (Type,
// Reminder style, Mode) — same chip/track chrome, differing only in options
// and item sizing.
export function SegmentedToggle<T extends string>({
  label,
  value,
  onChange,
  options,
  itemClassName = "h-10 flex-1 rounded-[10px] text-[14px] lg:h-10.5",
  caption,
}: SegmentedToggleProps<T>) {
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(v) => v && onChange(v as T)}
        className="gap-1 rounded-[13px] border border-edge-chip bg-[#161616] p-1 lg:gap-1.25 lg:bg-surface"
      >
        {options.map((opt) => (
          <ToggleGroupItem key={opt.value} value={opt.value} className={itemClassName}>
            {opt.icon && <opt.icon className="size-3.75" />}
            {opt.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {caption}
    </div>
  )
}
