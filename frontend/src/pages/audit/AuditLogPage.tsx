import { Fragment, useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { listAuditEntityNames, searchAuditLog } from '../../api/audit'
import { AuditActionBadge, ChangesList, RecordLink } from '../../components/audit/AuditParts'
import { ReportMessage } from '../../components/reports/ReportParts'
import { useReport } from '../../components/reports/useReport'
import { compactInputClass, FormField, primaryButtonClass, secondaryButtonClass } from '../../components/ui/FormField'
import { Pagination } from '../../components/ui/Pagination'
import { auditActionLabels, nameToWords, recordLabel, type AuditAction, type AuditLogFilter } from '../../types/audit'
import { formatTimestamp } from '../../utils/format'

const actions = Object.keys(auditActionLabels) as AuditAction[]
const filterKeys = ['fromDate', 'toDate', 'user', 'action', 'entityName', 'entityId'] as const
type FilterFields = Omit<AuditLogFilter, 'page'>

// PDF section 4 "Audit Logs" and section 10 "Audit Trail" (NFR-SEC-04, BR-04). Administrators only.
// Read-only: the API has no way to change or delete an entry.
// The filters and page number live in the address bar, so Back, Refresh and sharing a link keep them.
export default function AuditLogPage() {
  const [params, setParams] = useSearchParams()
  const fields = Object.fromEntries(filterKeys.map((k) => [k, params.get(k) ?? ''])) as FilterFields
  const filter: AuditLogFilter = { ...fields, page: params.get('page') ?? '' }
  const { data, error, loading } = useReport(searchAuditLog, filter)
  const [openId, setOpenId] = useState<number | null>(null)
  const toggle = (id: number) => setOpenId((current) => (current === id ? null : id))

  const [entityNames, setEntityNames] = useState<string[]>([])
  useEffect(() => {
    listAuditEntityNames()
      .then(setEntityNames)
      .catch(() => setEntityNames([]))
  }, [])

  // Empty values are left out of the address; a new filter always starts on page 1.
  function show(fields: Partial<AuditLogFilter>) {
    setParams(Object.fromEntries(Object.entries(fields).filter(([, value]) => value)))
  }

  const isFiltered = Object.values(fields).some(Boolean)
  const singleRecord = filter.entityName && filter.entityId

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Audit log</h1>
        <p className="text-sm text-slate-600">
          Every login, failed login and logout, every change to patient, clinical, financial and staff records, and
          every time someone opened a medical record. Newest first. Entries cannot be changed or deleted.
        </p>
      </div>

      {/* Remounted when the address changes (for example after "History"), so the boxes show the filter in use. */}
      <FilterForm
        key={params.toString()}
        initial={fields}
        entityNames={entityNames}
        canClear={isFiltered}
        onApply={show}
        onClear={() => show({})}
      />

      {singleRecord && (
        <p className="text-sm text-slate-700">
          Showing the history of <strong>{recordLabel(filter.entityName, filter.entityId)}</strong>.
        </p>
      )}

      <ReportMessage error={error} loading={loading && !data} />

      {data && (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  When
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  User
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Action
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Record
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  <span className="sr-only">More</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((entry) => {
                const isOpen = openId === entry.id
                return (
                  <Fragment key={entry.id}>
                    {/* Clicking anywhere on the row opens its details, the same as the Details button. */}
                    <tr onClick={() => toggle(entry.id)} className="cursor-pointer hover:bg-slate-50">
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700">{formatTimestamp(entry.timestamp)}</td>
                      <td className="px-4 py-3 text-slate-900">{entry.userName ?? '-'}</td>
                      <td className="px-4 py-3">
                        <AuditActionBadge action={entry.action} />
                      </td>
                      <td className="px-4 py-3">
                        {entry.entityName ? recordLabel(entry.entityName, entry.entityId) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {entry.entityName && entry.entityId && !singleRecord && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              show({ entityName: entry.entityName!, entityId: entry.entityId! })
                            }}
                            className="mr-3 text-blue-700 hover:underline"
                          >
                            History
                          </button>
                        )}
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          aria-controls={`audit-details-${entry.id}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            toggle(entry.id)
                          }}
                          className="text-blue-700 hover:underline"
                        >
                          {isOpen ? 'Hide details' : 'Details'}
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr id={`audit-details-${entry.id}`} className="bg-slate-50">
                        <td colSpan={5} className="space-y-2 px-4 py-3">
                          {entry.changes ? (
                            <ChangesList changes={entry.changes} />
                          ) : (
                            <p className="text-xs text-slate-500">No further details were saved with this entry.</p>
                          )}
                          <p className="text-xs text-slate-500">
                            Entry {entry.id} &middot; IP address {entry.ipAddress ?? 'not known'}
                          </p>
                          {entry.entityName && entry.entityId && (
                            <RecordLink entityName={entry.entityName} entityId={entry.entityId} />
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    No audit entries match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {data && (
        <Pagination
          totalCount={data.totalCount}
          page={data.page}
          pageSize={data.pageSize}
          noun="entry"
          nounPlural="entries"
          onPageChange={(page) => show({ ...fields, page: String(page) })}
        />
      )}
    </div>
  )
}

// The filter boxes. Nothing is searched until "Apply filters", so typing a name does not reload on every key.
function FilterForm({
  initial,
  entityNames,
  canClear,
  onApply,
  onClear,
}: {
  initial: FilterFields
  entityNames: string[]
  canClear: boolean
  onApply: (fields: FilterFields) => void
  onClear: () => void
}) {
  const [draft, setDraft] = useState(initial)
  const set = (field: keyof FilterFields) => (e: { target: { value: string } }) =>
    setDraft({ ...draft, [field]: e.target.value })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onApply({ ...draft, user: draft.user.trim(), entityId: draft.entityId.trim() })
  }

  // A record type stays in the list even before the log has loaded, so a shared link still shows it.
  const typeOptions =
    draft.entityName && !entityNames.includes(draft.entityName) ? [draft.entityName, ...entityNames] : entityNames

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      aria-label="Filter the audit log"
      className="flex flex-wrap items-end gap-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
    >
      <FormField id="audit-from" label="From">
        <input
          id="audit-from"
          type="date"
          value={draft.fromDate}
          max={draft.toDate || undefined}
          onChange={set('fromDate')}
          className={compactInputClass}
        />
      </FormField>
      <FormField id="audit-to" label="To">
        <input
          id="audit-to"
          type="date"
          value={draft.toDate}
          min={draft.fromDate || undefined}
          onChange={set('toDate')}
          className={compactInputClass}
        />
      </FormField>
      <FormField id="audit-user" label="User">
        <input
          id="audit-user"
          type="search"
          placeholder="Username"
          value={draft.user}
          onChange={set('user')}
          className={`${compactInputClass} w-40`}
        />
      </FormField>
      <FormField id="audit-action" label="Action">
        <select id="audit-action" value={draft.action} onChange={set('action')} className={compactInputClass}>
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {auditActionLabels[a]}
            </option>
          ))}
        </select>
      </FormField>
      <FormField id="audit-type" label="Record type">
        <select id="audit-type" value={draft.entityName} onChange={set('entityName')} className={compactInputClass}>
          <option value="">All records</option>
          {typeOptions.map((name) => (
            <option key={name} value={name}>
              {nameToWords(name)}
            </option>
          ))}
        </select>
      </FormField>
      <FormField id="audit-record-id" label="Record ID">
        <input
          id="audit-record-id"
          type="search"
          value={draft.entityId}
          onChange={set('entityId')}
          className={`${compactInputClass} w-28`}
        />
      </FormField>
      <div className="flex gap-2">
        <button type="submit" className={primaryButtonClass}>
          Apply filters
        </button>
        {canClear && (
          <button type="button" onClick={onClear} className={secondaryButtonClass}>
            Clear filters
          </button>
        )}
      </div>
    </form>
  )
}
