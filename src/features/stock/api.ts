import { fetchAll, unwrap } from '@/lib/api'
import { rpc } from '@/lib/rpc'
import { supabase } from '@/lib/supabase'
import type { StockMovementType } from '@/types/db'

export interface MovementRow {
  id: number
  variant_id: string
  movement_type: StockMovementType
  quantity: number
  stock_before: number
  stock_after: number
  unit_cost: number | null
  reason: string | null
  notes: string | null
  reference_type: string | null
  reference_id: string | null
  created_at: string
  product_variants: {
    sku: string
    products: { name: string } | null
    colors: { name: string } | null
    sizes: { name: string } | null
  } | null
}

export interface MovementFilter {
  from?: string
  to?: string
  type?: StockMovementType | ''
  variantId?: string
  limit: number
}

export async function listMovements(f: MovementFilter): Promise<MovementRow[]> {
  let q = supabase
    .from('stock_movements')
    .select('*, product_variants(sku, products(name), colors(name), sizes(name))')
    .order('id', { ascending: false })
    .limit(f.limit)
  if (f.from) q = q.gte('created_at', `${f.from}T00:00:00-03:00`)
  if (f.to) q = q.lt('created_at', `${nextDay(f.to)}T00:00:00-03:00`)
  if (f.type) q = q.eq('movement_type', f.type)
  if (f.variantId) q = q.eq('variant_id', f.variantId)
  return unwrap(await q)
}

function nextDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

export type ManualAdjustType = Extract<
  StockMovementType,
  | 'adjustment_in'
  | 'adjustment_out'
  | 'damage_out'
  | 'theft_out'
  | 'internal_use_out'
  | 'initial_load'
>

export async function adjustStock(input: {
  variantId: string
  type: ManualAdjustType
  quantity: number
  reason: string
  notes: string | null
}): Promise<void> {
  await rpc('adjust_stock', {
    p_variant_id: input.variantId,
    p_type: input.type,
    p_quantity: input.quantity,
    p_reason: input.reason,
    p_notes: input.notes,
  })
}

/** Todos los movimientos de un rango (para exportar a Excel). */
export async function listAllMovements(from: string, to: string): Promise<MovementRow[]> {
  return fetchAll<MovementRow>((a, b) =>
    supabase
      .from('stock_movements')
      .select('*, product_variants(sku, products(name), colors(name), sizes(name))')
      .gte('created_at', `${from}T00:00:00-03:00`)
      .lt('created_at', `${nextDay(to)}T00:00:00-03:00`)
      .order('id', { ascending: false })
      .range(a, b),
  )
}
