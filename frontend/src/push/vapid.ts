// applicationServerKey wants the VAPID public key as bytes (a BufferSource).
// Dependency-free on purpose: both the app (push/subscribe.ts) and the service
// worker (sw.ts) import it, so the SW bundle stays clear of app-only deps.
export function vapidKeyBytes(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  const buffer = new ArrayBuffer(raw.length)
  const view = new Uint8Array(buffer)
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i)
  return buffer
}
