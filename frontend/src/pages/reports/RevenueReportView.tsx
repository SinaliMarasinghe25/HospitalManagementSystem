import { useState } from 'react'
import { Link } from 'react-router'
import { getRevenueReport } from '../../api/reports'
import { FilterBar, PeriodFields, ReportHeader, ReportMessage, Stat, StatGrid, TruncatedNote } from '../../components/reports/ReportParts'
import { ReportTable } from '../../components/reports/ReportTable'
import { periodText, sumBy, thisMonth } from '../../components/reports/reportUtils'
import { useReport } from '../../components/reports/useReport'
import { chargeTypeLabels, paymentMethodLabels } from '../../types/billing'
import { formatDate, formatDateTime, formatMoney } from '../../utils/format'

// FR-RP-03 Revenue reports: revenue by source and date range.
// Billed = invoices issued in the period, by where the charges came from (cancelled invoices are left out).
// Collected = payments received in the period; its total is exactly the sum of those payments.
export default function RevenueReportView() {
  const [filter, setFilter] = useState(thisMonth)
  const { data, error, loading } = useReport(getRevenueReport, filter)

  return (
    <div className="space-y-4">
      <FilterBar>
        <PeriodFields value={filter} onChange={setFilter} />
      </FilterBar>
      <ReportMessage error={error} loading={loading && !data} />
      {data && (
        <>
          <ReportHeader title="Revenue" covers={periodText(data.period.from, data.period.to)}>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              <strong>Billed:</strong> invoices issued in this period, excluding cancelled invoices.{' '}
              <strong>Collected:</strong> payments received in this period.
            </p>
          </ReportHeader>
          <StatGrid>
            <Stat label="Billed" value={formatMoney(data.billedTotal)} note={`${data.invoiceCount} invoices`} />
            <Stat label="Collected" value={formatMoney(data.collected)} note={`${data.payments.length} payments`} />
            <Stat label="Discounts given" value={formatMoney(data.discounts)} />
            <Stat label="Still owed (all invoices, today)" value={formatMoney(data.outstandingNow)} />
          </StatGrid>
          <div className="grid gap-4 lg:grid-cols-2 print:grid-cols-2">
            <ReportTable
              title="Billed by source"
              rows={[
                ...data.bySource.map((s) => ({ key: s.source, label: chargeTypeLabels[s.source], count: s.charges, amount: s.amount })),
                { key: 'discount', label: 'Less discounts', count: null, amount: -data.discounts },
              ]}
              rowKey={(r) => r.key}
              footer={['Billed total', sumBy(data.bySource, (s) => s.charges), data.billedTotal]}
              columns={[
                { header: 'Source', value: (r) => r.label },
                { header: 'Charges', value: (r) => r.count, numeric: true },
                { header: 'Amount', value: (r) => r.amount, money: true },
              ]}
            />
            <ReportTable
              title="Collected by payment method"
              rows={data.byMethod}
              rowKey={(m) => m.method}
              footer={['Collected total', sumBy(data.byMethod, (m) => m.payments), data.collected]}
              columns={[
                { header: 'Method', value: (m) => paymentMethodLabels[m.method] },
                { header: 'Payments', value: (m) => m.payments, numeric: true },
                { header: 'Amount', value: (m) => m.amount, money: true },
              ]}
            />
          </div>
          <ReportTable
            title="By day"
            rows={data.byDay}
            rowKey={(d) => d.date}
            footer={['Total', data.billedTotal, data.collected]}
            columns={[
              { header: 'Date', value: (d) => d.date, show: (d) => formatDate(d.date) },
              { header: 'Billed', value: (d) => d.billed, money: true },
              { header: 'Collected', value: (d) => d.collected, money: true },
            ]}
          />
          {data.detailTruncated && <TruncatedNote shown={data.payments.length} total={sumBy(data.byMethod, (m) => m.payments)} />}
          <ReportTable
            title="Payments received"
            rows={data.payments}
            rowKey={(p) => p.id}
            footer={['Total', '', '', '', '', data.collected]}
            columns={[
              { header: 'Receipt no.', value: (p) => p.receiptNumber },
              { header: 'Paid', value: (p) => p.paidAt, show: (p) => formatDateTime(p.paidAt) },
              {
                header: 'Invoice',
                value: (p) => p.invoiceNumber,
                show: (p) => (
                  <Link to={`/billing/invoices/${p.invoiceId}`} className="font-medium text-brand-700 hover:underline">
                    {p.invoiceNumber}
                  </Link>
                ),
              },
              { header: 'Patient', value: (p) => `${p.patientName} (${p.patientNumber})` },
              { header: 'Method', value: (p) => paymentMethodLabels[p.method] },
              { header: 'Amount', value: (p) => p.amount, money: true },
            ]}
          />
        </>
      )}
    </div>
  )
}
