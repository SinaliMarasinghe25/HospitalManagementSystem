import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ApiError } from '../../api/client'
import { listLabTests, saveLabTest } from '../../api/lab'
import { FormField, inputClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui/FormField'
import type { LabTest } from '../../types/lab'
import { errorsByField } from '../../utils/formErrors'
import { formatMoney } from '../../utils/format'

type TestForm = { code: string; name: string; price: string; unit: string; referenceRange: string; isActive: boolean }
const emptyForm: TestForm = { code: '', name: '', price: '', unit: '', referenceRange: '', isActive: true }

// Administrator: the lab test catalogue and prices (assumption A9). A test is never deleted, only made inactive,
// because old requests still point to it.
export default function LabTestsPage() {
  const [tests, setTests] = useState<LabTest[] | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<TestForm>(emptyForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    listLabTests(true).then(setTests).catch(() => setTests([]))
  }, [reloadKey])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErrors({})
    try {
      await saveLabTest(editingId, { ...form, price: Number(form.price || 0) })
      setEditingId(null)
      setForm(emptyForm)
      setReloadKey((k) => k + 1)
    } catch (err) {
      if (err instanceof ApiError) setErrors(errorsByField(err.fieldErrors))
    }
  }

  const field = (key: keyof TestForm) => ({
    value: String(form[key]),
    onChange: (e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value }),
  })

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <Link to="/laboratory" className="text-sm text-blue-700 hover:underline">
          &larr; Laboratory
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">Test catalogue and prices</h1>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-3 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="font-semibold text-slate-900">{editingId ? 'Edit test' : 'Add test'}</h2>
        <div className="grid gap-3 sm:grid-cols-5">
          <FormField id="code" label="Code" required error={errors.code}>
            <input id="code" maxLength={20} {...field('code')} className={`${inputClass} font-mono`} />
          </FormField>
          <div className="sm:col-span-2">
            <FormField id="name" label="Name" required error={errors.name}>
              <input id="name" maxLength={150} {...field('name')} className={inputClass} />
            </FormField>
          </div>
          <FormField id="price" label="Price (LKR)" required error={errors.price}>
            <input id="price" type="number" min={0} step="0.01" {...field('price')} className={inputClass} />
          </FormField>
          <FormField id="unit" label="Unit" error={errors.unit}>
            <input id="unit" maxLength={30} {...field('unit')} className={inputClass} />
          </FormField>
          <div className="sm:col-span-2">
            <FormField id="referenceRange" label="Reference range" error={errors.referenceRange}>
              <input id="referenceRange" maxLength={100} {...field('referenceRange')} className={inputClass} />
            </FormField>
          </div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            Can be requested
          </label>
        </div>
        <div className="flex gap-2">
          <button type="submit" className={primaryButtonClass}>
            {editingId ? 'Save test' : 'Add test'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null)
                setForm(emptyForm)
              }}
              className={secondaryButtonClass}
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Code</th>
              <th scope="col" className="px-4 py-3 font-medium">Name</th>
              <th scope="col" className="px-4 py-3 font-medium">Price</th>
              <th scope="col" className="px-4 py-3 font-medium">Unit</th>
              <th scope="col" className="px-4 py-3 font-medium">Reference range</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
              <th scope="col" className="px-4 py-3"><span className="sr-only">Edit</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tests?.map((t) => (
              <tr key={t.id} className={t.isActive ? '' : 'text-slate-400'}>
                <td className="px-4 py-2 font-mono">{t.code}</td>
                <td className="px-4 py-2">{t.name}</td>
                <td className="px-4 py-2">{formatMoney(t.price)}</td>
                <td className="px-4 py-2">{t.unit ?? '-'}</td>
                <td className="px-4 py-2">{t.referenceRange ?? '-'}</td>
                <td className="px-4 py-2">{t.isActive ? 'Active' : 'Inactive'}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(t.id)
                      setForm({
                        code: t.code,
                        name: t.name,
                        price: String(t.price),
                        unit: t.unit ?? '',
                        referenceRange: t.referenceRange ?? '',
                        isActive: t.isActive,
                      })
                      window.scrollTo({ top: 0 })
                    }}
                    className="text-blue-700 hover:underline"
                  >
                    Edit<span className="sr-only"> {t.name}</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
