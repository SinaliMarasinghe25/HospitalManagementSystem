import { useState } from 'react'
import { Link } from 'react-router'
import { getPharmacyReport } from '../../api/reports'
import { FilterBar, PeriodFields, ReportHeader, ReportMessage, Stat, StatGrid } from '../../components/reports/ReportParts'
import { ReportTable, type Column } from '../../components/reports/ReportTable'
import { periodText, thisMonth } from '../../components/reports/reportUtils'
import { useReport } from '../../components/reports/useReport'
import type { AlertBatch } from '../../types/pharmacy'
import { formatDate, formatMoney } from '../../utils/format'

// FR-RP-04 Pharmacy reports: stock levels, low stock, near expiry and dispensed items.
// Stock and expiry show today's position; the dates only choose the "dispensed" period.
export default function PharmacyReportView() {
  const [filter, setFilter] = useState(thisMonth)
  const { data, error, loading } = useReport(getPharmacyReport, filter)

  const medicineLink = (id: number, text: string) => (
    <Link to={`/pharmacy/medicines/${id}`} className="font-medium text-brand-700 hover:underline">
      {text}
    </Link>
  )
  const batchColumns: Column<AlertBatch>[] = [
    {
      header: 'Medicine',
      value: (b) => `${b.medicineName} ${b.strength} ${b.form}`,
      show: (b) => medicineLink(b.medicineId, `${b.medicineName} ${b.strength} ${b.form}`),
    },
    { header: 'Batch', value: (b) => b.batchNumber },
    { header: 'Expiry date', value: (b) => b.expiryDate, show: (b) => formatDate(b.expiryDate) },
    { header: 'Quantity', value: (b) => b.quantityOnHand, numeric: true },
  ]

  return (
    <div className="space-y-4">
      <FilterBar>
        <PeriodFields value={filter} onChange={setFilter} />
      </FilterBar>
      <ReportMessage error={error} loading={loading && !data} />
      {data && (
        <>
          <ReportHeader
            title="Pharmacy"
            covers={`Stock as of today · Dispensed ${periodText(data.period.from, data.period.to)}`}
          />
          <StatGrid>
            <Stat label="Stock value (cost)" value={formatMoney(data.stockValue)} note={`${data.stock.length} medicines`} />
            <Stat label="Low stock" value={data.lowStock.length} note="below reorder level" />
            <Stat label="Expiring soon" value={data.nearExpiry.length} note={`batches, within ${data.nearExpiryDays} days`} />
            <Stat label="Expired" value={data.expired.length} note="batches still on the shelf" />
            <Stat label="Items dispensed" value={data.dispensedQuantity} note={formatMoney(data.dispensedAmount)} />
          </StatGrid>
          <ReportTable
            title="Dispensed in this period"
            csvName={`dispensed-${data.period.from}-to-${data.period.to}`}
            rows={data.dispensed}
            rowKey={(d) => d.medicineId}
            footer={['Total', data.dispensedQuantity, data.dispensedAmount]}
            columns={[
              {
                header: 'Medicine',
                value: (d) => `${d.name} ${d.strength} ${d.form}`,
                show: (d) => medicineLink(d.medicineId, `${d.name} ${d.strength} ${d.form}`),
              },
              { header: 'Quantity', value: (d) => d.quantity, numeric: true },
              { header: 'Billed', value: (d) => d.amount, money: true },
            ]}
          />
          <ReportTable
            title="Low stock"
            csvName="low-stock"
            rows={data.lowStock}
            rowKey={(m) => m.id}
            empty="No medicine is below its reorder level."
            columns={[
              { header: 'Medicine', value: (m) => `${m.name} ${m.strength} ${m.form}`, show: (m) => medicineLink(m.id, `${m.name} ${m.strength} ${m.form}`) },
              { header: 'Usable stock', value: (m) => m.usableStock, numeric: true },
              { header: 'Reorder level', value: (m) => m.reorderLevel, numeric: true },
            ]}
          />
          <div className="grid gap-4 lg:grid-cols-2 print:grid-cols-1">
            <ReportTable
              title={`Expiring within ${data.nearExpiryDays} days`}
              csvName="near-expiry"
              rows={data.nearExpiry}
              rowKey={(b) => b.batchId}
              empty="No batch expires soon."
              columns={batchColumns}
            />
            <ReportTable
              title="Expired, still on the shelf"
              csvName="expired"
              rows={data.expired}
              rowKey={(b) => b.batchId}
              empty="No expired stock."
              columns={batchColumns}
            />
          </div>
          <ReportTable
            title="Stock levels"
            csvName="stock-levels"
            rows={data.stock}
            rowKey={(m) => m.id}
            empty="No medicines yet."
            footer={['Total', '', '', '', '', data.stockValue]}
            columns={[
              { header: 'Medicine', value: (m) => `${m.name} ${m.strength} ${m.form}`, show: (m) => medicineLink(m.id, `${m.name} ${m.strength} ${m.form}`) },
              { header: 'Usable stock', value: (m) => m.usableStock, numeric: true },
              { header: 'Reorder level', value: (m) => m.reorderLevel, numeric: true },
              { header: 'Next expiry', value: (m) => m.nextExpiry, show: (m) => (m.nextExpiry ? formatDate(m.nextExpiry) : '-') },
              { header: 'Selling price', value: (m) => m.unitPrice, money: true },
              { header: 'Stock value (cost)', value: (m) => m.stockValue, money: true },
            ]}
          />
        </>
      )}
    </div>
  )
}
