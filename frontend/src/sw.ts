/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { vapidKeyBytes } from './push/vapid'

declare let self: ServiceWorkerGlobalScope

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING')
    self.skipWaiting()
})

// self.__WB_MANIFEST is the default injection point
precacheAndRoute(self.__WB_MANIFEST)

// clean old assets
cleanupOutdatedCaches()

/** @type {RegExp[] | undefined} */
let allowlist
// in dev mode, we disable precaching to avoid caching issues
if (import.meta.env.DEV)
  allowlist = [/^\/$/]

// to allow work offline
registerRoute(new NavigationRoute(
  createHandlerBoundToURL('index.html'),
  { allowlist },
))

// ── Web Push ─────────────────────────────────────────────────────────────────
// The send-notifications Edge Function posts { title, body, url, tag }. `tag`
// collapses re-nudges of the same occurrence in the OS tray. See docs/adr/0003.

interface PushPayload {
  title?: string
  body?: string
  url?: string
  tag?: string
}

self.addEventListener('push', (event) => {
  let payload: PushPayload = {}
  try {
    payload = event.data?.json() ?? {}
  }
  catch {
    payload = { body: event.data?.text() }
  }
  const title = payload.title ?? 'Undegen'
  event.waitUntil(self.registration.showNotification(title, {
    body: payload.body ?? '',
    tag: payload.tag,
    icon: '/pwa-192x192.png',
    badge: '/pwa-64x64.png',
    data: { url: payload.url ?? '/today' },
  }))
})

// Tapping a notification focuses an open tab, else opens the app at /today.
// react-router (declarative, App.tsx) now owns paths, so the Edge Function can
// pass a deeper `url` (e.g. /stats/:id) when a per-activity deep link is wanted.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? '/today'
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if ('focus' in client) {
        await client.focus()
        // App is already open: focusing won't reset the day switcher's viewed day,
        // so tell the client to snap back to today (SelectedDayProvider listens).
        client.postMessage({ type: 'notification-click', url })
        return
      }
    }
    await self.clients.openWindow(url)
  })())
})

// The push service can rotate a subscription. Re-subscribe here so delivery keeps
// working; the app persists the new row on next open (reconcileSubscription).
self.addEventListener('pushsubscriptionchange', ((event: ExtendableEvent) => {
  const key = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!key) return
  event.waitUntil(
    self.registration.pushManager
      .subscribe({ userVisibleOnly: true, applicationServerKey: vapidKeyBytes(key) })
      .then(() => undefined)
      .catch((err) => console.error('[sw] re-subscribe failed', err)),
  )
}) as EventListener)
