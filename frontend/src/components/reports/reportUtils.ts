import type { PeriodFilter } from '../../api/reports'
import { addDays, formatDate, todayInHospital } from '../../utils/format'

// Report periods: hospital days "YYYY-MM-DD", both inclusive.

function firstOfMonth(isoDate: string) {
  return `${isoDate.slice(0, 8)}01`
}

// Without a choice, a report covers this month so far (the same default as the API).
export function thisMonth(): PeriodFilter {
  const today = todayInHospital()
  return { fromDate: firstOfMonth(today), toDate: today }
}

export const periodPresets: { label: string; period: () => PeriodFilter }[] = [
  { label: 'This month', period: thisMonth },
  {
    label: 'Last month',
    period: () => {
      const lastDay = addDays(firstOfMonth(todayInHospital()), -1)
      return { fromDate: firstOfMonth(lastDay), toDate: lastDay }
    },
  },
  { label: 'Last 30 days', period: () => ({ fromDate: addDays(todayInHospital(), -29), toDate: todayInHospital() }) },
  { label: 'This year', period: () => ({ fromDate: `${todayInHospital().slice(0, 4)}-01-01`, toDate: todayInHospital() }) },
]

export function periodText(from: string, to: string) {
  return from === to ? formatDate(from) : `${formatDate(from)} to ${formatDate(to)}`
}

// Adds up one number from every row, for table footers.
export function sumBy<T>(rows: T[], pick: (row: T) => number) {
  return rows.reduce((total, row) => total + pick(row), 0)
}
