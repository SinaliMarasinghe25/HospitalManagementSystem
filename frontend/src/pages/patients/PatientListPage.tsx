import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ApiError } from '../../api/client'
import { searchPatients } from '../../api/patients'
import { Permissions } from '../../auth/permissions'
import { hasAnyRole } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { inputClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui/FormField'
import { Pagination } from '../../components/ui/Pagination'
import type { PagedResult } from '../../types/paged'
import type { PatientSummary } from '../../types/patient'
import { ageFrom } from '../../utils/format'

// PDF 3.2 "Search Patient" and section 7 Patient Screen.
export default function PatientListPage() {
  const { user } = useAuth()
  // The search words and page number live in the address bar (?search=...&page=2),
  // so Back, Refresh and sharing a link keep the same results.
  const [params, setParams] = useSearchParams()
  const search = params.get('search') ?? ''
  const page = Number(params.get('page') ?? '1')

  const [searchInput, setSearchInput] = useState(search)
  const [result, setResult] = useState<PagedResult<PatientSummary> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false // stops an old, slow response from overwriting a newer one
    searchPatients(search, page)
      .then((data) => !ignore && (setResult(data), setError(null)))
      .catch((err: unknown) => !ignore && setError(err instanceof ApiError ? err.message : 'Could not load patients.'))
    return () => {
      ignore = true
    }
  }, [search, page])

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setParams(searchInput.trim() ? { search: searchInput.trim() } : {})
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[1.75rem] leading-tight font-medium text-slate-900">Patients</h1>
        {hasAnyRole(user?.roles, Permissions.editPatients) && (
          <Link to="/patients/new" className={primaryButtonClass}>
            Add patient
          </Link>
        )}
      </div>

      <form onSubmit={handleSearch} className="flex gap-2" role="search">
        <label htmlFor="patient-search" className="sr-only">
          Search patients
        </label>
        <input
          id="patient-search"
          type="search"
          placeholder="Name, patient number, phone or NIC"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className={`${inputClass} max-w-md`}
        />
        <button type="submit" className={secondaryButtonClass}>
          Search
        </button>
      </form>

      {error && (
        <p className="border-l-2 border-red-700 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl bg-white shadow-card ring-1 ring-slate-200/70">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/60 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Patient no.</th>
              <th scope="col" className="px-4 py-3 font-medium">Name</th>
              <th scope="col" className="px-4 py-3 font-medium">Age / Gender</th>
              <th scope="col" className="px-4 py-3 font-medium">Phone</th>
              <th scope="col" className="px-4 py-3 font-medium">NIC</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {result?.items.map((p) => (
              <tr key={p.id} className="hover:bg-brand-50/40">
                <td className="px-4 py-3 font-mono text-slate-700">{p.patientNumber}</td>
                <td className="px-4 py-3">
                  <Link to={`/patients/${p.id}`} className="font-medium text-brand-700 hover:underline">
                    {p.firstName} {p.lastName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {ageFrom(p.dateOfBirth)} / {p.gender}
                </td>
                <td className="px-4 py-3 text-slate-700">{p.phone}</td>
                <td className="px-4 py-3 text-slate-700">{p.nationalId ?? '-'}</td>
              </tr>
            ))}
            {result && result.items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  No patients found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {result && (
        <Pagination
          totalCount={result.totalCount}
          page={page}
          pageSize={result.pageSize}
          noun="patient"
          onPageChange={(p) => setParams({ ...(search && { search }), page: String(p) })}
        />
      )}
    </div>
  )
}
