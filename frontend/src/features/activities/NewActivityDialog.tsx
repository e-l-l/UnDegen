import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { ChevronLeft, X } from "./icons"
import { NewActivityFormBody } from "./NewActivityFormBody"
import { useNewActivityForm } from "./useNewActivityForm"

type NewActivityDialogProps = {
  userId: string
  onClose: () => void
}

// One Radix Dialog underneath both form factors — reused for its focus-trap/
// Esc/portal behaviour in both cases. Only the content's positioning/chrome
// differs per breakpoint (lg, matching the rest of the app): a full-screen
// takeover on mobile, a centered 620px card with a dimmed backdrop on desktop.
// Mounted only while open (see App.tsx) so each open gets a fresh form.
export function NewActivityDialog({ userId, onClose }: NewActivityDialogProps) {
  const form = useNewActivityForm(userId, onClose)

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        className={cn(
          "inset-0 h-full w-full rounded-none border-0 bg-background p-0",
          // A definite height, not h-auto+max-h: a flex column sized by
          // height:auto gives its flex-1 (scrollable) child no definite space
          // to grow into, so it collapses instead of filling/scrolling —
          // confirmed unreliable in this engine even via CSS Grid's 1fr rows.
          // min(740px, 88dvh) is always a real number, so flex-1 + overflow-
          // y-auto below resolves correctly on every fork, every viewport.
          "lg:top-1/2 lg:left-1/2 lg:h-[min(740px,88dvh)] lg:w-[620px] lg:-translate-x-1/2 lg:-translate-y-1/2",
          "lg:rounded-[20px] lg:border lg:border-[#303030] lg:bg-[#222222] lg:shadow-2xl"
        )}
      >
        {/* mobile header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-[#171717] px-5.5 pt-6 pb-3 lg:hidden">
          <Button type="button" onClick={onClose} aria-label="Back" variant="ghost" size="icon" className="size-8 text-ink-dim">
            <ChevronLeft className="size-5.5" />
          </Button>
          <DialogTitle className="text-[16px]">New activity</DialogTitle>
          <DialogClose asChild>
            <Button type="button" aria-label="Close" variant="ghost" size="icon" className="size-8 text-ink-muted">
              <X className="size-4" />
            </Button>
          </DialogClose>
        </div>

        {/* desktop header */}
        <div className="hidden flex-shrink-0 items-center justify-between border-b border-[#2c2c2c] px-6.5 py-5.5 lg:flex">
          <DialogTitle>New activity</DialogTitle>
          <DialogClose asChild>
            <Button type="button" aria-label="Close" variant="ghost" size="icon" className="size-8 text-ink-dim hover:text-ink">
              <X className="size-5" />
            </Button>
          </DialogClose>
        </div>

        <NewActivityFormBody form={form} />

        {/* mobile footer */}
        <div className="flex-shrink-0 border-t border-[#171717] px-5.5 py-3 pb-7.5 lg:hidden">
          <Button
            type="button"
            size="lg"
            disabled={form.submitting}
            onClick={() => void form.submit()}
            className="h-13 w-full rounded-[14px] text-[16px]"
          >
            {form.submitting ? "Creating…" : "Create activity"}
          </Button>
        </div>

        {/* desktop footer */}
        <div className="hidden flex-shrink-0 items-center justify-end gap-2.75 border-t border-[#2c2c2c] px-6.5 py-4.5 lg:flex">
          <DialogClose asChild>
            <Button type="button" variant="outline" className="h-11.5 rounded-xl px-5.5 text-[14.5px]">
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            disabled={form.submitting}
            onClick={() => void form.submit()}
            className="h-11.5 rounded-xl px-6.5 text-[14.5px]"
          >
            {form.submitting ? "Creating…" : "Create activity"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
