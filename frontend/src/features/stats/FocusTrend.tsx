import { useId } from "react"
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts"

// Minimal focus-trend line chart (Recharts v3, themed to the design tokens — no
// default Recharts colors, no axis clutter, greyscale not pink). Weekly minutes
// banked over the last N weeks; direction is the "keep going" nudge. See
// features/stats/DESIGN_BRIEF.md §8 / the design hand-off.

interface FocusTrendProps {
  // weekly values, oldest→newest (minutes for focus, or any monotone series)
  values: number[]
  height?: number
}

// Custom dot: emphasize the most-recent point (brighter + larger), the rest are
// dim. Recharts clones this element per data point, injecting cx/cy/index.
function TrendDot(props: { cx?: number; cy?: number; index?: number; last?: number }) {
  const { cx, cy, index, last } = props
  if (cx == null || cy == null) return null
  const isLast = index === last
  return <circle cx={cx} cy={cy} r={isLast ? 3.4 : 2.2} fill={isLast ? "#F0F0F0" : "#8A8A8A"} />
}

export function FocusTrend({ values, height = 100 }: FocusTrendProps) {
  const gid = useId()
  const data = values.map((v, i) => ({ i, v }))
  const max = Math.max(1, ...values)

  return (
    <div className="rounded-[14px] border border-[#232323] bg-[#141414] p-[14px_14px_6px]">
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 14, right: 4, bottom: 6, left: 4 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity={0.08} />
              <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="i" hide />
          <YAxis hide domain={[0, max]} />
          <ReferenceLine y={0} stroke="#1A1A1A" strokeWidth={1} />
          <Area
            type="linear"
            dataKey="v"
            stroke="#D6D6D6"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={`url(#${gid})`}
            fillOpacity={1}
            isAnimationActive={false}
            dot={<TrendDot last={data.length - 1} />}
            activeDot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex justify-between px-0.5 pt-0.5 text-[10.5px] text-[#5E5E5E]">
        <span>{values.length} wks ago</span>
        <span>now</span>
      </div>
    </div>
  )
}
