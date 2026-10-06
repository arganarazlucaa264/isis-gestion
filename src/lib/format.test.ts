import { describe, expect, it } from 'vitest'
import { addDaysISO, docNumber, parseDecimal, startOfMonthISO, todayISO } from '@/lib/format'

describe('parseDecimal', () => {
  it('acepta formato argentino y anglosajón', () => {
    expect(parseDecimal('1.234,50')).toBe(1234.5)
    expect(parseDecimal('1,234.50')).toBe(1234.5)
    expect(parseDecimal('1234,5')).toBe(1234.5)
    expect(parseDecimal('$ 99')).toBe(99)
  })
  it('devuelve NaN si no es un número', () => {
    expect(parseDecimal('abc')).toBeNaN()
    expect(parseDecimal('')).toBeNaN()
  })
})

describe('fechas', () => {
  it('todayISO usa la zona horaria de Buenos Aires', () => {
    // 02:30 UTC del 2/1 son las 23:30 del 1/1 en Buenos Aires
    expect(todayISO(new Date('2026-01-02T02:30:00Z'))).toBe('2026-01-01')
  })
  it('suma días y calcula inicio de mes', () => {
    expect(addDaysISO('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDaysISO('2026-03-01', -1)).toBe('2026-02-28')
    expect(startOfMonthISO('2026-05-17')).toBe('2026-05-01')
  })
  it('docNumber rellena con ceros', () => {
    expect(docNumber('V', 42)).toBe('V-000042')
  })
})
