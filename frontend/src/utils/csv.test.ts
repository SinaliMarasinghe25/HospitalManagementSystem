import { describe, expect, it } from 'vitest'
import { toCsv } from './csv'

// Report export (assumption A7).
describe('toCsv', () => {
  it('joins cells with commas and rows with Windows line ends', () => {
    expect(toCsv([['Name', 'Total'], ['Cash', 1500.5]])).toBe('Name,Total\r\nCash,1500.5')
  })

  it('quotes cells that contain a comma, a quote or a line break', () => {
    expect(toCsv([['Perera, Nimali', 'says "hi"', 'two\nlines']])).toBe('"Perera, Nimali","says ""hi""","two\nlines"')
  })

  it('leaves empty values empty', () => {
    expect(toCsv([[null, undefined, '']])).toBe(',,')
  })

  it('stops text from running as an Excel formula (CSV injection)', () => {
    expect(toCsv([['=1+1', '+94771234567', '@SUM(A1)', '-x']])).toBe("'=1+1,'+94771234567,'@SUM(A1),'-x")
  })

  it('keeps negative numbers as numbers', () => {
    expect(toCsv([[-12.5]])).toBe('-12.5')
  })
})
