// The row of tabs used on the Staff, Laboratory, Billing, Pharmacy and Admissions pages.
// The page keeps the chosen tab in the address (?tab=...), so the back button and links work.
export function Tabs<T extends string>({
  label,
  tabs,
  labels,
  value,
  onChange,
}: {
  label: string
  tabs: readonly T[]
  labels: Record<T, string>
  value: T
  onChange: (tab: T) => void
}) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-1 border-b border-slate-200">
      {tabs.map((t) => (
        <button
          key={t}
          type="button"
          role="tab"
          aria-selected={value === t}
          onClick={() => onChange(t)}
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
            value === t ? 'border-blue-700 text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          {labels[t]}
        </button>
      ))}
    </div>
  )
}
