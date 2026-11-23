import { useState, type ReactNode } from 'react'

// A soft rounded panel with "notched" corners: a corner card sits in a cut-out of the panel, with the
// page colour (--color-frame) around it and rounded inner corners. Used on the login page and the dashboard.

const filletLeft = {
  backgroundImage: 'radial-gradient(circle at 100% 0, transparent 1.75rem, var(--color-frame) calc(1.75rem + 0.5px))',
}
const filletRight = {
  backgroundImage: 'radial-gradient(circle at 0 0, transparent 1.75rem, var(--color-frame) calc(1.75rem + 0.5px))',
}

// The panel itself: the hospital's own photo if the file exists, otherwise a light blue gradient with the
// built-in illustration of the hospital standing on it.
export function PanelPicture({ photo, artClassName }: { photo: string; artClassName: string }) {
  const [hasPhoto, setHasPhoto] = useState(true)
  return (
    <div className="absolute inset-0 overflow-hidden rounded-[1.75rem] bg-linear-to-br from-brand-100 via-[#e6eefb] to-accent-100" aria-hidden="true">
      <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-accent-200/50 blur-3xl" />
      <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-brand-200/60 blur-3xl" />
      {hasPhoto ? (
        <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover" onError={() => setHasPhoto(false)} />
      ) : (
        <div
          className={`absolute bg-contain bg-bottom bg-no-repeat ${artClassName}`}
          style={{ backgroundImage: "url('/images/hero-building.svg')" }}
        />
      )}
    </div>
  )
}

// A card tucked into the bottom-left or bottom-right corner of the panel.
// On small screens (below lg) it is a normal card, with no cut-out.
export function CornerCard({ side, className = '', children }: { side: 'left' | 'right'; className?: string; children: ReactNode }) {
  const left = side === 'left'
  return (
    <div className={`relative z-10 lg:absolute lg:bottom-0 ${left ? 'lg:left-0' : 'lg:right-0'} ${className}`}>
      <div
        className={`relative lg:bg-frame ${left ? 'lg:rounded-tr-[1.75rem] lg:pt-3 lg:pr-3' : 'lg:rounded-tl-[1.75rem] lg:pt-3 lg:pl-3'}`}
      >
        <span
          className={`absolute bottom-full hidden h-7 w-7 lg:block ${left ? 'left-0' : 'right-0'}`}
          style={left ? filletLeft : filletRight}
          aria-hidden="true"
        />
        <span
          className={`absolute bottom-0 hidden h-7 w-7 lg:block ${left ? 'left-full' : 'right-full'}`}
          style={left ? filletLeft : filletRight}
          aria-hidden="true"
        />
        {children}
      </div>
    </div>
  )
}
