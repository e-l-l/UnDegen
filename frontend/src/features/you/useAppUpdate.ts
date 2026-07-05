import { useCallback, useRef, useState } from "react"
import { useRegisterSW } from "virtual:pwa-register/react"

// Read-side companion to PWABadge for the You page's "App" section. PWABadge owns
// the periodic update *detection* (hourly interval + visibilitychange/online,
// guarded module-level) and the offline/update toast. This hook only needs the
// version string, whether a new build is waiting (needRefresh), an on-demand
// "check now", and reload. It deliberately does NOT re-wire the periodic checks:
// registering the SW twice is idempotent at the browser level, but duplicating the
// interval/listeners is not — so onRegisteredSW here only captures the registration
// for a manual r.update(). In dev the SW is disabled (devOptions.enabled = false),
// so onRegisteredSW never fires and checkForUpdate is a no-op; the version still shows.
export function useAppUpdate() {
  const regRef = useRef<ServiceWorkerRegistration | undefined>(undefined)
  const [checking, setChecking] = useState(false)

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, r) {
      regRef.current = r
    },
  })

  const checkForUpdate = useCallback(async () => {
    // r.update() over a dead network throws — same offline guard PWABadge uses.
    if ("onLine" in navigator && !navigator.onLine) return
    const r = regRef.current
    if (!r) return
    setChecking(true)
    try {
      await r.update()
    } finally {
      setChecking(false)
    }
  }, [])

  const reload = useCallback(() => {
    void updateServiceWorker(true)
  }, [updateServiceWorker])

  return { version: __APP_VERSION__, needRefresh, checking, checkForUpdate, reload }
}
