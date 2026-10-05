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
