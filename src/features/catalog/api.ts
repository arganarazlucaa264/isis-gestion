import { fetchAll, unwrap } from '@/lib/api'
import { rpc } from '@/lib/rpc'
import { supabase } from '@/lib/supabase'
import type { Row, Variant } from '@/types/db'

export interface VariantFilter {
  search?: string
  categoryId?: string
  productId?: string
  includeInactive?: boolean
}

/** Escapa lo que rompe la sintaxis de filtros .or() de PostgREST. */
function safeTerm(term: string): string {
  return term.replace(/[,()%*\\]/g, ' ').trim()
}

export async function listVariants(filter: VariantFilter = {}): Promise<Variant[]> {
  const term = safeTerm(filter.search ?? '')
  return fetchAll<Variant>((from, to) => {
    let q = supabase.from('v_variants').select('*')
    if (!filter.includeInactive) q = q.eq('active', true).eq('product_active', true)
    if (filter.productId) q = q.eq('product_id', filter.productId)
    if (filter.categoryId) q = q.eq('category_id', filter.categoryId)
    if (term) {
      q = q.or(
        ['product_name', 'product_code', 'sku', 'color_name', 'ean']
          .map((c) => `${c}.ilike.%${term}%`)
          .join(','),
      )
    }
    return q.order('product_name').order('color_name').order('size_order').range(from, to)
  })
}

export async function getProduct(id: string): Promise<Row<'products'>> {
  return unwrap(await supabase.from('products').select('*').eq('id', id).single())
}

export interface ProductInput {
  code: string
  name: string
  description: string | null
  category_id: string | null
  brand_id: string | null
  supplier_id: string | null
  active: boolean
}

export async function createProduct(input: ProductInput): Promise<Row<'products'>> {
  return unwrap(await supabase.from('products').insert(input).select('*').single())
}

export async function updateProduct(id: string, input: ProductInput): Promise<Row<'products'>> {
  return unwrap(await supabase.from('products').update(input).eq('id', id).select('*').single())
}

export interface VariantCost {
  variant_id: string
  last_cost: number
  avg_cost: number
}

/** Costos: solo dueño/encargado/depósito/solo lectura (RLS). Para otros roles devuelve vacío. */
export async function listCosts(productId: string): Promise<VariantCost[]> {
  const variants = unwrap(
    await supabase.from('product_variants').select('id').eq('product_id', productId),
  )
  const ids = variants.map((v) => v.id)
  if (ids.length === 0) return []
  return unwrap(
    await supabase
      .from('variant_costs')
      .select('variant_id,last_cost,avg_cost')
      .in('variant_id', ids),
  )
}

export interface NewVariantInput {
  productId: string
  colorId: string
  sizeId: string
  sku: string
  ean: string | null
  price: number
  cost: number
  minStock: number
  initialStock: number
}

export async function createVariant(i: NewVariantInput): Promise<Row<'product_variants'>> {
  return rpc('create_variant', {
    p_product_id: i.productId,
    p_color_id: i.colorId,
    p_size_id: i.sizeId,
    p_sku: i.sku,
    p_ean: i.ean,
    p_price: i.price,
    p_cost: i.cost,
    p_min_stock: i.minStock,
    p_initial_stock: i.initialStock,
  })
}

export interface VariantUpdate {
  sku: string
  ean: string | null
  price: number
  min_stock: number
  active: boolean
}

export async function updateVariant(
  id: string,
  input: VariantUpdate,
): Promise<Row<'product_variants'>> {
  return unwrap(
    await supabase.from('product_variants').update(input).eq('id', id).select('*').single(),
  )
}

export async function setVariantCost(variantId: string, cost: number): Promise<void> {
  await rpc('set_variant_cost', { p_variant_id: variantId, p_cost: cost })
}

export async function listPriceHistory(variantId: string): Promise<Row<'price_history'>[]> {
  return unwrap(
    await supabase
      .from('price_history')
      .select('*')
      .eq('variant_id', variantId)
      .order('changed_at', { ascending: false }),
  )
}

export async function listCostHistory(variantId: string): Promise<Row<'cost_history'>[]> {
  return unwrap(
    await supabase
      .from('cost_history')
      .select('*')
      .eq('variant_id', variantId)
      .order('changed_at', { ascending: false }),
  )
}

export type MasterTable = 'categories' | 'brands' | 'colors' | 'sizes'

export async function saveMaster(
  table: MasterTable,
  id: string | null,
  values: Record<string, unknown>,
): Promise<void> {
  if (id) {
    unwrap(
      await supabase
        .from(table)
        .update(values as never)
        .eq('id', id)
        .select('id')
        .single(),
    )
  } else {
    unwrap(
      await supabase
        .from(table)
        .insert(values as never)
        .select('id')
        .single(),
    )
  }
}

export async function saveSupplier(
  id: string | null,
  values: Record<string, unknown>,
): Promise<Row<'suppliers'>> {
  if (id)
    return unwrap(
      await supabase
        .from('suppliers')
        .update(values as never)
        .eq('id', id)
        .select('*')
        .single(),
    )
  return unwrap(
    await supabase
      .from('suppliers')
      .insert(values as never)
      .select('*')
      .single(),
  )
}

/** Búsqueda exacta por EAN o SKU (la misma que usarán el lector USB y la cámara). */
export async function findVariantByCode(code: string): Promise<Variant | null> {
  const rows = (await rpc('find_variant_by_code', { p_code: code })) as unknown as Variant[]
  return rows[0] ?? null
}

/** Búsqueda libre para el POS (nombre, modelo, SKU, color, EAN). */
export async function searchVariants(query: string, limit = 30): Promise<Variant[]> {
  return (await rpc('search_variants', { p_query: query, p_limit: limit })) as unknown as Variant[]
}
