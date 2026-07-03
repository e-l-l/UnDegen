import { useEffect } from "react"

import { reconcileSubscription } from "./subscribe"

// On session-active / reconnect / return-to-foreground, keep the push subscription
// row and the user's timezone current — no permission prompt. Mirrors useSync's
// trigger set; call it beside useSync in the signed-in subtree.
export function useReconcileNotifications(userId: string): void {
  useEffect(() => {
    void reconcileSubscription(userId)

    const onOnline = () => void reconcileSubscription(userId)
    const onVisible = () => {
      if (document.visibilityState === "visible") void reconcileSubscription(userId)
    }
    window.addEventListener("online", onOnline)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.removeEventListener("online", onOnline)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [userId])
}
