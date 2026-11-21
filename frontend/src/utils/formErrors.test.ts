import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/client'
import { allErrors, errorsByField, firstError } from './formErrors'

describe('errorsByField', () => {
  it('turns API field names into form field names, keeping the first message', () => {
    expect(
      errorsByField({
        FirstName: ['First name is required.', 'Too long.'],
        'Doctor.LicenseNumber': ['Already used.'],
        '$.dateOfBirth': ['Not a date.'],
      }),
    ).toEqual({
      firstName: 'First name is required.',
      'doctor.licenseNumber': 'Already used.',
      dateOfBirth: 'Not a date.',
    })
  })
})

describe('allErrors and firstError', () => {
  it('lists every field problem from the API', () => {
    const error = new ApiError(400, 'One or more validation errors occurred.', {
      Amount: ['The amount is more than the balance due.'],
      ReferenceNumber: ['Enter the card slip reference.'],
    })

    expect(allErrors(error, 'fallback')).toEqual([
      'The amount is more than the balance due.',
      'Enter the card slip reference.',
    ])
    expect(firstError(error, 'fallback')).toBe('The amount is more than the balance due.')
  })

  it('uses the API title when there are no field problems', () => {
    expect(allErrors(new ApiError(409, 'Already dispensed.'), 'fallback')).toEqual(['Already dispensed.'])
  })

  it('uses the fallback when the API did not answer', () => {
    expect(firstError(new TypeError('Failed to fetch'), 'Could not save.')).toBe('Could not save.')
  })
})
