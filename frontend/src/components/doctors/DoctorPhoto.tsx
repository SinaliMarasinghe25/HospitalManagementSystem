import { useState } from 'react'

type Props = {
  doctorId: number
  name: string
  // Tailwind size classes, e.g. "h-9 w-9" in a table or "h-20 w-20" on the doctor's page.
  size?: string
  textSize?: string
}

// A doctor's photo, from frontend/public/images/doctors/<doctor id>.jpg (built into the site, so it
// survives redeploys). When there is no photo for that doctor, their initials are shown instead.
export function DoctorPhoto({ doctorId, name, size = 'h-9 w-9', textSize = 'text-[11px]' }: Props) {
  const [failedFor, setFailedFor] = useState<number | null>(null)
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')

  if (failedFor === doctorId) {
    return (
      <span
        className={`${size} ${textSize} inline-flex shrink-0 items-center justify-center rounded-full bg-linear-to-br from-brand-100 to-accent-100 font-mono font-medium text-brand-800 ring-2 ring-white`}
        aria-hidden="true"
      >
        {initials || 'Dr'}
      </span>
    )
  }

  return (
    <img
      src={`/images/doctors/${doctorId}.jpg`}
      alt=""
      loading="lazy"
      onError={() => setFailedFor(doctorId)}
      className={`${size} shrink-0 rounded-full object-cover ring-2 ring-white shadow-sm`}
    />
  )
}
