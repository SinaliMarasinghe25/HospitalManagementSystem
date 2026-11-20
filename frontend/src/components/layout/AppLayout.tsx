import { useEffect, useState } from 'react'
import { Link, Outlet } from 'react-router'
import { useAuth } from '../../auth/useAuth'
import { Sidebar } from './Sidebar'

// The frame around every page after login: header, sidebar, and the page itself (<Outlet />).
export function AppLayout() {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  // Close the mobile menu when Escape is pressed. (Clicking a link closes it via onNavigate.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-md p-2 text-slate-700 hover:bg-slate-100 lg:hidden"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <span className="font-semibold text-slate-900">Hospital Management System</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-slate-600 sm:inline">
            {user?.userName} ({user?.roles.join(', ')})
          </span>
          <Link to="/change-password" className="text-sm text-blue-700 hover:underline">
            Change password
          </Link>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="flex">
        {/* Desktop: always visible */}
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-56 shrink-0 overflow-y-auto border-r border-slate-200 bg-white lg:block">
          <Sidebar />
        </aside>

        {/* Mobile and tablet: slides in from the left */}
        {menuOpen && (
          <div className="fixed inset-0 z-30 lg:hidden">
            <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMenuOpen(false)} aria-hidden="true" />
            <aside id="mobile-menu" className="absolute inset-y-0 left-0 w-64 overflow-y-auto bg-white shadow-lg">
              <p className="px-6 pt-4 text-sm text-slate-600">{user?.userName}</p>
              <Sidebar onNavigate={() => setMenuOpen(false)} />
            </aside>
          </div>
        )}

        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
