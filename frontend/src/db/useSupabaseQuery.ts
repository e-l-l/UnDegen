import { useEffect, useRef, useState, type DependencyList } from "react"

type Listener = () => void

const listeners = new Set<Listener>()
let dataVersion = 0

// Supabase is the source of truth. Mutations call this after the server accepts
// a change so mounted reads refetch the authoritative rows.
export function invalidateSupabaseData(): void {
  dataVersion++
  for (const listener of listeners) listener()
}

// Refresh server-backed reads when the app may have missed another device's
// changes. This is query invalidation only; there is no local database or sync.
export function useSupabaseRefresh(userId: string): void {
  useEffect(() => {
    invalidateSupabaseData()

    const onOnline = () => invalidateSupabaseData()
    const onVisible = () => {
      if (document.visibilityState === "visible") invalidateSupabaseData()
    }
    window.addEventListener("online", onOnline)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.removeEventListener("online", onOnline)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [userId])
}

// Minimal async query hook for the app's server-backed read functions. It keeps
// the last successful value during a refresh and uses undefined only for the
// initial load, matching the loading contract the screens already consume.
export function useSupabaseQuery<T>(query: () => Promise<T>, dependencies: DependencyList): T | undefined {
  const queryRef = useRef(query)
  queryRef.current = query

  const [value, setValue] = useState<T | undefined>(undefined)
  const [version, setVersion] = useState(dataVersion)

  useEffect(() => {
    const listener = () => setVersion(dataVersion)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  useEffect(() => {
    let current = true
    void queryRef.current()
      .then((next) => {
        if (current) setValue(next)
      })
      .catch((error: unknown) => {
        if (current) console.error("[data] Supabase query failed", error)
      })
    return () => {
      current = false
    }
    // The caller controls the query key through the dependency list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, ...dependencies])

  return value
}
