import { useState } from 'react'
import { searchPatients } from '../../api/patients'
import type { PatientSummary } from '../../types/patient'
import { inputClass, secondaryButtonClass } from '../ui/FormField'

export type ChosenPatient = { id: number; name: string; patientNumber: string }

// Search by name, patient number, NIC or phone (the same search as the Patients page).
export function PatientSearch({ onChoose, error }: { onChoose: (p: ChosenPatient) => void; error?: string }) {
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<PatientSummary[] | null>(null)

  async function search() {
    if (term.trim() === '') return
    const page = await searchPatients(term.trim(), 1, 10)
    setResults(page.items)
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <label htmlFor="patient-search" className="sr-only">
          Search patients
        </label>
        <input
          id="patient-search"
          type="search"
          placeholder="Name, patient number, NIC or phone"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => {
            // Enter searches here instead of submitting the whole booking form.
            if (e.key === 'Enter') {
              e.preventDefault()
              void search()
            }
          }}
          aria-invalid={!!error}
          className={inputClass}
        />
        <button type="button" onClick={() => void search()} className={secondaryButtonClass}>
          Search
        </button>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {results && (
        <ul className="divide-y divide-slate-100 rounded-md ring-1 ring-slate-200">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onChoose({ id: p.id, name: `${p.firstName} ${p.lastName}`, patientNumber: p.patientNumber })}
                className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50"
              >
                <strong>
                  {p.firstName} {p.lastName}
                </strong>{' '}
                <span className="text-slate-500">
                  {p.patientNumber} · {p.phone}
                </span>
              </button>
            </li>
          ))}
          {results.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">No patients found.</li>}
        </ul>
      )}
    </div>
  )
}
