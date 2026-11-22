import type { ReactNode } from 'react'
import { formatMoney } from '../../utils/format'

// A plain value in a report table cell.
export type CellValue = string | number | boolean | null | undefined

// One table definition per report table: its columns and how each cell is shown.
export type Column<T> = {
  header: string
  // The plain value, shown when there is no "show".
  value: (row: T) => CellValue
  // Optional richer display, such as a link or a badge.
  show?: (row: T) => ReactNode
  // Money columns are shown as "LKR 1,500.00".
  money?: boolean
  numeric?: boolean
}

export function ReportTable<T>({
  title,
  columns,
  rows,
  rowKey,
  footer,
  empty = 'Nothing in this period.',
}: {
  title: string
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string | number
  footer?: CellValue[] // one value per column, e.g. ['Total', 12, 3400]
  empty?: string
}) {
  const display = (column: Column<T>, value: CellValue) =>
    column.money && typeof value === 'number' ? formatMoney(value) : value
  const align = (column: Column<T>) => (column.money || column.numeric ? 'text-right' : '')

  return (
    <section className="rounded-2xl bg-white shadow-card ring-1 ring-slate-200/70 print:break-inside-avoid-page print:shadow-none print:ring-0">
      <div className="border-b border-slate-200 px-4 py-3 print:px-0">
        <h2 className="font-semibold text-slate-900">{title}</h2>
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
