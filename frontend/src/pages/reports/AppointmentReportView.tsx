import { useState } from 'react'
import { Link } from 'react-router'
import { getAppointmentReport } from '../../api/reports'
import { Roles, hasAnyRole } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { DoctorPicker } from '../../components/appointments/DoctorPicker'
import { StatusBadge } from '../../components/appointments/StatusBadge'
import { statusLabels } from '../../components/appointments/appointmentRules'
import { FilterBar, PeriodFields, ReportHeader, ReportMessage, Stat, StatGrid, TruncatedNote } from '../../components/reports/ReportParts'
import { ReportTable } from '../../components/reports/ReportTable'
import { periodText, sumBy, thisMonth } from '../../components/reports/reportUtils'
import { useReport } from '../../components/reports/useReport'
import { compactInputClass } from '../../components/ui/FormField'
import { appointmentStatuses, type AppointmentStatus } from '../../types/appointment'
import { formatDateTime } from '../../utils/format'

// FR-RP-02 Appointment reports: by doctor, status and date range.
// A doctor sees only their own appointments (the API enforces this), so the doctor filter is not shown to them.
export default function AppointmentReportView() {
  const { user } = useAuth()
  const seesAllDoctors = hasAnyRole(user?.roles, [Roles.Administrator, Roles.Receptionist])
  const [filter, setFilter] = useState(() => ({ ...thisMonth(), doctorId: '', status: '' }))
  const { data, error, loading } = useReport(getAppointmentReport, filter)
  const count = (status: AppointmentStatus) => data?.byStatus.find((s) => s.label === status)?.count ?? 0

  return (
    <div className="space-y-4">
      <FilterBar>
        <PeriodFields value={filter} onChange={(p) => setFilter({ ...filter, ...p })} />
        <div>
          <label htmlFor="report-status" className="block text-sm font-medium text-slate-700">
            Status
          </label>
          <select
            id="report-status"
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
            className={`${compactInputClass} mt-1`}
          >
            <option value="">All statuses</option>
            {appointmentStatuses.map((s) => (
              <option key={s} value={s}>
                {statusLabels[s]}
              </option>
            ))}
          </select>
        </div>
        {seesAllDoctors && (
          <div className="min-w-72 flex-1">
            <DoctorPicker
              idPrefix="report"
              doctorId={filter.doctorId}
              onChange={(doctorId) => setFilter({ ...filter, doctorId })}
              allowAll
            />
          </div>
        )}
      </FilterBar>
      <ReportMessage error={error} loading={loading && !data} />
      {data && (
        <>
          <ReportHeader
            title="Appointments"
            covers={[
              periodText(data.period.from, data.period.to),
              filter.status && statusLabels[filter.status as AppointmentStatus],
              filter.doctorId && data.byDoctor[0] && `Dr ${data.byDoctor[0].doctorName}`,
              !seesAllDoctors && 'Your appointments only',
            ]
              .filter(Boolean)
              .join(' · ')}
          />
          <StatGrid>
            <Stat label="Appointments" value={data.total} />
            <Stat label="Completed" value={count('Completed')} />
            <Stat label="Cancelled" value={count('Cancelled')} />
            <Stat label="No-show" value={count('NoShow')} />
          </StatGrid>
          <ReportTable
            title="By doctor"
            csvName={`appointments-by-doctor-${data.period.from}-to-${data.period.to}`}
            rows={data.byDoctor}
            rowKey={(d) => d.doctorId}
            footer={[
              'Total',
              '',
              data.total,
              sumBy(data.byDoctor, (d) => d.completed),
              sumBy(data.byDoctor, (d) => d.cancelled),
              sumBy(data.byDoctor, (d) => d.noShow),
              sumBy(data.byDoctor, (d) => d.open),
            ]}
            columns={[
              { header: 'Doctor', value: (d) => `Dr ${d.doctorName}` },
              { header: 'Specialization', value: (d) => d.specialization },
              { header: 'Total', value: (d) => d.total, numeric: true },
              { header: 'Completed', value: (d) => d.completed, numeric: true },
              { header: 'Cancelled', value: (d) => d.cancelled, numeric: true },
              { header: 'No-show', value: (d) => d.noShow, numeric: true },
              { header: 'Still open', value: (d) => d.open, numeric: true },
            ]}
          />
          <ReportTable
            title="By status"
            csvName={`appointments-by-status-${data.period.from}-to-${data.period.to}`}
            rows={data.byStatus}
            rowKey={(s) => s.label}
            footer={['Total', data.total]}
            columns={[
              { header: 'Status', value: (s) => statusLabels[s.label as AppointmentStatus] },
              { header: 'Appointments', value: (s) => s.count, numeric: true },
            ]}
          />
          {data.detailTruncated && <TruncatedNote shown={data.appointments.length} total={data.total} />}
          <ReportTable
            title="Appointment list"
            csvName={`appointments-${data.period.from}-to-${data.period.to}`}
            rows={data.appointments}
            rowKey={(a) => a.id}
            columns={[
              {
                header: 'Date and time',
                value: (a) => a.startTime,
                show: (a) => (
                  <Link to={`/appointments/${a.id}`} className="font-medium text-blue-700 hover:underline">
                    {formatDateTime(a.startTime)}
                  </Link>
                ),
              },
              { header: 'Patient no.', value: (a) => a.patientNumber },
              { header: 'Patient', value: (a) => a.patientName },
              { header: 'Doctor', value: (a) => `Dr ${a.doctorName}` },
              { header: 'Status', value: (a) => statusLabels[a.status], show: (a) => <StatusBadge status={a.status} /> },
            ]}
          />
        </>
      )}
    </div>
  )
}
