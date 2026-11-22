import type { ReactNode } from 'react'
import { LogoMark } from '../layout/icons'

const highlights = [
  ['01', 'Patients, appointments and medical records'],
  ['02', 'Laboratory, pharmacy and billing, connected'],
  ['03', 'Each role sees only what it needs'],
]

// The page used outside the app's menu: login, forgot password, reset password and change password.
// Large screens: a green brand panel on the left and the form on the right. Phones: the form only.
export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="grid min-h-screen bg-paper lg:grid-cols-[1fr_1fr]">
      <section className="hidden bg-brand-900 text-brand-50 lg:flex lg:flex-col lg:justify-between lg:p-14">
        <div className="flex items-center gap-3">
          <LogoMark className="h-9 w-9 bg-brand-50! text-brand-900!" />
          <span className="font-display text-xl">HMS</span>
          <span className="ml-auto font-mono text-[11px] tracking-[0.12em] text-brand-300 uppercase">
            Hospital Management System
          </span>
        </div>

        <div className="max-w-lg">
          <h2 className="font-display text-5xl leading-[1.05] font-normal tracking-tight text-white">
            One record. <em className="text-brand-200">Every</em> department.
          </h2>
          <ol className="mt-12 divide-y divide-brand-700/70 border-y border-brand-700/70">
            {highlights.map(([n, text]) => (
              <li key={n} className="flex items-baseline gap-5 py-3.5 text-brand-100">
                <span className="font-mono text-xs text-brand-300">{n}</span>
                {text}
              </li>
            ))}
          </ol>
        </div>

        <p className="font-mono text-[11px] tracking-wide text-brand-300">
          Authorised staff only. Activity is recorded in the audit log.
        </p>
      </section>

      <section className="flex items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <LogoMark className="h-9 w-9" />
            <span className="leading-tight">
              <span className="block font-display text-xl text-slate-900">HMS</span>
              <span className="eyebrow block text-[10px]">Hospital Management System</span>
            </span>
          </div>
          <h1 className="text-4xl font-normal text-slate-900">{title}</h1>
          {children}
        </div>
      </section>
    </main>
  )
}

// Red error box and amber/green notice box, the same on each of those pages.
export function AuthAlert({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 border-l-2 border-red-700 bg-red-50 p-3 text-sm text-red-800" role="alert">
      {children}
    </p>
  )
}

export function AuthNotice({ tone = 'amber', children }: { tone?: 'amber' | 'green'; children: ReactNode }) {
  const colours =
    tone === 'green' ? 'border-green-700 bg-green-50 text-green-900' : 'border-amber-600 bg-amber-50 text-amber-900'
  return (
    <p className={`mt-4 border-l-2 p-3 text-sm ${colours}`} role="status">
      {children}
    </p>
  )
}
