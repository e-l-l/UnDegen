interface NowDividerProps {
  time: string
}

export function NowDivider({ time }: NowDividerProps) {
  return (
    <div className="flex items-center gap-2.5 py-3.5 lg:gap-3 lg:py-4">
      <span className="text-[11px] font-bold tracking-[0.12em] text-pink lg:text-[11.5px]">NOW</span>
      <div className="h-[1.5px] flex-1 bg-gradient-to-r from-pink to-pink/10" />
      <span className="text-[12px] tabular-nums text-pink lg:text-[12.5px]">{time}</span>
    </div>
  )
}
