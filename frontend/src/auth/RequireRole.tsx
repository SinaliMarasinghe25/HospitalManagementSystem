import type { ReactNode } from 'react'
import type { Role } from './roles'
import { hasAnyRole } from './roles'
import { useAuth } from './useAuth'

// Shows the page only to the given roles. The API checks the same roles on every request;
// this just stops users from landing on a page that would fail.
export function RequireRole({ roles, children }: { roles: readonly Role[]; children: ReactNode }) {
  const { user } = useAuth()

  if (!hasAnyRole(user?.roles, roles)) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200/70">
        <h1 className="text-[1.75rem] leading-tight font-medium text-slate-900">Not authorised</h1>
        <p className="mt-2 text-slate-600">Your role does not have access to this page.</p>
      </div>
    )
  }

  return children
}
