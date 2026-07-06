import type { ReactNode } from "react"
import { ArrowDown, ArrowUp, ChevronRight, Minus, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { iconForActivity } from "@/features/today/iconForActivity"
import { avoidCopy, EMPTY_AVOIDED, fmtMins, NO_AVOIDED } from "./copy"
import type { ActivityStatRow, CompletionRecord, DeltaDir, SessionRecord, StatsOverview, WeekStripCell } from "./types"

// ── section label ─────────────────────────────────────────────────────────────
export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("text-[11.5px] font-semibold uppercase tracking-[0.1em] text-[#5A5A5A]", className)}>
      {children}
    </div>
  )
}

// ── delta arrow (shared glyph) ────────────────────────────────────────────────
function DeltaArrow({ dir, size, color }: { dir: DeltaDir; size: number; color: string }) {
  const Icon = dir === "up" ? ArrowUp : dir === "down" ? ArrowDown : Minus
  return <Icon size={size} color={color} strokeWidth={2} />
}

// ── delta chip (hero) — pill with arrow + change-magnitude vs prior week ───────
export function DeltaChip({ dir, label, size = "sm" }: { dir: DeltaDir; label: string; size?: "sm" | "lg" }) {
  // positive delta uses the pink signal; neutral ("same") and negative stay grey
  const color = dir === "up" ? "#f2a7bb" : "#9A9A9A"
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#232323] bg-[#181818] py-1 pl-2 pr-2.5"
      style={{ fontSize: size === "lg" ? 13 : 12, color }}
    >
      <DeltaArrow dir={dir} size={13} color={color} />
      <span className="tabular-nums">{label}</span>
    </span>
  )
}

// ── delta mini (rows / summary cards) — arrow + optional text ──────────────────
export function DeltaMini({ dir, label }: { dir: DeltaDir; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.25 text-[11.5px] text-[#9A9A9A] tabular-nums">
      <DeltaArrow dir={dir} size={12} color="#9A9A9A" />
      {label ? <span>{label}</span> : null}
    </span>
  )
}

// ── week-strip — 7 rounded cells (reminder occurrences) ───────────────────────
const STRIP_CELL: Record<WeekStripCell, string> = {
  done: "bg-[#CACACA]",
  pending: "bg-transparent shadow-[inset_0_0_0_1.4px_#303030]",
  notdone: "bg-transparent shadow-[inset_0_0_0_1.4px_#3A3A3A]",
}

export function WeekStrip({ strip }: { strip: WeekStripCell[] }) {
  return (
    <div className="flex gap-1">
      {strip.map((s, i) => (
        <div key={i} className={cn("size-3 shrink-0 rounded-[4px]", STRIP_CELL[s])} />
      ))}
    </div>
  )
}

// ── sparkline — recent session lengths (long tasks) ───────────────────────────
export function Sparkline({ vals }: { vals: number[] }) {
  const max = Math.max(1, ...vals)
  return (
    <div className="flex h-6 items-end gap-[3px]">
      {vals.map((v, i) => (
        <div
          key={i}
          className="w-1.5 rounded-[2px]"
          style={{ height: Math.max(3, (v / max) * 24), background: i === vals.length - 1 ? "#B4B4B4" : "#3A3A3A" }}
        />
      ))}
    </div>
  )
}

// ── icon tile — activity glyph in a rounded square ────────────────────────────
export function IconTile({ Icon, size, stroke = "#8A8A8A" }: { Icon: LucideIcon; size: number; stroke?: string }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center border border-[#262626] bg-[#1A1A1A]"
      style={{ width: size, height: size, borderRadius: size >= 38 ? 11 : 10 }}
    >
      <Icon size={Math.round(size * 0.5)} color={stroke} strokeWidth={1.7} />
    </div>
  )
}

// ── per-activity breakdown row (tap → detail) ─────────────────────────────────
export function ActivityRow({ row, desktop, onClick }: { row: ActivityStatRow; desktop?: boolean; onClick?: () => void }) {
  const Icon = iconForActivity(row)
  const archived = row.archived
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick?.()
        }
      }}
      className="flex items-center gap-3.5 border-b border-[#1A1A1A] px-1 py-3.5 transition-colors hover:bg-[#141414]"
      style={{ opacity: archived ? 0.5 : 1 }}
    >
      <IconTile Icon={Icon} size={desktop ? 40 : 38} stroke={archived ? "#5E5E5E" : "#8A8A8A"} />
      <div
        className="shrink-0 overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-[450]"
        style={{ width: desktop ? 150 : 120, color: archived ? "#9A9A9A" : "#E4E4E4" }}
      >
        {row.name}
      </div>
      <div className={cn("flex min-w-0 flex-1", desktop ? "justify-start" : "justify-center")}>
        {archived ? (
          <span className="text-[12.5px] text-[#5E5E5E]">History only</span>
        ) : row.type === "reminder" ? (
          <WeekStrip strip={row.weekStrip ?? []} />
        ) : (
          <Sparkline vals={row.sparkline ?? []} />
        )}
      </div>
      {!archived && (
        <div className="flex items-center gap-3">
          <span className="text-[14px] font-medium text-[#D6D6D6] tabular-nums">
            {row.type === "reminder" ? `${row.done} / ${row.planned}` : fmtMins(row.focusMins ?? 0)}
          </span>
          <DeltaMini dir={row.delta} />
        </div>
      )}
      <ChevronRight size={16} color="#5E5E5E" strokeWidth={1.8} className="shrink-0" />
    </div>
  )
}

// ── the whole breakdown list (active + archived-under-divider) ────────────────
export function ActivityList({
  rows,
  desktop,
  onOpen,
}: {
  rows: ActivityStatRow[]
  desktop?: boolean
  onOpen: (activityId: string) => void
}) {
  const active = rows.filter((r) => !r.archived)
  const archived = rows.filter((r) => r.archived)
  return (
    <div>
      {active.map((r) => (
        <ActivityRow key={r.activityId} row={r} desktop={desktop} onClick={() => onOpen(r.activityId)} />
      ))}
      {archived.length > 0 && (
        <>
          <div className="flex items-center gap-3 px-1 pb-2 pt-4.5">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[#4A4A4A]">Archived</span>
            <div className="h-px flex-1 bg-[#1A1A1A]" />
          </div>
          {archived.map((r) => (
            <ActivityRow key={r.activityId} row={r} desktop={desktop} onClick={() => onOpen(r.activityId)} />
          ))}
        </>
      )}
    </div>
  )
}

// ── most-avoided callout (the roast's home) ───────────────────────────────────
export function MostAvoided({
  avoid,
  empty,
  big,
}: {
  avoid: StatsOverview["mostAvoided"]
  empty?: boolean // whole-page empty state (no activity at all)
  big?: boolean // desktop full-height panel
}) {
  const panelBase = "flex flex-col justify-center rounded-2xl border border-[#232323] bg-[#141414] box-border"
  if (!avoid) {
    const copy = empty ? EMPTY_AVOIDED : NO_AVOIDED
    return (
      <div className={cn(panelBase, big ? "h-full p-[22px]" : "p-[18px]")}>
        <div className="text-[15.5px] font-medium text-[#E4E4E4]">{copy.title}</div>
        <div className="mt-2 text-[14px] leading-[1.5] text-[#9A9A9A]">{copy.sub}</div>
      </div>
    )
  }
  const Icon = iconForActivity(avoid)
  const strip: WeekStripCell[] = Array.from({ length: avoid.planned }, (_, i) => (i < avoid.done ? "done" : "notdone"))
  return (
    <div className={cn(panelBase, big ? "h-full p-[22px]" : "p-[18px]")}>
      <div className="flex items-center gap-3">
        <IconTile Icon={Icon} size={big ? 44 : 38} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-ink" style={{ fontSize: big ? 18 : 16 }}>
            {avoid.name}
          </div>
          <div className="mt-[3px] text-[13px] text-[#9A9A9A] tabular-nums">
            {avoid.done} of {avoid.planned} this week
          </div>
        </div>
        <WeekStrip strip={strip} />
      </div>
      <div className="mt-4 leading-[1.5] text-[#9A9A9A]" style={{ fontSize: big ? 15 : 14 }}>
        {avoidCopy()}
      </div>
    </div>
  )
}

// ── completion row (reminder detail log) — peer of SessionRow ─────────────────
// `skipped` (the stored value behind a user's "Missed it") is presented
// identically to derived `missed` — one "Missed" vocabulary end-to-end. The
// data stays honest (status is still `skipped`); this is display-only. The
// shared `MISSED_*` constants keep the two keys in lockstep (still an exhaustive
// Record — split them again if a status ever needs its own look).
const MISSED_CELL = "bg-transparent shadow-[inset_0_0_0_1.4px_#2A2A2A]"
const MISSED_TEXT = "text-[#6E6E6E]"
const STATUS_CELL: Record<CompletionRecord["status"], string> = {
  done: "bg-[#CACACA]",
  skipped: MISSED_CELL,
  missed: MISSED_CELL,
}
const STATUS_TEXT: Record<CompletionRecord["status"], string> = {
  done: "text-[#D6D6D6]",
  skipped: MISSED_TEXT,
  missed: MISSED_TEXT,
}
const STATUS_LABEL: Record<CompletionRecord["status"], string> = { done: "Done", skipped: "Missed", missed: "Missed" }

export function CompletionRow({ record }: { record: CompletionRecord }) {
  return (
    <div className="flex items-center gap-3.5 border-b border-[#1A1A1A] px-1 py-[13px]">
      <div className={`size-3 shrink-0 rounded-[4px] ${STATUS_CELL[record.status]}`} />
      <div className="flex-1 text-[13px] text-[#9A9A9A]">{record.date}</div>
      <span className={`text-[12.5px] font-medium ${STATUS_TEXT[record.status]}`}>{STATUS_LABEL[record.status]}</span>
    </div>
  )
}

// ── session row (detail) ──────────────────────────────────────────────────────
export function SessionRow({ session }: { session: SessionRecord }) {
  return (
    <div className="flex items-center gap-3.5 border-b border-[#1A1A1A] px-1 py-[13px]">
      <div className="w-[52px] shrink-0 text-[13px] text-[#9A9A9A]">{session.date}</div>
      <div className="w-[52px] shrink-0 text-[12.5px] text-[#5E5E5E] tabular-nums">{session.time}</div>
      <div className="min-w-0 flex-1">
        <div className="h-[5px] overflow-hidden rounded-full bg-[#2A2A2A]">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.min(100, (session.mins / 60) * 100)}%`, background: session.goalMet ? "#F2A7BB" : "#4A4A4A" }}
          />
        </div>
      </div>
      <span className="w-11 shrink-0 text-right text-[13.5px] font-medium text-[#D6D6D6] tabular-nums">{session.mins}m</span>
      <span className="w-[66px] shrink-0 text-right">
        {session.goalMet && (
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.03em] text-[#C9A7B0]">Goal met</span>
        )}
      </span>
    </div>
  )
}
