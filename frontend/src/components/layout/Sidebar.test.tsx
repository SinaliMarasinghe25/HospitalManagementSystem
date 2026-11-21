import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Roles } from '../../auth/roles'
import { renderWithAuth } from '../../test/renderWithAuth'
import { Sidebar } from './Sidebar'

// NFR-USA-03: the sidebar shows only the modules the user's roles can use.
function menuItems() {
  return screen.getAllByRole('link').map((link) => link.textContent)
}

describe('Sidebar', () => {
  it('shows a receptionist the front-desk modules only', () => {
    renderWithAuth(<Sidebar />, { roles: [Roles.Receptionist] })

    expect(menuItems()).toEqual([
      'Dashboard', 'Patients', 'Doctors', 'Appointments', 'Admissions', 'Billing', 'Staff', 'Reports',
    ])
  })

  it('hides clinical modules and the audit log from an accountant', () => {
    renderWithAuth(<Sidebar />, { roles: [Roles.Accountant] })

    expect(screen.getByRole('link', { name: 'Billing' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Pharmacy' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Patients' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Medical Records' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Audit Log' })).not.toBeInTheDocument()
  })

  it('shows the audit log to an administrator', () => {
    renderWithAuth(<Sidebar />, { roles: [Roles.Administrator] })

    expect(screen.getByRole('link', { name: 'Audit Log' })).toHaveAttribute('href', '/audit-log')
  })

  it('combines the modules of a user with two roles', () => {
    renderWithAuth(<Sidebar />, { roles: [Roles.Pharmacist, Roles.LaboratoryStaff] })

    expect(screen.getByRole('link', { name: 'Pharmacy' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Laboratory' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Billing' })).not.toBeInTheDocument()
  })
})
