import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ApiError } from '../../api/client'
import { listDepartments, saveDepartment } from '../../api/doctors'
import { FormField, inputClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui/FormField'
import type { Department } from '../../types/doctor'

type Draft = { id: number | null; name: string; description: string; isActive: boolean }
const newDraft: Draft = { id: null, name: '', description: '', isActive: true }

// PDF section 6: Departments. Admin adds, renames and deactivates departments.
// Departments are deactivated, never deleted, because doctors and history point to them.
export default function DepartmentsPage() {
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
      await saveDepartment(draft.id, draft)
      setDraft(newDraft)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? (Object.values(err.fieldErrors)[0]?.[0] ?? err.message) : 'Could not save.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <Link to="/doctors" className="text-sm text-blue-700 hover:underline">
        &larr; Doctors
      </Link>
      <h1 className="text-xl font-semibold text-slate-900">Departments</h1>

      <form onSubmit={handleSubmit} className="grid gap-3 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:grid-cols-2">
        <h2 className="font-medium text-slate-900 sm:col-span-2">{draft.id === null ? 'Add department' : 'Edit department'}</h2>
        {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 sm:col-span-2" role="alert">{error}</p>}
        <FormField id="dept-name" label="Name" required>
          <input id="dept-name" value={draft.name} required maxLength={100} className={inputClass}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </FormField>
        <FormField id="dept-description" label="Description">
          <input id="dept-description" value={draft.description} maxLength={500} className={inputClass}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        </FormField>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />
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

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Name</th>
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
                <td className="px-4 py-3 text-slate-700">{d.doctorCount}</td>
                <td className="px-4 py-3 text-slate-700">{d.isActive ? 'Active' : 'Inactive'}</td>
                <td className="px-4 py-3 text-right">
                  <button type="button" className="text-blue-700 hover:underline"
                    onClick={() => setDraft({ id: d.id, name: d.name, description: d.description ?? '', isActive: d.isActive })}>
                    Edit
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
