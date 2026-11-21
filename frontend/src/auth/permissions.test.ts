// @vitest-environment node
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Permissions } from './permissions'

// The API's real permission file, read as plain text.
const policiesCs = readFileSync(new URL('../../../backend/Hms.Api/Authorization/Policies.cs', import.meta.url), 'utf8')

// permissions.ts must say the same as the API's Policies.cs. Otherwise a button appears that the API refuses
// (the user gets an error), or a button is missing for something the user may do.
// This test reads Policies.cs and compares every permission, so the two files can never drift apart.

// .AddPolicy(EditPatients, p => p.RequireRole(Roles.Administrator, Roles.Receptionist))
function apiPolicies(): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const match of policiesCs.matchAll(/\.AddPolicy\((\w+),\s*p\s*=>\s*p\.RequireRole\(([^)]*)\)\)/g)) {
    const name = match[1].charAt(0).toLowerCase() + match[1].slice(1) // EditPatients -> editPatients
    result[name] = match[2].split(',').map((role) => role.trim().replace('Roles.', ''))
  }
  return result
}

// Permissions that exist only in the browser, and API policies the browser does not need.
const browserOnly = ['pharmacyQueue']
const apiOnly = ['viewAuditLog']

describe('permissions.ts', () => {
  const api = apiPolicies()

  it('found the API policies', () => {
    expect(Object.keys(api).length).toBeGreaterThan(30)
  })

  for (const [name, roles] of Object.entries(Permissions)) {
    if (browserOnly.includes(name)) continue
    it(`${name} has the same roles as the API`, () => {
      expect(api[name], `${name} is not in Policies.cs`).toBeDefined()
      expect([...roles].sort()).toEqual([...api[name]].sort())
    })
  }

  it('has every API permission', () => {
    const missing = Object.keys(api).filter((name) => !(name in Permissions) && !apiOnly.includes(name))
    expect(missing).toEqual([])
  })
})
