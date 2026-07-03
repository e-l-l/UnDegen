import { AuthScreen } from "@/features/auth/AuthScreen"
import { TodayScreen } from "@/features/today/TodayScreen"
import { useSession } from "@/hooks/useSession"
import { useReconcileNotifications } from "@/push/useReconcile"
import { useSync } from "@/sync/useSync"
import PWABadge from "./PWABadge.tsx"

// Signed-in subtree. Owns the sync-down hook here (not in App) so useSync is called
// unconditionally within a component that only mounts once a user is present —
// keeping it above App's loading/signed-out early returns would break rules-of-hooks.
function SignedInApp({ userId }: { userId: string }) {
  useSync(userId)
  useReconcileNotifications(userId)
  return (
    <>
      <TodayScreen userId={userId} />
      <PWABadge />
    </>
  )
}

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

  return <SignedInApp userId={session.user.id} />
}

export default App
