import { NavLink } from 'react-router'
import { hasAnyRole } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { navItems } from '../../navigation'

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth()
  const visibleItems = navItems.filter((item) => hasAnyRole(user?.roles, item.roles))

  return (
    <nav aria-label="Main navigation" className="flex flex-col gap-1 p-3">
      {visibleItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/'}
          onClick={onNavigate}
          // NavLink adds aria-current="page" to the active link automatically.
          className={({ isActive }) =>
            `rounded-md px-3 py-2 text-sm font-medium ${
              isActive ? 'bg-blue-50 text-blue-800' : 'text-slate-700 hover:bg-slate-100'
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
