import type { ReactNode } from "react"
import { ChevronLeft } from "lucide-react"
import { useNavigate, useParams } from "react-router"

import { iconForActivity } from "@/features/today/iconForActivity"
import { fmtMins } from "./copy"
import { FocusTrend } from "./FocusTrend"
import { Heatmap } from "./Heatmap"
import { CompletionRow, DeltaMini, IconTile, SectionLabel, SessionRow } from "./parts"
import { deltaDir } from "./types"
import type { DeltaDir, StatsDetail } from "./types"
import { useStatsDetail } from "./useStatsData"

// Per-activity detail — full history for one activity. Depth is the point: its
// own heatmap (same component, scoped to this activity), the trend, and the raw
// log. The long-task variant is the designed one; the reminder variant follows
// the described spec (adherence chart + completion log) so every breakdown row's
// drill-down is functional. Mobile/desktop are duplicated blocks per house rule;
// the long/reminder body branches on data (not breakpoint). Reads live Dexie data
// via useStatsDetail.

function deltaLabel(dir: DeltaDir, amount: string, suffix = ""): string {
  if (dir === "flat") return `same${suffix}`
  return `${dir} ${amount}${suffix}`
}

function SummaryCard({ label, value, foot, pad }: { label: string; value: string; foot: ReactNode; pad: string }) {
  return (
    <div className={`flex-1 rounded-[14px] border border-[#232323] bg-[#141414] ${pad}`}>
      <div className="text-[11.5px] text-[#6E6E6E]">{label}</div>
      <div className="mt-1.5 text-[24px] font-semibold text-ink tabular-nums lg:text-[28px]">{value}</div>
      <div className="mt-2.5">{foot}</div>
    </div>
  )
}

function DetailBody({ detail, desktop }: { detail: StatsDetail; desktop: boolean }) {
  const isLong = detail.type === "long_task"

  // long-task deltas
  const focusCur = detail.week?.focusMins ?? 0
  const focusPrev = detail.prevWeek?.focusMins ?? 0
  const focusDir = deltaDir(focusCur, focusPrev)
  const focusDeltaAmt = fmtMins(Math.abs(focusCur - focusPrev))

  // reminder deltas
  const adhCur = detail.weekAdherence?.done ?? 0
  const adhPrev = detail.prevWeekAdherence?.done ?? 0
  const adhDir = deltaDir(adhCur, adhPrev)

  const trendValues = isLong
    ? (detail.focusTrend ?? []).map((t) => t.mins)
    : (detail.adherenceTrend ?? []).map((r) => Math.round(r * 100))

  return (
    <>
      {/* summary cards */}
      <div className={desktop ? "flex gap-3" : "flex gap-2.5"}>
        {isLong ? (
          <>
            <SummaryCard
              label="This week"
              value={fmtMins(focusCur)}
              pad={desktop ? "p-[16px_18px]" : "p-3.5"}
              foot={<DeltaMini dir={focusDir} label={deltaLabel(focusDir, focusDeltaAmt, desktop ? " vs last" : "")} />}
            />
            <SummaryCard
              label="All-time"
              value={fmtMins(detail.allTime?.focusMins ?? 0)}
              pad={desktop ? "p-[16px_18px]" : "p-3.5"}
              foot={
                <span className="text-[11.5px] text-[#6E6E6E] lg:text-[12px]">
                  {detail.allTime?.sessionCount ?? 0} sessions{desktop ? ` · avg ${detail.allTime?.avgMins ?? 0}m` : ""}
                </span>
              }
            />
          </>
        ) : (
          <>
            <SummaryCard
              label="This week"
              value={`${adhCur} / ${detail.weekAdherence?.planned ?? 0}`}
              pad={desktop ? "p-[16px_18px]" : "p-3.5"}
              foot={<DeltaMini dir={adhDir} label={deltaLabel(adhDir, `${Math.abs(adhCur - adhPrev)}`, desktop ? " vs last" : "")} />}
            />
            <SummaryCard
              label="Adherence"
              value={`${detail.weekAdherence?.planned ? Math.round((adhCur / detail.weekAdherence.planned) * 100) : 0}%`}
              pad={desktop ? "p-[16px_18px]" : "p-3.5"}
              foot={<span className="text-[11.5px] text-[#6E6E6E] lg:text-[12px]">this week</span>}
            />
          </>
        )}
      </div>

      {/* trend */}
      <SectionLabel className="mb-1 mt-6.5 lg:mt-7">{isLong ? "Focus / week" : "Adherence / week"}</SectionLabel>
      <div className="mb-3.5 text-[12px] text-[#5E5E5E]">
        {isLong ? "Last 8 weeks" : "Last 8 weeks · % of planned done"}
      </div>
      <FocusTrend
        values={trendValues}
        height={desktop ? 130 : 100}
        showValueTooltip={isLong}
      />

      {/* long-task: heatmap here (desktop keeps it in the left column too) */}
      {isLong && (
        <>
          <SectionLabel className="mb-1 mt-7 lg:mt-7.5">When</SectionLabel>
          <div className="mb-3 text-[12px] text-[#5E5E5E]">This activity's sessions, all-time</div>
          <Heatmap buckets={detail.heatmap ?? []} laneGap={desktop ? 23 : 21} />
        </>
      )}
    </>
  )
}

// Loading / not-found shell — a back affordance and a line, no chrome (detail
// has no nav island by design; back is the way out).
function DetailMessage({ text, onBack }: { text: string; onBack: () => void }) {
  return (
    <div className="flex h-svh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <p className="text-[14px] text-ink-body">{text}</p>
      <button
        type="button"
        onClick={onBack}
        className="text-[13px] text-ink-soft underline-offset-4 transition-colors hover:text-ink hover:underline"
      >
        Back to stats
      </button>
    </div>
  )
}

export function StatsDetailScreen({ userId }: { userId: string }) {
  const { activityId } = useParams()
  const navigate = useNavigate()
  const detail = useStatsDetail(userId, activityId)
  const back = () => navigate("/stats")

  if (detail === undefined) return <DetailMessage text="Reading your history…" onBack={back} />
  if (detail === null) return <DetailMessage text="That activity isn't here anymore." onBack={back} />

  const Icon = iconForActivity(detail)
  const typeLabel = detail.type === "long_task" ? "Long task" : "Reminder"
  const badgeText = detail.category ? `${typeLabel} · ${detail.category}` : typeLabel
  const isLong = detail.type === "long_task"

  return (
    <>
      {/* ════════ Mobile ════════ */}
      <div className="flex h-svh flex-col bg-background lg:hidden">
        <div className="shrink-0 px-5.5 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-1">
          <button type="button" onClick={back} className="flex items-center gap-1.5 text-[#8A8A8A]">
            <ChevronLeft size={18} strokeWidth={1.8} />
            <span className="text-[14px] font-[450]">Stats</span>
          </button>
          <div className="mt-4 flex items-center gap-3">
            <IconTile Icon={Icon} size={44} stroke="#9A9A9A" />
            <div className="min-w-0 flex-1">
              <div className="text-[20px] font-semibold tracking-[-0.01em] text-ink">{detail.name}</div>
              <span className="mt-1.25 inline-block rounded-full border border-[#2A2A2A] bg-[#1A1A1A] px-2.25 py-[3px] text-[11px] font-medium uppercase tracking-[0.04em] text-[#8A8A8A]">
                {typeLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-5.5 pt-5 pb-6">
          <DetailBody detail={detail} desktop={false} />
          <SectionLabel className="mb-2 mt-7">{isLong ? "Sessions" : "Log"}</SectionLabel>
          {isLong
            ? (detail.sessions ?? []).slice(0, 7).map((s) => <SessionRow key={s.id} session={s} />)
            : (detail.completionLog ?? []).map((r) => <CompletionRow key={r.id} record={r} />)}
        </div>
      </div>

      {/* ════════ Desktop ════════ */}
      <div className="relative hidden h-svh overflow-hidden bg-background lg:block">
        <div className="h-full overflow-auto px-11 pt-10 pb-8.5">
          <button type="button" onClick={back} className="flex items-center gap-1.5 text-[#8A8A8A]">
            <ChevronLeft size={17} strokeWidth={1.8} />
            <span className="text-[13.5px] font-[450]">Stats</span>
          </button>
          <div className="mt-4 flex items-center gap-3.5">
            <IconTile Icon={Icon} size={48} stroke="#9A9A9A" />
            <div>
              <div className="text-[26px] font-semibold tracking-[-0.02em] text-ink">{detail.name}</div>
              <span className="mt-1.5 inline-block rounded-full border border-[#2A2A2A] bg-[#1A1A1A] px-2.5 py-[3px] text-[11px] font-medium uppercase tracking-[0.04em] text-[#8A8A8A]">
                {badgeText}
              </span>
            </div>
          </div>

          <div className="mt-6.5 flex items-start gap-5">
            <div className="min-w-0 flex-[1.3]">
              <DetailBody detail={detail} desktop />
            </div>
            <div className="min-w-0 flex-1">
              <SectionLabel className="mb-2">{isLong ? "Sessions" : "Log"}</SectionLabel>
              {isLong
                ? (detail.sessions ?? []).map((s) => <SessionRow key={s.id} session={s} />)
                : (detail.completionLog ?? []).map((r) => <CompletionRow key={r.id} record={r} />)}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
