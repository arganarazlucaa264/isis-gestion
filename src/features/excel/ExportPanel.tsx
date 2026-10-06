import { useQuery } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DateRange } from '@/components/ui/DateRange'
import { defaultRange, type Range } from '@/components/ui/date-range'
import { Select } from '@/components/ui/Field'
import { useToast } from '@/components/ui/toast-context'
import {
  exportCash,
  exportInventory,
  exportMovements,
  exportProducts,
  exportPurchases,
  exportSales,
  exportStock,
  exportSuppliers,
  listInventoriesForExport,
} from '@/features/excel/exports'
import { useCan } from '@/features/auth/useCan'
import { toUserMessage } from '@/lib/errors'

function ExportCard({
  title,
  description,
  children,
  onRun,
}: {
  title: string
  description: string
  children?: ReactNode
  onRun: () => Promise<void>
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  async function run() {
    setBusy(true)
    try {
      await onRun()
    } catch (e) {
      toast.error(toUserMessage(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card>
      <CardHeader title={title} />
      <div className="flex flex-col gap-3 p-4">
        <p className="text-sm text-bronze-600">{description}</p>
        {children}
        <Button
          variant="gold"
          icon="download"
          loading={busy}
          onClick={() => {
            void run()
          }}
        >
          Exportar a Excel
        </Button>
      </div>
    </Card>
  )
}

export function ExportPanel() {
  const canSeeCost = useCan('owner', 'manager', 'stock_clerk', 'viewer')
  const canFinance = useCan('owner', 'manager', 'viewer')
  const canStock = useCan('owner', 'manager', 'stock_clerk', 'viewer')
  const [range, setRange] = useState<Range>(defaultRange())
  const [countId, setCountId] = useState('')
  const inventories = useQuery({
    queryKey: ['inventories', 'export'],
    queryFn: listInventoriesForExport,
    enabled: canStock,
  })

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-3">
        <p className="mb-2 text-xs font-semibold tracking-wide text-bronze-600 uppercase">
          Período para ventas, compras, movimientos y caja
        </p>
        <DateRange value={range} onChange={setRange} />
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ExportCard
          title="Stock"
          description="Una fila por variante con stock, mínimo, precio y costo. Es el mismo formato que se usa para importar (con ID, SKU y EAN como texto)."
          onRun={() => exportStock(canSeeCost)}
        />
        <ExportCard
          title="Productos y variantes"
          description="Hoja de modelos y hoja de variantes (compatible con la importación)."
          onRun={() => exportProducts(canSeeCost)}
        />
        {canFinance && (
          <ExportCard
            title="Ventas"
            description="Ventas del período con detalle de ítems y medios de pago."
            onRun={() => exportSales(range.from, range.to)}
          />
        )}
        {canStock && (
          <ExportCard
            title="Compras"
            description="Compras del período con su detalle."
            onRun={() => exportPurchases(range.from, range.to)}
          />
        )}
        {canStock && (
          <ExportCard
            title="Movimientos de stock"
            description="Libro de movimientos del período, con stock antes y después."
            onRun={() => exportMovements(range.from, range.to)}
          />
        )}
        {canFinance && (
          <ExportCard
            title="Caja"
            description="Cierres de caja y todos sus movimientos, indicando cuáles afectan el efectivo físico."
            onRun={() => exportCash(range.from, range.to)}
          />
        )}
        {canFinance && (
          <ExportCard
            title="Proveedores"
            description="Datos de proveedores con saldo y deuda vencida."
            onRun={() => exportSuppliers()}
          />
        )}
        {canStock && (
          <ExportCard
            title="Inventario físico"
            description="Detalle de un inventario: sistema, contado y diferencias."
            onRun={async () => {
              const c = inventories.data?.find((i) => i.id === countId)
              if (c) await exportInventory(c.id, c.number)
            }}
          >
            <Select
              label="Inventario"
              value={countId}
              onChange={(e) => {
                setCountId(e.target.value)
              }}
            >
              <option value="">Elegí un inventario</option>
              {inventories.data?.map((i) => (
                <option key={i.id} value={i.id}>
                  I-{String(i.number).padStart(6, '0')} · {i.name}
                </option>
              ))}
            </Select>
          </ExportCard>
        )}
      </div>
    </div>
  )
}
