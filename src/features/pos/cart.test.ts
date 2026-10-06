import { describe, expect, it } from 'vitest'
import {
  addToCart,
  cartTotals,
  paymentSummary,
  toPaymentInputs,
  validateCart,
  validatePayments,
  type CartItem,
  type PaymentRow,
} from '@/features/pos/cart'
import { parseDecimal } from '@/lib/format'
import type { Variant } from '@/types/db'

function variant(over: Partial<Variant> = {}): Variant {
  return {
    variant_id: 'v1',
    sku: 'REM-N-M',
    ean: null,
    price: 1000,
    min_stock: 0,
    active: true,
    product_id: 'p1',
    product_code: 'REM',
    product_name: 'Remera',
    product_active: true,
    category_id: null,
    category_name: null,
    brand_id: null,
    brand_name: null,
    supplier_id: null,
    color_id: 'c',
    color_name: 'Negro',
    color_hex: null,
    size_id: 's',
    size_name: 'M',
    size_order: 1,
    stock: 3,
    ...over,
  }
}

describe('carrito', () => {
  it('agrega y acumula cantidades', () => {
    const a = addToCart([], variant())
    const b = addToCart(a.items, variant())
    expect(b.items).toHaveLength(1)
    expect(b.items[0]?.quantity).toBe(2)
  })
  it('no supera el stock disponible', () => {
    const r = addToCart([{ variant: variant(), quantity: 3, discount: 0 }], variant())
    expect(r.error).toBe('Stock disponible: 3')
    expect(r.items[0]?.quantity).toBe(3)
  })
  it('avisa si no hay stock', () => {
    expect(addToCart([], variant({ stock: 0 })).error).toBe('Sin stock disponible')
  })
  it('permite superar el stock si la configuración lo habilita', () => {
    expect(addToCart([], variant({ stock: 0 }), { allowNegative: true }).error).toBeNull()
  })
})

describe('totales', () => {
  const items: CartItem[] = [
    { variant: variant({ price: 1000 }), quantity: 2, discount: 100 },
    { variant: variant({ variant_id: 'v2', sku: 'X', price: 2500.5 }), quantity: 1, discount: 0 },
  ]
  it('calcula subtotal, descuentos y total', () => {
    const t = cartTotals(items, 50)
    expect(t.subtotal).toBe(4500.5)
    expect(t.discountTotal).toBe(150)
    expect(t.total).toBe(4350.5)
    expect(t.discountPct).toBeCloseTo(3.33, 1)
  })
  it('valida el carrito', () => {
    expect(validateCart([], cartTotals([], 0))).toBe('El carrito está vacío')
    expect(validateCart(items, cartTotals(items, 0))).toBeNull()
    const bad: CartItem[] = [{ variant: variant(), quantity: 1, discount: 5000 }]
    expect(validateCart(bad, cartTotals(bad, 0))).toMatch(/supera su importe/)
  })
})

describe('pagos', () => {
  const cash: PaymentRow = {
    id: '1',
    methodId: 'm1',
    code: 'cash',
    isCash: true,
    amount: '1000',
    tendered: '5000',
    installments: '',
    reference: '',
  }
  const transfer: PaymentRow = {
    id: '2',
    methodId: 'm2',
    code: 'transfer',
    isCash: false,
    amount: '1.500,50',
    tendered: '',
    installments: '',
    reference: 'CBU 1',
  }

  it('calcula pagado, pendiente y vuelto (el vuelto no cuenta como pago)', () => {
    const s = paymentSummary([cash, transfer], 2500.5, parseDecimal)
    expect(s.paid).toBe(2500.5)
    expect(s.remaining).toBe(0)
    expect(s.change).toBe(4000)
    expect(s.balanced).toBe(true)
  })
  it('detecta que falta cobrar', () => {
    const s = paymentSummary([cash], 2500, parseDecimal)
    expect(s.remaining).toBe(1500)
    expect(s.balanced).toBe(false)
  })
  it('valida montos y efectivo recibido', () => {
    expect(validatePayments([cash, transfer], parseDecimal)).toBeNull()
    expect(validatePayments([{ ...cash, tendered: '500' }], parseDecimal)).toMatch(/recibido/)
    expect(validatePayments([{ ...cash, amount: '' }], parseDecimal)).toMatch(/mayor a 0/)
  })
  it('arma el payload para la RPC', () => {
    const inputs = toPaymentInputs(
      [cash, { ...transfer, code: 'credit', installments: '3' }],
      parseDecimal,
    )
    expect(inputs[0]).toEqual({ payment_method_id: 'm1', amount: 1000, amount_tendered: 5000 })
    expect(inputs[1]).toEqual({
      payment_method_id: 'm2',
      amount: 1500.5,
      installments: 3,
      reference: 'CBU 1',
    })
  })
})
