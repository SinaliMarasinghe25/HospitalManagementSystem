import { secondaryButtonClass } from './FormField'

// "123 entries, page 2 of 3" with Previous and Next, under a paged list.
// Shown only when there is something to page through.
export function Pagination({
  totalCount,
  page,
  pageSize,
  noun,
  nounPlural = `${noun}s`,
  onPageChange,
}: {
  totalCount: number
  page: number
  pageSize: number
  // What one row is, e.g. "patient". The plural adds an "s" unless it is given ("entry", "entries").
  noun: string
  nounPlural?: string
  onPageChange: (page: number) => void
}) {
  if (totalCount === 0) return null
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500 print:hidden"
      aria-label="Pagination"
    >
      <span>
        {totalCount.toLocaleString()} {totalCount === 1 ? noun : nounPlural}, page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          className={secondaryButtonClass}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        <button
          type="button"
          className={secondaryButtonClass}
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  )
}
