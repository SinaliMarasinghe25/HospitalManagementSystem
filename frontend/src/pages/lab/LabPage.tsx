import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ApiError } from '../../api/client'
import { listLabRequests } from '../../api/lab'
import { Permissions } from '../../auth/permissions'
import { hasAnyRole } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { LabStatusBadge, ResultText } from '../../components/lab/LabStatusBadge'
import { inputClass, secondaryButtonClass } from '../../components/ui/FormField'
import { Pagination } from '../../components/ui/Pagination'
import type { LabRequest } from '../../types/lab'
import type { PagedResult } from '../../types/paged'
import { addDays, formatDateTime, todayInHospital } from '../../utils/format'
import { Tabs } from '../../components/ui/Tabs'

type Tab = 'Requested' | 'SampleCollected' | 'recent'

const tabLabels: Record<Tab, string> = {
  Requested: 'Waiting for sample',
  SampleCollected: 'Sample collected',
  recent: 'All requests (7 days)',
}

// PDF 3.6 Laboratory Management: the lab's work queue.
// Lab staff work from the first two tabs; doctors and nurses use the last one to find results.
export default function LabPage() {
  const { user } = useAuth()
  const canManageTests = hasAnyRole(user?.roles, Permissions.manageLabTests)

  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab | null) ?? 'Requested'
  // The page number is in the address bar too (?tab=recent&page=2), so Back and Refresh keep it.
  const page = params.get('page') ?? '1'
  const [toDate, setToDate] = useState(() => todayInHospital())
  const [requests, setRequests] = useState<PagedResult<LabRequest> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    const filter = tab === 'recent' ? { fromDate: addDays(toDate, -6), toDate } : { status: tab }
    // The API sends the work queues oldest first, so the longest-waiting patient is at the top of page 1.
    listLabRequests({ ...filter, page })
      .then((data) => !ignore && (setRequests(data), setError(null)))
      .catch((err: unknown) => !ignore && setError(err instanceof ApiError ? err.message : 'Could not load lab requests.'))
    return () => {
      ignore = true
    }
  }, [tab, toDate, page])

  const rows = requests?.items

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Laboratory</h1>
        {canManageTests && (
          <Link to="/laboratory/tests" className={secondaryButtonClass}>
            Test catalogue and prices
          </Link>
        )}
      </div>

      <Tabs
        label="Lab request views"
        tabs={Object.keys(tabLabels) as Tab[]}
        labels={tabLabels}
        value={tab}
        onChange={(t) => {
          setRequests(null)
          setParams({ tab: t })
        }}
      />

      {tab === 'recent' && (
        <div className="flex items-center gap-2 text-sm text-slate-700">
          <label htmlFor="lab-to">Requested in the 7 days up to</label>
          <input
            id="lab-to"
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

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Request</th>
              <th scope="col" className="px-4 py-3 font-medium">Patient</th>
              <th scope="col" className="px-4 py-3 font-medium">Test</th>
              <th scope="col" className="px-4 py-3 font-medium">Requested</th>
              <th scope="col" className="px-4 py-3 font-medium">Sample</th>
              <th scope="col" className="px-4 py-3 font-medium">Result</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows?.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link to={`/laboratory/requests/${r.id}`} className="font-mono font-medium text-blue-700 hover:underline">
                    {r.requestNumber}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {r.patientName}
                  <span className="block text-xs text-slate-500">{r.patientNumber}</span>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {r.testName}
                  <span className="block text-xs text-slate-500">{r.testCode}</span>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {formatDateTime(r.requestedAt)}
                  <span className="block text-xs text-slate-500">Dr {r.doctorName}</span>
                </td>
                <td className="px-4 py-3 font-mono text-slate-700">{r.sampleId ?? '-'}</td>
                <td className="px-4 py-3">
                  <ResultText value={r.resultValue} unit={r.unit} isAbnormal={r.isAbnormal} />
                </td>
                <td className="px-4 py-3">
                  <LabStatusBadge status={r.status} />
                </td>
              </tr>
            ))}
            {rows && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                  Nothing here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {requests && (
        <Pagination
          totalCount={requests.totalCount}
          page={requests.page}
          pageSize={requests.pageSize}
          noun="request"
          onPageChange={(p) => setParams({ tab, page: String(p) })}
        />
      )}
    </div>
  )
}
