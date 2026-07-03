import { BarChart3, List } from "lucide-react"

import { cn } from "@/lib/utils"

// Desktop drops the mobile Focus tab — long tasks/focus sessions already have
// a home in the Long-tasks rail on this form factor, so a separate Focus
// destination would be redundant here (mobile has no side rail, so it keeps
// its own Focus tab). Stats is a visual-only stub: no router exists yet. You
// tab hidden until specced.
const SEGMENTS = [
  { label: "Today", Icon: List, active: true },
  { label: "Stats", Icon: BarChart3, active: false },
] as const

export function DesktopIsland() {
  // A macOS-style window frame (traffic lights, rounded/bordered outer
  // border) was considered and rejected: this is a browser-tab PWA, not an
  // Electron/native shell, and the real browser window already supplies
  // window chrome. Fake traffic lights here would read as a broken
  // impersonation of a native app inside a browser tab, so they're dropped;
  // the floating nav island itself is kept as a legitimate, chrome-independent
  // design choice.
  // Absolute overlay, not a normal-flow flex item: a transparent flex row
  // sitting above the body still pushes the Long-tasks rail's bg/border to
  // start below it, reading as a seam between "island strip" and "body strip"
  // even with no fill of its own. Overlaying the island and letting the body
  // fill the full window height keeps the rail's surface continuous
  // top-to-bottom, with the island floating over it. Root is pointer-events
  // none so it doesn't block the body underneath; the two interactive
  // clusters opt back in.
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-(--island-h) items-center justify-end px-4.5">
      <div className="pointer-events-auto absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-0.75 rounded-full border border-[#282828] bg-[#191919] p-1.25 shadow-[0_10px_26px_rgba(0,0,0,0.5)]">
        {SEGMENTS.map(({ label, Icon, active }) => (
          <div
            key={label}
            className={cn("flex items-center gap-2 rounded-full px-3.75 py-1.75", active && "bg-[#241b1e]")}
          >
            <Icon className={cn("size-4.25", active ? "text-pink" : "text-[#6e6e6e]")} strokeWidth={1.8} />
            <span className={cn("text-[13px]", active ? "font-semibold text-[#f0dbe1]" : "font-medium text-ink-body")}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
