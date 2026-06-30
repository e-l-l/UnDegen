import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold outline-none transition-all disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 focus-visible:ring-[3px] focus-visible:ring-ring/30",
  {
    variants: {
      variant: {
        // the pink CTA — the only pink, plus its soft glow
        default:
          "bg-primary text-primary-foreground shadow-[0_0_22px_rgba(242,167,187,0.22)] hover:bg-pink-hover",
        // grayscale secondary / social — never pink, even on hover
        outline:
          "border border-border bg-transparent font-medium text-secondary-foreground hover:border-[#3a3a3a] hover:bg-surface-raised",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "font-medium text-ink-soft underline-offset-4 hover:text-foreground",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-[52px] rounded-[14px] px-6 text-[16px]",
        icon: "size-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
