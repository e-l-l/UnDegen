// "Where it falls apart" — missed-rate-by-weekday strip. Seven greyscale bars
// (Mon..Sun), height = not-done rate 0..1, fill opacity scaling with the rate.
// Greyscale, never pink (this isn't a positive signal). Hand-rolled per
// features/stats/DESIGN_BRIEF.md §"Other visuals".

interface WeekdayFlakeProps {
  rates: number[] // len 7, Mon..Sun, not-done rate 0..1
  height?: number
}

const LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export function WeekdayFlake({ rates, height = 60 }: WeekdayFlakeProps) {
  return (
    <div className="rounded-[14px] border border-[#232323] bg-[#141414] p-[16px_14px_12px]">
      <div className="flex items-end gap-2" style={{ height }}>
        {rates.map((r, i) => (
          <div key={i} className="flex h-full flex-1 flex-col justify-end">
            <div
              title={`${Math.round(r * 100)}% missed`}
              className="rounded-[4px_4px_3px_3px]"
              style={{ height: `${Math.max(6, r * 100)}%`, background: `rgba(240,240,240,${0.14 + r * 0.5})` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {LABELS.map((l, i) => (
          <div key={i} className="flex-1 text-center text-[10px] text-[#5E5E5E]">
            {l[0]}
          </div>
        ))}
      </div>
    </div>
  )
}
