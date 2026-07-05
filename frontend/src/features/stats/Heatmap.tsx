import { useEffect, useId, useRef, useState } from "react"

// Ridgeline focus-density heatmap — hand-rolled SVG, NOT a library (decided by
// research; see features/stats/DESIGN_BRIEF.md §6 / the design hand-off). Seven
// lanes (Mon→Sun, top→bottom), each a smooth filled curve of focus intensity
// across the waking day. The one sanctioned heavy use of pink: intensity is a
// data signal. Reused at both scopes (aggregate on /stats, single-activity on
// /stats/:id) — takes a buckets[7][24] prop (minutes; local start hour of
// long-task sessions, all-time, incl. archived).

interface HeatmapProps {
  buckets: number[][] // [weekday 0=Mon..6=Sun][hour 0..23] = minutes
  ramp?: "pink" | "grey"
  laneGap?: number // px between lane baselines (tunes overlap/height)
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const START_H = 6
const END_H = 23
// gaussian kernel → organic hills instead of per-hour spikes
const KERNEL = [0.11, 0.24, 0.3, 0.24, 0.11]

function smooth(arr: number[]): number[] {
  return arr.map((_, i) => {
    let s = 0
    let w = 0
    for (let k = -2; k <= 2; k++) {
      const j = i + k
      if (j >= 0 && j < arr.length) {
        s += arr[j] * KERNEL[k + 2]
        w += KERNEL[k + 2]
      }
    }
    return s / w
  })
}

// catmull-rom → cubic-bezier segment string (C-commands, no leading M)
function seg(pts: [number, number][]): string {
  let d = ""
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] || p2
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += `C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)} `
  }
  return d
}

function hourLabel(hr: number): string {
  const ap = hr < 12 ? "a" : "p"
  let hh = hr % 12
  if (hh === 0) hh = 12
  return `${hh}${ap}`
}

export function Heatmap({ buckets, ramp = "pink", laneGap = 21 }: HeatmapProps) {
  const gid = useId()

  // Measure the card so the viewBox renders 1:1 with pixels — a fixed-unit
  // viewBox stretched to a wide column upscales strokes + labels (looks
  // "zoomed"). Width tracks the container; height stays a fixed px count.
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(360)
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const w = e?.contentRect.width
      if (w) setWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const hours: number[] = []
  for (let hr = START_H; hr <= END_H; hr++) hours.push(hr)
  const n = hours.length

  const lanes = DAYS.map((_, d) => smooth(hours.map((hr) => buckets[d]?.[hr] ?? 0)))
  let max = 1
  lanes.forEach((l) => l.forEach((v) => { if (v > max) max = v }))

  const W = width
  const padT = 16
  const padB = 26
  const padL = 40
  const padR = 16
  const plotW = W - padL - padR
  const maxRise = laneGap * 1.9
  const H = padT + maxRise + (DAYS.length - 1) * laneGap + padB
  const X = (i: number) => padL + (i / (n - 1)) * plotW
  const baseY = (d: number) => padT + maxRise + d * laneGap

  const isPink = ramp !== "grey"
  const c = isPink ? "242,167,187" : "236,236,236"

  return (
    <div ref={wrapRef} className="rounded-[14px] border border-[#232323] bg-[#141414] p-[12px_14px_8px]">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} className="block overflow-visible">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={`rgb(${c})`} stopOpacity={isPink ? 0.9 : 0.72} />
            <stop offset="55%" stopColor={`rgb(${c})`} stopOpacity={isPink ? 0.3 : 0.24} />
            <stop offset="100%" stopColor={`rgb(${c})`} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {/* top lane first so lower lanes occlude the ones above (classic ridgeline) */}
        {lanes.map((vals, d) => {
          const base = baseY(d)
          const pts = vals.map((v, i) => [X(i), base - (v / max) * maxRise] as [number, number])
          const curve = seg(pts)
          const x0 = pts[0][0].toFixed(1)
          const xL = pts[pts.length - 1][0].toFixed(1)
          const area = `M${x0} ${base.toFixed(1)} L${x0} ${pts[0][1].toFixed(1)} ${curve}L${xL} ${base.toFixed(1)} Z`
          const top = `M${x0} ${pts[0][1].toFixed(1)} ${curve}`
          return (
            <g key={d}>
              <line x1={padL} y1={base} x2={W - padR} y2={base} stroke="rgba(255,255,255,0.045)" strokeWidth={1} />
              <path d={area} fill={`url(#${gid})`} />
              <path d={top} fill="none" stroke={`rgba(${c},0.9)`} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
              <text x={padL - 11} y={base - 1} textAnchor="end" fontSize={9.5} fill="#5E5E5E" fontWeight={500}>
                {DAYS[d]}
              </text>
            </g>
          )
        })}
        {hours.map((hr, i) =>
          hr % 3 === 0 ? (
            <text key={hr} x={X(i)} y={H - 9} textAnchor="middle" fontSize={9} fill="#4E4E4E">
              {hourLabel(hr)}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  )
}
