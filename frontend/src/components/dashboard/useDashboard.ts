import { useCallback, useEffect, useRef, useState } from 'react'
import { getDashboard } from '../../api/dashboard'
import type { DashboardSummary } from '../../types/dashboard'

// Reload every 30 seconds while the page is visible, so changes made by other people show up.
const REFRESH_MS = 30_000

// Loads the dashboard when the page opens, every 30 seconds, when you come back to the browser tab,
// and when you press Refresh. A failed reload keeps the last numbers and shows an error.
export function useDashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const busy = useRef(false)

  // Every state change here happens after the answer arrives, never straight away.
  const load = useCallback(() => {
    if (busy.current) return
    busy.current = true
    getDashboard()
      .then((next) => {
        setSummary(next)
        setError(null)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load the dashboard.'))
      .finally(() => {
        busy.current = false
        setLoading(false)
      })
  }, [])

  // The Refresh button: show "Loading..." straight away, then load.
  const refresh = useCallback(() => {
    setLoading(true)
    load()
  }, [load])

  useEffect(() => {
    load()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') load()
    }, REFRESH_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [load])

  return { summary, error, loading, refresh }
}
