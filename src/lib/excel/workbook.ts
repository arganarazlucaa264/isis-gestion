import type { Workbook, Worksheet } from 'exceljs'

export interface SheetColumn {
  header: string
  key: string
  width?: number
  /** 'text' fuerza texto (SKU, EAN, IDs): conserva ceros a la izquierda. */
  type?: 'text' | 'int' | 'money' | 'date' | 'datetime' | 'percent'
  hidden?: boolean
}

export interface SheetDef {
  name: string
  columns: SheetColumn[]
  rows: Record<string, unknown>[]
  /** Fila de nota/instrucciones sobre el encabezado (no se usa en hojas de importación). */
  title?: string
}

const GOLD = 'FFB98F3E'
const INK = 'FF14110E'
const CREAM = 'FFFDFAF3'

const NUM_FMT: Partial<Record<NonNullable<SheetColumn['type']>, string>> = {
  text: '@',
  int: '#,##0',
  money: '#,##0.00',
  date: 'dd/mm/yyyy',
  datetime: 'dd/mm/yyyy hh:mm',
  percent: '0.00%',
}

function applyColumn(ws: Worksheet, col: SheetColumn, index: number) {
  const c = ws.getColumn(index + 1)
  c.width = col.width ?? Math.max(12, Math.min(40, col.header.length + 4))
  c.hidden = col.hidden === true
  const fmt = NUM_FMT[col.type ?? 'text']
  if (col.type && fmt) c.numFmt = fmt
}

/** Texto de un valor cualquiera (nunca "[object Object]"). */
function toText(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint')
    return String(value)
  if (value instanceof Date) return value.toISOString()
  return ''
}

/** Convierte el valor a lo que corresponde según el tipo de columna (texto como string). */
function coerce(
  value: unknown,
  type: SheetColumn['type'],
): string | number | Date | boolean | null {
  if (value === null || value === undefined || value === '') return null
  if (type === 'text') return toText(value)
  if (type === 'date' || type === 'datetime') {
    if (value instanceof Date) return value
    const d = new Date(toText(value))
    return Number.isNaN(d.getTime()) ? toText(value) : d
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'string' && (type === 'int' || type === 'money' || type === 'percent')) {
    const n = Number(value)
    return Number.isNaN(n) ? value : n
  }
  return toText(value)
}

export async function buildWorkbook(sheets: SheetDef[]): Promise<Workbook> {
  const { Workbook } = await import('exceljs')
  const wb = new Workbook()
  wb.creator = 'Isis Gestión'
  wb.created = new Date()

  for (const def of sheets) {
    const ws = wb.addWorksheet(def.name.slice(0, 31))
    def.columns.forEach((col, i) => {
      applyColumn(ws, col, i)
    })

    let headerRowIndex = 1
    if (def.title) {
      ws.addRow([def.title])
      ws.mergeCells(1, 1, 1, Math.max(1, def.columns.length))
      ws.getRow(1).font = { bold: true, size: 13 }
      headerRowIndex = 2
    }
    const header = ws.getRow(headerRowIndex)
    def.columns.forEach((col, i) => {
      header.getCell(i + 1).value = col.header
    })
    header.font = { bold: true, color: { argb: CREAM } }
    header.alignment = { vertical: 'middle' }
    header.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INK } }
      cell.border = { bottom: { style: 'medium', color: { argb: GOLD } } }
    })
    header.height = 22

    for (const row of def.rows) {
      const added = ws.addRow(def.columns.map((col) => coerce(row[col.key], col.type)))
      def.columns.forEach((col, i) => {
        const cell = added.getCell(i + 1)
        const fmt = NUM_FMT[col.type ?? 'text']
        if (fmt) cell.numFmt = fmt
      })
    }
    ws.views = [{ state: 'frozen', ySplit: headerRowIndex }]
    if (def.rows.length > 0) {
      ws.autoFilter = {
        from: { row: headerRowIndex, column: 1 },
        to: { row: headerRowIndex, column: def.columns.length },
      }
    }
  }
  return wb
}

export async function workbookToBuffer(sheets: SheetDef[]): Promise<ArrayBuffer> {
  const wb = await buildWorkbook(sheets)
  const buf = await wb.xlsx.writeBuffer()
  return buf
}

export async function downloadWorkbook(fileName: string, sheets: SheetDef[]): Promise<void> {
  const buffer = await workbookToBuffer(sheets)
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 5000)
}

export interface ParsedSheet {
  headers: string[]
  rows: { rowNumber: number; cells: Record<string, string> }[]
}

function cellToText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return Number.isInteger(value) ? value.toFixed(0) : String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'object') {
    const o = value as {
      text?: unknown
      result?: unknown
      richText?: { text: string }[]
      hyperlink?: unknown
    }
    if (Array.isArray(o.richText))
      return o.richText
        .map((r) => r.text)
        .join('')
        .trim()
    if (o.result !== undefined) return cellToText(o.result)
    if (typeof o.text === 'string') return o.text.trim()
  }
  return ''
}

/** Lee la primera hoja de un .xlsx: encabezado en la primera fila no vacía; todo como texto. */
export async function readFirstSheet(data: ArrayBuffer): Promise<ParsedSheet> {
  const { Workbook } = await import('exceljs')
  const wb = new Workbook()
  await wb.xlsx.load(data)
  const ws = wb.worksheets[0]
  if (!ws) throw new Error('El archivo no tiene hojas')

  let headerRow = 0
  const headers: string[] = []
  ws.eachRow((row, rowNumber) => {
    if (headerRow !== 0) return
    const texts: string[] = []
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      texts[col - 1] = cellToText(cell.value)
    })
    if (texts.some((t) => t !== '')) {
      headerRow = rowNumber
      for (let i = 0; i < texts.length; i++) headers.push(texts[i] ?? '')
    }
  })
  if (headerRow === 0) throw new Error('El archivo está vacío')

  const rows: ParsedSheet['rows'] = []
  ws.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRow) return
    const cells: Record<string, string> = {}
    headers.forEach((h, i) => {
      if (h === '') return
      const text = cellToText(row.getCell(i + 1).value)
      cells[h] = text
    })
    if (Object.values(cells).some((t) => t !== '')) rows.push({ rowNumber, cells })
  })
  return { headers, rows }
}
