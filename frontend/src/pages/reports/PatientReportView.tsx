import { useState } from 'react'
import { Link } from 'react-router'
import { getPatientReport } from '../../api/reports'
import { FilterBar, PeriodFields, ReportHeader, ReportMessage, Stat, StatGrid, TruncatedNote } from '../../components/reports/ReportParts'
import { ReportTable } from '../../components/reports/ReportTable'
import { periodText, sumBy, thisMonth } from '../../components/reports/reportUtils'
import { useReport } from '../../components/reports/useReport'
import type { CountRow } from '../../types/report'
import { formatDate, formatDateTime } from '../../utils/format'

// FR-RP-01 Patient reports: registrations by date range.
export default function PatientReportView() {
  const [filter, setFilter] = useState(thisMonth)
  const { data, error, loading } = useReport(getPatientReport, filter)

  return (
    <div className="space-y-4">
      <FilterBar>
        <PeriodFields value={filter} onChange={setFilter} />
      </FilterBar>
      <ReportMessage error={error} loading={loading && !data} />
      {data && (
        <>
          <ReportHeader title="Patient registrations" covers={periodText(data.period.from, data.period.to)} />
          <StatGrid>
            <Stat label="New patients" value={data.totalRegistered} />
            {data.byGender.map((g) => (
              <Stat key={g.label} label={g.label} value={g.count} />
            ))}
          </StatGrid>
          <div className="grid gap-4 lg:grid-cols-3 print:grid-cols-3">
            <CountTable title="By day" header="Date" rows={data.byDay} date />
            <CountTable title="By gender" header="Gender" rows={data.byGender} />
            <CountTable title="By age today" header="Age" rows={data.byAgeGroup} />
          </div>
          {data.detailTruncated && <TruncatedNote shown={data.patients.length} total={data.totalRegistered} />}
          <ReportTable
            title="Patients registered"
            rows={data.patients}
            rowKey={(p) => p.id}
            columns={[
              { header: 'Patient no.', value: (p) => p.patientNumber },
              {
                header: 'Name',
                value: (p) => p.fullName,
                show: (p) => (
                  <Link to={`/patients/${p.id}`} className="font-medium text-brand-700 hover:underline">
                    {p.fullName}
                  </Link>
                ),
              },
              { header: 'Gender', value: (p) => p.gender },
              { header: 'Date of birth', value: (p) => p.dateOfBirth, show: (p) => formatDate(p.dateOfBirth) },
              { header: 'Phone', value: (p) => p.phone },
              { header: 'Registered', value: (p) => p.registeredAt, show: (p) => formatDateTime(p.registeredAt) },
            ]}
          />
        </>
      )}
    </div>
  )
}

function CountTable({
  title,
  header,
  rows,
  date = false,
}: {
  title: string
  header: string
  rows: CountRow[]
  date?: boolean
}) {
  return (
    <ReportTable
      title={title}
      rows={rows}
      rowKey={(r) => r.label}
      footer={['Total', sumBy(rows, (r) => r.count)]}
      columns={[
        { header, value: (r) => r.label, show: date ? (r) => formatDate(r.label) : undefined },
        { header: 'Patients', value: (r) => r.count, numeric: true },
      ]}
    />
  )
}
