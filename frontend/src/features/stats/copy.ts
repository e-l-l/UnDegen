// Threshold-driven sarcastic copy for the Stats surface. Attitude lives here,
// not in the JSX — sarcasm targets the *gap* (the not-done), never the user as a
// person, and never needles a good week (a great week gets a plain, slightly
// surprised nod). This is the one place root CLAUDE.md's "no punishing missed
// states" rule is overridden, and it's scoped to Stats only. Exact lines by band
// come from features/stats/DESIGN_BRIEF.md §2 / the design hand-off.

// Format minutes → "Xh Ym" / "Xh" / "Ym" / "0m".
export function fmtMins(m: number): string {
  if (m <= 0) return "0m"
  const h = Math.floor(m / 60)
  const mm = m % 60
  if (h && mm) return `${h}h ${mm}m`
  if (h) return `${h}h`
  return `${mm}m`
}

// Hero roast: reacts to the showed-up rate, with a "weeks down" escalation.
export function heroCopy(showedUp: number, planned: number, weeksDown: number): string {
  if (planned === 0) return "Nothing to show. You haven't done anything yet. Poetic."
  const rate = showedUp / planned
  if (rate >= 0.95) return `${showedUp} of ${planned}. Look at you, functioning.`
  if (rate >= 0.85) return `${showedUp} of ${planned}. A good week. Noted, quietly.`
  if (rate >= 0.6) return `${showedUp} of ${planned}. Fine. Not a victory lap, but fine.`
  if (weeksDown >= 2) return "Second week down. The trend line has opinions."
  if (rate <= 0.15) return `${showedUp} of ${planned}. We both know what that means.`
  return `${showedUp} of ${planned}. Bold strategy.`
}

// Most-avoided callout roast. The gap is the target.
export function avoidCopy(): string {
  return "It's not going anywhere. Neither are you, apparently."
}

// Shown in the most-avoided slot when nothing was dodged — a plain, faintly
// suspicious nod, not a dig.
export const NO_AVOIDED = {
  title: "Nothing dodged this week.",
  sub: "Suspicious. Or you actually did the things.",
} as const

// Whole-section empty state (no activities logged at all).
export const EMPTY_AVOIDED = {
  title: "No activity yet.",
  sub: "Add something to avoid first.",
} as const
