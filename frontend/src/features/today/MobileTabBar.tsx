import { BarChart3, Disc2, List, User } from "lucide-react"

import { cn } from "@/lib/utils"

// Mobile keeps a Focus tab (no side rail to surface long tasks on this form
// factor) — desktop drops it in favor of the Long-tasks rail. See root
// CLAUDE.md's nav divergence note. Focus/Stats/You are visual-only stubs: no
// router exists yet and only Today is built.
const TABS = [
  { label: "Today", Icon: List, active: true },
  { label: "Focus", Icon: Disc2, active: false },
  { label: "Stats", Icon: BarChart3, active: false },
  { label: "You", Icon: User, active: false },
] as const

export function MobileTabBar() {
  return (
    <div className="flex shrink-0 border-t border-surface-raised bg-background px-4.5 pt-2.5 pb-[calc(env(safe-area-inset-bottom)_+_0.625rem)]">
      {TABS.map(({ label, Icon, active }) => (
        <div key={label} className="flex flex-1 flex-col items-center gap-1.25">
          <Icon className={cn("size-5.5", active ? "text-pink" : "text-ink-faint")} strokeWidth={1.6} />
          <span className={cn("text-[10.5px] font-medium", active ? "text-pink" : "text-ink-faint")}>
            {label}
          </span>
        </div>
      ))}
    </div>
  )
}
