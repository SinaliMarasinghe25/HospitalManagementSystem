import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { addBeds, listWards, saveWard, setBedActive } from '../../api/admissions'
import { ApiError } from '../../api/client'
import { FormField, inputClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui/FormField'
import type { Ward } from '../../types/admission'
import { errorsByField } from '../../utils/formErrors'
import { formatMoney } from '../../utils/format'

type WardForm = { name: string; wardType: string; dailyCharge: string }
const emptyForm: WardForm = { name: '', wardType: 'General', dailyCharge: '' }

// Administrator: add and edit wards, add beds, and take beds out of use.
export default function WardsPage() {
  const [wards, setWards] = useState<Ward[] | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<WardForm>(emptyForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    listWards().then(setWards).catch(() => setMessage('Could not load wards.'))
  }, [reloadKey])

  const reload = () => setReloadKey((k) => k + 1)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErrors({})
    setMessage(null)
    try {
      await saveWard(editingId, { name: form.name.trim(), wardType: form.wardType.trim(), dailyCharge: Number(form.dailyCharge || 0) })
      setEditingId(null)
      setForm(emptyForm)
      reload()
    } catch (err) {
      if (err instanceof ApiError) setErrors(errorsByField(err.fieldErrors))
      else setMessage('Could not save the ward.')
    }
  }

  async function run(action: () => Promise<void>) {
    setMessage(null)
    try {
      await action()
      reload()
    } catch (err) {
      setMessage(err instanceof ApiError ? (Object.values(err.fieldErrors)[0]?.[0] ?? err.message) : 'Could not save.')
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <Link to="/admissions" className="text-sm text-blue-700 hover:underline">
          &larr; Admissions
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">Wards and beds</h1>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-3 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="font-semibold text-slate-900">{editingId ? 'Edit ward' : 'Add ward'}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <FormField id="wardName" label="Name" required error={errors.name}>
            <input id="wardName" maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
          </FormField>
          <FormField id="wardType" label="Type" required error={errors.wardType}>
            <input
              id="wardType"
              list="ward-types"
              maxLength={50}
              value={form.wardType}
              onChange={(e) => setForm({ ...form, wardType: e.target.value })}
              className={inputClass}
            />
            <datalist id="ward-types">
              <option value="General" />
              <option value="ICU" />
              <option value="Maternity" />
              <option value="Paediatric" />
              <option value="Surgical" />
            </datalist>
          </FormField>
          <FormField id="dailyCharge" label="Bed charge per day (LKR)" required error={errors.dailyCharge}>
            <input
              id="dailyCharge"
              type="number"
              min={0}
              step="0.01"
              value={form.dailyCharge}
              onChange={(e) => setForm({ ...form, dailyCharge: e.target.value })}
              className={inputClass}
            />
          </FormField>
        </div>
        <div className="flex gap-2">
          <button type="submit" className={primaryButtonClass}>
            {editingId ? 'Save ward' : 'Add ward'}
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

      {message && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          {message}
        </p>
      )}

      {wards?.map((w) => (
        <WardCard
          key={w.id}
          ward={w}
          onEdit={() => {
            setEditingId(w.id)
            setForm({ name: w.name, wardType: w.wardType, dailyCharge: String(w.dailyCharge) })
            window.scrollTo({ top: 0 })
          }}
          onAddBeds={(prefix, count) => run(() => addBeds(w.id, prefix, count))}
          onToggleBed={(bedId, active) => run(() => setBedActive(bedId, active))}
        />
      ))}
    </div>
  )
}

function WardCard({
  ward,
  onEdit,
  onAddBeds,
  onToggleBed,
}: {
  ward: Ward
  onEdit: () => void
  onAddBeds: (prefix: string, count: number) => void
  onToggleBed: (bedId: number, active: boolean) => void
}) {
  const [prefix, setPrefix] = useState(() => `${ward.name.charAt(0).toUpperCase()}-`)
  const [count, setCount] = useState('4')

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200" aria-label={ward.name}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-slate-900">
          {ward.name} <span className="text-sm font-normal text-slate-500">({ward.wardType}, {formatMoney(ward.dailyCharge)} per day)</span>
        </h2>
        <button type="button" onClick={onEdit} className="text-sm text-blue-700 hover:underline">
          Edit<span className="sr-only"> {ward.name}</span>
        </button>
      </div>

      <ul className="mt-3 flex flex-wrap gap-2">
        {ward.beds.map((b) => (
          <li key={b.id} className={`rounded-md border px-2 py-1 text-sm ${b.isActive ? 'border-slate-300' : 'border-dashed border-slate-300 text-slate-400'}`}>
            {b.bedNumber}
            {b.admissionId ? (
              <span className="ml-2 text-xs text-amber-800">occupied</span>
            ) : (
              <button type="button" onClick={() => onToggleBed(b.id, !b.isActive)} className="ml-2 text-xs text-blue-700 hover:underline">
                {b.isActive ? 'Take out of use' : 'Put back in use'}
                <span className="sr-only"> bed {b.bedNumber}</span>
              </button>
            )}
          </li>
        ))}
        {ward.beds.length === 0 && <li className="text-sm text-slate-500">No beds yet.</li>}
      </ul>

      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          onAddBeds(prefix, Number(count))
        }}
      >
        <div>
          <label htmlFor={`prefix-${ward.id}`} className="block text-xs font-medium text-slate-600">
            Bed name prefix
          </label>
          <input id={`prefix-${ward.id}`} maxLength={10} value={prefix} onChange={(e) => setPrefix(e.target.value)} className={`${inputClass} w-28`} />
        </div>
        <div>
          <label htmlFor={`count-${ward.id}`} className="block text-xs font-medium text-slate-600">
            How many
          </label>
          <input
            id={`count-${ward.id}`}
            type="number"
            min={1}
            max={50}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className={`${inputClass} w-24`}
          />
        </div>
        <button type="submit" className={secondaryButtonClass}>
          Add beds<span className="sr-only"> to {ward.name}</span>
        </button>
      </form>
    </section>
  )
}
