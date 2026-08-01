import { DefaultModeToggle } from "./fields/DefaultModeToggle"
import { GoalDurationChips } from "./fields/GoalDurationChips"
import { NameField } from "./fields/NameField"
import { ReminderTypeToggle } from "./fields/ReminderTypeToggle"
import { FieldError, SectionLabel } from "./fields/shared"
import { SoftIntervalChips } from "./fields/SoftIntervalChips"
import { SoftWindowFields } from "./fields/SoftWindowFields"
import { StrictTimeField } from "./fields/StrictTimeField"
import { WeekdayPicker } from "./fields/WeekdayPicker"
import type { EditActivityForm } from "./useEditActivityForm"

export function EditActivityFormBody({ form }: { form: EditActivityForm }) {
  const isReminder = form.activity.type === "reminder"
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5.5 overflow-y-auto px-5.5 py-5 lg:px-6.5 lg:py-6">
      <div>
        <SectionLabel>Activity type</SectionLabel>
        <div className="rounded-xl border border-edge-chip bg-surface px-3.5 py-3 text-[14px] text-ink-body">
          {isReminder ? "Reminder" : "Long task"}
          <span className="ml-2 text-[12px] text-ink-faint">Fixed</span>
        </div>
      </div>
      <NameField value={form.name} onChange={form.setName} error={form.errors.name} />
      <WeekdayPicker value={form.recurrenceDays} onChange={form.setRecurrenceDays} error={form.errors.recurrenceDays} />
      {isReminder ? (
        <div>
          <ReminderTypeToggle value={form.reminderType} onChange={form.setReminderType} />
          {form.reminderType === "strict" ? (
            <StrictTimeField value={form.strictTime} onChange={form.setStrictTime} error={form.errors.strictTime} />
          ) : (
            <>
              <SoftWindowFields start={form.softStart} end={form.softEnd} onChangeStart={form.setSoftStart} onChangeEnd={form.setSoftEnd} error={form.errors.softWindow} />
              {form.reminderType === "soft" && (
                <div className="mt-3.5">
                  <SoftIntervalChips minutes={form.softIntervalMins} isCustom={form.softIntervalCustom}
                    onSelectPreset={(minutes) => { form.setSoftIntervalCustom(false); form.setSoftIntervalMins(minutes) }}
                    onSelectCustom={() => form.setSoftIntervalCustom(true)} onCustomChange={form.setSoftIntervalMins} />
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div>
          <DefaultModeToggle value={form.defaultMode} onChange={form.setDefaultMode} />
          {form.defaultMode === "goal" && (
            <div className="mt-3.5">
              <GoalDurationChips minutes={form.goalDurationMins} isCustom={form.goalDurationCustom}
                onSelectPreset={(minutes) => { form.setGoalDurationCustom(false); form.setGoalDurationMins(minutes) }}
                onSelectCustom={() => form.setGoalDurationCustom(true)} onCustomChange={form.setGoalDurationMins} />
            </div>
          )}
        </div>
      )}
      <FieldError msg={form.errors.form} />
    </div>
  )
}
