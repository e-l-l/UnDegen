import { createContext, useContext } from "react"

// How far the day switcher can travel from real today, in each direction.
export const DAY_WINDOW = 7

// The **viewed day** — the calendar date Today/Focus are currently showing, which
// may differ from **real today** (`todayLocal()`, the only day that accepts
// writes; see CLAUDE.md). Provided by SelectedDayProvider, which is lifted above
// the routes (App.tsx) so the viewed day survives tabbing between /today and
// /focus rather than resetting on each screen's unmount.
export interface SelectedDayValue {
  selectedDate: string // YYYY-MM-DD
  realToday: string
  isToday: boolean
  stepDay: (delta: number) => void
  goToday: () => void
  canGoBack: boolean // not yet at real today − DAY_WINDOW
  canGoForward: boolean // not yet at real today + DAY_WINDOW
}

export const SelectedDayContext = createContext<SelectedDayValue | null>(null)

export function useSelectedDay(): SelectedDayValue {
  const ctx = useContext(SelectedDayContext)
  if (!ctx) throw new Error("useSelectedDay must be used within SelectedDayProvider")
  return ctx
}
