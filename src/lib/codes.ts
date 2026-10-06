/**
 * Códigos de producto: EAN-8, UPC-A (12), EAN-13 y EAN-14 (GTIN), más SKU.
 * Espejo de is_valid_gtin() / normalize_ean() en la base: la base es la autoridad, esto es para UX.
 * El futuro lector USB (que actúa como teclado) o la cámara del celular entregan el código como
 * texto: todo el sistema lo resuelve con la misma búsqueda (find_variant_by_code).
 */

export const GTIN_LENGTHS = [8, 12, 13, 14] as const

export function isValidGtin(code: string): boolean {
  if (!/^\d+$/.test(code) || !(GTIN_LENGTHS as readonly number[]).includes(code.length))
    return false
  const digits = Array.from(code, Number)
  const check = digits.pop() ?? 0
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    const fromRight = digits.length - i // 1 = dígito pegado al verificador
    sum += (digits[i] ?? 0) * (fromRight % 2 === 1 ? 3 : 1)
  }
  return (10 - (sum % 10)) % 10 === check
}

/** Quita espacios y, si Excel comió ceros a la izquierda, los recupera. null si no hay GTIN válido. */
export function normalizeEan(input: string): string | null {
  const code = input.replace(/\s/g, '')
  if (!/^\d+$/.test(code)) return null
  if (isValidGtin(code)) return code
  for (const len of GTIN_LENGTHS) {
    if (len > code.length && isValidGtin(code.padStart(len, '0'))) return code.padStart(len, '0')
  }
  return null
}

/** Compara dos EAN ignorando ceros a la izquierda (UPC-A 12 dígitos == EAN-13 con un 0 delante). */
export function sameEan(a: string, b: string): boolean {
  return a.replace(/^0+/, '') === b.replace(/^0+/, '')
}

/** ¿Parece un código escaneado (solo dígitos, largo de GTIN) y no un texto de búsqueda? */
export function looksLikeGtin(input: string): boolean {
  const code = input.trim()
  return /^\d+$/.test(code) && code.length >= 8 && code.length <= 14
}

export type CodeKind = 'ean' | 'text'
export function classifyCode(input: string): CodeKind {
  return looksLikeGtin(input) ? 'ean' : 'text'
}

/** SKU sugerido: MODELO-COLOR-TALLE en mayúsculas y sin espacios. */
export function suggestSku(productCode: string, color: string, size: string): string {
  return [productCode, color, size]
    .map((p) => p.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().replace(/\s+/g, '').toUpperCase())
    .filter(Boolean)
    .join('-')
}
