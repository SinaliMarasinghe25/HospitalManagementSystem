import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowRightIcon } from '../layout/icons'

type Props = {
  label: string
  value: ReactNode
  detail?: ReactNode
  // Only set when this user can open the page behind the tile.
  to?: string
  icon?: ReactNode
}

// One cell of the dashboard's number strip: label, big figure, a line of detail, and a link.
const cell = 'group flex min-h-32 flex-col bg-white p-4 transition-colors sm:min-h-36 sm:p-5'

export function DashboardTile({ label, value, detail, to, icon }: Props) {
  const body = (
    <>
      <div className="flex items-center gap-2 text-slate-400">
        {icon}
        <p className="eyebrow">{label}</p>
      </div>
      <p
        className={`mt-4 font-display leading-none font-normal tracking-tight text-slate-900 tabular-nums ${
          typeof value === 'string' && value.length > 9 ? 'text-[2rem]' : 'text-[2.5rem]'
        }`}
      >
        {value}
      </p>
      {detail && <p className="mt-2 text-xs text-slate-500 tabular-nums">{detail}</p>}
      {to && (
        <span
          className="mt-auto flex items-center gap-1 pt-4 font-mono text-[11px] tracking-wide text-slate-400 uppercase group-hover:text-brand-700"
          aria-hidden="true"
        >
          Open <ArrowRightIcon width={12} height={12} className="transition-transform group-hover:translate-x-0.5" />
        </span>
      )}
    </>
  )
  return to ? (
    <Link to={to} className={`${cell} hover:bg-slate-50`}>
      {body}
    </Link>
  ) : (
    <div className={cell}>{body}</div>
  )
}
