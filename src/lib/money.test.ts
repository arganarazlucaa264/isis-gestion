import { describe, expect, it } from 'vitest'
import { formatMoney, roundMoney } from '@/lib/money'

describe('roundMoney', () => {
  it('redondea a 2 decimales', () => {
    expect(roundMoney(1.005)).toBe(1.01)
    expect(roundMoney(10.1 + 0.2)).toBe(10.3)
  })
})

describe('formatMoney', () => {
  it('formatea en pesos argentinos', () => {
    expect(formatMoney(1234.5)).toMatch(/1\.234,50/)
  })
})
