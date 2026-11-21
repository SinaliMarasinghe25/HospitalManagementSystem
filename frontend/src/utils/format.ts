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

export function formatMoney(amount: number) {
  return `LKR ${amount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// "08:00:00" -> "08:00"
export function formatTime(time: string) {
  return time.slice(0, 5)
}

// ---------- Hospital-time calendar helpers (appointments) ----------

// The hospital's calendar date of a moment, as "YYYY-MM-DD" ("en-CA" formats dates that way).
export function hospitalDateOf(moment: string | Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(moment),
  )
}

export function todayInHospital() {
  return hospitalDateOf(new Date())
}

// Date-only arithmetic in UTC, so the result never shifts because of the browser's time zone.
export function addDays(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

// The Monday of the week that contains the date.
export function startOfWeek(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay() // 0 = Sunday
  return addDays(isoDate, -((weekday + 6) % 7))
}

// "Mon 23 Nov"
export function formatDayHeading(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

// "10:15" in hospital time
export function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { timeZone, hour: '2-digit', minute: '2-digit' })
}

// "21 Nov 2026, 13:15:42" in hospital time, for the audit log where seconds matter.
export function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { timeZone, dateStyle: 'medium', timeStyle: 'medium' })
}
