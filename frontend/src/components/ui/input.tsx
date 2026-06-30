import * as React from "react"

import { cn } from "@/lib/utils"

// Base input: mobile surface (#1A1A1A). Desktop bg/height tweaks are applied at
// the call site (lg:bg-surface-raised, heights) per the handoff.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-[50px] w-full min-w-0 rounded-[13px] border border-input bg-surface px-[15px] text-[15px] text-ink-soft outline-none transition-colors",
        "placeholder:text-ink-faint",
        "focus-visible:border-[#3a3a3a] focus-visible:ring-[3px] focus-visible:ring-ring/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "[&::-ms-reveal]:hidden [&::-ms-clear]:hidden",
        className
      )}
      {...props}
    />
  )
}

export { Input }
