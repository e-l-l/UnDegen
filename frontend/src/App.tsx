import { AuthScreen } from "@/features/auth/AuthScreen"
import { useSession } from "@/hooks/useSession"
import { supabase } from "@/utils/supabase"
import PWABadge from "./PWABadge.tsx"

function App() {
  const { session, loading } = useSession()

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
  return (
    <>
      <main className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <p className="text-[14px] text-ink-muted">Signed in as</p>
        <p className="text-[18px] font-medium text-ink">{session.user.email}</p>
        <button
          onClick={() => void supabase.auth.signOut()}
          className="mt-2 text-[13px] text-ink-soft underline-offset-4 transition-colors hover:text-ink hover:underline"
        >
          Sign out
        </button>
      </main>
      <PWABadge />
    </>
  )
}

export default App
