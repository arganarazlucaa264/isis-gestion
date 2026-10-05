import { unwrap, unwrapAs } from '@/lib/api'
import { rpc } from '@/lib/rpc'
import { supabase } from '@/lib/supabase'
import type { Row } from '@/types/db'

export interface PaymentInput {
  payment_method_id: string
  amount: number
  amount_tendered?: number
  installments?: number
  reference?: string
}

export interface CartLine {
  variant_id: string
  quantity: number
  discount_amount: number
}

export const registerSale = (input: {
  items: CartLine[]
  payments: PaymentInput[]
  clientRequestId: string
  customerId: string | null
  generalDiscount: number
  notes: string | null
  sessionId: string | null
}) =>
  rpc('register_sale', {
    p_items: input.items,
    p_payments: input.payments,
    p_client_request_id: input.clientRequestId,
    p_customer_id: input.customerId,
    p_discount_amount: input.generalDiscount,
    p_notes: input.notes,
    p_session_id: input.sessionId,
  })

export const voidSale = (saleId: string, reason: string) =>
  rpc('void_sale', { p_sale_id: saleId, p_reason: reason })

export const registerReturn = (input: {
  saleId: string
  items: { sale_item_id: string; quantity: number }[]
  refundMethodId: string
  reason: string
  restock: boolean
}) =>
  rpc('register_return', {
    p_sale_id: input.saleId,
    p_items: input.items,
    p_refund_method_id: input.refundMethodId,
    p_reason: input.reason,
    p_restock: input.restock,
    p_session_id: null,
  })

export interface SaleRow extends Row<'sales'> {
  customers: { name: string } | null
}

export interface SaleDetail extends Row<'sales'> {
  customers: { name: string } | null
  sale_items: Row<'sale_items'>[]
  sale_payments: Row<'sale_payments'>[]
  sale_returns: (Row<'sale_returns'> & {
    sale_return_items: Row<'sale_return_items'>[]
    payment_methods: { name: string } | null
  })[]
}

export async function listSales(
  from: string,
  to: string,
  status: string,
  number: string,
): Promise<SaleRow[]> {
  const out: SaleRow[] = []
  for (let a = 0; ; a += 1000) {
    let q = supabase
      .from('sales')
      .select('*, customers(name)')
      .gte('created_at', `${from}T00:00:00-03:00`)
      .lt('created_at', `${nextDay(to)}T00:00:00-03:00`)
      .order('number', { ascending: false })
      .range(a, a + 999)
    if (status) q = q.eq('status', status)
    if (/^\d+$/.test(number)) q = q.eq('number', Number(number))
    const page = unwrap(await q) as unknown as SaleRow[]
    out.push(...page)
    if (page.length < 1000) return out
  }
}

function nextDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

export async function getSale(id: string): Promise<SaleDetail> {
  return unwrapAs<SaleDetail>(
    await supabase
      .from('sales')
      .select(
        '*, customers(name), sale_items(*), sale_payments(*), sale_returns(*, sale_return_items(*), payment_methods(name))',
      )
      .eq('id', id)
      .single(),
  )
}

export async function createCustomer(
  name: string,
  phone: string | null,
): Promise<Row<'customers'>> {
  return unwrap(await supabase.from('customers').insert({ name, phone }).select('*').single())
}
