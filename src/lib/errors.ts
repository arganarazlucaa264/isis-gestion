interface MaybeDbError {
  message?: unknown
  code?: unknown
  details?: unknown
}

/** Traduce errores de Postgres/Supabase a mensajes para el usuario. Los de negocio ya vienen en español. */
export function toUserMessage(error: unknown): string {
  if (!error) return 'Ocurrió un error inesperado'
  const e = error as MaybeDbError
  const message = typeof e.message === 'string' ? e.message : ''
  const code = typeof e.code === 'string' ? e.code : ''
  const text = `${message} ${typeof e.details === 'string' ? e.details : ''}`.toLowerCase()

  if (code === '23505' || text.includes('duplicate key')) {
    if (text.includes('sku')) return 'Ya existe una variante con ese SKU'
    if (text.includes('ean')) return 'Ese EAN ya pertenece a otra variante'
    if (text.includes('unique_combo')) return 'Ya existe esa combinación de modelo, color y talle'
    if (text.includes('products_code')) return 'Ya existe un producto con ese código'
    if (text.includes('name')) return 'Ya existe un registro con ese nombre'
    if (message && !text.includes('violates')) return message
    return 'Ya existe un registro con esos datos'
  }
  if (code === '23514' || text.includes('violates check constraint')) {
    if (text.includes('ean'))
      return 'EAN inválido (EAN-8, UPC-A, EAN-13 o EAN-14 con dígito verificador correcto)'
    if (message && !text.includes('violates')) return message
    return 'Algún valor ingresado no es válido'
  }
  if (code === '23503') return 'No se puede completar la operación: hay datos relacionados'
  if (
    code === '42501' ||
    text.includes('permission denied') ||
    text.includes('row-level security')
  ) {
    if (message && !text.includes('permission denied') && !text.includes('row-level security'))
      return message
    return 'No tenés permiso para realizar esta acción'
  }
  if (text.includes('failed to fetch') || text.includes('networkerror')) {
    return 'No hay conexión con el servidor. Revisá tu internet e intentá de nuevo.'
  }
  if (text.includes('jwt expired')) return 'Tu sesión venció. Volvé a iniciar sesión.'
  return message || 'Ocurrió un error inesperado'
}

export class ApiError extends Error {
  readonly code: string | undefined
  constructor(source: unknown) {
    super(toUserMessage(source))
    this.name = 'ApiError'
    const code = (source as MaybeDbError | null)?.code
    this.code = typeof code === 'string' ? code : undefined
  }
}
