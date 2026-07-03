import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils"
import { useDialogPortalContainer } from "./dialog"

function Popover({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

function PopoverTrigger({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

function PopoverContent({
  className,
  align = "start",
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  // Nested inside a Dialog, portal into Dialog.Content's own subtree instead
  // of document.body — otherwise Dialog's modal scroll-lock treats this
  // content as outside its bounds and swallows wheel/touch scroll over it
  // (see dialog.tsx's useDialogPortalContainer for the full explanation).
  // Outside a Dialog this is null, so Portal falls back to its document.body default.
  const dialogContainer = useDialogPortalContainer()

  return (
    <PopoverPrimitive.Portal container={dialogContainer ?? undefined}>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 rounded-[13px] border border-edge-panel bg-surface-raised text-ink-soft shadow-lg outline-none",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}

export { Popover, PopoverTrigger, PopoverContent }
