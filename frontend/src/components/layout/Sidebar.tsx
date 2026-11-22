import { NavLink } from 'react-router'
import { hasAnyRole } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { navItems, type NavItem } from '../../navigation'
import {
  AuditIcon, BedIcon, BillingIcon, CalendarIcon, DashboardIcon, DoctorIcon, FlaskIcon, PatientsIcon, PillIcon,
  RecordsIcon, ReportsIcon, StaffIcon,
} from './icons'

// Menu icon for each page in navigation.ts, by path.
const navIcons: Record<string, typeof DashboardIcon> = {
  '/': DashboardIcon,
  '/patients': PatientsIcon,
  '/doctors': DoctorIcon,
  '/appointments': CalendarIcon,
  '/medical-records': RecordsIcon,
  '/admissions': BedIcon,
  '/laboratory': FlaskIcon,
  '/pharmacy': PillIcon,
  '/billing': BillingIcon,
  '/staff': StaffIcon,
  '/reports': ReportsIcon,
  '/audit-log': AuditIcon,
}

// Menu sections. The order of navItems is kept; a heading is shown only when the user can see an item under it.
const sections: { title: string; paths: string[] }[] = [
  { title: 'Overview', paths: ['/'] },
  {
    title: 'Clinical',
    paths: ['/patients', '/doctors', '/appointments', '/medical-records', '/admissions', '/laboratory', '/pharmacy'],
  },
  { title: 'Administration', paths: ['/billing', '/staff', '/reports', '/audit-log'] },
]

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth()
  const visibleItems = navItems.filter((item) => hasAnyRole(user?.roles, item.roles))
  // Any item not listed in a section (a new module) still shows, at the end.
  const listed = new Set(sections.flatMap((s) => s.paths))
  const groups = [
    ...sections.map((s) => ({ title: s.title, items: visibleItems.filter((i) => s.paths.includes(i.path)) })),
    { title: 'More', items: visibleItems.filter((i) => !listed.has(i.path)) },
  ].filter((g) => g.items.length > 0)

  return (
    <nav aria-label="Main navigation" className="flex flex-col gap-6 px-3 py-5">
      {groups.map((group) => (
        <div key={group.title}>
          <p className="eyebrow px-3 pb-2 text-slate-400" aria-hidden="true">
            {group.title}
          </p>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => (
              <MenuLink key={item.path} item={item} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  )
}

function MenuLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const Icon = navIcons[item.path]
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      onClick={onNavigate}
      // NavLink adds aria-current="page" to the active link automatically.
      className={({ isActive }) =>
        `group relative flex items-center gap-3 rounded-md px-3 py-[7px] text-sm transition-colors ${
          isActive
            ? 'bg-white font-medium text-slate-900 ring-1 ring-slate-200'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute inset-y-2 -left-3 w-[3px] bg-brand-700" aria-hidden="true" />}
          {Icon && (
            <Icon width={18} height={18} className={isActive ? 'text-brand-700' : 'text-slate-400 transition-colors group-hover:text-slate-600'} />
          )}
          {item.label}
        </>
      )}
    </NavLink>
  )
}
