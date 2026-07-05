import { BrowserRouter, Navigate, Route, Routes } from "react-router"

import { AuthScreen } from "@/features/auth/AuthScreen"
import { StatsDetailScreen } from "@/features/stats/StatsDetailScreen"
import { StatsScreen } from "@/features/stats/StatsScreen"
import { TodayScreen } from "@/features/today/TodayScreen"
import { useSession } from "@/hooks/useSession"
import { useReconcileNotifications } from "@/push/useReconcile"
import { useSync } from "@/sync/useSync"
import PWABadge from "./PWABadge.tsx"

// Signed-in subtree. Owns the sync-down hook here (not in App) so useSync is called
// unconditionally within a component that only mounts once a user is present —
// keeping it above App's loading/signed-out early returns would break rules-of-hooks.
// Routing lives here too (declarative react-router v7): unknown paths and "/" fall
// through to /today. Screens render their own chrome (nav bars, rails), so there's
// no shared layout route — Today's desktop chrome differs from Stats'.
function SignedInApp({ userId }: { userId: string }) {
  useSync(userId)
  useReconcileNotifications(userId)
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/today" element={<TodayScreen userId={userId} />} />
        <Route path="/stats" element={<StatsScreen userId={userId} />} />
        <Route path="/stats/:activityId" element={<StatsDetailScreen userId={userId} />} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Routes>
      <PWABadge />
    </BrowserRouter>
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
