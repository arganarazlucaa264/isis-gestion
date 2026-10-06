import {
  IMPORT_HEADERS,
  IMPORT_KEYS,
  TEXT_KEYS,
  resolveHeader,
  type ImportKey,
} from '@/lib/excel/columns'
import type { ParsedSheet, SheetColumn, SheetDef } from '@/lib/excel/workbook'

export type RawImportRow = Partial<Record<ImportKey, string>>

export interface MappedSheet {
  recognized: Partial<Record<ImportKey, string>>
  unrecognized: string[]
  rows: { row_number: number; raw: RawImportRow }[]
}

/** Mapea los encabezados del archivo a las columnas conocidas y arma las filas crudas (texto). */
export function mapSheet(sheet: ParsedSheet): MappedSheet {
  const recognized: Partial<Record<ImportKey, string>> = {}
  const unrecognized: string[] = []
  for (const header of sheet.headers) {
    if (header === '') continue
    const key = resolveHeader(header)
    if (key && recognized[key] === undefined) recognized[key] = header
    else unrecognized.push(header)
  }
  const rows = sheet.rows.map((r) => {
    const raw: RawImportRow = {}
    for (const key of IMPORT_KEYS) {
      const header = recognized[key]
      if (header !== undefined) {
        const value = r.cells[header]
        if (value !== undefined && value !== '') raw[key] = value
      }
    }
    return { row_number: r.rowNumber, raw }
  })
  return { recognized, unrecognized, rows }
}

const WIDTHS: Record<ImportKey, number> = {
  variant_id: 38,
  sku: 20,
  ean: 18,
  product_code: 14,
  product_name: 30,
  category: 18,
  brand: 16,
  color: 14,
  size: 10,
  price: 14,
  cost: 14,
  stock: 10,
  min_stock: 14,
  active: 10,
}

export function productColumns(opts: { withCost: boolean; withId: boolean }): SheetColumn[] {
  return IMPORT_KEYS.filter(
    (k) => (k !== 'cost' || opts.withCost) && (k !== 'variant_id' || opts.withId),
  ).map((key) => ({
    header: IMPORT_HEADERS[key],
    key,
    width: WIDTHS[key],
    type: TEXT_KEYS.includes(key)
      ? 'text'
      : key === 'price' || key === 'cost'
        ? 'money'
        : key === 'stock' || key === 'min_stock'
          ? 'int'
          : 'text',
    hidden: key === 'variant_id',
  }))
}

/** Hoja de instrucciones común a las plantillas y exportaciones de stock. */
export function instructionsSheet(): SheetDef {
  const lines = [
    ['Cómo usar este archivo'],
    [''],
    ['• Una fila por variante (modelo + color + talle).'],
    [
      '• SKU y EAN se guardan como TEXTO para conservar ceros iniciales. No les cambies el formato.',
    ],
    [
      '• Para actualizar variantes existentes la fila se identifica por: ID variante, luego EAN, luego SKU.',
    ],
    [
      '• Para crear variantes nuevas hacen falta: Modelo o Producto, Color, Talle, Precio (y SKU, o se genera).',
    ],
    [
      '• El Stock importado es el stock FINAL: el sistema registra un movimiento solo por la diferencia.',
    ],
    [
      '• Antes de aplicar vas a ver una vista previa con errores y advertencias; nada se escribe hasta confirmar.',
    ],
    ['• Activo: Sí / No. Precios y costos: podés usar coma o punto decimal.'],
  ]
  return {
    name: 'Instrucciones',
    columns: [{ header: 'Instrucciones', key: 'text', width: 110, type: 'text' }],
    rows: lines.map(([text]) => ({ text })),
  }
}
