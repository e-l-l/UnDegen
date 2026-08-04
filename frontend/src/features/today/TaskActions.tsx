import { useState, type ReactElement, type ReactNode } from "react"
import { MoreVertical } from "lucide-react"

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Activity } from "@/db/types"
import { getResolvedActivity } from "@/db/activityQueries"
import { todayLocal } from "@/db/recurrence"
import { useSupabaseQuery } from "@/db/useSupabaseQuery"
import { EditActivityDialog } from "@/features/activities/EditActivityDialog"
import { cn } from "@/lib/utils"
import { DeleteChoiceDialog } from "./DeleteChoiceDialog"

interface TaskActionsProps {
  activity: Activity
  date: string
  userId: string
  // "Missed it" toggle — reminders only. When omitted (e.g. long_tasks, which
  // have no completion row and get no notifications) the item isn't rendered.
  // `missed` reflects whether this occurrence already carries a `skipped`
  // completion; the label flips to "Undo" when true. See the "Missed it" plan.
  missed?: boolean
  onToggleMissed?: () => void
  // Render the occurrence's row/card and drop `kebab` where the ⋮ trigger should
  // sit (it hides itself on mobile). The returned element is also the long-press /
  // right-click target for the context menu, so it must be a DOM element (asChild).
  children: (kebab: ReactNode) => ReactElement
}

// Per-occurrence action affordance. Two triggers, one shared menu + dialog:
//   • desktop → a hover-revealed ⋮ kebab (DropdownMenu)
//   • mobile  → press-and-hold the row/card (Radix ContextMenu = native long-press
//     on touch; also right-click on desktop as a harmless bonus)
// Two actions: "Missed it" (reminders only — stores `skipped`, silences the
// occurrence's notifications; toggles to "Undo") and Delete (opens the this-day /
// entire-activity choice dialog). Add further per-task actions (edit…) here.
export function TaskActions({ activity, date, userId, missed, onToggleMissed, children }: TaskActionsProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  // A cross-midnight active session carries its owner-date config in DayItem;
  // Editing is always based on today's config, so resolve it from Supabase.
  const editActivity = useSupabaseQuery(async () => {
    if (!editOpen) return undefined
    return getResolvedActivity(activity.id, todayLocal())
  }, [editOpen, activity.id])
  const openDialog = () => setDialogOpen(true)
  const missedLabel = missed ? "Undo" : "Missed it"

  const kebab = (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for ${activity.name}`}
        className={cn(
          "hidden size-7 shrink-0 items-center justify-center rounded-md text-ink-faint outline-none transition-opacity lg:flex",
          "opacity-0 hover:bg-surface-raised hover:text-ink-body focus-visible:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/30",
          "group-hover:opacity-100 data-[state=open]:bg-surface-raised data-[state=open]:opacity-100"
        )}
      >
        <MoreVertical className="size-4" strokeWidth={2} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        <DropdownMenuItem onSelect={() => setEditOpen(true)}>Edit activity</DropdownMenuItem>
        {onToggleMissed && <DropdownMenuItem onSelect={onToggleMissed}>{missedLabel}</DropdownMenuItem>}
        <DropdownMenuItem variant="destructive" onSelect={openDialog}>
          Delete…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children(kebab)}</ContextMenuTrigger>
        <ContextMenuContent className="min-w-36">
          <ContextMenuItem onSelect={() => setEditOpen(true)}>Edit activity</ContextMenuItem>
          {onToggleMissed && <ContextMenuItem onSelect={onToggleMissed}>{missedLabel}</ContextMenuItem>}
          <ContextMenuItem variant="destructive" onSelect={openDialog}>
            Delete…
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <DeleteChoiceDialog
        activity={activity}
        date={date}
        userId={userId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
      {editOpen && editActivity && <EditActivityDialog activity={editActivity} onClose={() => setEditOpen(false)} />}
    </>
  )
}
