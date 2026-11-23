import type { ReactNode } from 'react'
import { CalendarIcon, FlaskIcon, LogoMark, PillIcon } from '../layout/icons'
import { CornerCard, PanelPicture } from '../ui/NotchedPanel'

const highlights = [
  ['01', 'Patient registration, appointments and medical records'],
  ['02', 'Inpatient care, laboratory, pharmacy and billing'],
  ['03', 'Role-based access for clinical and administrative staff'],
]

// Floating chips on the picture: the main areas of the system, each with a coloured 3D icon.
const modules: [string, string, ReactNode][] = [
  ['Outpatient and inpatient care', 'from-brand-400 to-brand-700', <CalendarIcon key="c" width={15} height={15} />],
  ['Laboratory results', 'from-violet-400 to-violet-600', <FlaskIcon key="f" width={15} height={15} />],
  ['Pharmacy and billing', 'from-coral-400 to-coral-600', <PillIcon key="p" width={15} height={15} />],
]

// The teams the system serves, shown as a small stack of round badges.
const teams = [
  ['Dr', 'bg-brand-700 text-white'],
  ['RN', 'bg-accent-300 text-brand-950'],
  ['Lab', 'bg-white text-brand-800'],
  ['Rx', 'bg-brand-200 text-brand-900'],
]

// The page used outside the app's menu: login, forgot password, reset password and change password.
// A light rounded frame: a bold headline, then a soft panel with the hospital picture and two cards tucked
// into its corners (the system summary on the left, the form on the right). Phones get the headline,
// a short picture and the form.
export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-200/70 p-2 sm:p-4 lg:h-dvh lg:min-h-0 lg:p-[max(0.75rem,2vh)]">
      <div className="flex min-h-[calc(100vh-1rem)] flex-col rounded-[2rem] bg-frame p-4 shadow-pop sm:min-h-[calc(100vh-2rem)] sm:p-6 lg:h-full lg:min-h-0 lg:rounded-[2.5rem] lg:p-[max(1.25rem,3.5vh)]">
        <header className="flex items-center gap-3">
          <span className="flex items-center gap-2.5 rounded-full bg-white py-1.5 pr-5 pl-1.5 shadow-sm ring-1 ring-slate-200/70">
            <LogoMark className="h-9 w-9 rounded-full!" />
            <span className="text-base font-semibold tracking-tight text-slate-900">HMS</span>
          </span>
          <span className="ml-auto hidden items-center gap-2.5 text-[15px] font-medium text-slate-700 sm:flex">
            <span className="h-2 w-2 rounded-full bg-accent-400 shadow-[0_0_10px] shadow-accent-400/70" aria-hidden="true" />
            Hospital Management System
          </span>
        </header>

        <div className="mt-8 flex flex-wrap items-start justify-between gap-6 lg:mt-[3vh]">
          <h2 className="max-w-4xl text-[2.4rem] leading-[1.04] font-semibold tracking-[-0.035em] text-slate-900 sm:text-6xl lg:text-[clamp(2.5rem,7vh,4.25rem)]">
            Integrated patient care
            <span className="ml-3 inline-flex translate-y-[-0.12em] gap-1.5 align-middle" aria-hidden="true">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-700 text-white shadow-md shadow-brand-900/20 lg:h-[clamp(2.5rem,6vh,3.5rem)] lg:w-[clamp(2.5rem,6vh,3.5rem)]">
                <svg viewBox="0 0 24 24" className="h-1/2 w-1/2" fill="currentColor"><path d="M9.5 3h5a1 1 0 0 1 1 1v4.5H20a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-4.5V20a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-4.5H4a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1h4.5V4a1 1 0 0 1 1-1Z" /></svg>
              </span>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent-300 text-brand-950 lg:h-[clamp(2.5rem,6vh,3.5rem)] lg:w-[clamp(2.5rem,6vh,3.5rem)]">
                <svg viewBox="0 0 24 24" className="h-1/2 w-1/2" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l2-5 4 10 2-5h6" /></svg>
              </span>
            </span>
            <span className="block text-slate-900">
              and hospital <span className="text-brand-700">administration</span>
            </span>
          </h2>

          <div className="hidden max-w-60 xl:block [@media(max-height:879px)]:hidden!">
            <div className="flex -space-x-2.5" aria-hidden="true">
              {teams.map(([label, colours]) => (
                <span key={label} className={`inline-flex h-11 w-11 items-center justify-center rounded-full text-[10px] font-semibold ring-3 ring-frame ${colours}`}>
                  {label}
                </span>
              ))}
            </div>
            <p className="mt-3 text-sm leading-snug text-slate-600">
              For doctors, nurses, laboratory, pharmacy and administration teams.
            </p>
          </div>
        </div>

        <div className="relative mt-8 lg:mt-[3.5vh] lg:min-h-0 lg:flex-1">
          <div className="absolute inset-x-0 top-0 h-44 sm:h-56 lg:inset-0 lg:h-auto">
            <PanelPicture photo="/images/login-hero.jpg" artClassName="inset-x-4 bottom-0 top-4 lg:top-auto lg:right-[29%] lg:left-[25%] lg:h-[92%]" />
          </div>

          {/* Floating chips with soft 3D icons, layered at slightly different depths. */}
          <ul className="absolute top-7 left-7 hidden flex-col gap-3 lg:flex [@media(max-height:879px)]:hidden!" aria-hidden="true">
            {modules.map(([label, tone, icon], i) => (
              <li
                key={label}
                className="flex items-center gap-3 rounded-full bg-white/90 py-1.5 pr-5 pl-1.5 text-sm font-medium text-slate-800 shadow-card ring-1 ring-white backdrop-blur"
                style={{ marginLeft: `${i * 1.5}rem` }}
              >
                <span className={`icon-3d h-8 w-8 rounded-full! ${tone}`}>{icon}</span>
                {label}
              </li>
            ))}
          </ul>

          <CornerCard side="left" className="hidden w-[22rem] lg:block">
            <section className="rounded-[1.5rem] bg-white p-5 shadow-card ring-1 ring-slate-200/60" aria-label="About this system">
              <ol className="divide-y divide-slate-100">
                {highlights.map(([n, text]) => (
                  <li key={n} className="flex items-baseline gap-4 py-2 text-sm text-slate-700">
                    <span className="font-mono text-xs text-accent-600">{n}</span>
                    {text}
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-xs text-slate-500">
                Restricted to authorised personnel. All access is monitored and recorded.
              </p>
            </section>
          </CornerCard>

          <CornerCard side="right" className="mt-48 sm:mt-60 lg:mt-0 lg:w-[26rem]">
            <section className="rounded-[1.5rem] bg-white p-6 shadow-card ring-1 ring-slate-200/60 sm:p-8 lg:p-[max(1.5rem,3.5vh)]">
              <h1 className="text-3xl font-semibold text-slate-900">{title}</h1>
              {children}
            </section>
          </CornerCard>
        </div>
      </div>
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
