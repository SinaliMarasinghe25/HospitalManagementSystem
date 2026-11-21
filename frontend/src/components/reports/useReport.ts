import { useEffect, useState } from 'react'
import { ApiError } from '../../api/client'

type Loaded<T> = { key: string; data: T | null; error: string | null }

// Loads a report and loads it again whenever a filter changes.
// "load" is one of the functions in api/reports.ts; "filter" is a small object of strings.
// While a new filter is loading, the previous report stays on screen.
export function useReport<F, T>(load: (filter: F) => Promise<T>, filter: F) {
  // Compared as text, so a new object with the same values does not load the report again.
  const key = JSON.stringify(filter)
  const [loaded, setLoaded] = useState<Loaded<T>>({ key: '', data: null, error: null })

  useEffect(() => {
    let ignore = false
    load(JSON.parse(key) as F)
      .then((data) => !ignore && setLoaded({ key, data, error: null }))
      .catch((err: unknown) => {
        if (!ignore) setLoaded({ key, data: null, error: err instanceof ApiError ? errorText(err) : 'Could not load the report.' })
      })
    return () => {
      ignore = true
    }
  }, [load, key])

  return { data: loaded.data, error: loaded.error, loading: loaded.key !== key }
}

// A wrong date range comes back as a field error; show its message rather than the general title.
function errorText(err: ApiError) {
  return Object.values(err.fieldErrors)[0]?.[0] ?? err.message
}
