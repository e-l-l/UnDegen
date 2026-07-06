import { DefaultModeToggle } from "./fields/DefaultModeToggle"
import { GoalDurationChips } from "./fields/GoalDurationChips"
import { NameField } from "./fields/NameField"
import { ReminderTypeToggle } from "./fields/ReminderTypeToggle"
import { FieldError } from "./fields/shared"
import { SoftIntervalChips } from "./fields/SoftIntervalChips"
import { SoftWindowFields } from "./fields/SoftWindowFields"
import { StartsDateField } from "./fields/StartsDateField"
import { StrictTimeField } from "./fields/StrictTimeField"
import { TypeToggle } from "./fields/TypeToggle"
import { WeekdayPicker } from "./fields/WeekdayPicker"
import type { NewActivityForm } from "./useNewActivityForm"

// The shared scrollable body — every field, for both breakpoints. Only the
// Repeat-on/Starts pairing changes shape (stacked -> row) via lg: classes on
// one wrapper; everything else is a single flow, same top-to-bottom order at
// both breakpoints (desktop is just a narrower card).
export function NewActivityFormBody({ form }: { form: NewActivityForm }) {
  const isReminder = form.type === "reminder"

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5.5 overflow-y-auto px-5.5 py-5 lg:px-6.5 lg:py-6">
      <TypeToggle value={form.type} onChange={form.setType} />

      <NameField value={form.name} onChange={form.setName} error={form.errors.name} />

      <div className="flex flex-col gap-5.5 lg:flex-row lg:items-start lg:gap-4.5">
        <div className="lg:flex-[1.5]">
          <WeekdayPicker
            value={form.recurrenceDays}
            onChange={form.setRecurrenceDays}
            error={form.errors.recurrenceDays}
          />
        </div>
        <div className="lg:w-42.5 lg:flex-none">
          <StartsDateField value={form.recurrenceStart} onChange={form.setRecurrenceStart} />
        </div>
      </div>

      {!isReminder && (
        <p className="text-[12px] text-ink-faint lg:hidden">
          Long tasks have no set time — do them whenever, on these days.
        </p>
      )}

      {isReminder ? (
        <div>
          <ReminderTypeToggle value={form.reminderType} onChange={form.setReminderType} />
          {form.reminderType === "strict" ? (
            <StrictTimeField
              value={form.strictTime}
              onChange={form.setStrictTime}
              minTime={form.reminderMinTime}
              error={form.errors.strictTime}
            />
          ) : (
            // soft + random share the From/Until window; random fires once at a
            // hidden time inside it, so only soft adds the interval chips.
            <>
              <SoftWindowFields
                start={form.softStart}
                end={form.softEnd}
                onChangeStart={form.setSoftStart}
                onChangeEnd={form.setSoftEnd}
                error={form.errors.softWindow}
                minTime={form.reminderMinTime}
              />
              {form.reminderType === "soft" && (
                <div className="mt-3.5">
                  <SoftIntervalChips
                    minutes={form.softIntervalMins}
                    isCustom={form.softIntervalCustom}
                    onSelectPreset={(m) => {
                      form.setSoftIntervalCustom(false)
                      form.setSoftIntervalMins(m)
                    }}
                    onSelectCustom={() => form.setSoftIntervalCustom(true)}
                    onCustomChange={form.setSoftIntervalMins}
                  />
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
              <GoalDurationChips
                minutes={form.goalDurationMins}
                isCustom={form.goalDurationCustom}
                onSelectPreset={(m) => {
                  form.setGoalDurationCustom(false)
                  form.setGoalDurationMins(m)
                }}
                onSelectCustom={() => form.setGoalDurationCustom(true)}
                onCustomChange={form.setGoalDurationMins}
              />
            </div>
          )}
        </div>
      )}

      <FieldError msg={form.errors.form} />
    </div>
  )
}
