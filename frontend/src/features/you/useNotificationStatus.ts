import { useCallback, useEffect, useState } from "react"

import { needsInstallFirst, pushSupported } from "@/push/platform"
import { currentPermission, enableNotifications, isSubscribed } from "@/push/subscribe"

// Live Web Push state for the You page. The app has no notification store —
// permission is otherwise only read imperatively at create-reminder time
// (shouldOfferAsk) — so this is a fresh read path. It reads on mount and re-reads
// on focus/visibility, since the user can flip permission in browser/OS settings
// while the tab is backgrounded and JS gets no event for it.
export type NotifStatus = "loading" | "unsupported" | "needs-install" | "blocked" | "off" | "on"

async function readStatus(): Promise<NotifStatus> {
  if (!pushSupported()) return "unsupported"
  if (needsInstallFirst()) return "needs-install" // iOS in a browser tab, not yet installed
  const perm = currentPermission()
  if (perm === "denied") return "blocked" // cannot be re-granted from JS — browser settings only
  if (perm === "granted" && (await isSubscribed())) return "on"
  return "off" // 'default', or granted-but-unsubscribed → Enable (re)subscribes
}

export function useNotificationStatus(userId: string) {
  const [status, setStatus] = useState<NotifStatus>("loading")
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(() => {
    void readStatus().then(setStatus)
  }, [])

  useEffect(() => {
    refresh()
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh()
    }
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", refresh)
    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", refresh)
    }
  }, [refresh])

  // Reallow only — no off switch (disableNotifications stays uncalled by design).
  // MUST run from a user gesture (Notification.requestPermission requirement).
  const enable = useCallback(async () => {
    setBusy(true)
    const result = await enableNotifications(userId)
    setBusy(false)
    if (result === "denied") setStatus("blocked")
    else if (result === "unsupported") setStatus("unsupported")
    else setStatus("on")
  }, [userId])

  return { status, busy, enable }
}
