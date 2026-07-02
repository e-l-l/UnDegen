import * as React from "react"
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group"

import { cn } from "@/lib/utils"

// Segmented controls, weekday cells, preset/duration/interval chips — every
// selectable-option control in the app. Selected state is grayscale-only
// (bg-elevated / lg:bg-elevated-lg) per the hard "pink is CTA-only" rule; never
// tint a selected item pink. Layout (track bg/padding/gap/radius, chip vs.
// segment vs. square-cell shape) is a call-site concern — this only owns the
// selection color/text/focus treatment shared by every use.
function ToggleGroup({ className, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      className={cn("flex items-center", className)}
      {...props}
    />
  )
}

function ToggleGroupItem({ className, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium text-ink-dim outline-none transition-colors",
        "data-[state=on]:bg-elevated data-[state=on]:font-semibold data-[state=on]:text-ink lg:data-[state=on]:bg-elevated-lg",
        "focus-visible:ring-[3px] focus-visible:ring-ring/20",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { ToggleGroup, ToggleGroupItem }
