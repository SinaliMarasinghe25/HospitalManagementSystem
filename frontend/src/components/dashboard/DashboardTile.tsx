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
  // Colour of the 3D icon badge.
  tone?: keyof typeof tones
}

const tones = {
  blue: 'from-brand-400 to-brand-700',
  aqua: 'from-accent-300 to-accent-600',
  violet: 'from-violet-400 to-violet-600',
  coral: 'from-coral-400 to-coral-600',
  amber: 'from-amber-300 to-amber-500',
}

// One cell of the dashboard's number strip: label, big figure, a line of detail, and a link.
const cell = 'group @container flex min-h-32 min-w-0 flex-col rounded-[1.25rem] bg-white p-4 shadow-card ring-1 ring-slate-200/60 transition lg:min-h-0'

export function DashboardTile({ label, value, detail, to, icon, tone = 'blue' }: Props) {
  const body = (
    <>
      <div className="flex items-center gap-2 xl:gap-2.5">
        {icon && <span className={`icon-3d h-7 w-7 rounded-xl xl:h-8 xl:w-8 ${tones[tone]}`}>{icon}</span>}
        <p className="eyebrow min-w-0 text-[10px] leading-tight">{label}</p>
      </div>
      <p
        className={`mt-4 font-display leading-none font-semibold tracking-[-0.03em] whitespace-nowrap text-slate-900 tabular-nums ${
          typeof value === 'string' && value.length > 9 ? 'text-[clamp(1.1rem,13cqi,2rem)]' : 'text-[clamp(1.5rem,20cqi,2.25rem)]'
        }`}
      >
        {value}
      </p>
      {detail && <p className="mt-2 text-xs text-slate-500 tabular-nums">{detail}</p>}
      {to && (
        <span
          className="mt-auto flex items-center gap-1 pt-3 font-mono text-[11px] tracking-wide text-slate-400 uppercase group-hover:text-brand-700"
          aria-hidden="true"
        >
          Open <ArrowRightIcon width={12} height={12} className="transition-transform group-hover:translate-x-0.5" />
        </span>
      )}
    </>
  )
  return to ? (
    <Link to={to} className={`${cell} hover:-translate-y-0.5 hover:bg-white`}>
      {body}
    </Link>
  ) : (
    <div className={cell}>{body}</div>
  )
}
