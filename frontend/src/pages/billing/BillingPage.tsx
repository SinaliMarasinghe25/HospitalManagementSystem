import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ApiError } from '../../api/client'
import { listInvoices, listUnbilledPatients } from '../../api/billing'
import { Permissions } from '../../auth/permissions'
import { hasAnyRole } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { InvoiceStatusBadge } from '../../components/billing/InvoiceStatusBadge'
import { inputClass } from '../../components/ui/FormField'
import { Pagination } from '../../components/ui/Pagination'
import type { InvoicePage, UnbilledPatient } from '../../types/billing'
import { addDays, formatDateTime, formatMoney, todayInHospital } from '../../utils/format'
import { Tabs } from '../../components/ui/Tabs'

type Tab = 'unbilled' | 'due' | 'all'

const tabLabels: Record<Tab, string> = {
  unbilled: 'Ready to bill',
  due: 'Balance due',
  all: 'All invoices',
}

// PDF 3.8 Billing System and the Billing screen (section 7).
// The accountant bills patients from "Ready to bill" and takes payments on "Balance due".
// Receptionists see invoice balances only, so they can tell a patient what is still owed.
export default function BillingPage() {
  const { user } = useAuth()
  const seesDetails = hasAnyRole(user?.roles, Permissions.viewInvoiceDetails)
  const tabs: Tab[] = seesDetails ? ['unbilled', 'due', 'all'] : ['due', 'all']

  const [params, setParams] = useSearchParams()
  const requested = params.get('tab') as Tab | null
  const tab = requested && tabs.includes(requested) ? requested : tabs[0]

  return (
    <div className="space-y-4">
      <h1 className="text-[1.75rem] leading-tight font-medium text-slate-900">Billing</h1>
      <Tabs label="Billing views" tabs={tabs} labels={tabLabels} value={tab} onChange={(t) => setParams({ tab: t })} />
      {tab === 'unbilled' && <UnbilledList />}
      {tab !== 'unbilled' && <InvoiceList key={tab} due={tab === 'due'} linkToDetails={seesDetails} />}
    </div>
  )
}

const card = 'overflow-x-auto rounded-2xl bg-white shadow-card ring-1 ring-slate-200/70'
const th = 'px-4 py-3 font-medium'

function ErrorText({ error }: { error: string | null }) {
  return error ? (
    <p className="border-l-2 border-red-700 bg-red-50 p-3 text-sm text-red-800" role="alert">
      {error}
    </p>
  ) : null
}

function UnbilledList() {
  const [rows, setRows] = useState<UnbilledPatient[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listUnbilledPatients()
      .then(setRows)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load the list.'))
  }, [])

  return (
    <>
      <p className="text-sm text-slate-600">
        Charges are added automatically when a visit is completed, a lab result is entered, medicine is dispensed or a
        patient is discharged.
      </p>
      <ErrorText error={error} />
      <div className={card}>
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/60 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
            <tr>
              <th scope="col" className={th}>Patient</th>
              <th scope="col" className={th}>Charges</th>
              <th scope="col" className={th}>Amount</th>
              <th scope="col" className={th}>Waiting since</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows?.map((p) => (
              <tr key={p.patientId} className="hover:bg-brand-50/40">
                <td className="px-4 py-3">
                  <Link to={`/billing/patients/${p.patientId}`} className="font-medium text-brand-700 hover:underline">
                    {p.patientName}
                  </Link>
                  <span className="block text-xs text-slate-500">{p.patientNumber}</span>
                </td>
                <td className="px-4 py-3 text-slate-700">{p.chargeCount}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{formatMoney(p.total)}</td>
                <td className="px-4 py-3 text-slate-700">{formatDateTime(p.oldestChargeAt)}</td>
              </tr>
            ))}
            {rows && rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  Nothing waiting to be billed.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}

function InvoiceList({ due, linkToDetails }: { due: boolean; linkToDetails: boolean }) {
  const [search, setSearch] = useState('')
  const [toDate, setToDate] = useState(() => todayInHospital())
  const [page, setPage] = useState(1)
  const [data, setData] = useState<InvoicePage | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    // A short pause so typing a name makes one request, not one per letter.
    const timer = setTimeout(() => {
      const filter = due ? { due: true, search } : search.trim() ? { search } : { fromDate: addDays(toDate, -29), toDate }
      listInvoices({ ...filter, page })
        .then((result) => {
          if (ignore) return
          setData(result)
          setError(null)
        })
        .catch((err: unknown) => !ignore && setError(err instanceof ApiError ? err.message : 'Could not load invoices.'))
    }, 250)
    return () => {
      ignore = true
      clearTimeout(timer)
    }
  }, [due, search, toDate, page])

  const rows = data?.items

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
        <label htmlFor="invoice-search" className="sr-only">
          Search invoices
        </label>
        <input
          id="invoice-search"
          type="search"
          placeholder="Patient name, patient no. or invoice no."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1) // new search words start on page 1
          }}
          className={`${inputClass} max-w-xs`}
        />
        {!due && !search.trim() && (
          <>
            <label htmlFor="invoice-to">Issued in the 30 days up to</label>
            <input
              id="invoice-to"
              type="date"
              value={toDate}
              onChange={(e) => {
                if (!e.target.value) return
                setToDate(e.target.value)
                setPage(1) // a new date range starts on page 1
              }}
              className={`${inputClass} w-auto`}
            />
          </>
        )}
        {due && data && (
          <p className="ml-auto">
            {/* Added up by the API over every page, not only the rows shown here. */}
            Total still due: <strong>{formatMoney(data.totalBalance)}</strong>
          </p>
        )}
      </div>
      <ErrorText error={error} />
      <div className={card}>
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/60 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
            <tr>
              <th scope="col" className={th}>Invoice</th>
              <th scope="col" className={th}>Patient</th>
              <th scope="col" className={th}>Issued</th>
              <th scope="col" className={th}>Total</th>
              <th scope="col" className={th}>Paid</th>
              <th scope="col" className={th}>Balance</th>
              <th scope="col" className={th}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows?.map((i) => (
              <tr key={i.id} className={i.status === 'Cancelled' ? 'text-slate-400' : 'hover:bg-brand-50/40'}>
                <td className="px-4 py-3 font-mono">
                  {linkToDetails ? (
                    <Link to={`/billing/invoices/${i.id}`} className="font-medium text-brand-700 hover:underline">
                      {i.invoiceNumber}
                    </Link>
                  ) : (
                    i.invoiceNumber
                  )}
                </td>
                <td className="px-4 py-3">
                  {i.patientName}
                  <span className="block text-xs text-slate-500">{i.patientNumber}</span>
                </td>
                <td className="px-4 py-3">{formatDateTime(i.issuedAt)}</td>
                <td className="px-4 py-3">{formatMoney(i.total)}</td>
                <td className="px-4 py-3">{formatMoney(i.amountPaid)}</td>
                <td className={`px-4 py-3 ${i.balance > 0 ? 'font-semibold text-slate-900' : ''}`}>{formatMoney(i.balance)}</td>
                <td className="px-4 py-3">
                  <InvoiceStatusBadge status={i.status} />
                </td>
              </tr>
            ))}
            {rows && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                  {due ? 'No unpaid invoices.' : 'No invoices found.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {data && (
        <Pagination
          totalCount={data.totalCount}
          page={data.page}
          pageSize={data.pageSize}
          noun="invoice"
          onPageChange={setPage}
        />
      )}
    </>
  )
}
