import { useState } from "react"

import { NewActivityDialog } from "@/features/activities/NewActivityDialog"
import { NotificationAsk } from "@/features/notifications/NotificationAsk"
import { shouldOfferAsk } from "@/push/ask"

interface NewActivityFlowProps {
  userId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

// The "create activity → maybe ask for notifications" flow, shared by every
// screen with a create affordance (Today's FAB/header button, Focus's
// empty-state button). The caller owns only the open boolean it toggles; the
// non-obvious post-create ask (reminders only, and only if we can still offer)
// lives here so it can't drift between screens.
export function NewActivityFlow({ userId, open, onOpenChange }: NewActivityFlowProps) {
  const [askNotifications, setAskNotifications] = useState(false)

  return (
    <>
      {open && (
        <NewActivityDialog
          userId={userId}
          onClose={() => onOpenChange(false)}
          onCreated={(type) => {
            // Highest-intent moment to ask — but only for reminders, and only if
            // we can still offer (not already granted/blocked, or iOS needs install).
            if (type === "reminder" && shouldOfferAsk()) setAskNotifications(true)
          }}
        />
      )}

      {askNotifications && (
        <NotificationAsk userId={userId} onClose={() => setAskNotifications(false)} />
      )}
    </>
  )
}
