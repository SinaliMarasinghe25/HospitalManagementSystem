import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { listLabTests } from '../../api/lab'
import { getLabReport } from '../../api/reports'
import { LabStatusBadge } from '../../components/lab/LabStatusBadge'
import { FilterBar, PeriodFields, ReportHeader, ReportMessage, Stat, StatGrid, TruncatedNote } from '../../components/reports/ReportParts'
import { ReportTable } from '../../components/reports/ReportTable'
import { periodText, sumBy, thisMonth } from '../../components/reports/reportUtils'
import { useReport } from '../../components/reports/useReport'
import { compactInputClass } from '../../components/ui/FormField'
import { labStatusLabels, type LabRequestStatus, type LabTest } from '../../types/lab'
import { formatDateTime } from '../../utils/format'

const statuses = Object.keys(labStatusLabels) as LabRequestStatus[]

// FR-RP-05 Laboratory reports: tests by type, status and date range.
export default function LabReportView() {
  const [filter, setFilter] = useState(() => ({ ...thisMonth(), labTestId: '', status: '' }))
  const { data, error, loading } = useReport(getLabReport, filter)
  const [tests, setTests] = useState<LabTest[]>([])

  useEffect(() => {
    listLabTests(true).then(setTests).catch(() => setTests([]))
  }, [])

  const testName = tests.find((t) => String(t.id) === filter.labTestId)?.name

  return (
    <div className="space-y-4">
      <FilterBar>
        <PeriodFields value={filter} onChange={(p) => setFilter({ ...filter, ...p })} />
        <div>
          <label htmlFor="report-test" className="block text-sm font-medium text-slate-700">
            Test
          </label>
          <select
            id="report-test"
            value={filter.labTestId}
            onChange={(e) => setFilter({ ...filter, labTestId: e.target.value })}
            className={`${compactInputClass} mt-1`}
          >
            <option value="">All tests</option>
            {tests.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.code})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="report-lab-status" className="block text-sm font-medium text-slate-700">
            Status
          </label>
          <select
            id="report-lab-status"
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
            className={`${compactInputClass} mt-1`}
          >
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {labStatusLabels[s]}
              </option>
            ))}
          </select>
        </div>
      </FilterBar>
      <ReportMessage error={error} loading={loading && !data} />
      {data && (
        <>
          <ReportHeader
            title="Laboratory tests"
            covers={[
              periodText(data.period.from, data.period.to),
              testName,
              filter.status && labStatusLabels[filter.status as LabRequestStatus],
            ]
              .filter(Boolean)
              .join(' · ')}
          />
          <StatGrid>
            <Stat label="Tests requested" value={data.total} />
            <Stat label="Still waiting" value={sumBy(data.byTest, (t) => t.waiting)} note="for a sample or a result" />
            <Stat label="Results ready" value={sumBy(data.byTest, (t) => t.completed)} />
            <Stat label="Abnormal results" value={sumBy(data.byTest, (t) => t.abnormal)} />
          </StatGrid>
          <ReportTable
            title="By test"
            csvName={`lab-by-test-${data.period.from}-to-${data.period.to}`}
            rows={data.byTest}
            rowKey={(t) => t.labTestId}
            footer={[
              'Total',
              data.total,
              sumBy(data.byTest, (t) => t.waiting),
              sumBy(data.byTest, (t) => t.completed),
              sumBy(data.byTest, (t) => t.abnormal),
              sumBy(data.byTest, (t) => t.cancelled),
            ]}
            columns={[
              { header: 'Test', value: (t) => `${t.name} (${t.code})` },
              { header: 'Requested', value: (t) => t.total, numeric: true },
              { header: 'Waiting', value: (t) => t.waiting, numeric: true },
              { header: 'Result ready', value: (t) => t.completed, numeric: true },
              { header: 'Abnormal', value: (t) => t.abnormal, numeric: true },
              { header: 'Cancelled', value: (t) => t.cancelled, numeric: true },
            ]}
          />
          <ReportTable
            title="By status"
            csvName={`lab-by-status-${data.period.from}-to-${data.period.to}`}
            rows={data.byStatus}
            rowKey={(s) => s.label}
            footer={['Total', data.total]}
            columns={[
              { header: 'Status', value: (s) => labStatusLabels[s.label as LabRequestStatus] },
              { header: 'Tests', value: (s) => s.count, numeric: true },
            ]}
          />
          {data.detailTruncated && <TruncatedNote shown={data.requests.length} total={data.total} />}
          <ReportTable
            title="Test list"
            csvName={`lab-tests-${data.period.from}-to-${data.period.to}`}
            rows={data.requests}
            rowKey={(r) => r.id}
            columns={[
              {
                header: 'Request no.',
                value: (r) => r.requestNumber,
                show: (r) => (
                  <Link to={`/laboratory/requests/${r.id}`} className="font-medium text-blue-700 hover:underline">
                    {r.requestNumber}
                  </Link>
                ),
              },
              { header: 'Requested', value: (r) => r.requestedAt, show: (r) => formatDateTime(r.requestedAt) },
              { header: 'Patient', value: (r) => `${r.patientName} (${r.patientNumber})` },
              { header: 'Test', value: (r) => r.testName },
              { header: 'Doctor', value: (r) => `Dr ${r.doctorName}` },
              { header: 'Status', value: (r) => labStatusLabels[r.status], show: (r) => <LabStatusBadge status={r.status} /> },
              { header: 'Abnormal', value: (r) => (r.isAbnormal ? 'Yes' : ''), show: (r) => (r.isAbnormal ? <strong className="text-red-700">Yes</strong> : '') },
            ]}
          />
        </>
      )}
    </div>
  )
}
