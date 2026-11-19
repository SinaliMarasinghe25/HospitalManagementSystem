import { useEffect, useState } from 'react'
import { listDepartments, listDoctors } from '../../api/doctors'
import type { Department, DoctorSummary } from '../../types/doctor'
import { inputClass } from '../ui/FormField'

// UI-APT-03 Doctor Selection: choose a department first, then a doctor from that department.
export function DoctorPicker({
  idPrefix,
  doctorId,
  onChange,
  allowAll = false,
  error,
}: {
  idPrefix: string
  doctorId: string
  onChange: (doctorId: string) => void
  allowAll?: boolean // calendar filter: "All doctors" is allowed
  error?: string
}) {
  const [departments, setDepartments] = useState<Department[]>([])
  const [departmentId, setDepartmentId] = useState('')
  const [doctors, setDoctors] = useState<DoctorSummary[]>([])

  useEffect(() => {
    listDepartments().then(setDepartments).catch(() => setDepartments([]))
  }, [])

  useEffect(() => {
    let ignore = false
    listDoctors(departmentId, '')
      .then((data) => !ignore && setDoctors(data))
      .catch(() => !ignore && setDoctors([]))
    return () => {
      ignore = true
    }
  }, [departmentId])

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div>
        <label htmlFor={`${idPrefix}-department`} className="block text-sm font-medium text-slate-700">
          Department
        </label>
        <select
          id={`${idPrefix}-department`}
          value={departmentId}
          onChange={(e) => {
            setDepartmentId(e.target.value)
            onChange('')
          }}
          className={`${inputClass} mt-1`}
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-doctor`} className="block text-sm font-medium text-slate-700">
          Doctor
          {!allowAll && <span className="text-red-600"> *</span>}
        </label>
        <select
          id={`${idPrefix}-doctor`}
          value={doctorId}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${idPrefix}-doctor-error` : undefined}
          className={`${inputClass} mt-1`}
        >
          <option value="">{allowAll ? 'All doctors' : 'Choose a doctor'}</option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>
              Dr {d.fullName} ({d.specialization})
            </option>
          ))}
        </select>
        {error && (
          <p id={`${idPrefix}-doctor-error`} className="mt-1 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
