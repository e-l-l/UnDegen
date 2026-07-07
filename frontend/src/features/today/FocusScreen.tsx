import { useEffect, useMemo, useState } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { Navigate } from "react-router"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { getDayItems } from "@/db/dayView"
import { formatMonthDay, parseLocalDate } from "@/db/recurrence"
import { completeWorkSession, startWorkSession } from "@/db/repo"
import type { WorkSession } from "@/db/types"
import { DaySwitcher } from "./DaySwitcher"
import { LongTaskCard } from "./LongTaskCard"
import { MobileTabBar } from "./MobileTabBar"
import { NewActivityFlow } from "./NewActivityFlow"
import { useSelectedDay } from "./selectedDay"
import { relativeTitle } from "./useTodayData"

interface FocusScreenProps {
  userId: string
}

// The Focus tab is mobile-only (root CLAUDE.md nav divergence): desktop surfaces
// the same long tasks in Today's right-hand rail, so there's no desktop Focus
// destination. DesktopIsland has no Focus tab to reach this route, but a deep
// link / stale URL can still land here — redirect those to /today rather than
// render a blank lg:hidden shell. A route redirect has no CSS equivalent, so
// this is the one place we branch on a JS media query.
function useIsDesktop() {
  const query = "(min-width: 1024px)" // Tailwind lg
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setIsDesktop(mq.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])
  return isDesktop
}

// Mobile home for long tasks — the counterpart to Today's desktop Long-tasks
// rail, built from the same primitives (LongTaskCard, MobileTabBar). Reads long
// tasks straight off getDayItems (the shared read API) rather than useTodayData:
// Focus needs neither the reminder buckets/counts nor the minute-tick clock that
// hook maintains, so a lean [userId]-keyed live query avoids a per-minute
// re-render for data this screen would discard. Writes go through repo.ts.
export function FocusScreen({ userId }: FocusScreenProps) {
  const isDesktop = useIsDesktop()
  const { selectedDate, isToday, realToday } = useSelectedDay()
  const items = useLiveQuery(() => getDayItems(userId, selectedDate), [userId, selectedDate])
  const [creatingActivity, setCreatingActivity] = useState(false)

  const startSession = (activityId: string) => {
    if (!isToday) return // review-only off-today
    void startWorkSession(userId, selectedDate, activityId)
  }
  const stopSession = (session: WorkSession) => {
    void completeWorkSession(session)
  }

  // Active session pinned first (only one can be in_progress at a time — see
  // LongTaskCard); the rest keep getDayItems' position order.
  const ordered = useMemo(
    () =>
      (items ?? [])
        .filter((i) => i.activity.type === "long_task")
        .sort((a, b) => {
          const aActive = a.sessions.some((s) => s.status === "in_progress") ? 0 : 1
          const bActive = b.sessions.some((s) => s.status === "in_progress") ? 0 : 1
          return aActive !== bActive ? aActive - bActive : a.activity.position - b.activity.position
        }),
    [items]
  )

  if (isDesktop) return <Navigate to="/today" replace />

  const monthDay = formatMonthDay(parseLocalDate(selectedDate))

  // Empty timeline: today gets the create-oriented prompt; a review-only day gets
  // a calm single line, no CTA (can't act on another day).
  const emptyState = isToday ? (
    <FocusEmptyState onCreate={() => setCreatingActivity(true)} />
  ) : (
    <div className="mt-16 text-center text-[14px] text-ink-muted">
      {selectedDate < realToday ? "Nothing logged that day." : "Nothing planned yet."}
    </div>
  )

  return (
    <>
      <div className="flex h-svh flex-col bg-background">
        <div className="shrink-0 px-5.5 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-2">
          <div className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-faint">
            {isToday ? "Focus" : `${relativeTitle(selectedDate, realToday)} · ${monthDay}`}
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="text-[30px] font-semibold tracking-[-0.02em] text-ink">Long tasks</div>
            <DaySwitcher />
          </div>
          <div className="mt-1.5 text-[14px] text-ink-muted">Needs a focus session, not a checkbox</div>
        </div>

        <div className="flex-1 overflow-auto px-5.5 pt-3.5 pb-2">
          {items === undefined ? null : ordered.length === 0 ? (
            emptyState
          ) : (
            <div className="flex flex-col gap-3.5">
              {ordered.map((item) => (
                <LongTaskCard
                  key={item.activity.id}
                  item={item}
                  onStart={() => startSession(item.activity.id)}
                  onStop={stopSession}
                  userId={userId}
                  date={selectedDate}
                  readOnly={!isToday}
                />
              ))}
            </div>
          )}
        </div>

        <MobileTabBar />
      </div>

      <NewActivityFlow userId={userId} open={creatingActivity} onOpenChange={setCreatingActivity} />
    </>
  )
}

// Calm, non-punishing empty state (this is Focus, not Stats — no roast). The
// handoff flagged copy as TBD; this is a reasonable first pass. A create
// affordance keeps it from being a dead end, reusing the same dialog Today's FAB
// opens (it can create a long task or a reminder).
function FocusEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mt-16 flex flex-col items-center px-4 text-center">
      <div className="text-[17px] font-medium text-ink-soft">Nothing to focus on yet</div>
      <div className="mt-2 max-w-70 text-[14px] leading-relaxed text-ink-muted">
        Long tasks are the things that need a real session, not a checkbox. Add one when you're ready.
      </div>
      <Button type="button" onClick={onCreate} className="mt-6 rounded-full px-4">
        <Plus className="size-4" strokeWidth={2.2} />
        New activity
      </Button>
    </div>
  )
}
