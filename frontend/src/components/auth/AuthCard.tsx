import type { ReactNode } from 'react'

// The small centred card used by every page outside the app's menu:
// login, forgot password, reset password and change password.
export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {children}
      </div>
    </main>
  )
}

// Red error box and amber/green notice box, the same on each of those pages.
export function AuthAlert({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
      {children}
    </p>
  )
}

export function AuthNotice({ tone = 'amber', children }: { tone?: 'amber' | 'green'; children: ReactNode }) {
  const colours = tone === 'green' ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'
  return (
    <p className={`mt-4 rounded-md p-3 text-sm ${colours}`} role="status">
      {children}
    </p>
  )
}
