import { useRegisterSW } from 'virtual:pwa-register/react'

import { Button } from '@/components/ui/button'

function PWABadge() {
  // check for updates every hour
  const period = 60 * 60 * 1000

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      if (period <= 0 || !r) return
      if (r.active?.state === 'activated') {
        registerUpdateChecks(period, swUrl, r)
      }
      else if (r.installing) {
        r.installing.addEventListener('statechange', (e) => {
          const sw = e.target as ServiceWorker
          if (sw.state === 'activated')
            registerUpdateChecks(period, swUrl, r)
        })
      }
    },
  })

  function close() {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  if (!offlineReady && !needRefresh)
    return null

  // Bottom-anchored, on-system toast (grayscale + dark tokens; pink stays reserved
  // for the primary CTA / brand). Cleared above the mobile tab bar + safe area;
  // pins bottom-right on desktop.
  return (
    <div
      role="alert"
      aria-labelledby="pwa-toast-message"
      className="fixed inset-x-4 z-50 mx-auto max-w-sm bottom-[calc(env(safe-area-inset-bottom)+5rem)] sm:inset-x-auto sm:right-4 sm:mx-0 sm:bottom-[calc(env(safe-area-inset-bottom)+1rem)]"
    >
      <div className="flex items-center gap-3 rounded-xl border border-border bg-popover/95 px-4 py-3 shadow-lg backdrop-blur-sm">
        <p id="pwa-toast-message" className="flex-1 text-sm text-foreground">
          {offlineReady
            ? 'Ready to work offline.'
            : 'New version available.'}
        </p>
        <div className="flex items-center gap-1">
          {needRefresh && (
            <Button variant="outline" size="sm" onClick={() => updateServiceWorker(true)}>
              Reload
            </Button>
          )}
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => close()}>
            {needRefresh ? 'Later' : 'Dismiss'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default PWABadge

// Registered once per SW registration; guards against duplicate listeners if
// PWABadge remounts (App swaps signed-out/in trees).
let updateChecksWired = false
// Throttle: mobile fires visibilitychange on every tab switch — don't hammer the
// SW/network. Never check more than once per MIN_CHECK_GAP.
const MIN_CHECK_GAP = 60 * 1000
let lastCheckedAt = 0

/**
 * Detection, not auto-update: this only asks the SW to look for a new build. If
 * one is found, useRegisterSW flips `needRefresh` → the prompt toast appears.
 * The user still clicks Reload (registerType: 'prompt', per CLAUDE.md — a silent
 * reload would kill a live timer/session in this write-heavy app).
 *
 * Why beyond the hourly interval: on mobile the OS freezes a backgrounded PWA and
 * *resumes* the frozen JS context rather than reloading it, so the page-load check
 * never re-runs and setInterval is throttled/killed while backgrounded. The
 * reliable moment is when the app returns to the foreground — so we also check on
 * visibilitychange (and on `online`, to catch a reconnect).
 */
function registerUpdateChecks(period: number, swUrl: string, r: ServiceWorkerRegistration) {
  if (period <= 0 || updateChecksWired) return
  updateChecksWired = true

  async function checkForUpdate(force = false) {
    if ('onLine' in navigator && !navigator.onLine)
      return
    const now = Date.now()
    if (!force && now - lastCheckedAt < MIN_CHECK_GAP)
      return
    lastCheckedAt = now

    const resp = await fetch(swUrl, {
      cache: 'no-store',
      headers: {
        'cache': 'no-store',
        'cache-control': 'no-cache',
      },
    })

    if (resp?.status === 200)
      await r.update()
  }

  // Hourly check for the case where the app is left open in the foreground all day.
  setInterval(() => { void checkForUpdate(true) }, period)

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible')
      void checkForUpdate()
  })
  window.addEventListener('online', () => { void checkForUpdate() })
}
