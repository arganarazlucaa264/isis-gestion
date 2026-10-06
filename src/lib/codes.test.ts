import { describe, expect, it } from 'vitest'
import {
  classifyCode,
  isValidGtin,
  looksLikeGtin,
  normalizeEan,
  sameEan,
  suggestSku,
} from '@/lib/codes'

describe('isValidGtin', () => {
  it('valida EAN-13, EAN-8 y UPC-A', () => {
    expect(isValidGtin('4006381333931')).toBe(true)
    expect(isValidGtin('96385074')).toBe(true)
    expect(isValidGtin('036000291452')).toBe(true)
  })
  it('rechaza dígito verificador incorrecto, largo inválido y no numéricos', () => {
    expect(isValidGtin('4006381333932')).toBe(false)
    expect(isValidGtin('12345')).toBe(false)
    expect(isValidGtin('ABC12345')).toBe(false)
  })
})

describe('normalizeEan', () => {
  it('recupera ceros iniciales perdidos', () => {
    expect(normalizeEan('1234565')).toBe('01234565')
  })
  it('deja intacto un código válido y limpia espacios', () => {
    expect(normalizeEan(' 4006381333931 ')).toBe('4006381333931')
  })
  it('devuelve null si no hay forma de validarlo', () => {
    expect(normalizeEan('1234')).toBeNull()
    expect(normalizeEan('hola')).toBeNull()
  })
})

describe('sameEan', () => {
  it('ignora ceros a la izquierda', () => {
    expect(sameEan('036000291452', '0036000291452')).toBe(true)
    expect(sameEan('4006381333931', '4006381333932')).toBe(false)
  })
})

describe('classifyCode', () => {
  it('distingue un código escaneado de un texto', () => {
    expect(looksLikeGtin('4006381333931')).toBe(true)
    expect(classifyCode('remera negra')).toBe('text')
    expect(classifyCode('4006381333931')).toBe('ean')
  })
})

describe('suggestSku', () => {
  it('arma MODELO-COLOR-TALLE sin tildes ni espacios', () => {
    expect(suggestSku('rem-01', 'Marrón claro', 'M')).toBe('REM-01-MARRONCLARO-M')
  })
})
