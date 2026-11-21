// Matches PagedResult<T> in the API: one page of a longer list.
export type PagedResult<T> = {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
}
