export interface DayAccess {
  canUpdateReminders: boolean
  canRunSessions: boolean
}

// Local dates use YYYY-MM-DD throughout the app, so lexical ordering matches
// calendar ordering. Past reminder completions are safe to correct after the
// fact; work sessions are not, because starting one records the current time.
export function dayAccess(selectedDate: string, realToday: string): DayAccess {
  return {
    canUpdateReminders: selectedDate <= realToday,
    canRunSessions: selectedDate === realToday,
  }
}
