/**
 * Columnas del Excel de importación / exportación de productos y stock.
 * SKU y EAN SIEMPRE viajan como texto (formato "@") para no perder ceros iniciales
 * ni convertirse en notación científica.
 */

export type ImportKey =
  | 'variant_id'
  | 'sku'
  | 'ean'
  | 'product_code'
  | 'product_name'
  | 'category'
  | 'brand'
  | 'color'
  | 'size'
  | 'price'
  | 'cost'
  | 'stock'
  | 'min_stock'
  | 'active'

export const IMPORT_KEYS: readonly ImportKey[] = [
  'variant_id',
  'sku',
  'ean',
  'product_code',
  'product_name',
  'category',
  'brand',
  'color',
  'size',
  'price',
  'cost',
  'stock',
  'min_stock',
  'active',
]

export const IMPORT_HEADERS: Record<ImportKey, string> = {
  variant_id: 'ID variante',
  sku: 'SKU',
  ean: 'EAN',
  product_code: 'Modelo',
  product_name: 'Producto',
  category: 'Categoría',
  brand: 'Marca',
  color: 'Color',
  size: 'Talle',
  price: 'Precio',
  cost: 'Costo',
  stock: 'Stock',
  min_stock: 'Stock mínimo',
  active: 'Activo',
}

/** Columnas que se leen como texto (nunca como número). */
export const TEXT_KEYS: readonly ImportKey[] = ['variant_id', 'sku', 'ean', 'product_code']

const ALIASES: Record<ImportKey, string[]> = {
  variant_id: ['id variante', 'id', 'variant id', 'variant_id', 'idvariante'],
  sku: ['sku', 'codigo interno', 'cod interno'],
  ean: ['ean', 'codigo de barras', 'cod de barras', 'codigo barras', 'barcode', 'ean13', 'gtin'],
  product_code: [
    'modelo',
    'codigo de modelo',
    'codigo modelo',
    'cod modelo',
    'product code',
    'product_code',
    'codigo',
  ],
  product_name: ['producto', 'nombre', 'descripcion', 'articulo', 'product name', 'product_name'],
  category: ['categoria', 'rubro', 'category'],
  brand: ['marca', 'brand'],
  color: ['color', 'colour'],
  size: ['talle', 'talla', 'size'],
  price: ['precio', 'precio de venta', 'precio venta', 'price', 'pvp'],
  cost: ['costo', 'precio de costo', 'costo unitario', 'cost'],
  stock: ['stock', 'stock actual', 'cantidad', 'existencia', 'stock real', 'contado'],
  min_stock: ['stock minimo', 'minimo', 'stock min', 'min stock', 'min_stock'],
  active: ['activo', 'active', 'habilitado'],
}

export function normalizeHeader(header: string): string {
  return header
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Resuelve el encabezado de una columna del archivo a su clave interna (o null si no se reconoce). */
export function resolveHeader(header: string): ImportKey | null {
  const n = normalizeHeader(header)
  for (const key of IMPORT_KEYS) {
    if (ALIASES[key].some((a) => normalizeHeader(a) === n)) return key
  }
  return null
}
