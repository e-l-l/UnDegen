import { TimePicker } from "../TimePicker"
import { FieldError, MiniLabel } from "./shared"

type SoftWindowFieldsProps = {
  start: string
  end: string
  onChangeStart: (value: string) => void
  onChangeEnd: (value: string) => void
  error?: string
  // Floor for both ends — set when the activity starts today so the window
  // can't begin in the past.
  minTime?: string
}

export function SoftWindowFields({ start, end, onChangeStart, onChangeEnd, error, minTime }: SoftWindowFieldsProps) {
  return (
    <div className="mt-3.5">
      <div className="flex gap-2.5">
        <div className="flex-1">
          <MiniLabel>From</MiniLabel>
          <TimePicker value={start} onChange={onChangeStart} minTime={minTime} className="h-12" />
        </div>
        <div className="flex-1">
          <MiniLabel>Until</MiniLabel>
          <TimePicker value={end} onChange={onChangeEnd} minTime={minTime} className="h-12" />
        </div>
      </div>
      <FieldError msg={error} />
    </div>
  )
}
