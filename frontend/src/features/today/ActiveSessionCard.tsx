import { useEffect, useState } from "react"
import { Square } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { Activity, WorkSession } from "@/db/types"
import { iconForActivity } from "./iconForActivity"

interface ActiveSessionCardProps {
  activity: Activity
  session: WorkSession
  onStop: (session: WorkSession) => void
}

// Live M:SS ticking timer. Derives elapsed from a wall-clock diff against
// started_at on every tick (not a naive counter) so backgrounding/throttling
// the tab can't drift the display — see the design handoff's own note on this.
function formatMMSS(totalSecs: number) {
  const s = Math.max(0, Math.floor(totalSecs))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, "0")}`
}

export function ActiveSessionCard({ activity, session, onStop }: ActiveSessionCardProps) {
  const [, tick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [session.id])

  const isGoal = session.mode === "goal"
  const goalSecs = (session.goal_duration_mins ?? 0) * 60
  const rawElapsedSecs = (Date.now() - new Date(session.started_at).getTime()) / 1000
  const elapsedSecs = isGoal && goalSecs > 0 ? Math.min(rawElapsedSecs, goalSecs) : rawElapsedSecs
  const pct = isGoal && goalSecs > 0 ? Math.min(1, elapsedSecs / goalSecs) : 0
  const minsLeft = isGoal && goalSecs > 0 ? Math.max(0, Math.ceil((goalSecs - elapsedSecs) / 60)) : 0

  const Icon = iconForActivity(activity)

  return (
    <div className="relative overflow-hidden rounded-[18px] border border-session-border bg-session-bg p-4.5 motion-safe:animate-session-glow lg:rounded-2xl">
      <div
        className="pointer-events-none absolute -top-11 -right-7.5 size-50 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(242,167,187,0.14), rgba(242,167,187,0) 70%)" }}
      />

      <div className="flex items-center gap-3">
        <div className="relative flex size-10 shrink-0 items-center justify-center">
          <span className="absolute inset-0 rounded-[12px] border-[1.5px] border-pink/50 motion-safe:animate-session-ring" />
          <div className="flex size-10 items-center justify-center rounded-[11px] border border-session-border bg-session-icon-bg">
            <Icon className="size-4.75 text-pink" strokeWidth={1.7} />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15.5px] font-medium text-session-title lg:text-[14.5px]">{activity.name}</div>
          {!isGoal && <div className="mt-0.5 text-[12.5px] text-session-muted">Zen</div>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-pink/24 bg-pink/12 py-1.25 pr-2.75 pl-2.25">
          <span className="size-1.75 rounded-full bg-pink shadow-[0_0_8px_rgba(242,167,187,0.9)] motion-safe:animate-session-pulse" />
          <span className="text-[11.5px] font-semibold text-pink">In session</span>
        </div>
      </div>

      <div className="mt-4 flex items-baseline gap-2.25">
        <div className="text-[34px] leading-none font-semibold tracking-[-0.02em] text-session-timer tabular-nums lg:text-[30px]">
          {formatMMSS(elapsedSecs)}
        </div>
        <div className="text-[12.5px] text-session-muted">
          {isGoal ? `elapsed · goal ${session.goal_duration_mins} min` : "elapsed · no limit"}
        </div>
      </div>

      {isGoal ? (
        <>
          <div className="mt-3.5 h-1.75 overflow-hidden rounded-full bg-session-track">
            <div className="relative h-full overflow-hidden rounded-full bg-pink" style={{ width: `${pct * 100}%` }}>
              <div
                className="absolute inset-0 motion-safe:animate-session-shimmer"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 100%)",
                }}
              />
            </div>
          </div>
          <div className="mt-2.25 text-[12px] text-session-muted tabular-nums">
            {Math.round(pct * 100)}% of goal · {minsLeft} min left
          </div>
        </>
      ) : (
        <>
          <div
            className="mt-4 h-0.5 rounded-full motion-safe:animate-[sessionPulse_2.6s_ease-in-out_infinite]"
            style={{
              background: "linear-gradient(90deg, rgba(242,167,187,0) 0%, rgba(242,167,187,0.6) 50%, rgba(242,167,187,0) 100%)",
            }}
          />
          <div className="mt-3 text-[12px] text-session-muted">Counting up · finish whenever you're ready</div>
        </>
      )}

      <Button
        type="button"
        variant="outline"
        onClick={() => onStop(session)}
        className="mt-4 h-11.5 w-full rounded-[13px] text-[14.5px] font-medium hover:border-pink/40 hover:bg-pink/10 hover:text-pink lg:h-11 lg:rounded-xl"
      >
        <Square className="size-3 fill-current" strokeWidth={0} />
        {isGoal ? "Stop session" : "Finish"}
      </Button>
    </div>
  )
}
