import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { archiveActivity, removeOccurrence } from "@/db/repo"
import type { Activity } from "@/db/types"

interface DeleteChoiceDialogProps {
  activity: Activity
  date: string
  userId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

// The destructive choice, mirroring a calendar's delete: drop just this one
// day's occurrence, or the whole recurring activity. "Just this day" is the
// default (narrower) action; deleting the whole thing is deliberate and only
// archives — history is kept, it just disappears from view. Both are one-way
// from the UI for now (no undo / un-archive screen yet — see CLAUDE.md open
// questions). Built on the base Dialog primitive; the centered-card + button
// stack styling mirrors NotificationAsk by hand (not yet a shared component).
export function DeleteChoiceDialog({ activity, date, userId, open, onOpenChange }: DeleteChoiceDialogProps) {
  const close = () => onOpenChange(false)

  const deleteThisDay = () => {
    void removeOccurrence(userId, date, activity.id)
    close()
  }

  const deleteEntire = () => {
    void archiveActivity(activity.id)
    close()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-1/2 left-1/2 w-[calc(100%-2.5rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 gap-4 rounded-[20px] border border-[#303030] bg-[#1a1a1a] p-6">
        <DialogTitle>Delete “{activity.name}”?</DialogTitle>
        <p className="text-[14.5px] leading-relaxed text-ink-body">
          Just this one day, or the whole thing? Deleting the whole activity hides
          it from now on but keeps the history you've already logged.
        </p>
        <div className="mt-1 flex flex-col gap-2.5">
          <Button
            type="button"
            size="lg"
            onClick={deleteThisDay}
            className="h-13 w-full rounded-[14px] text-[16px]"
          >
            Just this day
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={deleteEntire}
            className="h-12 w-full rounded-[14px] text-[15px]"
          >
            Delete entire activity
          </Button>
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              className="h-11 w-full rounded-[14px] text-[14.5px] text-ink-dim"
            >
              Cancel
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  )
}
