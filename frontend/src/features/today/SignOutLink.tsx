import { supabase } from "@/utils/supabase"

// Temporary: no "You" screen exists yet to own sign-out, so it's a small text
// link at the end of the primary scroll content until one does. Shared by
// TodayScreen and FocusScreen (both mobile scroll bodies end with it).
export function SignOutLink() {
  return (
    <div className="py-6 text-center">
      <button
        type="button"
        onClick={() => void supabase.auth.signOut()}
        className="text-[13px] text-ink-soft underline-offset-4 transition-colors hover:text-ink hover:underline"
      >
        Sign out
      </button>
    </div>
  )
}
