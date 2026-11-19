import { useAuth } from '../auth/useAuth'

// PDF section 7, Dashboard. The five tiles get real numbers as each module is built.
const tiles = [
  'Total Patients',
  "Today's Appointments",
  'Revenue Summary',
  'Laboratory Requests',
  'Pharmacy Alerts',
]

export default function DashboardPage() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="flex items-center justify-between bg-white px-4 py-3 shadow-sm sm:px-8">
        <span className="font-semibold text-slate-900">HMS</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600">
            {user?.userName} ({user?.roles.join(', ')})
          </span>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="px-4 py-6 sm:px-8">
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {tiles.map((tile) => (
            <div key={tile} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <p className="text-sm text-slate-600">{tile}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-400">--</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
