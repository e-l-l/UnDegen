import { useCallback, useState } from "react"

import { supabase } from "@/utils/supabase"

// With no device-local user-data store or pending-write queue, signing out only
// needs to end the Supabase session.
export function useSignOut() {
  const [busy, setBusy] = useState(false)

  const requestSignOut = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } finally {
      setBusy(false)
    }
  }, [busy])

  return { requestSignOut, busy }
}
