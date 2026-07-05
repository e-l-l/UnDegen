import { useCallback, useState } from "react"

import { db } from "@/db/db"
import { supabase } from "@/utils/supabase"

// Sign-out that also wipes the local Dexie store. Otherwise a different account
// signing in on the same device would see the prior user's rows lingering in
// IndexedDB — RLS scopes the cloud mirror, not the local one. Guard: if there are
// unflushed offline writes in syncQueue, surface a confirm before discarding them
// (pendingCount !== null drives the confirm dialog).
export function useSignOut() {
  const [busy, setBusy] = useState(false)
  const [pendingCount, setPendingCount] = useState<number | null>(null)

  // Clear local tables, THEN drop the session. onAuthStateChange unmounts
  // SignedInApp on sign-out, so the local wipe must happen first.
  const wipeAndSignOut = useCallback(async () => {
    setBusy(true)
    try {
      await Promise.all(db.tables.map((t) => t.clear()))
      await supabase.auth.signOut()
    } finally {
      setBusy(false)
      setPendingCount(null)
    }
  }, [])

  // Entry point from the Sign out button: if unsynced writes exist, open the
  // confirm dialog; otherwise sign out straight away.
  const requestSignOut = useCallback(async () => {
    if (busy) return
    const queued = await db.syncQueue.count()
    if (queued > 0) {
      setPendingCount(queued)
      return
    }
    await wipeAndSignOut()
  }, [busy, wipeAndSignOut])

  const cancel = useCallback(() => setPendingCount(null), [])

  return { requestSignOut, confirmSignOut: wipeAndSignOut, cancel, pendingCount, busy }
}
