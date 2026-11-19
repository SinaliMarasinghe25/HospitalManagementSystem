import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ApiError } from '../../api/client'
import { listDepartments, listDoctors } from '../../api/doctors'
import { Permissions } from '../../auth/permissions'
import { hasAnyRole } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { inputClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui/FormField'
import type { Department, DoctorSummary } from '../../types/doctor'
import { formatMoney } from '../../utils/format'

// PDF 3.3 Doctor Management: list of doctors, filtered by department.
export default function DoctorListPage() {
  const { user } = useAuth()
  const canManage = hasAnyRole(user?.roles, Permissions.manageDoctors)
  const [params, setParams] = useSearchParams()
  const departmentId = params.get('departmentId') ?? ''
  const search = params.get('search') ?? ''

  const [departments, setDepartments] = useState<Department[]>([])
  const [doctors, setDoctors] = useState<DoctorSummary[] | null>(null)
  const [searchInput, setSearchInput] = useState(search)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listDepartments().then(setDepartments).catch(() => setError('Could not load departments.'))
  }, [])

  useEffect(() => {
    let ignore = false
    // Admins also see inactive doctors, so they can re-activate them.
    listDoctors(departmentId, search, canManage)
      .then((data) => !ignore && setDoctors(data))
      .catch((err: unknown) => !ignore && setError(err instanceof ApiError ? err.message : 'Could not load doctors.'))
    return () => {
      ignore = true
    }
  }, [departmentId, search, canManage])

  function update(next: { departmentId?: string; search?: string }) {
    const merged = { departmentId, search, ...next }
    setParams(Object.fromEntries(Object.entries(merged).filter(([, v]) => v)))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Doctors</h1>
        {canManage && (
          <div className="flex gap-2">
            <Link to="/doctors/departments" className={secondaryButtonClass}>
              Departments
            </Link>
            <Link to="/doctors/new" className={primaryButtonClass}>
              Add doctor
            </Link>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <label htmlFor="department-filter" className="sr-only">
          Department
        </label>
        <select
          id="department-filter"
          value={departmentId}
          onChange={(e) => update({ departmentId: e.target.value })}
          className={`${inputClass} max-w-xs`}
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <form
          role="search"
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            update({ search: searchInput.trim() })
          }}
        >
          <label htmlFor="doctor-search" className="sr-only">
            Search doctors
          </label>
          <input
            id="doctor-search"
            type="search"
            placeholder="Name or specialisation"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className={inputClass}
          />
          <button type="submit" className={secondaryButtonClass}>
            Search
          </button>
        </form>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Name</th>
              <th scope="col" className="px-4 py-3 font-medium">Specialisation</th>
              <th scope="col" className="px-4 py-3 font-medium">Department</th>
              <th scope="col" className="px-4 py-3 font-medium">Consultation fee</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {doctors?.map((d) => (
              <tr key={d.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link to={`/doctors/${d.id}`} className="font-medium text-blue-700 hover:underline">
                    Dr {d.fullName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-700">{d.specialization}</td>
                <td className="px-4 py-3 text-slate-700">{d.departmentName}</td>
                <td className="px-4 py-3 text-slate-700">{formatMoney(d.consultationFee)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      d.isActive ? 'bg-green-50 text-green-800' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {d.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
            {doctors && doctors.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  No doctors found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
