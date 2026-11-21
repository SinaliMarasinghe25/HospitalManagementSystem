// CSV export (assumption A7: reports are printable and exportable as CSV). Built in the browser from the data
// already on screen, so the file always matches what the user sees.

export type CsvValue = string | number | boolean | null | undefined

function cell(value: CsvValue) {
  if (value === null || value === undefined) return ''
  let text = String(value)
  // A cell that starts with = + - @ could run as a formula in Excel ("CSV injection"), so it is made plain text.
  // Numbers are safe: -12.5 stays a number.
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function toCsv(rows: CsvValue[][]) {
  return rows.map((row) => row.map(cell).join(',')).join('\r\n')
}

export function downloadCsv(fileName: string, rows: CsvValue[][]) {
  // The byte order mark makes Excel read the file as UTF-8.
  const blob = new Blob(['﻿', toCsv(rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}
