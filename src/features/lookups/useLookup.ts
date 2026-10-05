import { useQuery } from '@tanstack/react-query'
import { unwrap } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import type { Row } from '@/types/db'

export type LookupTable =
  | 'categories'
  | 'brands'
  | 'colors'
  | 'sizes'
  | 'suppliers'
  | 'payment_methods'
  | 'cash_registers'
  | 'expense_categories'
  | 'customers'

const ORDER: Record<LookupTable, string> = {
  categories: 'name',
  brands: 'name',
  colors: 'name',
  sizes: 'sort_order',
  suppliers: 'name',
  payment_methods: 'sort_order',
  cash_registers: 'name',
  expense_categories: 'name',
  customers: 'name',
}

/** Tablas maestras chicas, cacheadas. Incluye inactivas (la UI filtra según el caso). */
export function useLookup<T extends LookupTable>(table: T) {
  return useQuery({
    queryKey: ['lookup', table],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Row<T>[]> =>
      unwrap(await supabase.from(table).select('*').order(ORDER[table])) as unknown as Row<T>[],
  })
}

export const lookupKey = (table: LookupTable) => ['lookup', table] as const
