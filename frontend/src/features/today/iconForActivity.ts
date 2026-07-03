import { Bell, Target, type LucideIcon } from "lucide-react"

import type { Activity } from "@/db/types"

import { KEYWORD_ICONS } from "./iconKeywords"

// Settled decision (root CLAUDE.md): no icon/emoji column in the DB — the icon
// is derived from activity type + name on the frontend. Keyword match first,
// then a per-type fallback so every activity renders *something*.
export function iconForActivity(activity: Pick<Activity, "type" | "name">): LucideIcon {
  for (const [pattern, icon] of KEYWORD_ICONS) {
    if (pattern.test(activity.name)) return icon
  }
  return activity.type === "reminder" ? Bell : Target
}
