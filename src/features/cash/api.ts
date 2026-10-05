import { fetchAll, unwrap, unwrapAs } from '@/lib/api'
import { rpc } from '@/lib/rpc'
import { supabase } from '@/lib/supabase'
import type { CashMethodTotal, CashMovementKind, CashSessionView, Row } from '@/types/db'

export interface SessionWithUser extends CashSessionView {
  opener: { full_name: string } | null
  cash_registers: { name: string } | null
}

export interface CashMovementRow {
  id: number
  cash_session_id: string
  kind: CashMovementKind
  direction: 'in' | 'out'
  amount: number
  affects_physical_cash: boolean
  description: string | null
  reference_type: string | null
  reference_id: string | null
  created_at: string
  payment_methods: { name: string; code: string; is_cash: boolean } | null
}

export async function listOpenSessions(): Promise<CashSessionView[]> {
  return unwrap(
    await supabase
      .from('v_cash_sessions')
      .select('*')
      .eq('status', 'open')
      .order('opened_at', { ascending: false }),
  ) as unknown as CashSessionView[]
}

export async function listSessions(from: string, to: string): Promise<CashSessionView[]> {
  return fetchAll<CashSessionView>((a, b) =>
    supabase
      .from('v_cash_sessions')
      .select('*')
      .gte('opened_at', `${from}T00:00:00-03:00`)
      .lt('opened_at', `${nextDay(to)}T00:00:00-03:00`)
      .order('opened_at', { ascending: false })
      .order('id')
      .range(a, b),
  )
}

function nextDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

export async function getSession(id: string): Promise<CashSessionView> {
  return unwrapAs<CashSessionView>(
    await supabase.from('v_cash_sessions').select('*').eq('id', id).single(),
  )
}

export async function listMethodTotals(sessionId: string): Promise<CashMethodTotal[]> {
  return unwrap(
    await supabase
      .from('v_cash_method_totals')
      .select('*')
      .eq('session_id', sessionId)
      .order('sort_order'),
  ) as unknown as CashMethodTotal[]
}

export async function listSessionMovements(sessionId: string): Promise<CashMovementRow[]> {
  return unwrap(
    await supabase
      .from('cash_movements')
      .select('*, payment_methods(name, code, is_cash)')
      .eq('cash_session_id', sessionId)
      .order('id', { ascending: false }),
  ) as unknown as CashMovementRow[]
}

export interface ClosedTotal extends Row<'cash_session_totals'> {
  payment_methods: { name: string; code: string; is_cash: boolean; sort_order: number } | null
}

export async function listClosedTotals(sessionId: string): Promise<ClosedTotal[]> {
  return unwrap(
    await supabase
      .from('cash_session_totals')
      .select('*, payment_methods(name, code, is_cash, sort_order)')
      .eq('session_id', sessionId),
  )
}

export const openSession = (registerId: string, amount: number, notes: string | null) =>
  rpc('open_cash_session', { p_register_id: registerId, p_opening_amount: amount, p_notes: notes })

export const registerCashMovement = (input: {
  kind: 'income' | 'withdrawal'
  paymentMethodId: string
  amount: number
  description: string
  sessionId: string
}) =>
  rpc('register_cash_movement', {
    p_kind: input.kind,
    p_payment_method_id: input.paymentMethodId,
    p_amount: input.amount,
    p_description: input.description,
    p_session_id: input.sessionId,
  })

export const closeSession = (input: {
  sessionId: string
  countedCash: number
  notes: string | null
  reported: Record<string, number>
}) =>
  rpc('close_cash_session', {
    p_session_id: input.sessionId,
    p_counted_cash: input.countedCash,
    p_notes: input.notes,
    p_reported: input.reported,
  })

export const reopenSession = (sessionId: string, reason: string) =>
  rpc('reopen_cash_session', { p_session_id: sessionId, p_reason: reason })

/** Todos los movimientos de caja de un rango (para exportar). */
export async function listMovementsRange(
  from: string,
  to: string,
): Promise<(CashMovementRow & { cash_sessions: { number: number } | null })[]> {
  const out: (CashMovementRow & { cash_sessions: { number: number } | null })[] = []
  for (let a = 0; ; a += 1000) {
    const page = unwrap(
      await supabase
        .from('cash_movements')
        .select('*, payment_methods(name, code, is_cash), cash_sessions(number)')
        .gte('created_at', `${from}T00:00:00-03:00`)
        .lt('created_at', `${nextDay(to)}T00:00:00-03:00`)
        .order('id')
        .range(a, a + 999),
    ) as unknown as (CashMovementRow & { cash_sessions: { number: number } | null })[]
    out.push(...page)
    if (page.length < 1000) return out
  }
}
