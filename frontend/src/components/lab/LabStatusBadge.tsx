import { labStatusLabels, type LabRequestStatus } from '../../types/lab'

const styles: Record<LabRequestStatus, string> = {
  Requested: 'bg-blue-50 text-blue-800 ring-blue-200',
  SampleCollected: 'bg-amber-50 text-amber-800 ring-amber-200',
  Completed: 'bg-green-50 text-green-800 ring-green-200',
  Cancelled: 'bg-slate-100 text-slate-600 ring-slate-200',
}

export function LabStatusBadge({ status }: { status: LabRequestStatus }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${styles[status]}`}>
      {labStatusLabels[status]}
    </span>
  )
}

// Text plus colour, so "abnormal" is never shown by colour alone.
export function ResultText({ value, unit, isAbnormal }: { value: string | null; unit: string | null; isAbnormal: boolean | null }) {
  if (value === null) return <span className="text-slate-400">-</span>
  return (
    <span className={isAbnormal ? 'font-semibold text-red-700' : 'text-slate-900'}>
      {value}
      {unit && ` ${unit}`}
      {isAbnormal && ' (abnormal)'}
    </span>
  )
}
