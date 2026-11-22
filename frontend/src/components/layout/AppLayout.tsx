import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import { useAuth } from '../../auth/useAuth'
import { navItems } from '../../navigation'
import { ChevronDownIcon, CloseIcon, KeyIcon, LogoMark, LogoutIcon, MenuIcon } from './icons'
import { NotificationBell } from './NotificationBell'
import { Sidebar } from './Sidebar'

// The frame around every page after login: dark sidebar, top bar, and the page itself (<Outlet />).
export function AppLayout() {
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  // Close the mobile menu when Escape is pressed. (Clicking a link closes it via onNavigate.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // The module the current page belongs to, shown in the top bar ("Patients" for /patients/12/edit).
  // Today's date for the top bar, worked out once when the layout opens.
  const [todayLabel] = useState(() =>
    new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
  )
  const section =
    navItems.find((item) => item.path !== '/' && (pathname === item.path || pathname.startsWith(`${item.path}/`)))
      ?.label ?? (pathname === '/' ? 'Dashboard' : '')

  return (
    <div className="min-h-screen bg-paper print:bg-white">
      {/* Desktop: the sidebar is always visible */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-slate-50 lg:flex print:hidden">
        <SidebarBody />
      </aside>

      {/* Mobile and tablet: slides in from the left */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden print:hidden">
          <div
            className="fade-in absolute inset-0 bg-slate-950/40"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <aside id="mobile-menu" className="slide-in absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-slate-200 bg-slate-50 shadow-pop">
            <button
              type="button"
              className="absolute top-4 right-3 rounded-md p-2 text-slate-500 hover:bg-slate-200/60 hover:text-slate-900"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
            >
              <CloseIcon />
            </button>
            <SidebarBody onNavigate={() => setMenuOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-64 print:pl-0">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-paper/95 px-4 backdrop-blur-sm sm:px-6 lg:px-8 print:hidden">
          <button
            type="button"
            className="-ml-1 rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <MenuIcon />
          </button>
          <Link to="/" className="flex items-center gap-2 lg:hidden" aria-label="Dashboard">
            <LogoMark className="h-8 w-8" />
          </Link>

          <div className="min-w-0 flex-1">
            <p className="hidden truncate font-mono text-xs tracking-wide text-slate-500 uppercase sm:block">
              <span className="text-slate-400">HMS</span>
              {section && (
                <>
                  <span className="mx-2 text-slate-300" aria-hidden="true">/</span>
                  <span className="text-slate-800">{section}</span>
                </>
              )}
              <span className="mx-2 text-slate-300" aria-hidden="true">·</span>
              <span className="text-slate-400">{todayLabel}</span>
            </p>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <NotificationBell />
            <span className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" aria-hidden="true" />
            <UserMenu />
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print:p-0">
          <div key={pathname} className="page-enter mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth()
  return (
    <>
      <Link to="/" onClick={onNavigate} className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 px-5">
        <LogoMark className="h-8 w-8" />
        <span className="leading-tight">
          <span className="block font-display text-lg font-medium text-slate-900">HMS</span>
          <span className="eyebrow block text-[10px] whitespace-nowrap text-slate-400">Hospital Management</span>
        </span>
      </Link>
      <div className="scroll-slim flex-1 overflow-y-auto">
        <Sidebar onNavigate={onNavigate} />
      </div>
      {user && (
        <div className="flex items-center gap-3 border-t border-slate-200 px-5 py-4">
          <Avatar name={user.userName} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900">{user.userName}</p>
            <p className="truncate font-mono text-[11px] text-slate-500">{user.roles.join(', ')}</p>
          </div>
        </div>
      )}
    </>
  )
}

function Avatar({ name, size = 'h-9 w-9' }: { name: string; size?: string }) {
  const initials = name
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
  return (
    <span
      className={`${size} inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-mono text-[11px] font-medium text-brand-800 ring-1 ring-brand-200`}
      aria-hidden="true"
    >
      {initials || '?'}
    </span>
  )
}

// Name and roles, with Change password and Logout in a small drop-down.
function UserMenu() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onClick)
    }
  }, [open])

  if (!user) return null

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="user-menu"
        className="flex items-center gap-2 rounded-md p-1 pr-2 text-left hover:bg-slate-100"
      >
        <Avatar name={user.userName} size="h-8 w-8" />
        <span className="hidden leading-tight md:block">
          <span className="block max-w-40 truncate text-sm font-medium text-slate-900">{user.userName}</span>
          <span className="block max-w-40 truncate font-mono text-[11px] text-slate-500">{user.roles.join(', ')}</span>
        </span>
        <ChevronDownIcon width={16} height={16} className="text-slate-400" />
        <span className="sr-only">Account menu</span>
      </button>

      {open && (
        <div
          id="user-menu"
          className="fade-in absolute right-0 z-40 mt-2 w-60 overflow-hidden rounded-lg bg-white shadow-pop"
        >
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="truncate text-sm font-medium text-slate-900">{user.userName}</p>
            <p className="truncate text-xs text-slate-500">{user.roles.join(', ')}</p>
          </div>
          <div className="p-1.5">
            <Link
              to="/change-password"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900"
            >
              <KeyIcon width={18} height={18} className="text-slate-400" />
              Change password
            </Link>
            <button
              type="button"
              onClick={() => void logout()}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-700 hover:bg-red-50"
            >
              <LogoutIcon width={18} height={18} />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
