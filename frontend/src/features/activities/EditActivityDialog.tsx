import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { parseLocalDate, todayLocal } from "@/db/recurrence"
import type { Activity } from "@/db/types"
import { cn } from "@/lib/utils"
import { EditActivityFormBody } from "./EditActivityFormBody"
import { ChevronLeft, X } from "./icons"
import { useEditActivityForm } from "./useEditActivityForm"

export function EditActivityDialog({ activity, onClose }: { activity: Activity; onClose: () => void }) {
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const form = useEditActivityForm(activity, onClose)
  const today = todayLocal()
  const future = today < activity.recurrence_start
  const startLabel = parseLocalDate(activity.recurrence_start).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  })
  const requestClose = () => form.dirty ? setConfirmDiscard(true) : onClose()

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && requestClose()}>
        <DialogContent onOpenAutoFocus={(event) => event.preventDefault()} className={cn(
          "inset-0 h-full w-full rounded-none border-0 bg-background p-0",
          "lg:top-1/2 lg:left-1/2 lg:h-[min(740px,88dvh)] lg:w-155 lg:-translate-x-1/2 lg:-translate-y-1/2",
          "lg:rounded-[20px] lg:border lg:border-[#303030] lg:bg-[#222222] lg:shadow-2xl"
        )}>
          <div className="flex shrink-0 items-center gap-2 border-b border-[#171717] px-5.5 py-3 lg:hidden">
            <Button type="button" onClick={requestClose} aria-label="Back" variant="ghost" size="icon" className="size-8 text-ink-dim"><ChevronLeft className="size-5.5" /></Button>
            <DialogTitle className="text-[16px]">Edit activity.</DialogTitle>
          </div>
          <div className="hidden shrink-0 items-center justify-between border-b border-[#2c2c2c] px-6.5 py-5.5 lg:flex">
            <DialogTitle>Edit activity.</DialogTitle>
            <Button type="button" onClick={requestClose} aria-label="Close" variant="ghost" size="icon" className="size-8 text-ink-dim hover:text-ink"><X className="size-5" /></Button>
          </div>
          <EditActivityFormBody form={form} />
          <div className="shrink-0 border-t border-[#242424] px-5.5 py-3 pb-7.5 lg:flex lg:items-center lg:justify-between lg:px-6.5 lg:py-4.5">
            <p className="mb-3 text-[12.5px] text-ink-faint lg:mb-0">
              {future ? `Changes apply when this activity starts on ${startLabel}.` : "Changes apply from today."}
            </p>
            <div className="flex gap-2.5 lg:justify-end">
              <Button type="button" variant="outline" onClick={requestClose} className="hidden lg:inline-flex">Cancel</Button>
              <Button type="button" disabled={!form.dirty || !form.valid || form.submitting} onClick={() => void form.submit()} className="h-12 flex-1 rounded-xl lg:h-11 lg:flex-none lg:px-6">
                {form.submitting ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <DialogContent className="top-1/2 left-1/2 w-[calc(100%-2.5rem)] max-w-[390px] -translate-x-1/2 -translate-y-1/2 rounded-[18px] border border-[#303030] bg-[#1a1a1a] p-6">
          <DialogTitle>Discard changes?</DialogTitle>
          <p className="mt-2 text-[14px] text-ink-muted">Your edits haven’t been saved.</p>
          <div className="mt-5 flex justify-end gap-2.5">
            <Button type="button" variant="outline" onClick={() => setConfirmDiscard(false)}>Keep editing</Button>
            <Button type="button" onClick={onClose}>Discard</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
