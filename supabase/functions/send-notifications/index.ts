// send-notifications — the server-side alarm (see docs/adr/0003).
//
// Invoked every minute by pg_cron (0004_notifications_cron.sql). Poll-and-compute:
// there is no stored schedule. Each tick this derives who is due *now* in their own
// timezone, claims each slot in notification_log (claim-then-send = at-most-once),
// and sends Web Push to that user's subscriptions.
//
// Auth: verify_jwt is off (config.toml); we validate a shared secret header the
// cron sends, so only the cron can invoke this. Uses the service role, which
// bypasses RLS, to read across users.
//
// web-push runs on npm compat in the Edge Runtime. SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are injected automatically; the rest are set via
// `supabase secrets set` (see 0004 / plan).
//
// NOTE: this is a Deno module (Supabase Edge Function), not part of the Vite
// frontend build (frontend/tsconfig.app.json includes only `src`). Edit with the
// Deno LSP (deno.json marks the boundary).
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import webpush from "web-push"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import {
  buildPayload,
  dueSlots,
  formatHHMM,
  localContext,
  type LocalContext,
  recursOn,
  type ReminderActivity,
} from "./schedule.ts"

const LOOKBACK_MINS = 12

const CRON_SECRET = Deno.env.get("CRON_SECRET")!
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT")!,
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!
)

interface SubRow {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

interface Due {
  activity: ReminderActivity // carries user_id — no separate userId field
  localDate: string
  slot: number
}

Deno.serve(async (req: Request) => {
  if (req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response("unauthorized", { status: 401 })
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const now = new Date()

  // 1. Only users with a subscription can be notified — start there.
  const subResp = await admin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
  if (subResp.error) return json({ error: subResp.error.message }, 500)
  const subs = (subResp.data ?? []) as SubRow[]
  if (!subs.length) return json({ sent: 0, note: "no subscriptions" })

  const userIds = [...new Set(subs.map((s) => s.user_id))]
  const subsByUser = groupBy(subs, (s) => s.user_id)

  // 2/3. Timezone per user (load-bearing) + reminder activities. Independent reads
  //      — both keyed only on userIds — so fetch them in one round-trip.
  const [settingsResp, actResp] = await Promise.all([
    admin.from("user_settings").select("user_id, timezone").in("user_id", userIds),
    admin
      .from("activities")
      .select(
        "id, user_id, name, reminder_type, strict_time, soft_interval_mins, soft_start, soft_end, recurrence_days, recurrence_start, exception_dates"
      )
      .in("user_id", userIds)
      .eq("type", "reminder")
      .eq("archived", false),
  ])
  const settings = (settingsResp.data ?? []) as Array<{ user_id: string; timezone: string }>
  const tzByUser = new Map(settings.map((s) => [s.user_id, s.timezone]))
  const activities = (actResp.data ?? []) as ReminderActivity[]

  // 4. Compute due slots (in each user's local time, within the lookback window).
  //    localContext depends only on (now, tz), so memoize per zone across activities.
  const ctxByTz = new Map<string, LocalContext>()
  const due: Due[] = []
  for (const a of activities) {
    const tz = tzByUser.get(a.user_id)
    if (!tz) continue // no timezone captured yet → can't place its wall-clock
    let ctx = ctxByTz.get(tz)
    if (!ctx) {
      ctx = localContext(now, tz)
      ctxByTz.set(tz, ctx)
    }
    if (!recursOn(a, ctx)) continue
    for (const slot of dueSlots(a, ctx.minutes, LOOKBACK_MINS)) {
      due.push({ activity: a, localDate: ctx.date, slot })
    }
  }
  if (!due.length) return json({ sent: 0 })

  // 5. Completion-aware stop for SOFT reminders: silence remaining nudges once the
  //    occurrence is done/skipped today. (Strict fires once regardless.)
  const completed = await loadCompletedSet(
    admin,
    due.filter((d) => d.activity.reminder_type === "soft")
  )

  // 6. Claim + send, slot by slot.
  let sent = 0
  let skipped = 0
  for (const d of due) {
    if (
      d.activity.reminder_type === "soft" &&
      completed.has(`${d.activity.id}|${d.localDate}`)
    ) {
      skipped++
      continue
    }

    const slotStr = formatHHMM(d.slot)

    // Claim the slot: insert … on conflict do nothing. Empty result = someone
    // (a prior/overlapping tick) already claimed it → skip.
    const claimResp = await admin
      .from("notification_log")
      .upsert(
        {
          user_id: d.activity.user_id,
          activity_id: d.activity.id,
          local_date: d.localDate,
          slot: slotStr,
          status: "pending",
        },
        { onConflict: "activity_id,local_date,slot", ignoreDuplicates: true }
      )
      .select("id")
    const claimed = (claimResp.data ?? []) as Array<{ id: string }>
    if (claimResp.error || claimed.length === 0) {
      skipped++
      continue
    }
    const logId = claimed[0].id

    // We won the claim → send to every subscription this user has.
    const payload = JSON.stringify(buildPayload(d.activity, d.slot, d.localDate))
    const userSubs = subsByUser.get(d.activity.user_id) ?? []
    const result = await sendToSubs(admin, userSubs, payload)
    sent += result.delivered

    await admin
      .from("notification_log")
      .update({
        status: result.delivered > 0 ? "sent" : "failed",
        error: result.error,
        sent_at: new Date().toISOString(),
      })
      .eq("id", logId)
  }

  return json({ due: due.length, sent, skipped })
})

// Send one payload to all of a user's subscriptions (independent recipients →
// concurrently). Prunes dead subscriptions (410 Gone / 404) as it goes. Safe for
// at-most-once: the slot is already claimed before this is called.
async function sendToSubs(
  admin: SupabaseClient,
  subs: SubRow[],
  payload: string
): Promise<{ delivered: number; error: string | null }> {
  let delivered = 0
  let error: string | null = null
  await Promise.all(
    subs.map(async (s) => {
      const subscription = {
        endpoint: s.endpoint,
        keys: { p256dh: s.p256dh, auth: s.auth },
      }
      try {
        await webpush.sendNotification(subscription, payload)
        delivered++
      } catch (err) {
        const statusCode = (err as { statusCode?: number })?.statusCode
        if (statusCode === 404 || statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("id", s.id)
        } else {
          error = err instanceof Error ? err.message : String(err)
          console.error(`[push] send failed (${statusCode ?? "?"}): ${error}`)
        }
      }
    })
  )
  return { delivered, error }
}

// For each soft-due (activity, localDate), is the occurrence already done/skipped?
// Resolve via days → day_activities → completions in batch reads.
async function loadCompletedSet(admin: SupabaseClient, softDue: Due[]): Promise<Set<string>> {
  const done = new Set<string>()
  if (!softDue.length) return done

  const userIds = [...new Set(softDue.map((d) => d.activity.user_id))]
  const dates = [...new Set(softDue.map((d) => d.localDate))]
  const activityIds = [...new Set(softDue.map((d) => d.activity.id))]

  const daysResp = await admin
    .from("days")
    .select("id, user_id, date")
    .in("user_id", userIds)
    .in("date", dates)
  const days = (daysResp.data ?? []) as Array<{ id: string; user_id: string; date: string }>
  if (!days.length) return done
  const dayById = new Map(days.map((d) => [d.id, d]))

  const daResp = await admin
    .from("day_activities")
    .select("id, day_id, activity_id")
    .in("day_id", days.map((d) => d.id))
    .in("activity_id", activityIds)
  const dayActs = (daResp.data ?? []) as Array<{ id: string; day_id: string; activity_id: string }>
  if (!dayActs.length) return done
  const daById = new Map(dayActs.map((da) => [da.id, da]))

  const compResp = await admin
    .from("completions")
    .select("day_activity_id, status")
    .in("day_activity_id", dayActs.map((da) => da.id))
  const completions = (compResp.data ?? []) as Array<{ day_activity_id: string; status: string }>

  for (const c of completions) {
    if (c.status !== "done" && c.status !== "skipped") continue
    const da = daById.get(c.day_activity_id)
    if (!da) continue
    const day = dayById.get(da.day_id)
    if (!day) continue
    done.add(`${da.activity_id}|${day.date}`)
  }
  return done
}

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const k = key(item)
    const arr = map.get(k) ?? []
    arr.push(item)
    map.set(k, arr)
  }
  return map
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}
