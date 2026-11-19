// One small helper for every API call, built on the browser's fetch().
// It sends and receives JSON, includes the login cookie, and turns error
// responses (ProblemDetails) into an ApiError with a readable message.

export class ApiError extends Error {
  readonly status: number
  readonly fieldErrors: Record<string, string[]>

  constructor(status: number, message: string, fieldErrors: Record<string, string[]> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

// Fired when the session has expired, so the app can send the user back to the login page.
export const SESSION_EXPIRED_EVENT = 'hms:session-expired'

type ProblemDetails = {
  title?: string
  detail?: string
  errors?: Record<string, string[]>
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })

  if (response.ok) {
    // 204 No Content has no body to read.
    if (response.status === 204) {
      return undefined as T
    }
    return (await response.json()) as T
  }

  if (response.status === 401 && !path.startsWith('/auth/')) {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
  }

  let problem: ProblemDetails = {}
  try {
    problem = (await response.json()) as ProblemDetails
  } catch {
    // The body was empty or not JSON; fall back to a generic message below.
  }

  const message =
    problem.title ??
    problem.detail ??
    (response.status === 403
      ? 'You do not have permission to do this.'
      : response.status >= 500
        ? 'The server is not available. Please try again later.'
        : `Request failed (${response.status}).`)

  throw new ApiError(response.status, message, problem.errors)
}
