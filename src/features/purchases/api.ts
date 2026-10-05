import { unwrap, unwrapAs } from '@/lib/api'
import { rpc } from '@/lib/rpc'
import { supabase } from '@/lib/supabase'
import type { Row } from '@/types/db'

export interface PurchaseListRow extends Row<'purchases'> {
  suppliers: { name: string } | null
}

export interface PurchaseFull extends Row<'purchases'> {
  suppliers: { name: string } | null
  purchase_items: Row<'purchase_items'>[]
}

export async function listPurchases(
  from: string,
  to: string,
  status: string,
  supplierId: string,
): Promise<PurchaseListRow[]> {
  const out: PurchaseListRow[] = []
  for (let a = 0; ; a += 1000) {
    let q = supabase
      .from('purchases')
      .select('*, suppliers(name)')
      .gte('purchase_date', from)
      .lte('purchase_date', to)
      .order('number', { ascending: false })
      .range(a, a + 999)
    if (status) q = q.eq('status', status)
    if (supplierId) q = q.eq('supplier_id', supplierId)
    const page = unwrap(await q) as unknown as PurchaseListRow[]
    out.push(...page)
    if (page.length < 1000) return out
  }
}

export async function getPurchase(id: string): Promise<PurchaseFull> {
  return unwrapAs<PurchaseFull>(
    await supabase
      .from('purchases')
      .select('*, suppliers(name), purchase_items(*)')
      .eq('id', id)
      .single(),
  )
}

export interface PurchasePaymentRow {
  amount: number
  supplier_payments: {
    number: number
    paid_at: string
    voided_at: string | null
    reference: string | null
    payment_methods: { name: string } | null
  } | null
}

export async function listPurchasePayments(purchaseId: string): Promise<PurchasePaymentRow[]> {
  return unwrap(
    await supabase
      .from('supplier_payment_allocations')
      .select(
        'amount, supplier_payments(number, paid_at, voided_at, reference, payment_methods(name))',
      )
      .eq('purchase_id', purchaseId),
  )
}

export async function getLastCost(variantId: string): Promise<number> {
  const rows = unwrap(
    await supabase.from('variant_costs').select('last_cost').eq('variant_id', variantId),
  )
  return rows[0]?.last_cost ?? 0
}

export interface SavePurchaseInput {
  purchaseId: string | null
  supplierId: string
  invoiceNumber: string | null
  purchaseDate: string
  dueDate: string | null
  discount: number
  tax: number
  notes: string | null
  items: { variant_id: string; quantity: number; unit_cost: number }[]
}

export const savePurchase = (i: SavePurchaseInput) =>
  rpc('save_purchase', {
    p_purchase_id: i.purchaseId,
    p_supplier_id: i.supplierId,
    p_invoice_number: i.invoiceNumber,
    p_purchase_date: i.purchaseDate,
    p_due_date: i.dueDate,
    p_discount_amount: i.discount,
    p_tax_amount: i.tax,
    p_notes: i.notes,
    p_items: i.items,
  })

export interface ReceivePayment {
  payment_method_id: string
  amount: number
  reference?: string
  from_register: boolean
}

export const receivePurchase = (id: string, payment: ReceivePayment | null) =>
  rpc('receive_purchase', { p_purchase_id: id, p_payment: payment })

export const cancelPurchase = (id: string, reason: string) =>
  rpc('cancel_purchase', { p_purchase_id: id, p_reason: reason })
