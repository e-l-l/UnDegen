import { useLiveQuery } from "dexie-react-hooks"
import { Bell, ChevronRight, ListChecks } from "lucide-react"
import { useNavigate } from "react-router"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { db } from "@/db/db"
import { DesktopIsland } from "@/features/today/DesktopIsland"
import { MobileTabBar } from "@/features/today/MobileTabBar"
import { cn } from "@/lib/utils"
import { useSession } from "@/hooks/useSession"
import { useAppUpdate } from "./useAppUpdate"
import { useNotificationStatus } from "./useNotificationStatus"
import { useSignOut } from "./useSignOut"

// The "You" page: identity → notifications → app/version → sign out. Plain and
// matter-of-fact (the Stats "roast" tone does NOT apply here). All logic lives in
// the hooks; this file is the visual layer, built to design_handoff_you. Identity
// is the page title — the app has no avatar/photo. Follows the house chrome rule:
// duplicated mobile/desktop blocks, each rendering its own nav (no shared layout
// route; see App.tsx). Pink is CTA/live-signal only — Enable + Reload are the only
// pink here; sign-out is a restrained warm-muted tint, never pink, never loud red.

function displayName(name: string | undefined, email: string | undefined): string {
  const trimmed = name?.trim()
  if (trimmed) return trimmed
  if (email) return email.split("@")[0]
  return "You"
}

function activityLine(count: number | undefined): string {
  if (count === undefined) return "…"
  if (count === 0) return "Nothing tracked yet"
  if (count === 1) return "1 activity tracked"
  return `${count} activities tracked`
}

function ActivitiesSection({ count, desktop, onOpen, className }: { count: number | undefined; desktop?: boolean; onOpen: () => void; className?: string }) {
  return (
    <section className={className}>
      <div className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-[#5A5A5A]">Activities</div>
      <button type="button" onClick={onOpen} className={cn("flex w-full items-center gap-3.5 rounded-2xl border border-[#232323] bg-[#141414] text-left transition-colors hover:bg-[#181818]", desktop ? "p-[20px_22px]" : "p-[18px]")}>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-[11px] border border-[#292929] bg-[#1a1a1a]"><ListChecks className="size-5 text-[#888]" strokeWidth={1.7} /></div>
        <div className="min-w-0 flex-1"><div className="text-[15px] font-medium text-[#E4E4E4]">Manage activities</div><div className="mt-1 text-[13px] text-[#6e6e6e]">{activityLine(count)}</div></div>
        <ChevronRight className="size-4.5 text-[#555]" />
      </button>
    </section>
  )
}

// ── Notifications ─────────────────────────────────────────────────────────────

type Notif = ReturnType<typeof useNotificationStatus>

function BellTile({ stroke, desktop }: { stroke: string; desktop?: boolean }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[11px] border border-[#262626] bg-[#1A1A1A]",
        desktop ? "size-[42px]" : "size-10"
      )}
    >
      <Bell size={desktop ? 21 : 20} strokeWidth={1.7} color={stroke} />
    </div>
  )
}

// Copy + tile-stroke + title-tint for the guidance-only states (blocked / needs-
// install / loading) — each is one bell tile + title + optional sub, no action.
const GUIDANCE: Record<
  "blocked" | "needs-install" | "loading",
  { stroke: string; title: string; titleTint: string; sub?: string }
> = {
  blocked: {
    stroke: "#6E6E6E",
    title: "Blocked in your browser",
    titleTint: "#C4C4C4",
    sub: "Re-enable notifications for Undegen in your site settings — we can’t turn them back on from here.",
  },
  "needs-install": {
    stroke: "#6E6E6E",
    title: "Add Undegen to your home screen first",
    titleTint: "#C4C4C4",
    sub: "Notifications need the installed app. Share → Add to Home Screen, then come back here.",
  },
  loading: {
    stroke: "#5E5E5E",
    title: "Checking notifications…",
    titleTint: "#8A8A8A",
  },
}

function NotifSection({ notif, desktop, className }: { notif: Notif; desktop?: boolean; className?: string }) {
  const { status } = notif
  if (status === "unsupported") return null // this screen owns the hide-when-unsupported rule

  const titleSize = desktop ? "text-[15.5px]" : "text-[15px]"
  const title = (text: string, tint: string) => (
    <div className={cn("font-medium", titleSize)} style={{ color: tint }}>
      {text}
    </div>
  )
  const sub = (text: string) => <div className="mt-1 text-[13.5px] leading-[1.5] text-[#9A9A9A]">{text}</div>

  let body
  if (status === "on") {
    body = (
      <div className="flex items-start gap-3.5">
        <BellTile stroke="#8A8A8A" desktop={desktop} />
        <div className="min-w-0 flex-1">
          {title("Notifications on", "#E4E4E4")}
          {sub("Nudges arrive when something is due. Managed in your device settings.")}
        </div>
        <div className="mt-0.5 flex shrink-0 items-center gap-1.75 text-[12.5px] text-[#7E7E7E]">
          <span className="size-[7px] rounded-full bg-[#8A8A8A]" />
          On
        </div>
      </div>
    )
  } else if (status === "off") {
    body = (
      <div className="flex items-center gap-3.5">
        <BellTile stroke="#8A8A8A" desktop={desktop} />
        <div className="min-w-0 flex-1">
          {title("Notifications off", "#E4E4E4")}
          {sub("You won’t get a nudge when something is due.")}
        </div>
        <Button type="button" size="sm" disabled={notif.busy} onClick={() => void notif.enable()}>
          {notif.busy ? "Turning on…" : "Enable"}
        </Button>
      </div>
    )
  } else {
    const g = GUIDANCE[status]
    body = (
      <div className="flex items-start gap-3.5">
        <BellTile stroke={g.stroke} desktop={desktop} />
        <div className="min-w-0 flex-1">
          {title(g.title, g.titleTint)}
          {g.sub && sub(g.sub)}
        </div>
      </div>
    )
  }

  return (
    <section className={className}>
      <div className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-[#5A5A5A]">Notifications</div>
      <div className={cn("rounded-2xl border border-[#232323] bg-[#141414]", desktop ? "p-[20px_22px]" : "p-[18px]")}>
        {body}
      </div>
    </section>
  )
}

// ── App / version ─────────────────────────────────────────────────────────────

type Update = ReturnType<typeof useAppUpdate>

function AppSection({ update, desktop, className }: { update: Update; desktop?: boolean; className?: string }) {
  return (
    <section className={className}>
      <div className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-[#5A5A5A]">App</div>
      <div className={cn("rounded-2xl border border-[#232323] bg-[#141414]", desktop ? "p-[20px_22px]" : "p-[18px]")}>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className={cn("font-medium text-[#E4E4E4]", desktop ? "text-[15.5px]" : "text-[15px]")}>
              {update.needRefresh ? "Update available" : "Undegen"}
            </div>
            <div className="mt-1 text-[13px] tabular-nums text-[#5E5E5E]">
              {update.needRefresh ? "A newer version is ready. Reload to apply." : `Version ${update.version}`}
            </div>
          </div>
          {update.needRefresh ? (
            <Button type="button" size="sm" onClick={update.reload}>
              Reload
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={update.checking}
              onClick={() => void update.checkForUpdate()}
            >
              {update.checking ? "Checking…" : "Check for updates"}
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}

// ── Sign out ──────────────────────────────────────────────────────────────────
// Destructiveness signalled by a restrained warm tint + separation — never pink,
// never a loud red.

function SignOutSection({
  busy,
  onRequest,
  desktop,
  className,
}: {
  busy: boolean
  onRequest: () => void | Promise<void>
  desktop?: boolean
  className?: string
}) {
  return (
    <section className={cn("flex items-center justify-between gap-4 border-t border-[#1A1A1A]", className)}>
      <div className="min-w-0">
        <div className="text-[15px] font-medium text-[#C4C4C4]">Sign out</div>
        <div className={cn("mt-0.75 leading-[1.4] text-[#5E5E5E]", desktop ? "text-[13px]" : "text-[12.5px]")}>
          Local data is wiped from this device.
        </div>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void onRequest()}
        className={cn(
          "shrink-0 rounded-[10px] border border-[#3A2A2C] py-2.25 text-[13.5px] font-medium text-[#C97A7A] transition-colors hover:border-[#4A3033] hover:bg-[#1A1416] disabled:pointer-events-none disabled:opacity-60",
          desktop ? "px-[18px]" : "px-4"
        )}
      >
        Sign out
      </button>
    </section>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function YouScreen({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const { session } = useSession()
  const email = session?.user.email
  const name = session?.user.user_metadata?.name as string | undefined

  const activityCount = useLiveQuery(
    () => db.activities.where("user_id").equals(userId).and((a) => !a.archived).count(),
    [userId]
  )

  const notif = useNotificationStatus(userId)
  const update = useAppUpdate()
  const signOut = useSignOut()

  const title = displayName(name, email)
  const line = activityLine(activityCount)

  return (
    <>
      {/* ════════ Mobile ════════ */}
      <div className="flex h-svh flex-col bg-background lg:hidden">
        <div className="shrink-0 px-5.5 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-1">
          <div className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-faint">Account</div>
          <div className="mt-2 truncate text-[30px] font-semibold tracking-[-0.02em] text-ink">{title}</div>
        </div>

        <div className="flex flex-1 flex-col overflow-auto px-5.5 pt-5 pb-2">
          {email && <div className="truncate text-[15px] text-[#8A8A8A]">{email}</div>}
          <div className="mt-2.5 text-[13px] tabular-nums text-[#5E5E5E]">{line}</div>

          <div className="my-6 h-px bg-[#1A1A1A]" />

          <ActivitiesSection count={activityCount} onOpen={() => navigate("/you/activities")} className="mb-6.5" />
          <NotifSection notif={notif} className="mb-6.5" />
          <AppSection update={update} />

          <SignOutSection busy={signOut.busy} onRequest={signOut.requestSignOut} className="mt-auto pt-5" />
        </div>

        <MobileTabBar />
      </div>

      {/* ════════ Desktop ════════ */}
      <div className="relative hidden h-svh overflow-hidden bg-background lg:block">
        <DesktopIsland />
        <div className="h-full overflow-auto px-10 pt-[calc(var(--island-h)+0.5rem)] pb-10">
          <div className="mx-auto w-full max-w-[560px]">
            <div className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-faint">Account</div>
            <div className="mt-1.5 truncate text-[27px] font-semibold tracking-[-0.02em] text-ink">{title}</div>
            {email && <div className="mt-3.5 truncate text-[15px] text-[#8A8A8A]">{email}</div>}
            <div className="mt-2.5 text-[13px] tabular-nums text-[#5E5E5E]">{line}</div>

            <div className="my-[30px] h-px bg-[#1A1A1A]" />

            <ActivitiesSection count={activityCount} desktop onOpen={() => navigate("/you/activities")} className="mb-6.5" />
            <NotifSection notif={notif} desktop className="mb-6.5" />
            <AppSection update={update} desktop />

            <SignOutSection
              busy={signOut.busy}
              onRequest={signOut.requestSignOut}
              desktop
              className="mt-[34px] pt-6"
            />
          </div>
        </div>
      </div>

      {/* Confirm dialog — only surfaces when signing out would discard unsynced
          offline writes (pendingCount !== null). */}
      <Dialog open={signOut.pendingCount !== null} onOpenChange={(next) => !next && signOut.cancel()}>
        <DialogContent className="top-1/2 left-1/2 w-[calc(100%-2.5rem)] max-w-[400px] -translate-x-1/2 -translate-y-1/2 gap-0 rounded-[20px] border border-[#303030] bg-[#1a1a1a] p-6 lg:p-[26px]">
          <DialogTitle className="tracking-[-0.01em] lg:text-[19px]">Sign out?</DialogTitle>
          <p className="mt-2.5 text-[14px] leading-[1.55] text-[#9A9A9A] lg:text-[14.5px]">
            This signs you out and clears all Undegen data stored on this device. Anything not synced is gone.
          </p>
          <div className="mt-5.5 flex gap-2.5 lg:mt-6 lg:justify-end">
            <button
              type="button"
              onClick={signOut.cancel}
              className="flex-1 rounded-[12px] border border-[#303030] bg-transparent py-2.75 text-[14px] font-medium text-[#C4C4C4] transition-colors hover:border-[#3E3E3E] lg:flex-none lg:px-5 lg:py-2.5"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={signOut.busy}
              onClick={() => void signOut.confirmSignOut()}
              className="flex-1 rounded-[12px] border border-[#542E31] bg-[#3A2124] py-2.75 text-[14px] font-semibold text-[#F0DADA] transition-colors hover:bg-[#472629] disabled:pointer-events-none disabled:opacity-60 lg:flex-none lg:px-5 lg:py-2.5"
            >
              {signOut.busy ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
