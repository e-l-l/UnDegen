import { useId, useState } from "react"
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts"

import { fmtMins } from "./copy"

// Minimal trend line chart (Recharts v3, themed to the design tokens — no
// default Recharts colors, no axis clutter, greyscale not pink). Hovering a
// point reveals its formatted weekly value. See the Stats design hand-off.

interface FocusTrendProps {
  // weekly values, oldest→newest (minutes for focus, or any monotone series)
  values: number[]
  height?: number
  showValueTooltip?: boolean
}

// Custom dot: emphasize the most-recent point (brighter + larger), the rest are
// dim. Focus graphs also use a larger transparent hit target so the value only
// appears when the node itself is hovered (not anywhere in its x-axis band).
function TrendDot(props: {
  cx?: number
  cy?: number
  index?: number
  last?: number
  value?: number
  showValueTooltip?: boolean
}) {
  const { cx, cy, index, last, value, showValueTooltip } = props
  const [hovered, setHovered] = useState(false)
  if (cx == null || cy == null) return null

  const isLast = index === last
  const label = value == null ? "" : fmtMins(value)
  const tooltipWidth = Math.max(42, label.length * 7 + 16)
  const tooltipX = index === 0 ? cx - 2 : isLast ? cx - tooltipWidth + 2 : cx - tooltipWidth / 2
  const tooltipY = cy < 34 ? cy + 10 : cy - 34

  if (!showValueTooltip) {
    return <circle cx={cx} cy={cy} r={isLast ? 3.4 : 2.2} fill={isLast ? "#F0F0F0" : "#8A8A8A"} />
  }

  return (
    <g
      role="img"
      aria-label={`${label} focused`}
      tabIndex={0}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      style={{ outline: "none" }}
    >
      <circle cx={cx} cy={cy} r={10} fill="transparent" />
      <circle
        cx={cx}
        cy={cy}
        r={hovered ? 4.2 : isLast ? 3.4 : 2.2}
        fill={hovered || isLast ? "#F0F0F0" : "#8A8A8A"}
        stroke={hovered ? "#141414" : "none"}
        strokeWidth={hovered ? 2 : 0}
      />
      {hovered && (
        <g pointerEvents="none">
          <rect x={tooltipX} y={tooltipY} width={tooltipWidth} height={24} rx={5} fill="#1B1B1B" stroke="#303030" />
          <text
            x={tooltipX + tooltipWidth / 2}
            y={tooltipY + 16}
            fill="#D6D6D6"
            fontSize={11.5}
            fontWeight={500}
            textAnchor="middle"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {label}
          </text>
        </g>
      )}
    </g>
  )
}

export function FocusTrend({ values, height = 100, showValueTooltip = true }: FocusTrendProps) {
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
            dot={<TrendDot last={data.length - 1} showValueTooltip={showValueTooltip} />}
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
