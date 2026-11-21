import type { ReactNode } from 'react'
import { Link } from 'react-router'

type Props = {
  label: string
  value: ReactNode
  detail?: ReactNode
  // Only set when this user can open the page behind the tile.
  to?: string
}

const box = 'block rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200'

export function DashboardTile({ label, value, detail, to }: Props) {
  const body = (
    <>
      <p className="text-sm text-slate-600">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {detail && <p className="text-xs text-slate-500">{detail}</p>}
    </>
  )
  return to ? (
    <Link to={to} className={`${box} hover:ring-blue-300`}>
      {body}
    </Link>
  ) : (
    <div className={box}>{body}</div>
  )
}
