import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Bell } from "@/features/activities/icons"
import { needsInstallFirst } from "@/push/platform"
import { enableNotifications } from "@/push/subscribe"

type Props = {
  userId: string
  onClose: () => void
}

type Phase = "ask" | "install" | "denied"

// Contextual permission ask, shown right after a reminder is created (the highest-
// intent moment). Three shapes:
//   • install — iOS in a browser tab: it can't do Web Push until the PWA is on the
//     home screen, so we guide instead of prompting.
//   • ask     — the real prompt; the native dialog fires from the button gesture.
//   • denied  — the browser is blocking; point at site settings.
// No settings screen exists yet, so this is the only entry point for now.
export function NotificationAsk({ userId, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>(() => (needsInstallFirst() ? "install" : "ask"))
  const [busy, setBusy] = useState(false)

  async function handleEnable() {
    setBusy(true)
    const result = await enableNotifications(userId)
    setBusy(false)
    if (result === "denied") setPhase("denied")
    else onClose() // 'subscribed' or 'unsupported' — nothing more to do here
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        className="top-1/2 left-1/2 w-[calc(100%-2.5rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 gap-4 rounded-[20px] border border-[#303030] bg-[#1a1a1a] p-6"
      >
        <div className="flex size-11 items-center justify-center rounded-[13px] bg-elevated text-ink-dim">
          <Bell className="size-5.5" />
        </div>

        {phase === "install" ? (
          <>
            <DialogTitle>One more step</DialogTitle>
            <p className="text-[14.5px] leading-relaxed text-ink-body">
              iPhone only sends reminders from an installed app. Add Undegen to your
              home screen — tap <span className="text-ink-soft">Share</span>, then{" "}
              <span className="text-ink-soft">Add to Home Screen</span> — then turn
              reminders on from there.
            </p>
            <Button type="button" size="lg" onClick={onClose} className="mt-1 h-13 w-full rounded-[14px] text-[16px]">
              Got it
            </Button>
          </>
        ) : phase === "denied" ? (
          <>
            <DialogTitle>Notifications are blocked</DialogTitle>
            <p className="text-[14.5px] leading-relaxed text-ink-body">
              Your browser is blocking notifications for Undegen. You can turn them
              back on in the site settings, then create a reminder again.
            </p>
            <Button type="button" size="lg" onClick={onClose} className="mt-1 h-13 w-full rounded-[14px] text-[16px]">
              Close
            </Button>
          </>
        ) : (
          <>
            <DialogTitle>Get reminded?</DialogTitle>
            <p className="text-[14.5px] leading-relaxed text-ink-body">
              You made a reminder. Want the nudge to actually reach you when you're
              avoiding it?
            </p>
            <div className="mt-1 flex flex-col gap-2.5">
              <Button
                type="button"
                size="lg"
                disabled={busy}
                onClick={() => void handleEnable()}
                className="h-13 w-full rounded-[14px] text-[16px]"
              >
                {busy ? "Turning on…" : "Turn on reminders"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                className="h-11 w-full rounded-[14px] text-[14.5px] text-ink-dim"
              >
                Not now
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
