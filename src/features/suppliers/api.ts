import { fetchAll, unwrap } from '@/lib/api'
import { rpc } from '@/lib/rpc'
import { supabase } from '@/lib/supabase'
import type { Row, StatementRow, SupplierBalance, SupplierLedgerType } from '@/types/db'

export async function listBalances(): Promise<SupplierBalance[]> {
  return fetchAll<SupplierBalance>((a, b) =>
    supabase.from('v_supplier_balances').select('*').order('name').order('supplier_id').range(a, b),
  )
}

export async function getBalance(id: string): Promise<SupplierBalance | null> {
  const rows = unwrap(
    await supabase.from('v_supplier_balances').select('*').eq('supplier_id', id),
  ) as unknown as SupplierBalance[]
  return rows[0] ?? null
}

export async function getSupplier(id: string): Promise<Row<'suppliers'>> {
  return unwrap(await supabase.from('suppliers').select('*').eq('id', id).single())
}

export async function listStatement(id: string): Promise<StatementRow[]> {
  return fetchAll<StatementRow>((a, b) =>
    supabase
      .from('v_supplier_statement')
      .select('*')
      .eq('supplier_id', id)
      .order('id', { ascending: false })
      .range(a, b),
  )
}

export interface SupplierPurchase extends Row<'purchases'> {
  supplier_name_ref?: never
}

export async function listSupplierPurchases(id: string): Promise<Row<'purchases'>[]> {
  return fetchAll<Row<'purchases'>>((a, b) =>
    supabase
      .from('purchases')
      .select('*')
      .eq('supplier_id', id)
      .order('purchase_date', { ascending: false })
      .order('number', { ascending: false })
      .range(a, b),
  )
}

export interface PaymentRowWithMethod extends Row<'supplier_payments'> {
  payment_methods: { name: string; is_cash: boolean } | null
  supplier_payment_allocations: { purchase_id: string; amount: number }[]
}

export async function listSupplierPayments(id: string): Promise<PaymentRowWithMethod[]> {
  return fetchAll<PaymentRowWithMethod>((a, b) =>
    supabase
      .from('supplier_payments')
      .select(
        '*, payment_methods(name, is_cash), supplier_payment_allocations(purchase_id, amount)',
      )
      .eq('supplier_id', id)
      .order('paid_at', { ascending: false })
      .order('id')
      .range(a, b),
  )
}

export async function listSupplierProducts(
  id: string,
): Promise<Pick<Row<'products'>, 'id' | 'code' | 'name' | 'active'>[]> {
  return unwrap(
    await supabase
      .from('products')
      .select('id,code,name,active')
      .eq('supplier_id', id)
      .order('name'),
  )
}

export const registerSupplierPayment = (i: {
  supplierId: string
  methodId: string
  amount: number
  reference: string | null
  notes: string | null
  allocations: { purchase_id: string; amount: number }[] | null
  fromRegister: boolean
  sessionId: string | null
}) =>
  rpc('register_supplier_payment', {
    p_supplier_id: i.supplierId,
    p_payment_method_id: i.methodId,
    p_amount: i.amount,
    p_paid_at: null,
    p_reference: i.reference,
    p_notes: i.notes,
    p_allocations: i.allocations,
    p_from_register: i.fromRegister,
    p_session_id: i.sessionId,
  })

export const voidSupplierPayment = (id: string, reason: string) =>
  rpc('void_supplier_payment', { p_payment_id: id, p_reason: reason })

export const addLedgerEntry = (
  supplierId: string,
  type: Extract<SupplierLedgerType, 'opening_balance' | 'adjustment'>,
  amount: number,
  notes: string,
) =>
  rpc('add_supplier_ledger_entry', {
    p_supplier_id: supplierId,
    p_type: type,
    p_amount: amount,
    p_notes: notes,
  })
