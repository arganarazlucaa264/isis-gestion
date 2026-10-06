import { unwrap } from '@/lib/api'
import { rpc } from '@/lib/rpc'
import { supabase } from '@/lib/supabase'
import type { Row } from '@/types/db'

export interface ExpenseRow extends Row<'expenses'> {
  expense_categories: { name: string } | null
  payment_methods: { name: string; is_cash: boolean } | null
  suppliers: { name: string } | null
}

export async function listExpenses(
  from: string,
  to: string,
  categoryId?: string,
): Promise<ExpenseRow[]> {
  const out: ExpenseRow[] = []
  for (let a = 0; ; a += 1000) {
    let q = supabase
      .from('expenses')
      .select('*, expense_categories(name), payment_methods(name, is_cash), suppliers(name)')
      .gte('expense_date', from)
      .lte('expense_date', to)
      .order('expense_date', { ascending: false })
      .order('number', { ascending: false })
      .range(a, a + 999)
    if (categoryId) q = q.eq('category_id', categoryId)
    const page = unwrap(await q) as unknown as ExpenseRow[]
    out.push(...page)
    if (page.length < 1000) return out
  }
}

export interface ExpenseInput {
  date: string
  categoryId: string
  description: string
  amount: number
  paymentMethodId: string
  paidFromRegister: boolean
  supplierId: string | null
  receiptRef: string | null
  notes: string | null
  sessionId: string | null
}

export const registerExpense = (i: ExpenseInput) =>
  rpc('register_expense', {
    p_expense_date: i.date,
    p_category_id: i.categoryId,
    p_description: i.description,
    p_amount: i.amount,
    p_payment_method_id: i.paymentMethodId,
    p_paid_from_register: i.paidFromRegister,
    p_supplier_id: i.supplierId,
    p_receipt_ref: i.receiptRef,
    p_notes: i.notes,
    p_session_id: i.sessionId,
  })

export const voidExpense = (id: string, reason: string) =>
  rpc('void_expense', { p_expense_id: id, p_reason: reason })
