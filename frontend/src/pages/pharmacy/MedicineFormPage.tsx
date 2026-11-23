import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError } from '../../api/client'
import { getMedicine, saveMedicine } from '../../api/pharmacy'
import { FormField, inputClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui/FormField'
import { errorsByField } from '../../utils/formErrors'

type Form = {
  name: string
  genericName: string
  form: string
  strength: string
  unitPrice: string
  reorderLevel: string
  isActive: boolean
}

const empty: Form = { name: '', genericName: '', form: 'Tablet', strength: '', unitPrice: '', reorderLevel: '', isActive: true }

// Suggestions only: the pharmacist can type any form.
const commonForms = ['Tablet', 'Capsule', 'Syrup', 'Suspension', 'Injection', 'Inhaler', 'Cream', 'Drops', 'Sachet']

// Pharmacist: add or edit a medicine in the catalogue (FR-PH-01). A medicine is never deleted, only made
// inactive, because old prescriptions and stock history still point to it.
export default function MedicineFormPage() {
  const { id } = useParams()
  const editingId = id ? Number(id) : null
  const navigate = useNavigate()

  const [form, setForm] = useState<Form>(empty)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editingId === null) return
    getMedicine(editingId)
      .then(({ medicine: m }) =>
        setForm({
          name: m.name,
          genericName: m.genericName ?? '',
          form: m.form,
          strength: m.strength,
          unitPrice: String(m.unitPrice),
          reorderLevel: String(m.reorderLevel),
          isActive: m.isActive,
        }),
      )
      .catch(() => setFormError('Could not load the medicine.'))
  }, [editingId])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErrors({})
    setFormError(null)
    setSaving(true)
    try {
      const saved = await saveMedicine(editingId, {
        name: form.name.trim(),
        genericName: form.genericName.trim() || null,
        form: form.form.trim(),
        strength: form.strength.trim(),
        unitPrice: Number(form.unitPrice || 0),
        reorderLevel: Number(form.reorderLevel || 0),
        isActive: form.isActive,
      })
      navigate(`/pharmacy/medicines/${editingId ?? saved?.id}`)
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(errorsByField(err.fieldErrors))
        setFormError(Object.keys(err.fieldErrors).length ? null : err.message)
      } else {
        setFormError('Could not save the medicine.')
      }
    } finally {
      setSaving(false)
    }
  }

  const set = (key: keyof Form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value })

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link to={editingId ? `/pharmacy/medicines/${editingId}` : '/pharmacy?tab=stock'} className="text-sm text-brand-700 hover:underline">
          &larr; Back
        </Link>
        <h1 className="mt-1 text-[1.75rem] leading-tight font-medium text-slate-900">{editingId ? 'Edit medicine' : 'Add medicine'}</h1>
      </div>

      {formError && (
        <p className="border-l-2 border-red-700 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {formError}
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4 rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200/70">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="name" label="Name" required error={errors.name}>
            <input id="name" maxLength={150} value={form.name} onChange={set('name')} className={inputClass} />
          </FormField>
          <FormField id="genericName" label="Generic name" error={errors.genericName}>
            <input id="genericName" maxLength={150} value={form.genericName} onChange={set('genericName')} className={inputClass} />
          </FormField>
          <FormField id="form" label="Form" required error={errors.form}>
            <input id="form" list="medicine-forms" maxLength={50} value={form.form} onChange={set('form')} className={inputClass} />
            <datalist id="medicine-forms">
              {commonForms.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </FormField>
          <FormField id="strength" label="Strength" required error={errors.strength}>
            <input id="strength" maxLength={50} placeholder="500 mg" value={form.strength} onChange={set('strength')} className={inputClass} />
          </FormField>
          <FormField id="unitPrice" label="Price per unit (LKR)" required error={errors.unitPrice}>
            <input id="unitPrice" type="number" min={0} step="0.01" value={form.unitPrice} onChange={set('unitPrice')} className={inputClass} />
          </FormField>
          <FormField id="reorderLevel" label="Reorder level (units)" required error={errors.reorderLevel}>
            <input id="reorderLevel" type="number" min={0} value={form.reorderLevel} onChange={set('reorderLevel')} className={inputClass} />
          </FormField>
        </div>
        <p className="text-xs text-slate-500">A low-stock alert shows when usable stock falls below the reorder level.</p>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
          Active (available for prescribing)
        </label>
        <div className="flex gap-2">
          <button type="submit" disabled={saving} className={primaryButtonClass}>
            {saving ? 'Saving...' : 'Save medicine'}
          </button>
          <Link to={editingId ? `/pharmacy/medicines/${editingId}` : '/pharmacy?tab=stock'} className={secondaryButtonClass}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
