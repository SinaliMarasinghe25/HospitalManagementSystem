// Dates come from the API in UTC; show them in the hospital's time zone (assumption A11).
const timeZone = 'Asia/Colombo'

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { timeZone, dateStyle: 'medium', timeStyle: 'short' })
}

// "YYYY-MM-DD" date-only values have no time zone, so format them as plain text.
export function formatDate(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    dateStyle: 'medium',
  })
}

export function ageFrom(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number)
  const today = new Date()
  let age = today.getFullYear() - year
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) {
    age--
  }
  return age
}

export function formatFileSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
