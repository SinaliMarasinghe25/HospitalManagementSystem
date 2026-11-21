import { Link } from 'react-router'
import { auditActionLabels, nameToWords, recordLabel, type AuditAction } from '../../types/audit'

// Small pieces of the Audit Log page: the action badge, record names and links, and the saved changes.

const actionStyles: Record<AuditAction, string> = {
  Login: 'bg-slate-100 text-slate-700 ring-slate-200',
  Logout: 'bg-slate-100 text-slate-700 ring-slate-200',
  LoginFailed: 'bg-red-50 text-red-800 ring-red-200',
  Create: 'bg-green-50 text-green-800 ring-green-200',
  Update: 'bg-blue-50 text-blue-800 ring-blue-200',
  Delete: 'bg-red-50 text-red-800 ring-red-200',
  View: 'bg-amber-50 text-amber-800 ring-amber-200',
}

export function AuditActionBadge({ action }: { action: AuditAction }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ${actionStyles[action]}`}
    >
      {auditActionLabels[action]}
    </span>
  )
}

// The page that shows a record, for the record types that have one. The id in the log is that page's id.
const recordPages: Record<string, (id: string) => string> = {
  Patient: (id) => `/patients/${id}`,
  MedicalHistory: (id) => `/patients/${id}`,
  Appointment: (id) => `/appointments/${id}`,
  MedicalRecord: (id) => `/medical-records/${id}`,
  Prescription: (id) => `/pharmacy/prescriptions/${id}`,
  Admission: (id) => `/admissions/${id}`,
  LabRequest: (id) => `/laboratory/requests/${id}`,
  Medicine: (id) => `/pharmacy/medicines/${id}`,
  Invoice: (id) => `/billing/invoices/${id}`,
  Employee: (id) => `/staff/employees/${id}`,
  DoctorSchedule: (id) => `/doctors/${id}`,
}

// "Open patient 5": a link to the record's own page, shown inside an entry's details.
// Nothing is shown when the record has no page of its own (for example a ward or a user account).
export function RecordLink({ entityName, entityId }: { entityName: string; entityId: string }) {
  const page = /^\d+$/.test(entityId) ? recordPages[entityName] : undefined
  if (!page) return null
  return (
    <Link to={page(entityId)} className="text-sm font-medium text-blue-700 hover:underline">
      Open {recordLabel(entityName, entityId).toLowerCase()}
    </Link>
  )
}

// The JSON saved with an entry, as "Field: value" lines in A to Z order. Anything that is not an object is shown as it is.
export function ChangesList({ changes }: { changes: string }) {
  let parsed: unknown
  try {
    parsed = JSON.parse(changes)
  } catch {
    parsed = changes
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return <pre className="text-xs whitespace-pre-wrap text-slate-800">{JSON.stringify(parsed, null, 2)}</pre>
  }
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-xs">
      {Object.entries(parsed)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([field, value]) => (
          <div key={field} className="contents">
            <dt className="font-medium text-slate-600">{nameToWords(field)}</dt>
            <dd className="break-all whitespace-pre-wrap text-slate-900">{showValue(value)}</dd>
          </div>
        ))}
    </dl>
  )
}

function showValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '-'
  return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
}
