import { useLayoutEffect, useRef, useState } from "react"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { clearReminder, completeWorkSession, markReminder, startWorkSession } from "@/db/repo"
import type { WorkSession } from "@/db/types"
import { DaySwitcher } from "./DaySwitcher"
import { DesktopIsland } from "./DesktopIsland"
import { LongTaskCard } from "./LongTaskCard"
import { MobileTabBar } from "./MobileTabBar"
import { NewActivityFlow } from "./NewActivityFlow"
import { useSelectedDay } from "./selectedDay"
import { Timeline } from "./Timeline"
import { useTodayData } from "./useTodayData"

interface TodayScreenProps {
  userId: string
}

export function TodayScreen({ userId }: TodayScreenProps) {
  const { selectedDate, realToday, isToday } = useSelectedDay()
  const data = useTodayData(userId, selectedDate)
  const [creatingActivity, setCreatingActivity] = useState(false)

  // Off-today empty timeline (pre-history past / empty future) — a calm line,
  // never a prompt to act (the day is read-only). ISO date strings compare
  // lexicographically, so `<` is a valid past check.
  const emptyMessage = selectedDate < realToday ? "Nothing tracked that day." : "Nothing planned yet."

  // Header count: today shows outstanding ("to go"); off-today, a neutral tally
  // (can't act on another day). Same in both the mobile and desktop chrome.
  const countLabel = isToday
    ? `${data.doneCount} done · ${data.toGoCount} to go today`
    : `${data.doneCount} of ${data.totalCount} done`

  const mobileScrollRef = useRef<HTMLDivElement>(null)
  const mobileNowRef = useRef<HTMLDivElement>(null)
  const desktopScrollRef = useRef<HTMLDivElement>(null)
  const desktopNowRef = useRef<HTMLDivElement>(null)
  const scrolledRef = useRef(false)

  // Scroll so NOW is comfortably in view on first load — a computed offset,
  // never scrollIntoView (unreliable with a scroll container inside a flex-1
  // body, see NewActivityDialog.tsx's note on h-auto + flex for the same issue).
  useLayoutEffect(() => {
    // Scroll-to-NOW only applies to today — off-today there's no NOW divider.
    if (scrolledRef.current || data.loading || !isToday) return
    for (const [container, marker] of [
      [mobileScrollRef.current, mobileNowRef.current],
      [desktopScrollRef.current, desktopNowRef.current],
    ] as const) {
      if (container && marker) {
        container.scrollTop = marker.offsetTop - container.clientHeight / 2
      }
    }
    scrolledRef.current = true
  }, [data.loading, isToday])

  // Writes only ever target real today — other days are review-only (the read-only
  // UI hides these affordances, and the guard is a belt-and-braces backstop).
  const toggleDone = (activityId: string, done: boolean) => {
    if (!isToday) return
    void (done
      ? clearReminder(userId, selectedDate, activityId)
      : markReminder(userId, selectedDate, activityId, "done"))
  }

  // "Missed it" — a deliberate dismissal stored as `skipped` (ADR 0001: derived
  // `missed` is never written; this is a real skip override). It silences the
  // occurrence's notifications; Undo clears the completion.
  const toggleMissed = (activityId: string, missed: boolean) => {
    if (!isToday) return
    void (missed
      ? clearReminder(userId, selectedDate, activityId)
      : markReminder(userId, selectedDate, activityId, "skipped"))
  }

  const startSession = (activityId: string) => {
    if (!isToday) return
    void startWorkSession(userId, selectedDate, activityId)
  }

  const stopSession = (session: WorkSession) => {
    void completeWorkSession(session)
  }

  return (
    <>
      {/* ════════ Mobile ════════ */}
      <div className="flex h-svh flex-col bg-background lg:hidden">
        <div className="shrink-0 px-5.5 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-2">
          <div className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-faint">{data.eyebrow}</div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="text-[30px] font-semibold tracking-[-0.02em] text-ink">{data.title}</div>
            <DaySwitcher />
          </div>
          <div className="mt-1.5 text-[14px] text-ink-muted">
            {countLabel}
          </div>
        </div>

        <div ref={mobileScrollRef} className="flex-1 overflow-auto px-5.5 pb-2">
          <Timeline
            ref={mobileNowRef}
            earlier={data.earlier}
            upNext={data.upNext}
            reminders={data.reminders}
            readOnly={!isToday}
            emptyMessage={emptyMessage}
            nowLabel={data.nowLabel}
            onToggleDone={toggleDone}
            onToggleMissed={toggleMissed}
            userId={userId}
            date={selectedDate}
          />
        </div>

        <MobileTabBar />

        <button
          type="button"
          onClick={() => setCreatingActivity(true)}
          aria-label="New activity"
          className="fixed right-5 bottom-[calc(104px+env(safe-area-inset-bottom))] flex size-14 items-center justify-center rounded-full bg-pink text-on-pink shadow-[0_0_22px_rgba(242,167,187,0.22)]"
        >
          <Plus className="size-6" strokeWidth={2} />
        </button>
      </div>

      {/* ════════ Desktop ════════ */}
      {/* DesktopIsland is an absolute overlay (not a normal-flow row above the
          body) so the rail's bg/border run full window height behind it —
          see the comment in DesktopIsland.tsx. Each pane clears the island
          with its own top padding, derived from --island-h (index.css) plus a
          small per-pane gap, so the island height lives in one place. */}
      <div className="relative hidden h-svh overflow-hidden bg-background lg:block">
        <DesktopIsland />
        <div className="flex h-full">
          <div ref={desktopScrollRef} className="flex-1 overflow-auto px-9 pt-[calc(var(--island-h)-0.5rem)] pb-7.5">
            <div className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-faint">{data.eyebrow}</div>
            {/* Switcher lives on the right (hi-fi spec, DESIGN_HANDOFF §4's mock),
                not clustered by the title; New Activity keeps the corner as the
                primary CTA, switcher immediately to its left. */}
            <div className="mt-1.5 flex items-center justify-between">
              <div className="text-[27px] font-semibold tracking-[-0.02em] text-ink">{data.title}</div>
              <div className="flex items-center gap-3">
                <DaySwitcher />
                <Button
                  type="button"
                  size="sm"
                  aria-label="New activity"
                  onClick={() => setCreatingActivity(true)}
                  className="rounded-full px-3.5"
                >
                  <Plus className="size-4" strokeWidth={2.2} />
                  New Activity
                </Button>
              </div>
            </div>
            <div className="mt-1 mb-6 text-[14px] text-ink-muted">
              {countLabel}
            </div>
            <Timeline
              ref={desktopNowRef}
              earlier={data.earlier}
              upNext={data.upNext}
              reminders={data.reminders}
              readOnly={!isToday}
              emptyMessage={emptyMessage}
              nowLabel={data.nowLabel}
              onToggleDone={toggleDone}
              onToggleMissed={toggleMissed}
              userId={userId}
              date={selectedDate}
            />
          </div>

          <div className="w-110 shrink-0 overflow-auto border-l border-edge-panel bg-panel px-5.5 pt-[calc(var(--island-h)+0.625rem)] pb-7">
            <div className="text-[16px] font-semibold text-[#e6e6e6]">Long tasks</div>
            <div className="mt-1 text-[13px] text-ink-faint">Needs a focus session, not a checkbox.</div>
            <div className="mt-4.5 flex flex-col gap-3.5">
              {data.longTasks.map((item) => (
                <LongTaskCard
                  key={item.activity.id}
                  item={item}
                  onStart={() => startSession(item.activity.id)}
                  onStop={stopSession}
                  userId={userId}
                  readOnly={!isToday}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <NewActivityFlow userId={userId} open={creatingActivity} onOpenChange={setCreatingActivity} />
    </>
  )
}
