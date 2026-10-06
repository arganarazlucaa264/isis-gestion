import { unwrap } from '@/lib/api'
import { rpc } from '@/lib/rpc'
import { supabase } from '@/lib/supabase'
import type { Row } from '@/types/db'

export type InventoryCount = Row<'inventory_counts'>

export interface InventoryItem {
  id: string
  count_id: string
  variant_id: string
  expected_qty: number
  counted_qty: number | null
  counted_at: string | null
  system_qty_at_count: number | null
  difference: number | null
  notes: string | null
  product_variants: {
    sku: string
    ean: string | null
    products: { name: string; code: string } | null
    colors: { name: string } | null
    sizes: { name: string } | null
  } | null
}

export const STATUS_LABEL: Record<string, string> = {
  counting: 'Contando',
  review: 'En revisión',
  applied: 'Aplicado',
  cancelled: 'Cancelado',
}

export async function listInventories(): Promise<InventoryCount[]> {
  return unwrap(
    await supabase.from('inventory_counts').select('*').order('started_at', { ascending: false }),
  )
}

export async function getInventory(id: string): Promise<InventoryCount> {
  return unwrap(await supabase.from('inventory_counts').select('*').eq('id', id).single())
}

export async function listItems(countId: string): Promise<InventoryItem[]> {
  const out: InventoryItem[] = []
  for (let from = 0; ; from += 1000) {
    const page = unwrap(
      await supabase
        .from('inventory_count_items')
        .select('*, product_variants(sku, ean, products(name, code), colors(name), sizes(name))')
        .eq('count_id', countId)
        .order('id')
        .range(from, from + 999),
    ) as unknown as InventoryItem[]
    out.push(...page)
    if (page.length < 1000) return out
  }
}

export async function createInventory(input: {
  name: string
  scope: 'all' | 'category' | 'selection'
  categoryId: string | null
  variantIds: string[] | null
  notes: string | null
}): Promise<InventoryCount> {
  return rpc('create_inventory_count', {
    p_name: input.name,
    p_scope: input.scope,
    p_category_id: input.categoryId,
    p_variant_ids: input.variantIds,
    p_notes: input.notes,
  })
}

export async function recordCount(input: {
  countId: string
  variantId: string
  quantity: number
  mode: 'set' | 'add'
}): Promise<void> {
  await rpc('record_inventory_count', {
    p_count_id: input.countId,
    p_variant_id: input.variantId,
    p_counted_qty: input.quantity,
    p_mode: input.mode,
    p_notes: null,
  })
}

export interface BulkResult {
  updated: number
  not_found: string[]
  invalid: string[]
}

export async function recordCountsBulk(
  countId: string,
  rows: { ean?: string; sku?: string; variant_id?: string; counted_qty: string }[],
  mode: 'set' | 'add' = 'set',
): Promise<BulkResult> {
  const result = (await rpc('record_inventory_counts_bulk', {
    p_count_id: countId,
    p_rows: rows,
    p_mode: mode,
  })) as unknown as BulkResult
  return result
}

export const submitReview = (id: string) => rpc('submit_inventory_review', { p_count_id: id })
export const reopenCount = (id: string) => rpc('reopen_inventory_count', { p_count_id: id })
export const applyCount = (id: string) => rpc('apply_inventory_count', { p_count_id: id })
export const cancelCount = (id: string, reason: string) =>
  rpc('cancel_inventory_count', { p_count_id: id, p_reason: reason })
