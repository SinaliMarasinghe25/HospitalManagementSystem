import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { getNotifications, getUnreadCount, markAllRead, markRead } from '../../api/notifications'
import type { AppNotification } from '../../types/notification'
import { formatDateTime } from '../../utils/format'
import { BellIcon } from './icons'

// How often the bell asks for the unread count. The API does not count this as activity,
// so the 20-minute session timeout still works on an unattended screen.
const POLL_MS = 60_000

// The bell in the header (assumption A27): a red badge with the unread count, and a panel with the newest 20.
export function NotificationBell() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AppNotification[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const refreshCount = useCallback(() => {
    // A failed count is not worth an error message: the next poll tries again.
    // A 401 (session ended) is handled by apiFetch, which sends the user to the login page.
    getUnreadCount().then(setUnread, () => {})
  }, [])

  // On every page change, and every minute while the browser tab is visible.
  useEffect(() => {
    refreshCount()
  }, [pathname, refreshCount])

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') refreshCount()
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [refreshCount])

  // Close the panel with Escape or a click outside it.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onClick)
    }
  }, [open])

  async function load() {
    setError(null)
    try {
      const list = await getNotifications()
      setItems(list.items)
      setUnread(list.unreadCount)
    } catch {
      setError('Could not load notifications.')
    }
  }

  function toggle() {
    if (!open) void load()
    setOpen(!open)
  }

  async function openItem(item: AppNotification) {
    setOpen(false)
    if (!item.isRead) {
      await markRead(item.id).catch(() => {})
      refreshCount()
    }
    if (item.link) navigate(item.link)
  }

  async function readAll() {
    await markAllRead().catch(() => {})
    await load()
  }

  const badge = unread > 99 ? '99+' : String(unread)

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="notification-panel"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        className="relative rounded-full p-2.5 text-slate-500 hover:bg-white/80 hover:text-slate-900"
      >
        <BellIcon />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-4 rounded-sm bg-red-700 px-1 text-center font-mono text-[10px] leading-4 font-medium text-white ring-2 ring-paper">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div
          id="notification-panel"
          // Phones: full width under the header. Larger screens: a dropdown below the bell.
          className="fade-in fixed inset-x-2 top-16 z-40 overflow-hidden rounded-xl bg-white/90 shadow-pop backdrop-blur-xl sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-96"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Notifications</h2>
            {unread > 0 && (
              <button type="button" onClick={() => void readAll()} className="text-xs text-brand-700 hover:underline">
                Mark all as read
              </button>
            )}
          </div>

          {error && <p className="px-4 py-3 text-sm text-red-700">{error}</p>}
          {!error && items === null && <p className="px-4 py-3 text-sm text-slate-600">Loading...</p>}
          {items?.length === 0 && <p className="px-4 py-3 text-sm text-slate-600">No notifications yet.</p>}

          {items && items.length > 0 && (
            <ul className="scroll-slim max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => void openItem(item)}
                    className={`block w-full px-4 py-3 text-left hover:bg-slate-50 ${item.isRead ? '' : 'bg-brand-50/60'}`}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-slate-900">
                      {!item.isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-label="Unread" />}
                      {item.title}
                    </span>
                    <span className="mt-0.5 block text-sm text-slate-700">{item.message}</span>
                    <span className="mt-1 block text-xs text-slate-500">{formatDateTime(item.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
