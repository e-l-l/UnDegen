import { useState } from "react"

import { NewActivityDialog } from "@/features/activities/NewActivityDialog"
import { AuthScreen } from "@/features/auth/AuthScreen"
import { useSession } from "@/hooks/useSession"
import { supabase } from "@/utils/supabase"
import PWABadge from "./PWABadge.tsx"

function App() {
  const { session, loading } = useSession()
  const [creatingActivity, setCreatingActivity] = useState(false)

  if (loading) {
    return <div className="min-h-svh bg-background" />
  }

  if (!session) {
    return (
      <>
        <AuthScreen />
        <PWABadge />
      </>
    )
  }

  // Placeholder home until the "Today" screen exists — proves the auth loop.
  // The "+ New activity" trigger is temporary too, so the create flow is
  // testable end-to-end before a real Today screen owns it.
  return (
    <>
      <main className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <p className="text-[14px] text-ink-muted">Signed in as</p>
        <p className="text-[18px] font-medium text-ink">{session.user.email}</p>
        <button
          onClick={() => setCreatingActivity(true)}
          className="mt-4 rounded-full bg-pink px-4 py-2 text-[13px] font-medium text-on-pink transition-colors hover:bg-pink-hover"
        >
          + New activity
        </button>
        <button
          onClick={() => void supabase.auth.signOut()}
          className="mt-2 text-[13px] text-ink-soft underline-offset-4 transition-colors hover:text-ink hover:underline"
        >
          Sign out
        </button>
      </main>
      {creatingActivity && (
        <NewActivityDialog userId={session.user.id} onClose={() => setCreatingActivity(false)} />
      )}
      <PWABadge />
    </>
  )
}

export default App
