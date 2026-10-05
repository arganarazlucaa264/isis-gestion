import { describe, expect, it } from 'vitest'
import { mapSheet, productColumns } from '@/lib/excel/products'
import { normalizeHeader, resolveHeader } from '@/lib/excel/columns'
import { readFirstSheet, workbookToBuffer } from '@/lib/excel/workbook'

describe('encabezados', () => {
  it('normaliza tildes, mayúsculas y separadores', () => {
    expect(normalizeHeader('  Stock_Mínimo ')).toBe('stock minimo')
  })
  it('reconoce alias en español', () => {
    expect(resolveHeader('Código de barras')).toBe('ean')
    expect(resolveHeader('Talle')).toBe('size')
    expect(resolveHeader('Stock mínimo')).toBe('min_stock')
    expect(resolveHeader('Cosa rara')).toBeNull()
  })
})

describe('Excel: SKU y EAN como texto', () => {
  it('conserva ceros iniciales al exportar y volver a leer', async () => {
    const buffer = await workbookToBuffer([
      {
        name: 'Stock',
        columns: productColumns({ withCost: true, withId: true }),
        rows: [
          {
            sku: '00123',
            ean: '01234565',
            product_code: 'REM',
            product_name: 'Remera',
            price: 1500.5,
            stock: 3,
            active: 'Sí',
          },
        ],
      },
    ])
    const sheet = await readFirstSheet(buffer)
    const mapped = mapSheet(sheet)
    expect(mapped.rows).toHaveLength(1)
    const raw = mapped.rows[0]?.raw
    expect(raw?.sku).toBe('00123')
    expect(raw?.ean).toBe('01234565')
    expect(raw?.price).toBe('1500.5')
    expect(raw?.stock).toBe('3')
  })

  it('un EAN-13 numérico no se convierte en notación científica', async () => {
    const ExcelJS = await import('exceljs')
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('x')
    ws.addRow(['EAN', 'SKU'])
    ws.addRow([4006381333931, 12345])
    const buf = await wb.xlsx.writeBuffer()
    const mapped = mapSheet(await readFirstSheet(buf))
    expect(mapped.rows[0]?.raw.ean).toBe('4006381333931')
    expect(mapped.rows[0]?.raw.sku).toBe('12345')
  })

  it('ignora filas vacías y reporta columnas no reconocidas', async () => {
    const ExcelJS = await import('exceljs')
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('x')
    ws.addRow(['SKU', 'Columna rara'])
    ws.addRow(['A1', 'x'])
    ws.addRow([])
    ws.addRow(['B2', 'y'])
    const buf = await wb.xlsx.writeBuffer()
    const mapped = mapSheet(await readFirstSheet(buf))
    expect(mapped.rows.map((r) => r.raw.sku)).toEqual(['A1', 'B2'])
    expect(mapped.unrecognized).toEqual(['Columna rara'])
  })
})
