import { useEffect, useState } from "react"
import type { Session } from "@supabase/supabase-js"

import { supabase } from "@/utils/supabase"

// Auth session for gating the UI. getSession() is the local (localStorage) read —
// instant, safe to gate render on. onAuthStateChange keeps it live. Do NOT await
// other supabase calls inside the callback (documented deadlock); defer if needed.
export function useSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })

    return () => data.subscription.unsubscribe()
  }, [])

  return { session, loading }
}
