import { ChevronLeft, ChevronRight } from "lucide-react"

import { useSelectedDay } from "./selectedDay"

// Day switcher — steps the viewed day within the ±DAY_WINDOW window; the "Today"
// button (shown only off-today) is the way home since there's no calendar jump.
// Grayscale only — pink is reserved for CTA/brand/live (index.css). The header
// title/eyebrow already name the viewed day, so this is just the controls.
//
// Single component for both breakpoints: chevrons/pill scale up at lg: (32→34px)
// so the mobile header and Today's desktop title row share one control. Disabled
// chevrons drop to a low-emphasis fill/border/stroke (not just opacity) so a
// bound reads as "wall", not "faded button". Hover only lifts the border — never
// pink, never a fill flash. Visuals per DESIGN_HANDOFF_day_switcher.md.
export function DaySwitcher() {
  const { isToday, stepDay, goToday, canGoBack, canGoForward } = useSelectedDay()

  // lucide icons stroke `currentColor`, so the chevron colour rides the button's
  // text colour — enabled #8a8a8a, disabled #3a3a3a — no per-icon class needed.
  const chevron =
    "flex size-8 items-center justify-center rounded-[10px] border bg-surface border-edge-chip text-[#8a8a8a] transition-colors enabled:hover:border-[#3a3a3a] disabled:bg-[#141414] disabled:border-[#1e1e1e] disabled:text-[#3a3a3a] lg:size-[34px]"

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Previous day"
          onClick={() => stepDay(-1)}
          disabled={!canGoBack}
          className={chevron}
        >
          <ChevronLeft className="size-4 lg:size-[17px]" strokeWidth={2} />
        </button>
        <button
          type="button"
          aria-label="Next day"
          onClick={() => stepDay(1)}
          disabled={!canGoForward}
          className={chevron}
        >
          <ChevronRight className="size-4 lg:size-[17px]" strokeWidth={2} />
        </button>
      </div>
      {!isToday && (
        <button
          type="button"
          onClick={goToday}
          className="flex h-8 items-center rounded-full border border-edge-chip bg-surface px-[13px] text-[13px] font-semibold text-[#bfbfbf] transition-colors hover:border-[#3a3a3a] lg:h-[34px] lg:px-[15px]"
        >
          Today
        </button>
      )}
    </div>
  )
}
