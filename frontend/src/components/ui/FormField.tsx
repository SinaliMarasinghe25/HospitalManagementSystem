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
      <div className="mt-1">{children}</div>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}

export const inputClass =
  'block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/30 focus:outline-none aria-[invalid=true]:border-red-500'

export const primaryButtonClass =
  'rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus:ring-2 focus:ring-blue-600/40 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60'

export const secondaryButtonClass =
  'rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50'
