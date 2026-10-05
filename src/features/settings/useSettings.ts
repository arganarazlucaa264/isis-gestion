import { useQuery } from '@tanstack/react-query'
import { unwrap } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/types/database'

export interface AppSettings {
  store_name: string
  currency: string
  timezone: string
  allow_negative_stock: boolean
  cashier_max_discount_pct: number
}

const DEFAULTS: AppSettings = {
  store_name: 'Isis',
  currency: 'ARS',
  timezone: 'America/Argentina/Buenos_Aires',
  allow_negative_stock: false,
  cashier_max_discount_pct: 10,
}

function parse(rows: { key: string; value: Json }[]): AppSettings {
  const out: AppSettings = { ...DEFAULTS }
  for (const r of rows) {
    if (r.key === 'store_name' && typeof r.value === 'string') out.store_name = r.value
    if (r.key === 'currency' && typeof r.value === 'string') out.currency = r.value
    if (r.key === 'timezone' && typeof r.value === 'string') out.timezone = r.value
    if (r.key === 'allow_negative_stock' && typeof r.value === 'boolean')
      out.allow_negative_stock = r.value
    if (r.key === 'cashier_max_discount_pct' && typeof r.value === 'number')
      out.cashier_max_discount_pct = r.value
  }
  return out
}

export const SETTINGS_KEY = ['app-settings'] as const

export function useSettings() {
  const query = useQuery({
    queryKey: SETTINGS_KEY,
    staleTime: 5 * 60_000,
    queryFn: async () => parse(unwrap(await supabase.from('app_settings').select('key,value'))),
  })
  return { ...query, settings: query.data ?? DEFAULTS }
}
