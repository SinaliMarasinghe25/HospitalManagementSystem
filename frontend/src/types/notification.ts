// Matches NotificationDtos.cs in the API.
export type AppNotification = {
  id: number
  title: string
  message: string
  // A page inside this app, e.g. "/laboratory/requests/12".
  link: string | null
  createdAt: string
  isRead: boolean
}

export type NotificationList = {
  items: AppNotification[]
  unreadCount: number
}
