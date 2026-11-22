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
    <div role="tablist" aria-label={label} className="scroll-slim flex gap-6 overflow-x-auto border-b border-slate-200">
      {tabs.map((t) => (
        <button
          key={t}
          type="button"
          role="tab"
          aria-selected={value === t}
          onClick={() => onChange(t)}
          className={`-mb-px shrink-0 border-b-2 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
            value === t
              ? 'border-brand-700 text-slate-900'
              : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-900'
          }`}
        >
          {labels[t]}
        </button>
      ))}
    </div>
  )
}
