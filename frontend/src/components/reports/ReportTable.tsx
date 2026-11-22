import type { ReactNode } from 'react'
import { downloadCsv, type CsvValue } from '../../utils/csv'
import { formatMoney } from '../../utils/format'

// One table definition drives both the table on screen and its CSV file, so the two always match.
export type Column<T> = {
  header: string
  // The plain value: written to the CSV file, and shown when there is no "show".
  value: (row: T) => CsvValue
  // Optional richer display, such as a link or a badge.
  show?: (row: T) => ReactNode
  // Money columns are shown as "LKR 1,500.00" and written to CSV as plain numbers.
  money?: boolean
  numeric?: boolean
}

export function ReportTable<T>({
  title,
  csvName,
  columns,
  rows,
  rowKey,
  footer,
  empty = 'Nothing in this period.',
}: {
  title: string
  csvName: string // file name without ".csv"
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string | number
  footer?: CsvValue[] // one value per column, e.g. ['Total', 12, 3400]
  empty?: string
}) {
  const display = (column: Column<T>, value: CsvValue) =>
    column.money && typeof value === 'number' ? formatMoney(value) : value
  const align = (column: Column<T>) => (column.money || column.numeric ? 'text-right' : '')

  const exportCsv = () => {
    const header = columns.map((c) => c.header)
    const body = rows.map((row) => columns.map((c) => c.value(row)))
    downloadCsv(`${csvName}.csv`, footer ? [header, ...body, footer] : [header, ...body])
  }

  return (
    <section className="rounded-2xl bg-white shadow-card ring-1 ring-slate-200/70 print:break-inside-avoid-page print:shadow-none print:ring-0">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 print:px-0">
        <h2 className="font-semibold text-slate-900">{title}</h2>
        <button
          type="button"
          onClick={exportCsv}
          disabled={rows.length === 0}
          className="text-sm font-medium text-brand-700 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline print:hidden"
        >
          Download CSV
        </button>
      </div>
      <div className="overflow-x-auto print:overflow-visible">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/60 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500 print:bg-white">
            <tr>
              {columns.map((c) => (
                <th key={c.header} scope="col" className={`px-4 py-2 font-medium print:px-2 ${align(c)}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((c) => (
                  <td key={c.header} className={`px-4 py-2 text-slate-700 print:px-2 ${align(c)}`}>
                    {c.show ? c.show(row) : display(c, c.value(row))}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6 text-center text-slate-500">
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
          {footer && rows.length > 0 && (
            <tfoot className="border-t-2 border-slate-300 font-semibold text-slate-900">
              <tr>
                {columns.map((c, i) => (
                  <td key={c.header} className={`px-4 py-2 print:px-2 ${align(c)}`}>
                    {display(c, footer[i])}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  )
}
