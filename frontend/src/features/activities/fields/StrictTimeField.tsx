import { TimePicker } from "../TimePicker"

type StrictTimeFieldProps = {
  value: string
  onChange: (value: string) => void
}

export function StrictTimeField({ value, onChange }: StrictTimeFieldProps) {
  return (
    <div className="mt-3.5 flex items-center gap-3.5">
      <span className="text-[14px] text-ink-body">Fires once at</span>
      <TimePicker value={value} onChange={onChange} className="h-11.5 w-32.5 flex-none lg:h-11" />
    </div>
  )
}
