import { supabase } from "@/utils/supabase"

import { pushSupported } from "./platform"
import { captureTimezone } from "./timezone"
import { vapidKeyBytes } from "./vapid"

// Client side of Web Push: request permission, subscribe via the service worker's
// PushManager, and persist the subscription + timezone DIRECT to Supabase (these
// live in Supabase alongside the rest of the app data. The Edge Function reads
// these rows to know who + where to push.

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export type EnableResult = "subscribed" | "denied" | "unsupported"

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null
  return (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.ready)
}

export function currentPermission(): NotificationPermission {
  return "Notification" in window ? Notification.permission : "denied"
}

export async function isSubscribed(): Promise<boolean> {
  const reg = await getRegistration()
  if (!reg) return false
  return Boolean(await reg.pushManager.getSubscription())
}

// Persist a subscription row (endpoint unique → upsert). Also used by the app-side
// reconcile after the SW silently re-subscribes on pushsubscriptionchange.
async function saveSubscription(userId: string, sub: PushSubscription): Promise<void> {
  const keys = sub.toJSON().keys
  if (!keys?.p256dh || !keys?.auth) {
    console.warn("[push] subscription missing keys; not saved")
    return
  }
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: sub.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: navigator.userAgent,
      last_seen: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  )
  if (error) console.warn(`[push] subscription upsert failed: ${error.message}`)
}

// Request permission (MUST be called from a user gesture) and subscribe.
export async function enableNotifications(userId: string): Promise<EnableResult> {
  if (!pushSupported() || !VAPID_PUBLIC_KEY) return "unsupported"

  const permission = await Notification.requestPermission()
  if (permission !== "granted") return "denied"

  const reg = await getRegistration()
  if (!reg) return "unsupported"

  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidKeyBytes(VAPID_PUBLIC_KEY),
    }))

  // Two independent upserts (different tables, no data dependency) — run together.
  await Promise.all([saveSubscription(userId, sub), captureTimezone(userId)])
  return "subscribed"
}

// Turn notifications off: drop the row, then unsubscribe locally.
export async function disableNotifications(userId: string): Promise<void> {
  const reg = await getRegistration()
  if (!reg) return
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint).eq("user_id", userId)
  await sub.unsubscribe()
}

// Called on session-active/foreground: if a subscription already exists (incl. one
// the SW silently re-created on pushsubscriptionchange), make sure its row is
// current, and refresh the timezone. No permission prompt.
export async function reconcileSubscription(userId: string): Promise<void> {
  if (!pushSupported() || currentPermission() !== "granted") return
  const reg = await getRegistration()
  const sub = reg ? await reg.pushManager.getSubscription() : null
  // Independent upserts — run together (subscription row is optional here).
  await Promise.all([
    sub ? saveSubscription(userId, sub) : Promise.resolve(),
    captureTimezone(userId),
  ])
}
