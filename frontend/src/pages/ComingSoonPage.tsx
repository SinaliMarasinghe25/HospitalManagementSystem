// Placeholder for modules we have not built yet.
export default function ComingSoonPage({ title, pdfRef }: { title: string; pdfRef: string }) {
  return (
    <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
      <p className="mt-2 text-slate-600">This module is coming in a later step.</p>
      <p className="mt-1 text-sm text-slate-500">Requirement: {pdfRef}</p>
    </div>
  )
}
