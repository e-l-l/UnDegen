import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import { BarChart, Clock, LogoCheck, Target } from "./icons"
import type { AuthMode } from "./useAuthForm"

function FeatureRow({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <li className="flex items-center gap-[13px]">
      <span className="flex size-[30px] shrink-0 items-center justify-center rounded-[9px] border border-edge-chip bg-surface text-ink-body">
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
        "relative w-[46%] shrink-0 flex-col overflow-hidden border-r border-edge-panel bg-panel p-[54px]",
        className
      )}
    >
      <div
        className="pointer-events-none absolute -bottom-[60px] -left-[40px] size-[340px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(242,167,187,0.10), rgba(242,167,187,0) 70%)",
        }}
      />

      {/* logo lockup */}
      <div className="flex items-center gap-[11px]">
        <span className="flex size-[34px] items-center justify-center rounded-[10px] border border-border bg-surface">
          <LogoCheck className="size-[17px] text-pink" strokeWidth={2.2} />
        </span>
        <span className="text-[19px] font-bold tracking-[-0.02em] text-[#ededed]">
          Undegen
        </span>
      </div>

      {mode === "login" ? (
        <>
          <div className="flex-1" />
          <div className="relative">
            <h2 className="max-w-[420px] text-[30px] font-semibold leading-[1.25] tracking-[-0.02em] text-[#e8e8e8]">
              The things you keep putting off, finally handled.
            </h2>
            <p className="mt-4 max-w-[380px] text-[15px] leading-[1.6] text-ink-muted">
              Timed daily reminders and multi-session focus tasks, in one quiet place.
            </p>
          </div>
        </>
      ) : (
        <div className="relative flex flex-1 flex-col justify-center">
          <h2 className="max-w-[420px] text-[30px] font-semibold leading-[1.25] tracking-[-0.02em] text-[#e8e8e8]">
            Start small. Three reminders, free.
          </h2>
          <ul className="mt-[30px] flex flex-col gap-4">
            <FeatureRow icon={<Clock className="size-[15px]" />} label="Timed daily reminders" />
            <FeatureRow
              icon={<Target className="size-[15px]" />}
              label="Focus sessions for long tasks"
            />
            <FeatureRow
              icon={<BarChart className="size-[15px]" />}
              label="Streaks and weekly progress"
            />
          </ul>
        </div>
      )}
    </aside>
  )
}
