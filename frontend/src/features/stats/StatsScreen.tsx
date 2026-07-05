import { useNavigate } from "react-router"

import { DesktopIsland } from "@/features/today/DesktopIsland"
import { MobileTabBar } from "@/features/today/MobileTabBar"
import { fmtMins, heroCopy } from "./copy"
import { FocusTrend } from "./FocusTrend"
import { Heatmap } from "./Heatmap"
import { ActivityList, DeltaChip, MostAvoided, SectionLabel } from "./parts"
import { deltaDir } from "./types"
import { useStatsOverview } from "./useStatsData"
import { WeekdayFlake } from "./WeekdayFlake"

// Stats overview — the honest mirror. Aggregate hero → most-avoided callout →
// shared visuals (heatmap, focus trend, flake map) → per-activity breakdown.
// Mobile/desktop are duplicated blocks (lg:hidden / hidden lg:block), not one
// responsive tree — the chromes genuinely differ (same house rule as
// TodayScreen/NewActivityDialog). Reads live Dexie data via useStatsOverview.

// Loading shell — keeps the chrome so nav stays put while Dexie resolves.
function StatsLoading() {
  return (
    <>
      <div className="flex h-svh flex-col bg-background lg:hidden">
        <div className="shrink-0 px-5.5 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-1">
          <div className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-faint">Rolling 7 days · to today</div>
          <div className="mt-2 text-[30px] font-semibold tracking-[-0.02em] text-ink">Stats</div>
        </div>
        <div className="flex flex-1 items-center justify-center px-5.5">
          <p className="text-[13px] text-ink-faint">Reading your history…</p>
        </div>
        <MobileTabBar />
      </div>
      <div className="relative hidden h-svh overflow-hidden bg-background lg:block">
        <DesktopIsland />
        <div className="flex h-full items-center justify-center">
          <p className="text-[13px] text-ink-faint">Reading your history…</p>
        </div>
      </div>
    </>
  )
}

export function StatsScreen({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const data = useStatsOverview(userId)
  const openActivity = (id: string) => navigate(`/stats/${id}`)

  if (!data) return <StatsLoading />

  const { week, prevWeek } = data
  const showedDir = deltaDir(week.showedUp, prevWeek.showedUp)
  const focusDir = deltaDir(week.focusMins, prevWeek.focusMins)
  const showedDeltaLabel = showedDir === "flat" ? "same" : `${prevWeek.showedUp} / ${prevWeek.planned}`
  const focusDeltaLabel = focusDir === "flat" ? "same" : fmtMins(prevWeek.focusMins)
  const roast = heroCopy(week.showedUp, week.planned, data.weeksDown)

  const isEmpty = week.planned === 0 && data.activities.length === 0
  const hasFocus = data.focusTrend.some((t) => t.mins > 0) || data.heatmap.some((row) => row.some((v) => v > 0))
  const hasReminders = data.activities.some((a) => a.type === "reminder" && !a.archived)
  const trendValues = data.focusTrend.map((t) => t.mins)

  return (
    <>
      {/* ════════ Mobile ════════ */}
      <div className="flex h-svh flex-col bg-background lg:hidden">
        <div className="shrink-0 px-5.5 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-1">
          <div className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-faint">Rolling 7 days · to today</div>
          <div className="mt-2 text-[30px] font-semibold tracking-[-0.02em] text-ink">Stats</div>
        </div>

        <div className="flex-1 overflow-auto px-5.5 pt-3.5 pb-2">
          {/* HERO */}
          <div className="flex items-baseline justify-between">
            <span className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-[#5A5A5A]">This week</span>
            <span className="text-[11px] text-[#5A5A5A]">vs last week</span>
          </div>
          <div className="mt-2.5 rounded-2xl border border-[#232323] bg-[#141414] p-[16px_18px]">
            <div className="flex items-center justify-between pb-3 pt-0.5">
              <div>
                <div className="mb-1.25 text-[11.5px] text-[#6E6E6E]">Showed up</div>
                <div className="text-[32px] font-semibold leading-none tracking-[-0.02em] text-ink tabular-nums">
                  {week.showedUp}
                  <span className="text-[19px] font-medium text-[#6E6E6E]"> / {week.planned}</span>
                </div>
              </div>
              <DeltaChip dir={showedDir} label={showedDeltaLabel} size="lg" />
            </div>
            <div className="h-px bg-[#232323]" />
            <div className="flex items-center justify-between pb-0.5 pt-3">
              <div>
                <div className="mb-1.25 text-[11.5px] text-[#6E6E6E]">Focus banked</div>
                <div className="text-[32px] font-semibold leading-none tracking-[-0.02em] text-ink tabular-nums">
                  {fmtMins(week.focusMins)}
                </div>
              </div>
              <DeltaChip dir={focusDir} label={focusDeltaLabel} size="lg" />
            </div>
          </div>
          <div className="px-1 pb-0.5 pt-3.5 text-[14.5px] leading-[1.5] text-[#9A9A9A]">{roast}</div>

          {/* MOST AVOIDED */}
          <SectionLabel className="mb-2.5 mt-6.5">Most avoided</SectionLabel>
          <MostAvoided avoid={data.mostAvoided} empty={isEmpty} />

          {!isEmpty && (
            <>
              {/* WHEN YOU FOCUS */}
              {hasFocus && (
                <>
                  <SectionLabel className="mb-1 mt-7">When you focus</SectionLabel>
                  <div className="mb-3 text-[12px] text-[#5E5E5E]">All-time · long-task sessions</div>
                  <Heatmap buckets={data.heatmap} laneGap={21} />

                  <SectionLabel className="mb-1 mt-7">Focus / week</SectionLabel>
                  <div className="mb-3.5 text-[12px] text-[#5E5E5E]">Last 8 weeks</div>
                  <FocusTrend values={trendValues} height={100} />
                </>
              )}

              {/* WHERE IT FALLS APART */}
              {hasReminders && (
                <>
                  <SectionLabel className="mb-1 mt-7">Where it falls apart</SectionLabel>
                  <div className="mb-3.5 text-[12px] text-[#5E5E5E]">Missed rate by weekday</div>
                  <WeekdayFlake rates={data.weekdayFlake} height={60} />
                </>
              )}

              {/* BY ACTIVITY */}
              <SectionLabel className="mb-1.5 mt-7">By activity</SectionLabel>
              <ActivityList rows={data.activities} onOpen={openActivity} />
            </>
          )}

          <div className="h-3" />
        </div>

        <MobileTabBar />
      </div>

      {/* ════════ Desktop ════════ */}
      <div className="relative hidden h-svh overflow-hidden bg-background lg:block">
        <DesktopIsland />
        <div className="h-full overflow-auto px-10 pt-[calc(var(--island-h)+0.5rem)] pb-8.5">
          <div className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-faint">Rolling 7 days · to today</div>
          <div className="mt-1.5 text-[27px] font-semibold tracking-[-0.02em] text-ink">Stats</div>

          {/* top row: hero + most avoided */}
          <div className="mt-5.5 flex items-stretch gap-5">
            <div className="min-w-0 flex-[1.35]">
              <div className="flex items-baseline justify-between">
                <span className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-[#5A5A5A]">This week</span>
                <span className="text-[11px] text-[#5A5A5A]">vs last week</span>
              </div>
              <div className="mt-2.5 flex gap-9 rounded-2xl border border-[#232323] bg-[#141414] p-[20px_22px]">
                <div className="flex-1">
                  <div className="mb-1.75 text-[11.5px] text-[#6E6E6E]">Showed up</div>
                  <div className="text-[40px] font-semibold leading-none tracking-[-0.02em] text-ink tabular-nums">
                    {week.showedUp}
                    <span className="text-[22px] font-medium text-[#6E6E6E]"> / {week.planned}</span>
                  </div>
                  <div className="mt-3">
                    <DeltaChip dir={showedDir} label={showedDeltaLabel} size="lg" />
                  </div>
                </div>
                <div className="w-px bg-[#232323]" />
                <div className="flex-1">
                  <div className="mb-1.75 text-[11.5px] text-[#6E6E6E]">Focus banked</div>
                  <div className="text-[40px] font-semibold leading-none tracking-[-0.02em] text-ink tabular-nums">
                    {fmtMins(week.focusMins)}
                  </div>
                  <div className="mt-3">
                    <DeltaChip dir={focusDir} label={focusDeltaLabel} size="lg" />
                  </div>
                </div>
              </div>
              <div className="px-0.5 pt-4 text-[15px] leading-[1.5] text-[#9A9A9A]">{roast}</div>
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <SectionLabel>Most avoided</SectionLabel>
              <div className="mt-2.5 flex-1">
                <MostAvoided avoid={data.mostAvoided} empty={isEmpty} big />
              </div>
            </div>
          </div>

          {!isEmpty && (
            <>
              {/* middle row: heatmap + (trend over flake) */}
              <div className="mt-7.5 flex items-start gap-5">
                {hasFocus && (
                  <div className="min-w-0 flex-[1.35]">
                    <SectionLabel>When you focus</SectionLabel>
                    <div className="mb-3.5 mt-1 text-[12px] text-[#5E5E5E]">All-time · long-task sessions, local start hour</div>
                    <Heatmap buckets={data.heatmap} laneGap={37.5} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  {hasFocus && (
                    <>
                      <SectionLabel>Focus / week</SectionLabel>
                      <div className="mb-3.5 mt-1 text-[12px] text-[#5E5E5E]">Last 8 weeks · minutes banked</div>
                      <FocusTrend values={trendValues} height={120} />
                    </>
                  )}
                  {hasReminders && (
                    <div className="mt-6.5">
                      <SectionLabel>Where it falls apart</SectionLabel>
                      <div className="mb-3.5 mt-1 text-[12px] text-[#5E5E5E]">Missed rate by weekday</div>
                      <WeekdayFlake rates={data.weekdayFlake} height={70} />
                    </div>
                  )}
                </div>
              </div>

              {/* by activity */}
              <SectionLabel className="mb-2 mt-8">By activity</SectionLabel>
              <ActivityList rows={data.activities} desktop onOpen={openActivity} />
            </>
          )}
        </div>
      </div>
    </>
  )
}
