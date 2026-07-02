import { BarChart3, Disc2, List, User } from "lucide-react"

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
    <div className="flex shrink-0 border-t border-[#161616] bg-background px-[18px] pt-2.5 pb-7.5">
      {TABS.map(({ label, Icon, active }) => (
        <div key={label} className="flex flex-1 flex-col items-center gap-[5px]">
          <Icon className={active ? "size-[22px] text-pink" : "size-[22px] text-[#555555]"} strokeWidth={1.6} />
          <span
            className={
              active ? "text-[10.5px] font-medium text-pink" : "text-[10.5px] font-medium text-[#555555]"
            }
          >
            {label}
          </span>
        </div>
      ))}
    </div>
  )
}
