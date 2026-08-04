import { supabase } from "@/utils/supabase"

// The server-side alarm can't place a zoneless 'HH:MM' reminder without knowing the
// user's timezone. We capture the device's IANA zone and write it to user_settings
// direct (cloud-only notification configuration — see the push module note in
// frontend/CONTEXT.md). Last-device-wins: opening the app on a new device updates it.

export function currentTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

export async function captureTimezone(userId: string): Promise<void> {
  const timezone = currentTimezone()
  if (!timezone) return
  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: userId, timezone }, { onConflict: "user_id" })
  if (error) console.warn(`[push] timezone upsert failed: ${error.message}`)
}
