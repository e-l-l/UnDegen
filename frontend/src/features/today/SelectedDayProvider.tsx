import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"

import { addDays, todayLocal } from "@/db/recurrence"
import { DAY_WINDOW, SelectedDayContext, type SelectedDayValue } from "./selectedDay"

// Holds the day switcher's viewed day. Mounted above the routes (App.tsx) so it
// survives tabbing between /today and /focus, while still starting at today on
// cold start (initial state). Hook + context live in selectedDay.ts.
export function SelectedDayProvider({ children }: { children: ReactNode }) {
  const [selectedDate, setSelectedDate] = useState(() => todayLocal())

  // Recomputed each render so bounds/labels stay correct if the app is left open
  // across midnight (the switcher re-renders on any step, refreshing this).
  const realToday = todayLocal()
  const floor = addDays(realToday, -DAY_WINDOW)
  const ceil = addDays(realToday, DAY_WINDOW)

  const stepDay = useCallback(
    (delta: number) => {
      setSelectedDate((prev) => {
        const next = addDays(prev, delta)
        // Clamp into the window (string dates are lexicographically comparable).
        return next < floor ? floor : next > ceil ? ceil : next
      })
    },
    [floor, ceil]
  )

  const goToday = useCallback(() => setSelectedDate(todayLocal()), [])

  // Reset to today when a notification is tapped. Cold start already lands on
  // today via the initial state; this covers the app-already-open case, where
  // the SW focuses the existing window and posts `notification-click` rather than
  // navigating (see sw.ts). Best-effort — no-op if the SW never posts.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    const onMessage = (e: MessageEvent) => {
      if ((e.data as { type?: string } | undefined)?.type === "notification-click") goToday()
    }
    navigator.serviceWorker.addEventListener("message", onMessage)
    return () => navigator.serviceWorker.removeEventListener("message", onMessage)
  }, [goToday])

  const value = useMemo<SelectedDayValue>(
    () => ({
      selectedDate,
      realToday,
      isToday: selectedDate === realToday,
      stepDay,
      goToday,
      canGoBack: selectedDate > floor,
      canGoForward: selectedDate < ceil,
    }),
    [selectedDate, realToday, floor, ceil, stepDay, goToday]
  )

  return <SelectedDayContext.Provider value={value}>{children}</SelectedDayContext.Provider>
}
