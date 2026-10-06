import { describe, expect, it } from 'vitest'
import { toUserMessage } from '@/lib/errors'

describe('toUserMessage', () => {
  it('deja pasar los mensajes de negocio en español', () => {
    expect(
      toUserMessage({
        code: '23514',
        message: 'Stock insuficiente para REM-01 (disponible 1, pedido 2)',
      }),
    ).toMatch(/Stock insuficiente/)
  })
  it('traduce SKU y EAN duplicados', () => {
    expect(
      toUserMessage({
        code: '23505',
        message: 'duplicate key value violates unique constraint "product_variants_sku_uidx"',
      }),
    ).toBe('Ya existe una variante con ese SKU')
    expect(
      toUserMessage({
        code: '23505',
        message: 'duplicate key value violates unique constraint "product_variants_ean_uidx"',
      }),
    ).toBe('Ese EAN ya pertenece a otra variante')
  })
  it('traduce permisos denegados', () => {
    expect(toUserMessage({ code: '42501', message: 'permission denied for table profiles' })).toBe(
      'No tenés permiso para realizar esta acción',
    )
    expect(toUserMessage({ code: '42501', message: 'Permiso insuficiente' })).toBe(
      'Permiso insuficiente',
    )
  })
})
