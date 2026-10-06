import { ApiError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

type Fns = Database['public']['Functions']

/**
 * Llama a una función RPC de la base (todas las operaciones críticas son RPC transaccionales).
 * Los argumentos se arman en cada módulo `api.ts`; el retorno queda tipado por la base.
 */
export async function rpc<N extends keyof Fns>(
  name: N,
  args: Record<string, unknown> = {},
): Promise<Fns[N]['Returns']> {
  const { data, error } = await supabase.rpc(name, args as never)
  if (error) throw new ApiError(error)
  return data
}

const PAGE = 1000

/**
 * Como rpc(), pero para funciones que devuelven filas (RETURNS TABLE / SETOF): pide todas las páginas.
 * PostgREST/Supabase limita cada pedido a 1000 filas (db-max-rows) y trunca en silencio; sin esto,
 * un reporte con más de 1000 filas (p. ej. stock valorizado con muchas variantes) saldría incompleto.
 * La función SQL debe tener un ORDER BY determinístico.
 */
export async function rpcAll<N extends keyof Fns>(
  name: N,
  args: Record<string, unknown> = {},
): Promise<Fns[N]['Returns']> {
  const out: unknown[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.rpc(name, args as never).range(from, from + PAGE - 1)
    if (error) throw new ApiError(error)
    const rows: unknown[] = Array.isArray(data) ? data : []
    out.push(...rows)
    if (rows.length < PAGE) return out as Fns[N]['Returns']
  }
}
