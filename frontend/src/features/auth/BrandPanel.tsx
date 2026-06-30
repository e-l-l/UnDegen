import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import { BarChart, Clock, LogoCheck, Target } from "./icons"
import type { AuthMode } from "./useAuthForm"

function FeatureRow({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <li className="flex items-center gap-3.25">
      <span className="flex size-7.5 shrink-0 items-center justify-center rounded-[9px] border border-edge-chip bg-surface text-ink-body">
        {icon}
      </span>
      <span className="text-[14.5px] text-ink-body">{label}</span>
    </li>
  )
}

// Desktop-only left pane (46%). Login → bottom-anchored headline; signup →
// vertically-centred headline + feature list. The pink radial is ambient, not
// a "pink thing" — it sits under everything at ~10% opacity.
export function BrandPanel({ mode, className }: { mode: AuthMode; className?: string }) {
  return (
    <aside
      className={cn(
        "relative w-[46%] shrink-0 flex-col overflow-hidden border-r border-edge-panel bg-panel p-13.5",
        className
      )}
    >
      <div
        className="pointer-events-none absolute -bottom-15 -left-10 size-85 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(242,167,187,0.10), rgba(242,167,187,0) 70%)",
        }}
      />

      {/* logo lockup */}
      <div className="flex items-center gap-2.75">
        <span className="flex size-8.5 items-center justify-center rounded-[10px] border border-border bg-surface">
          <LogoCheck className="size-4.25 text-pink" strokeWidth={2.2} />
        </span>
        <span className="text-[19px] font-bold tracking-[-0.02em] text-[#ededed]">
          Undegen
        </span>
      </div>

      {mode === "login" ? (
        <>
          <div className="flex-1" />
          <div className="relative">
            <h2 className="max-w-105 text-[30px] font-semibold leading-tight tracking-[-0.02em] text-[#e8e8e8]">
              The things you keep putting off, finally handled.
            </h2>
            <p className="mt-4 max-w-95 text-[15px] leading-[1.6] text-ink-muted">
              Timed daily reminders and multi-session focus tasks, in one quiet place.
            </p>
          </div>
        </>
      ) : (
        <div className="relative flex flex-1 flex-col justify-center">
          <h2 className="max-w-105 text-[30px] font-semibold leading-tight tracking-[-0.02em] text-[#e8e8e8]">
            For the things you keep avoiding.
          </h2>
          <ul className="mt-7.5 flex flex-col gap-4">
            <FeatureRow icon={<Clock className="size-3.75" />} label="Timed daily reminders" />
            <FeatureRow
              icon={<Target className="size-3.75" />}
              label="Focus sessions for long tasks"
            />
            <FeatureRow
              icon={<BarChart className="size-3.75" />}
              label="Streaks and weekly progress"
            />
          </ul>
        </div>
      )}
    </aside>
  )
}
