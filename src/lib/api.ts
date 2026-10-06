import { ApiError } from '@/lib/errors'

interface DbResult<T> {
  data: T | null
  error: { message: string; code?: string; details?: string } | null
}

/** Devuelve los datos o lanza un ApiError con un mensaje legible. */
export function unwrap<T>(result: DbResult<T>): T {
  if (result.error) throw new ApiError(result.error)
  if (result.data === null) throw new ApiError({ message: 'La operación no devolvió datos' })
  return result.data
}

/** Igual que unwrap pero permite null (maybeSingle). */
export function unwrapNullable<T>(result: DbResult<T>): T | null {
  if (result.error) throw new ApiError(result.error)
  return result.data
}

const PAGE = 1000

/** Recorre todas las páginas de una consulta (PostgREST limita a 1000 filas por pedido). */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<DbResult<unknown[]>>,
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const rows = unwrap(await page(from, from + PAGE - 1)) as T[]
    out.push(...rows)
    if (rows.length < PAGE) return out
  }
}

/** Como unwrap, pero tipando el resultado (para vistas y embebidos que la base genera como anulables). */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- el llamador elige el tipo (vistas anulables)
export function unwrapAs<T>(result: DbResult<unknown>): T {
  return unwrap(result) as T
}
