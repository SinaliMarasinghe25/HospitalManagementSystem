import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Pagination } from './Pagination'

// The bar under every paged list (step 26).
describe('Pagination', () => {
  it('shows the total and the page, e.g. "47 requests, page 1 of 3"', () => {
    render(<Pagination totalCount={47} page={1} pageSize={20} noun="request" onPageChange={() => {}} />)

    expect(screen.getByText('47 requests, page 1 of 3')).toBeInTheDocument()
  })

  it('uses the singular for one row and the given plural', () => {
    const { rerender } = render(
      <Pagination totalCount={1} page={1} pageSize={20} noun="entry" nounPlural="entries" onPageChange={() => {}} />,
    )
    expect(screen.getByText('1 entry, page 1 of 1')).toBeInTheDocument()

    rerender(<Pagination totalCount={2} page={1} pageSize={20} noun="entry" nounPlural="entries" onPageChange={() => {}} />)
    expect(screen.getByText('2 entries, page 1 of 1')).toBeInTheDocument()
  })

  it('disables Previous on the first page and Next on the last page', () => {
    const { rerender } = render(<Pagination totalCount={45} page={1} pageSize={20} noun="patient" onPageChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()

    rerender(<Pagination totalCount={45} page={3} pageSize={20} noun="patient" onPageChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  it('asks for the next and previous page', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(<Pagination totalCount={100} page={2} pageSize={20} noun="patient" onPageChange={onPageChange} />)

    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Previous' }))

    expect(onPageChange.mock.calls).toEqual([[3], [1]])
  })

  it('shows nothing for an empty list', () => {
    const { container } = render(<Pagination totalCount={0} page={1} pageSize={20} noun="patient" onPageChange={() => {}} />)

    expect(container).toBeEmptyDOMElement()
  })
})
