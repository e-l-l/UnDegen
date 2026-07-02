import { AuthScreen } from "@/features/auth/AuthScreen"
import { TodayScreen } from "@/features/today/TodayScreen"
import { useSession } from "@/hooks/useSession"
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

  return (
    <>
      <TodayScreen userId={session.user.id} />
      <PWABadge />
    </>
  )
}

export default App
