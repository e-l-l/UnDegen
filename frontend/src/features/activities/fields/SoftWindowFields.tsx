import { TimePicker } from "../TimePicker"
import { FieldError, MiniLabel } from "./shared"

type SoftWindowFieldsProps = {
  start: string
  end: string
  onChangeStart: (value: string) => void
  onChangeEnd: (value: string) => void
  error?: string
}

export function SoftWindowFields({ start, end, onChangeStart, onChangeEnd, error }: SoftWindowFieldsProps) {
  return (
    <div className="mt-3.5">
      <div className="flex gap-2.5">
        <div className="flex-1">
          <MiniLabel>From</MiniLabel>
          <TimePicker value={start} onChange={onChangeStart} className="h-12" />
        </div>
        <div className="flex-1">
          <MiniLabel>Until</MiniLabel>
          <TimePicker value={end} onChange={onChangeEnd} className="h-12" />
        </div>
      </div>
      <FieldError msg={error} />
    </div>
  )
}
