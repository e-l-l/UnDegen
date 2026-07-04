import { TimePicker } from "../TimePicker"
import { FieldError } from "./shared"

type StrictTimeFieldProps = {
  value: string
  onChange: (value: string) => void
  minTime?: string
  error?: string
}

export function StrictTimeField({ value, onChange, minTime, error }: StrictTimeFieldProps) {
  return (
    <div className="mt-3.5">
      <div className="flex items-center gap-3.5">
        <span className="text-[14px] text-ink-body">Fires once at</span>
        <TimePicker value={value} onChange={onChange} minTime={minTime} className="h-11.5 w-40 flex-none lg:h-11" />
      </div>
      <FieldError msg={error} />
    </div>
  )
}
