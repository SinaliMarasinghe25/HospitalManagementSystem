import type { ReactNode } from 'react'

// Label + input + error message, the same way on every form.
// htmlFor/id link the label to the input, and aria-describedby links the error,
// so screen readers read them together.
export function FormField({
  id,
  label,
  required,
  error,
  children,
}: {
  id: string
  label: string
  required?: boolean
  error?: string
  children: ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </label>
      <div className="mt-1.5">{children}</div>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}

const inputBase =
  'block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-600 focus:ring-3 focus:ring-brand-600/12 focus:outline-none aria-[invalid=true]:border-red-600 aria-[invalid=true]:focus:ring-red-600/12'

export const inputClass = `${inputBase} w-full`

// The same look without "w-full", for inputs that set their own width (w-32, w-auto) in toolbars and tables.
// With both classes on one element, Tailwind's CSS order decides and w-full can win.
export const compactInputClass = inputBase

export const primaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-800 active:bg-brand-900 focus:outline-none focus-visible:ring-3 focus-visible:ring-brand-600/30 disabled:cursor-not-allowed disabled:opacity-60'

export const secondaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition-colors hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus-visible:ring-3 focus-visible:ring-brand-600/25 disabled:cursor-not-allowed disabled:opacity-50'
