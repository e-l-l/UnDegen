import {
  Activity as ActivityGlyph,
  Bell,
  Coffee,
  Flame,
  Moon,
  Phone,
  Pill,
  Shirt,
  Sun,
  Target,
  Video,
  type LucideIcon,
} from "lucide-react"

import type { Activity } from "@/db/types"

// Settled decision (root CLAUDE.md): no icon/emoji column in the DB — the icon
// is derived from activity type + name on the frontend. Keyword match first,
// then a per-type fallback so every activity renders *something*.
const KEYWORD_ICONS: [RegExp, LucideIcon][] = [
  [/med/i, Pill],
  [/coffee|inbox/i, Coffee],
  [/stand-?up|meeting|video|call/i, Video],
  [/dentist|phone/i, Phone],
  [/lunch|walk|sun/i, Sun],
  [/clean|laundry|shirt|dress/i, Shirt],
  [/gym|workout|exercise|run/i, ActivityGlyph],
  [/dinner|cook|meal/i, Flame],
  [/wind down|sleep|bed|screens/i, Moon],
]

export function iconForActivity(activity: Pick<Activity, "type" | "name">): LucideIcon {
  for (const [pattern, icon] of KEYWORD_ICONS) {
    if (pattern.test(activity.name)) return icon
  }
  return activity.type === "reminder" ? Bell : Target
}
