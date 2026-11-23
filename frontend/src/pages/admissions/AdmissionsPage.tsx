import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { listAdmissions, listWards } from '../../api/admissions'
import { ApiError } from '../../api/client'
import { Permissions } from '../../auth/permissions'
import { hasAnyRole } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { inputClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui/FormField'
import { Pagination } from '../../components/ui/Pagination'
import type { AdmissionSummary, Ward } from '../../types/admission'
import type { PagedResult } from '../../types/paged'
import { addDays, formatDateTime, formatMoney, todayInHospital } from '../../utils/format'
import { Tabs } from '../../components/ui/Tabs'

type Tab = 'beds' | 'current' | 'discharged'

const tabLabels: Record<Tab, string> = {
  beds: 'Bed board',
  current: 'Current inpatients',
  discharged: 'Discharged',
}

// Inpatient management (assumption A1): the bed board, who is admitted now, and recent discharges.
export default function AdmissionsPage() {
  const { user } = useAuth()
  const canAdmit = hasAnyRole(user?.roles, Permissions.admitPatients)
  const canManageWards = hasAnyRole(user?.roles, Permissions.manageWards)

  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab | null) ?? 'beds'
  // The page number is in the address bar too (?tab=current&page=2), so Back and Refresh keep it.
  const page = params.get('page') ?? '1'
  const [toDate, setToDate] = useState(() => todayInHospital())

  const [wards, setWards] = useState<Ward[] | null>(null)
  const [admissions, setAdmissions] = useState<PagedResult<AdmissionSummary> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    const request =
      tab === 'beds'
        ? listWards().then((data) => !ignore && setWards(data))
        : listAdmissions({
            ...(tab === 'current' ? {} : { status: 'Discharged', fromDate: addDays(toDate, -6), toDate }),
            page,
          }).then((data) => !ignore && setAdmissions(data))
    request.catch((err: unknown) => !ignore && setError(err instanceof ApiError ? err.message : 'Could not load.'))
    return () => {
      ignore = true
    }
  }, [tab, toDate, page])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[1.75rem] leading-tight font-medium text-slate-900">Admissions</h1>
        <div className="flex gap-2">
          {canManageWards && (
            <Link to="/admissions/wards" className={secondaryButtonClass}>
              Manage wards
            </Link>
          )}
          {canAdmit && (
            <Link to="/admissions/new" className={primaryButtonClass}>
              Admit patient
            </Link>
          )}
        </div>
      </div>

      <Tabs
        label="Admissions views"
        tabs={Object.keys(tabLabels) as Tab[]}
        labels={tabLabels}
        value={tab}
        onChange={(t) => {
          setAdmissions(null)
          setParams({ tab: t })
        }}
      />

      {error && (
        <p className="border-l-2 border-red-700 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}

      {tab === 'beds' && (
        <div className="space-y-4">
          {wards && wards.length === 0 && (
            <p className="text-sm text-slate-600">
              No wards yet.{canManageWards && ' Add wards and beds under Manage wards.'}
            </p>
          )}
          {wards?.map((w) => (
            <section key={w.id} className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200/70" aria-label={w.name}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold text-slate-900">
                  {w.name} <span className="text-sm font-normal text-slate-500">({w.wardType})</span>
                </h2>
                <p className="text-sm text-slate-600">
                  {w.freeBeds} of {w.totalBeds} beds free &middot; {formatMoney(w.dailyCharge)} per day
                </p>
              </div>
              <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {w.beds.filter((b) => b.isActive).map((b) => (
                  <li key={b.id}>
                    {b.admissionId ? (
                      <Link
                        to={`/admissions/${b.admissionId}`}
                        className="block rounded-lg border border-amber-300 bg-amber-50 p-2 text-sm hover:bg-amber-100"
                      >
                        <span className="font-semibold text-slate-900">{b.bedNumber}</span>
                        <span className="block truncate text-slate-700">{b.patientName}</span>
                        <span className="text-xs text-amber-800">Occupied</span>
                      </Link>
                    ) : canAdmit ? (
                      <Link
                        to={`/admissions/new?bedId=${b.id}`}
                        className="block rounded-lg border border-green-300 bg-green-50 p-2 text-sm hover:bg-green-100"
                      >
                        <span className="font-semibold text-slate-900">{b.bedNumber}</span>
                        <span className="block text-slate-500">&nbsp;</span>
                        <span className="text-xs text-green-800">Free: admit here</span>
                      </Link>
                    ) : (
                      <div className="rounded-lg border border-green-300 bg-green-50 p-2 text-sm">
                        <span className="font-semibold text-slate-900">{b.bedNumber}</span>
                        <span className="block text-slate-500">&nbsp;</span>
                        <span className="text-xs text-green-800">Free</span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {tab !== 'beds' && (
        <>
          {tab === 'discharged' && (
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <label htmlFor="discharged-to">Discharged in the 7 days up to</label>
              <input
                id="discharged-to"
                type="date"
                value={toDate}
                onChange={(e) => {
                  if (!e.target.value) return
                  setToDate(e.target.value)
                  setParams({ tab }) // a new date range starts on page 1
                }}
                className={`${inputClass} w-auto`}
              />
            </div>
          )}
          <div className="overflow-x-auto rounded-2xl bg-white shadow-card ring-1 ring-slate-200/70">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/60 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Admission</th>
                  <th scope="col" className="px-4 py-3 font-medium">Patient</th>
                  <th scope="col" className="px-4 py-3 font-medium">Ward and bed</th>
                  <th scope="col" className="px-4 py-3 font-medium">Doctor</th>
                  <th scope="col" className="px-4 py-3 font-medium">Admitted</th>
                  {tab === 'discharged' && <th scope="col" className="px-4 py-3 font-medium">Discharged</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {admissions?.items.map((a) => (
                  <tr key={a.id} className="hover:bg-brand-50/40">
                    <td className="px-4 py-3">
                      <Link to={`/admissions/${a.id}`} className="font-mono font-medium text-brand-700 hover:underline">
                        {a.admissionNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {a.patientName}
                      <span className="block text-xs text-slate-500">{a.patientNumber}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {a.wardName}, {a.bedNumber}
                    </td>
                    <td className="px-4 py-3 text-slate-700">Dr {a.doctorName}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDateTime(a.admittedAt)}</td>
                    {tab === 'discharged' && (
                      <td className="px-4 py-3 text-slate-700">{a.dischargedAt && formatDateTime(a.dischargedAt)}</td>
                    )}
                  </tr>
                ))}
                {admissions && admissions.items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                      {tab === 'current' ? 'No patients are admitted right now.' : 'No discharges in these 7 days.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {admissions && (
            <Pagination
              totalCount={admissions.totalCount}
              page={admissions.page}
              pageSize={admissions.pageSize}
              noun="admission"
              onPageChange={(p) => setParams({ tab, page: String(p) })}
            />
          )}
        </>
      )}
    </div>
  )
}
