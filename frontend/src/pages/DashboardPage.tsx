// PDF section 7, Dashboard. The five tiles get real numbers as each module is built.
const tiles = [
  'Total Patients',
  "Today's Appointments",
  'Revenue Summary',
  'Laboratory Requests',
  'Pharmacy Alerts',
]

export default function DashboardPage() {
  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {tiles.map((tile) => (
          <div key={tile} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-600">{tile}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-400">--</p>
          </div>
        ))}
      </div>
    </>
  )
}
