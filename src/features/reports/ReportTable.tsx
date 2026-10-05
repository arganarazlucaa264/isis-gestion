import type { ReactNode } from 'react'
import { Card, CardHeader, EmptyState } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Table, Td, Th, Thead, Tr } from '@/components/ui/Table'
import { downloadWorkbook, type SheetColumn } from '@/lib/excel/workbook'
import { formatMoney, formatNumber } from '@/lib/money'

export interface Col<T> {
  header: string
  key: keyof T & string
  kind?: 'text' | 'money' | 'int' | 'percent'
  render?: (row: T) => ReactNode
}

/** Tabla de reporte con botón de exportación a Excel (mismas columnas que se ven en pantalla). */
export function ReportTable<T extends object>({
  title,
  rows,
  columns,
  fileName,
  footer,
}: {
  title: string
  rows: T[]
  columns: Col<T>[]
  fileName: string
  footer?: ReactNode
}) {
  async function exportXlsx() {
    const sheetCols: SheetColumn[] = columns.map((c) => ({
      header: c.header,
      key: c.key,
      type:
        c.kind === 'money'
          ? 'money'
          : c.kind === 'int'
            ? 'int'
            : c.kind === 'percent'
              ? 'percent'
              : 'text',
      width: 18,
    }))
    await downloadWorkbook(fileName, [
      { name: title.slice(0, 31), columns: sheetCols, rows: rows as Record<string, unknown>[] },
    ])
  }

  return (
    <Card>
      <CardHeader
        title={title}
        actions={
          <Button
            size="sm"
            variant="outline"
            icon="download"
            disabled={rows.length === 0}
            onClick={() => {
              void exportXlsx()
            }}
          >
            Excel
          </Button>
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          title="Sin datos"
          description="No hay información para el período seleccionado."
        />
      ) : (
        <Table>
          <Thead>
            <tr>
              {columns.map((c) => (
                <Th key={c.key} className={c.kind && c.kind !== 'text' ? 'text-right' : ''}>
                  {c.header}
                </Th>
              ))}
            </tr>
          </Thead>
          <tbody>
            {rows.map((r, i) => (
              <Tr key={i}>
                {columns.map((c) => (
                  <Td
                    key={c.key}
                    className={c.kind && c.kind !== 'text' ? 'text-right tabular-nums' : ''}
                  >
                    {c.render ? c.render(r) : cell(r[c.key], c.kind)}
                  </Td>
                ))}
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
      {footer && <div className="border-t border-sand-200 p-3 text-sm">{footer}</div>}
    </Card>
  )
}

function cell(value: unknown, kind: Col<object>['kind']): ReactNode {
  if (value === null || value === undefined) return '—'
  if (kind === 'money') return formatMoney(Number(value))
  if (kind === 'int') return formatNumber(Number(value))
  if (kind === 'percent') return `${Number(value).toFixed(1)}%`
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}
