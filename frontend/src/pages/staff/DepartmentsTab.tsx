import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { listDepartments, saveDepartment } from '../../api/doctors'
import { FormField, inputClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui/FormField'
import type { Department } from '../../types/doctor'
import { firstError } from '../../utils/formErrors'

type Draft = { id: number | null; name: string; description: string; isActive: boolean; isClinical: boolean; isDefault: boolean }
const newDraft: Draft = { id: null, name: '', description: '', isActive: true, isClinical: true, isDefault: false }

// PDF section 6: Departments, kept on the Staff page only.
// Assumption A26 (proposed): clinical staff (doctors, nurses, laboratory staff, pharmacists...) choose a clinical
// department; everyone else is placed in "Administration" automatically, which cannot be renamed or deactivated.
// Departments are deactivated, never deleted, because employees and history point to them.
export default function DepartmentsTab() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [draft, setDraft] = useState<Draft>(newDraft)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const load = useCallback(() => {
    listDepartments(true).then(setDepartments).catch(() => setError('Could not load departments.'))
  }, [])
  useEffect(load, [load])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    try {
      await saveDepartment(draft.id, {
        name: draft.name,
        description: draft.description,
        isActive: draft.isActive,
        isClinical: draft.isClinical,
      })
      setDraft(newDraft)
      load()
    } catch (err) {
      setError(firstError(err, 'Could not save.'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-4">

      <form onSubmit={handleSubmit} className="grid gap-3 rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200/70 sm:grid-cols-2">
        <h2 className="font-medium text-slate-900 sm:col-span-2">{draft.id === null ? 'Add department' : 'Edit department'}</h2>
        {error && <p className="border-l-2 border-red-700 bg-red-50 p-3 text-sm text-red-800 sm:col-span-2" role="alert">{error}</p>}
        <FormField id="dept-name" label="Name" required>
          <input id="dept-name" value={draft.name} required maxLength={100} className={inputClass} disabled={draft.isDefault}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </FormField>
        <FormField id="dept-description" label="Description">
          <input id="dept-description" value={draft.description} maxLength={500} className={inputClass}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        </FormField>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={draft.isClinical} disabled={draft.isDefault}
            onChange={(e) => setDraft({ ...draft, isClinical: e.target.checked })} />
          Clinical department
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={draft.isActive} disabled={draft.isDefault}
            onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />
          Active
        </label>
        <div className="flex gap-2 sm:col-span-2">
          <button type="submit" className={primaryButtonClass} disabled={isSaving}>
            {draft.id === null ? 'Add department' : 'Save changes'}
          </button>
          {draft.id !== null && (
            <button type="button" className={secondaryButtonClass} onClick={() => setDraft(newDraft)}>Cancel</button>
          )}
        </div>
      </form>

      <div className="overflow-x-auto rounded-2xl bg-white shadow-card ring-1 ring-slate-200/70">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/60 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Name</th>
              <th scope="col" className="px-4 py-3 font-medium">Type</th>
              <th scope="col" className="px-4 py-3 font-medium">Staff</th>
              <th scope="col" className="px-4 py-3 font-medium">Doctors</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
              <th scope="col" className="px-4 py-3 font-medium"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {departments.map((d) => (
              <tr key={d.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{d.name}</p>
                  {d.description && <p className="text-slate-500">{d.description}</p>}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {d.isDefault ? 'Non-clinical (default)' : d.isClinical ? 'Clinical' : 'Non-clinical'}
                </td>
                <td className="px-4 py-3 text-slate-700">{d.staffCount}</td>
                <td className="px-4 py-3 text-slate-700">{d.doctorCount}</td>
                <td className="px-4 py-3 text-slate-700">{d.isActive ? 'Active' : 'Inactive'}</td>
                <td className="px-4 py-3 text-right">
                  <button type="button" className="text-brand-700 hover:underline"
                    onClick={() => setDraft({ id: d.id, name: d.name, description: d.description ?? '', isActive: d.isActive,
                      isClinical: d.isClinical, isDefault: d.isDefault })}>
                    Edit<span className="sr-only"> {d.name}</span>
                  </button>
                </td>
              </tr>
            ))}
            {departments.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  No departments found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
