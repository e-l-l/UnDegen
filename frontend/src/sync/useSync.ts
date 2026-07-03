import { useEffect } from "react"

import { pullAll } from "./pull"

// Fire a sync-down at the moments a device might have missed remote changes:
// session becomes active (mount), reconnect, and app returns to the foreground
// (the "put down laptop, open phone" case). One-shot per event; pullAll is
// single-flight and no-ops offline. Reads are a useLiveQuery over Dexie, so
// hydrated rows render with no further wiring.
//
// userId is the effect key (re-pull on user change) and, by living in a hook
// rather than useSession's onAuthStateChange callback, keeps the pull out of that
// callback (documented supabase-js deadlock when awaiting there).
export function useSync(userId: string): void {
  useEffect(() => {
    void pullAll()

    const onOnline = () => void pullAll()
    const onVisible = () => {
      if (document.visibilityState === "visible") void pullAll()
    }
    window.addEventListener("online", onOnline)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.removeEventListener("online", onOnline)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [userId])
}
