import { roundMoney } from '@/lib/money'
import type { Variant } from '@/types/db'
import type { CartLine, PaymentInput } from '@/features/pos/api'

export interface CartItem {
  variant: Variant
  quantity: number
  /** Descuento de la línea, en pesos. */
  discount: number
}

export interface CartTotals {
  subtotal: number
  lineDiscounts: number
  generalDiscount: number
  discountTotal: number
  total: number
  /** Descuento total como % del subtotal. */
  discountPct: number
}

/** Suma 1 (o `qty`) unidad de la variante. Devuelve el mismo array si supera el stock permitido. */
export function addToCart(
  items: CartItem[],
  variant: Variant,
  opts: { qty?: number; allowNegative?: boolean } = {},
): { items: CartItem[]; error: string | null } {
  const qty = opts.qty ?? 1
  const existing = items.find((i) => i.variant.variant_id === variant.variant_id)
  const next = (existing?.quantity ?? 0) + qty
  if (!opts.allowNegative && next > variant.stock) {
    return {
      items,
      error: variant.stock <= 0 ? 'Sin stock disponible' : `Stock disponible: ${variant.stock}`,
    }
  }
  if (existing) {
    return {
      items: items.map((i) => (i === existing ? { ...i, quantity: next } : i)),
      error: null,
    }
  }
  return { items: [...items, { variant, quantity: qty, discount: 0 }], error: null }
}

export function lineGross(item: CartItem): number {
  return roundMoney(item.variant.price * item.quantity)
}

export function cartTotals(items: CartItem[], generalDiscount: number): CartTotals {
  const subtotal = roundMoney(items.reduce((s, i) => s + lineGross(i), 0))
  const lineDiscounts = roundMoney(items.reduce((s, i) => s + i.discount, 0))
  const general = roundMoney(Math.max(0, generalDiscount))
  const discountTotal = roundMoney(lineDiscounts + general)
  const total = roundMoney(subtotal - discountTotal)
  return {
    subtotal,
    lineDiscounts,
    generalDiscount: general,
    discountTotal,
    total,
    discountPct: subtotal > 0 ? (discountTotal * 100) / subtotal : 0,
  }
}

/** ¿El carrito es consistente? Devuelve el primer problema encontrado o null. */
export function validateCart(items: CartItem[], totals: CartTotals): string | null {
  if (items.length === 0) return 'El carrito está vacío'
  for (const i of items) {
    if (i.discount < 0) return 'Hay un descuento negativo'
    if (i.discount > lineGross(i)) return `El descuento de ${i.variant.sku} supera su importe`
  }
  if (totals.generalDiscount > totals.subtotal - totals.lineDiscounts)
    return 'El descuento general supera el total'
  if (totals.total <= 0) return 'El total debe ser mayor a 0'
  return null
}

export function toCartLines(items: CartItem[]): CartLine[] {
  return items.map((i) => ({
    variant_id: i.variant.variant_id,
    quantity: i.quantity,
    discount_amount: i.discount,
  }))
}

// ---------------------------------------------------------------------------
// Pagos
// ---------------------------------------------------------------------------
export interface PaymentRow {
  id: string
  methodId: string
  code: string
  isCash: boolean
  /** Monto aplicado a la venta (texto del input). */
  amount: string
  /** Efectivo recibido (solo efectivo). */
  tendered: string
  installments: string
  reference: string
}

export interface PaymentSummary {
  paid: number
  remaining: number
  change: number
  balanced: boolean
}

export function paymentSummary(
  rows: PaymentRow[],
  total: number,
  parse: (s: string) => number,
): PaymentSummary {
  const paid = roundMoney(
    rows.reduce((s, r) => s + (Number.isNaN(parse(r.amount)) ? 0 : parse(r.amount)), 0),
  )
  const change = roundMoney(
    rows.reduce((s, r) => {
      if (!r.isCash) return s
      const amount = parse(r.amount)
      const tendered = r.tendered.trim() === '' ? amount : parse(r.tendered)
      return (
        s + (Number.isNaN(tendered) || Number.isNaN(amount) ? 0 : Math.max(0, tendered - amount))
      )
    }, 0),
  )
  const remaining = roundMoney(total - paid)
  return { paid, remaining, change, balanced: remaining === 0 && rows.length > 0 }
}

/** Valida cada fila de pago; devuelve el primer error o null. */
export function validatePayments(rows: PaymentRow[], parse: (s: string) => number): string | null {
  for (const r of rows) {
    const amount = parse(r.amount)
    if (Number.isNaN(amount) || amount <= 0) return 'Cada pago debe tener un monto mayor a 0'
    if (r.isCash && r.tendered.trim() !== '') {
      const tendered = parse(r.tendered)
      if (Number.isNaN(tendered) || tendered < amount)
        return 'El efectivo recibido no puede ser menor al monto'
    }
  }
  return null
}

export function toPaymentInputs(rows: PaymentRow[], parse: (s: string) => number): PaymentInput[] {
  return rows.map((r) => {
    const amount = parse(r.amount)
    const input: PaymentInput = { payment_method_id: r.methodId, amount }
    if (r.isCash && r.tendered.trim() !== '') input.amount_tendered = parse(r.tendered)
    if (r.code === 'credit' && r.installments.trim() !== '')
      input.installments = Number(r.installments)
    if (r.reference.trim() !== '') input.reference = r.reference.trim()
    return input
  })
}
