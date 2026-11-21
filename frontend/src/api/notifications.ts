import type { NotificationList } from '../types/notification'
import { apiFetch } from './client'

// One function per endpoint in NotificationsController.cs.

export function getNotifications(): Promise<NotificationList> {
  return apiFetch<NotificationList>('/notifications')
}

export async function getUnreadCount(): Promise<number> {
  return (await apiFetch<{ count: number }>('/notifications/unread-count')).count
}

export function markRead(id: number): Promise<void> {
  return apiFetch<void>(`/notifications/${id}/read`, { method: 'POST' })
}

export function markAllRead(): Promise<void> {
  return apiFetch<void>('/notifications/read-all', { method: 'POST' })
}
