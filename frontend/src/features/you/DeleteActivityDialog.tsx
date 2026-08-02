import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { archiveActivity } from "@/db/repo"
import type { Activity } from "@/db/types"

interface DeleteActivityDialogProps {
  activity: Activity
  open: boolean
  onOpenChange: (open: boolean) => void
}

// The manager has no occurrence/date context, so deletion here always means
// archiving the whole activity. Logged history stays available in Stats, while
// restore remains deliberately unavailable in the app for now.
export function DeleteActivityDialog({ activity, open, onOpenChange }: DeleteActivityDialogProps) {
  const deleteActivity = () => {
    void archiveActivity(activity.id)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-1/2 left-1/2 w-[calc(100%-2.5rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 gap-4 rounded-[20px] border border-[#303030] bg-[#1a1a1a] p-6">
        <DialogTitle>Delete “{activity.name}”?</DialogTitle>
        <p className="text-[14.5px] leading-relaxed text-ink-body">
          This hides the activity from now on and keeps the history you've already logged. You won't be able to restore it in the app.
        </p>
        <div className="mt-1 flex flex-col gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={deleteActivity}
            className="h-12 w-full rounded-[14px] border-[#3A2A2C] bg-[#2a1d1f] text-[15px] text-[#F0DADA] hover:border-[#513437] hover:bg-[#352326]"
          >
            Delete activity
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
