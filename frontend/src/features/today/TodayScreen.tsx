import { useLayoutEffect, useRef, useState } from "react"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { todayLocal } from "@/db/recurrence"
import { clearReminder, completeWorkSession, markReminder, startWorkSession } from "@/db/repo"
import type { WorkSession } from "@/db/types"
import { NewActivityDialog } from "@/features/activities/NewActivityDialog"
import { NotificationAsk } from "@/features/notifications/NotificationAsk"
import { shouldOfferAsk } from "@/push/ask"
import { supabase } from "@/utils/supabase"
import { DesktopIsland } from "./DesktopIsland"
import { LongTaskCard } from "./LongTaskCard"
import { MobileTabBar } from "./MobileTabBar"
import { Timeline } from "./Timeline"
import { useTodayData } from "./useTodayData"

interface TodayScreenProps {
  userId: string
}

// Temporary, mirrors the old placeholder screen's own comment: no "You"
// screen exists yet to own this, so it's a small text link at the end of the
// primary scroll content until one does.
function SignOutLink() {
  return (
    <div className="py-6 text-center">
      <button
        type="button"
        onClick={() => void supabase.auth.signOut()}
        className="text-[13px] text-ink-soft underline-offset-4 transition-colors hover:text-ink hover:underline"
      >
        Sign out
      </button>
    </div>
  )
}

export function TodayScreen({ userId }: TodayScreenProps) {
  const data = useTodayData(userId)
  const [creatingActivity, setCreatingActivity] = useState(false)
  const [askNotifications, setAskNotifications] = useState(false)

  const mobileScrollRef = useRef<HTMLDivElement>(null)
  const mobileNowRef = useRef<HTMLDivElement>(null)
  const desktopScrollRef = useRef<HTMLDivElement>(null)
  const desktopNowRef = useRef<HTMLDivElement>(null)
  const scrolledRef = useRef(false)

  // Scroll so NOW is comfortably in view on first load — a computed offset,
  // never scrollIntoView (unreliable with a scroll container inside a flex-1
  // body, see NewActivityDialog.tsx's note on h-auto + flex for the same issue).
  useLayoutEffect(() => {
    if (scrolledRef.current || data.loading) return
    for (const [container, marker] of [
      [mobileScrollRef.current, mobileNowRef.current],
      [desktopScrollRef.current, desktopNowRef.current],
    ] as const) {
      if (container && marker) {
        container.scrollTop = marker.offsetTop - container.clientHeight / 2
      }
    }
    scrolledRef.current = true
  }, [data.loading])

  const today = todayLocal()

  const toggleDone = (activityId: string, done: boolean) => {
    void (done
      ? clearReminder(userId, today, activityId)
      : markReminder(userId, today, activityId, "done"))
  }

  const startSession = (activityId: string) => {
    void startWorkSession(userId, today, activityId)
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
          <div className="mt-2 text-[30px] font-semibold tracking-[-0.02em] text-ink">Today</div>
          <div className="mt-1.5 text-[14px] text-ink-muted">
            {data.doneCount} done · {data.toGoCount} to go today
          </div>
        </div>

        <div ref={mobileScrollRef} className="flex-1 overflow-auto px-5.5 pb-2">
          <Timeline
            ref={mobileNowRef}
            earlier={data.earlier}
            upNext={data.upNext}
            nowLabel={data.nowLabel}
            onToggleDone={toggleDone}
            userId={userId}
            date={today}
          />
          <SignOutLink />
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
            <div className="mt-1.5 flex items-center justify-between">
              <div className="text-[27px] font-semibold tracking-[-0.02em] text-ink">Today</div>
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
            <div className="mt-1 mb-6 text-[14px] text-ink-muted">
              {data.doneCount} done · {data.toGoCount} to go today
            </div>
            <Timeline
              ref={desktopNowRef}
              earlier={data.earlier}
              upNext={data.upNext}
              nowLabel={data.nowLabel}
              onToggleDone={toggleDone}
              userId={userId}
              date={today}
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
                  date={today}
                />
              ))}
            </div>
            <SignOutLink />
          </div>
        </div>
      </div>

      {creatingActivity && (
        <NewActivityDialog
          userId={userId}
          onClose={() => setCreatingActivity(false)}
          onCreated={(type) => {
            // Highest-intent moment to ask — but only for reminders, and only if
            // we can still offer (not already granted/blocked, or iOS needs install).
            if (type === "reminder" && shouldOfferAsk()) setAskNotifications(true)
          }}
        />
      )}

      {askNotifications && (
        <NotificationAsk userId={userId} onClose={() => setAskNotifications(false)} />
      )}
    </>
  )
}
