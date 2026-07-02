import { Input } from "@/components/ui/input"
import { FieldError, SectionLabel } from "./shared"

type NameFieldProps = {
  value: string
  onChange: (value: string) => void
  error?: string
}

export function NameField({ value, onChange, error }: NameFieldProps) {
  return (
    <div>
      <SectionLabel>Name</SectionLabel>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Take meds"
        className="lg:rounded-xl"
      />
      <FieldError msg={error} />
    </div>
  )
}
