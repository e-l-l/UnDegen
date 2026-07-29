# Design handoff — Day switcher (Today + Focus)

Self-contained brief for the design session. The **data/state plumbing is already
built and wired**; this doc specifies the **visual + interaction design** the
session should build against. Where components exist today (`DaySwitcher`,
`ReadOnlyLongTaskCard`, the read-only `ReminderRow` branch) they are **functional
first passes** — restyle freely, keep the behaviour/contract.

---

## 1. What this feature is

Today (`/today`) and Focus (`/focus`) can now **step through days** and show that
day's view. Purpose: look back at what happened (past) and preview what's planned
(future).

Settled product decisions (do not re-open):

| | Decision |
|---|---|
| Interactivity | Past reminders allow **done/undo corrections**. Future reminders and every off-today long task remain review-only; skipping, sessions, and deleting are today-only. |
| Control | **Chevrons only** (`‹ ›`). No calendar-jump, no swipe. |
| Range | **Real today ±7 days.** Chevrons disable at the bounds. |
| Home | A **"Today" button**, shown only off-today (the only way back — there's no calendar). |
| Non-today reminders | **Flat chronological** list. No NOW divider, no Earlier/Up-next headers. |
| Non-today controls | Past reminders show only the done/undo circle. Everything else stays hidden (no "Missed it", no Start, no kebab, no FAB glow); future reminders have no control. Global "New Activity" stays. |
| Non-today long-tasks | Read-only per-day summary: that day's logged time / goal met, or `Planned`. |
| Header | **Relative title** (Yesterday / Tomorrow / weekday) + neutral `X of Y done`. Eyebrow keeps the full date. |
| Scope | Both **Today and Focus**; the two share one viewed day. |

---

## 2. Tone (important)

Calm and **non-punishing even on a past day full of missed reminders**. This is a
review surface, not the Stats roast — the Stats sarcasm stays contained to Stats.
A past day must not read as a wall of red failures. Missed shows as a quiet label,
not an alarm. Never needle. (Root `CLAUDE.md`: no punishing missed states outside
Stats.)

---

## 3. The data/state contract (already built)

Everything below is available now — design against it, don't rebuild it.

- **`useSelectedDay()`** (`selectedDay.ts`) → `{ selectedDate, realToday, isToday, stepDay(±1), goToday(), canGoBack, canGoForward }`. `DAY_WINDOW = 7`. Provider is above the routes, so the viewed day persists across Today↔Focus and resets to today on cold start / notification tap.
- **`useTodayData(userId, selectedDate)`** → adds `isToday`, `title` (relative label), `reminders` (flat, time-ordered `ReminderBucket[]`), `totalCount`, alongside the existing `earlier`/`upNext`/`nowLabel`/`doneCount`/`toGoCount`/`eyebrow`/`longTasks`.
- **`ReminderBucket`** = `{ item: DayItem, timeLabel, anchorMinutes }`; `item.state` ∈ `done | skipped | missed | pending`.
- **`DayItem.sessions`** on a long-task = that day's work sessions (per-day rollup source).

Behavioural invariants to preserve: `dayAccess(selectedDate, realToday)` allows reminder completion writes for past+today and session starts only today. Off-today still passes `readOnly` down to select the flat layout; `canUpdateReminders` independently exposes the past-day done/undo circle. `db/dayView.ts` derives past→`missed` / future→`pending` before a correction exists.

---

## 4. Switcher control (`DaySwitcher.tsx`)

- `‹` prev / `›` next stepping one day; **disabled** (visibly, low emphasis) when `!canGoBack` / `!canGoForward` (i.e. at real today ±7).
- **"Today"** affordance, shown **only when `!isToday`**, calls `goToday()`.
- **Grayscale only.** Pink is reserved for CTA / brand mark / live indicator (`index.css` rule, enforced across `toggle-group.tsx`/`button.tsx`). Use the elevated/edge grays (`bg-surface-raised`, `border-edge-chip`, `text-ink-*`).
- Icons: `lucide-react` `ChevronLeft`/`ChevronRight` (the `today/` folder's icon convention).
- **Placement:** header. Desktop = the existing title/`New Activity` `justify-between` row (title left, switcher beside it). Mobile = the stacked header block, beside the big relative title. Focus mirrors Today. (Current first pass puts it in the title row on both — refine as you see fit.)
- The header title/eyebrow already name the viewed day, so the control itself needn't repeat the date — but if a design wants an inline date label, that's fine.

## 5. Header

- **Title:** `data.title` — `Today` / `Yesterday` / `Tomorrow`, else the weekday name (within ±7). Today's title/behaviour is unchanged.
- **Eyebrow:** full date of the viewed day (unchanged shape: `Weekday · Mon D`).
- **Counts:** today = `X done · Y to go today` (unchanged). Off-today = neutral **`X of Y done`** — no "to go" (can't act), no "missed" wording in the header (that's a Stats concern).
- Focus: off-today, the relative day label replaces the `Focus` eyebrow; title stays `Long tasks`.

## 6. Non-today reminder list (read-only `ReminderRow`)

- One **flat, time-ordered** list. No NOW divider, no section headers.
- Each row: time (or `RANDOM`), icon, title, and a **calm right-aligned state label** — `Done` / `Missed` (nothing for `pending`). Past rows append the same done/undo circle used today; future rows do not. No kebab or context-menu off-today.
- `done`/`skipped` rows keep the existing faded (+ strikethrough for skipped) treatment; a **derived `missed`** (past, never marked) shows the label at **full opacity** — quiet, not a failure. Design the exact glyph/label treatment; keep it subdued.

## 7. Non-today long-task card (`ReadOnlyLongTaskCard.tsx`)

- Reflects **that day** from `item.sessions`: `Xh Ym logged` (+ `· goal met` when a goal-mode session hit its target), else `Planned` (future / none yet) or `Not logged` (past, none).
- **No Start, no live timer, no progress bar/sparkline** (those idle-card widgets are all-time and today-scoped), **no kebab**.
- Same card shell language as the idle cards (`idle-*` tokens) minus the interactive bits.

## 8. Empty states

- A past pre-history day (before the user had anything) or an empty future day: a calm, brief empty line — not a prompt to act (it's read-only). Focus already has a create-oriented empty state; consider a quieter variant off-today.

## 9. Tokens / system

Grayscale + single pastel-pink accent, dark always (`src/index.css`). Text ramp `--ink-faint`→`--ink`; surfaces `--surface`/`--surface-raised`/`--elevated`/`--elevated-lg`; edges `--edge-panel`/`--edge-chip`. Pink (`--pink`) **only** for CTA/brand/live — never nav, never selection, never the switcher. Reusable primitives: `components/ui/toggle-group.tsx` (grayscale segmented control), `button.tsx`, `calendar.tsx`+`popover.tsx` (unused here — no calendar jump).
