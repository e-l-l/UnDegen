import { BarChart3, Disc2, List, User } from "lucide-react"
import { useLocation, useNavigate } from "react-router"

import { cn } from "@/lib/utils"

// Mobile keeps a Focus tab (no side rail to surface long tasks on this form
// factor) — desktop drops it in favor of the Long-tasks rail. See root
// CLAUDE.md's nav divergence note. Today, Focus, Stats and You are all real routes.
const TABS = [
  { label: "Today", Icon: List, to: "/today" },
  { label: "Focus", Icon: Disc2, to: "/focus" },
  { label: "Stats", Icon: BarChart3, to: "/stats" },
  { label: "You", Icon: User, to: "/you" },
] as const

export function MobileTabBar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  return (
    <div className="flex shrink-0 border-t border-surface-raised bg-background px-4.5 pt-2.5 pb-[calc(env(safe-area-inset-bottom)_+_0.625rem)]">
      {TABS.map(({ label, Icon, to }) => {
        const active = pathname === to || pathname.startsWith(`${to}/`)
        return (
          <button
            key={label}
            type="button"
            onClick={() => navigate(to)}
            className="flex flex-1 flex-col items-center gap-1.25"
          >
            <Icon className={cn("size-5.5", active ? "text-pink" : "text-ink-faint")} strokeWidth={1.6} />
            <span className={cn("text-[10.5px] font-medium", active ? "text-pink" : "text-ink-faint")}>
              {label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
