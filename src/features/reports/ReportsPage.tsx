import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { BarChart, HBarList } from '@/components/charts/BarChart'
import { Badge, Card, CardHeader, PageHeader, QueryBoundary, Stat } from '@/components/ui/Card'
import { DateRange } from '@/components/ui/DateRange'
import { defaultRange, type Range } from '@/components/ui/date-range'
import { Select } from '@/components/ui/Field'
import { Tabs } from '@/components/ui/Tabs'
import {
  expensesByCategory,
  profit,
  purchasesBySupplier,
  salesByCategory,
  salesByDay,
  salesByPaymentMethod,
  salesByProduct,
  stockReport,
  supplierDebts,
} from '@/features/reports/api'
import { ReportTable } from '@/features/reports/ReportTable'
import { formatDate } from '@/lib/format'
import { formatMoney, formatMoneyInt } from '@/lib/money'

type Tab =
  | 'ventas'
  | 'productos'
  | 'categorias'
  | 'medios'
  | 'stock'
  | 'compras'
  | 'deudas'
  | 'gastos'
  | 'resultado'

const TABS = [
  { value: 'ventas', label: 'Ventas por día' },
  { value: 'productos', label: 'Por producto' },
  { value: 'categorias', label: 'Por categoría' },
  { value: 'medios', label: 'Medios de pago' },
  { value: 'stock', label: 'Stock' },
  { value: 'compras', label: 'Compras' },
  { value: 'deudas', label: 'Deudas' },
  { value: 'gastos', label: 'Gastos' },
  { value: 'resultado', label: 'Resultado' },
] as const

const NEEDS_RANGE: Record<Tab, boolean> = {
  ventas: true,
  productos: true,
  categorias: true,
  medios: true,
  stock: false,
  compras: true,
  deudas: false,
  gastos: true,
  resultado: true,
}

function ProfitCards({ range }: { range: Range }) {
  const query = useQuery({
    queryKey: ['reports', 'profit', range],
    queryFn: () => profit(range.from, range.to),
  })
  return (
    <QueryBoundary query={query}>
      {(p) => (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Stat
            label="Ventas netas"
            value={formatMoneyInt(p.net_sales)}
            tone="dark"
            hint="Ventas − devoluciones"
          />
          <Stat label="Costo de lo vendido" value={formatMoneyInt(p.cogs)} />
          <Stat
            label="Margen bruto"
            value={formatMoneyInt(p.gross_margin)}
            tone="gold"
            hint={`${p.margin_pct.toFixed(1)}% de las ventas`}
          />
          <Stat label="Gastos" value={formatMoneyInt(p.expenses)} />
          <Stat
            label="Resultado estimado"
            value={formatMoneyInt(p.estimated_result)}
            tone={p.estimated_result < 0 ? 'danger' : 'dark'}
            hint="Margen bruto − gastos"
          />
        </div>
      )}
    </QueryBoundary>
  )
}

function SalesByDay({ range }: { range: Range }) {
  const query = useQuery({
    queryKey: ['reports', 'by-day', range],
    queryFn: () => salesByDay(range.from, range.to),
  })
  return (
    <>
      <ProfitCards range={range} />
      <QueryBoundary query={query}>
        {(rows) => (
          <>
            <Card className="mb-4 p-4">
              <BarChart
                ariaLabel="Ventas netas por día"
                data={rows.map((r) => ({ label: formatDate(r.day), value: r.net_amount }))}
              />
            </Card>
            <ReportTable
              title="Ventas por día"
              fileName={`ventas-por-dia-${range.from}-a-${range.to}`}
              rows={rows.map((r) => ({ ...r, day: formatDate(r.day) }))}
              columns={[
                { header: 'Día', key: 'day' },
                { header: 'Tickets', key: 'tickets', kind: 'int' },
                { header: 'Unidades', key: 'units', kind: 'int' },
                { header: 'Ventas', key: 'sales_amount', kind: 'money' },
                { header: 'Devoluciones', key: 'returns_amount', kind: 'money' },
                { header: 'Neto', key: 'net_amount', kind: 'money' },
                { header: 'Costo', key: 'cogs', kind: 'money' },
                { header: 'Margen', key: 'margin', kind: 'money' },
              ]}
            />
          </>
        )}
      </QueryBoundary>
    </>
  )
}

function ByProduct({ range }: { range: Range }) {
  const query = useQuery({
    queryKey: ['reports', 'by-product', range],
    queryFn: () => salesByProduct(range.from, range.to),
  })
  return (
    <QueryBoundary query={query}>
      {(rows) => (
        <>
          <Card className="mb-4 p-4">
            <CardHeader title="Más vendidos (unidades)" />
            <div className="p-4">
              <HBarList
                format={(n) => `${n} u.`}
                data={rows.slice(0, 8).map((r) => ({
                  label: `${r.product_name} · ${r.color_name} · ${r.size_name}`,
                  value: r.units,
                }))}
              />
            </div>
          </Card>
          <ReportTable
            title="Ventas por producto"
            fileName={`ventas-por-producto-${range.from}-a-${range.to}`}
            rows={rows}
            columns={[
              { header: 'SKU', key: 'sku' },
              { header: 'Producto', key: 'product_name' },
              { header: 'Color', key: 'color_name' },
              { header: 'Talle', key: 'size_name' },
              { header: 'Categoría', key: 'category_name' },
              { header: 'Unidades', key: 'units', kind: 'int' },
              { header: 'Ventas netas', key: 'net_amount', kind: 'money' },
              { header: 'Costo', key: 'cogs', kind: 'money' },
              { header: 'Margen', key: 'margin', kind: 'money' },
            ]}
          />
        </>
      )}
    </QueryBoundary>
  )
}

function ByCategory({ range }: { range: Range }) {
  const query = useQuery({
    queryKey: ['reports', 'by-category', range],
    queryFn: () => salesByCategory(range.from, range.to),
  })
  return (
    <QueryBoundary query={query}>
      {(rows) => (
        <ReportTable
          title="Ventas por categoría"
          fileName={`ventas-por-categoria-${range.from}-a-${range.to}`}
          rows={rows}
          columns={[
            { header: 'Categoría', key: 'category_name' },
            { header: 'Unidades', key: 'units', kind: 'int' },
            { header: 'Ventas netas', key: 'net_amount', kind: 'money' },
            { header: 'Costo', key: 'cogs', kind: 'money' },
            { header: 'Margen', key: 'margin', kind: 'money' },
          ]}
        />
      )}
    </QueryBoundary>
  )
}

function ByMethod({ range }: { range: Range }) {
  const query = useQuery({
    queryKey: ['reports', 'by-method', range],
    queryFn: () => salesByPaymentMethod(range.from, range.to),
  })
  return (
    <QueryBoundary query={query}>
      {(rows) => (
        <>
          <Card className="mb-4 p-4">
            <HBarList
              data={rows
                .filter((r) => r.net !== 0)
                .map((r) => ({ label: r.name + (r.is_cash ? ' (efectivo)' : ''), value: r.net }))}
            />
          </Card>
          <ReportTable
            title="Ventas por medio de pago"
            fileName={`ventas-por-medio-${range.from}-a-${range.to}`}
            rows={rows}
            columns={[
              { header: 'Medio', key: 'name' },
              {
                header: 'Efectivo físico',
                key: 'is_cash',
                render: (r) => (r.is_cash ? <Badge tone="gold">Sí</Badge> : 'No'),
              },
              { header: 'Cobrado', key: 'collected', kind: 'money' },
              { header: 'Devuelto', key: 'refunded', kind: 'money' },
              { header: 'Neto', key: 'net', kind: 'money' },
            ]}
          />
        </>
      )}
    </QueryBoundary>
  )
}

function StockReport() {
  const [view, setView] = useState<'all' | 'low' | 'out'>('all')
  const query = useQuery({ queryKey: ['reports', 'stock'], queryFn: stockReport })
  const rows = useMemo(() => {
    const all = query.data ?? []
    return view === 'all' ? all : all.filter((r) => r.stock_status === view)
  }, [query.data, view])
  const value = (query.data ?? []).reduce((s, r) => s + r.value_cost, 0)
  const valuePrice = (query.data ?? []).reduce((s, r) => s + r.value_price, 0)
  return (
    <QueryBoundary query={{ ...query, data: query.data ? rows : undefined }}>
      {(data) => (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            <Stat label="Variantes" value={(query.data ?? []).length} />
            <Stat
              label="Sin stock"
              value={(query.data ?? []).filter((r) => r.stock_status === 'out').length}
              tone="danger"
            />
            <Stat
              label="Stock bajo"
              value={(query.data ?? []).filter((r) => r.stock_status === 'low').length}
              tone="gold"
            />
            <Stat
              label="Valorizado a costo"
              value={formatMoneyInt(value)}
              tone="dark"
              hint={`A precio de venta: ${formatMoney(valuePrice)}`}
            />
          </div>
          <div className="mb-3 max-w-xs">
            <Select
              label="Mostrar"
              value={view}
              onChange={(e) => {
                setView(e.target.value as 'all' | 'low' | 'out')
              }}
            >
              <option value="all">Todo el stock</option>
              <option value="low">Stock bajo</option>
              <option value="out">Sin stock</option>
            </Select>
          </div>
          <ReportTable
            title="Stock actual y valorización"
            fileName="stock-valorizado"
            rows={data}
            columns={[
              { header: 'SKU', key: 'sku' },
              { header: 'Producto', key: 'product_name' },
              { header: 'Color', key: 'color_name' },
              { header: 'Talle', key: 'size_name' },
              { header: 'Stock', key: 'stock', kind: 'int' },
              { header: 'Mínimo', key: 'min_stock', kind: 'int' },
              {
                header: 'Estado',
                key: 'stock_status',
                render: (r) =>
                  r.stock_status === 'out' ? (
                    <Badge tone="red">Sin stock</Badge>
                  ) : r.stock_status === 'low' ? (
                    <Badge tone="amber">Bajo</Badge>
                  ) : (
                    <Badge tone="green">OK</Badge>
                  ),
              },
              { header: 'Costo prom.', key: 'avg_cost', kind: 'money' },
              { header: 'Valor a costo', key: 'value_cost', kind: 'money' },
              { header: 'Valor a precio', key: 'value_price', kind: 'money' },
            ]}
          />
        </>
      )}
    </QueryBoundary>
  )
}

function Purchases({ range }: { range: Range }) {
  const query = useQuery({
    queryKey: ['reports', 'purchases', range],
    queryFn: () => purchasesBySupplier(range.from, range.to),
  })
  return (
    <QueryBoundary query={query}>
      {(rows) => (
        <ReportTable
          title="Compras por proveedor"
          fileName={`compras-por-proveedor-${range.from}-a-${range.to}`}
          rows={rows}
          columns={[
            { header: 'Proveedor', key: 'name' },
            { header: 'Compras', key: 'purchases_count', kind: 'int' },
            { header: 'Total', key: 'total', kind: 'money' },
            { header: 'Pagado', key: 'paid', kind: 'money' },
            { header: 'Pendiente', key: 'pending', kind: 'money' },
          ]}
        />
      )}
    </QueryBoundary>
  )
}

function Debts() {
  const query = useQuery({ queryKey: ['reports', 'debts'], queryFn: supplierDebts })
  return (
    <QueryBoundary query={query}>
      {(rows) => (
        <ReportTable
          title="Deudas con proveedores (antigüedad)"
          fileName="deudas-proveedores"
          rows={rows}
          columns={[
            { header: 'Proveedor', key: 'name' },
            { header: 'Saldo', key: 'balance', kind: 'money' },
            { header: 'No vencido', key: 'not_due', kind: 'money' },
            { header: '1-30 días', key: 'overdue_1_30', kind: 'money' },
            { header: '31-60 días', key: 'overdue_31_60', kind: 'money' },
            { header: '+60 días', key: 'overdue_61_plus', kind: 'money' },
            {
              header: 'Próx. vencimiento',
              key: 'next_due_date',
              render: (r) => formatDate(r.next_due_date),
            },
          ]}
          footer={
            <span>
              Total adeudado:{' '}
              <strong>{formatMoney(rows.reduce((s, r) => s + Math.max(0, r.balance), 0))}</strong>
            </span>
          }
        />
      )}
    </QueryBoundary>
  )
}

function Expenses({ range }: { range: Range }) {
  const query = useQuery({
    queryKey: ['reports', 'expenses', range],
    queryFn: () => expensesByCategory(range.from, range.to),
  })
  return (
    <QueryBoundary query={query}>
      {(rows) => (
        <>
          <Card className="mb-4 p-4">
            <HBarList
              tone="bronze"
              data={rows.map((r) => ({ label: r.category_name, value: r.total }))}
            />
          </Card>
          <ReportTable
            title="Gastos por categoría"
            fileName={`gastos-${range.from}-a-${range.to}`}
            rows={rows}
            columns={[
              { header: 'Categoría', key: 'category_name' },
              { header: 'Cantidad', key: 'expenses_count', kind: 'int' },
              { header: 'Total', key: 'total', kind: 'money' },
            ]}
            footer={
              <span>
                Total: <strong>{formatMoney(rows.reduce((s, r) => s + r.total, 0))}</strong>
              </span>
            }
          />
        </>
      )}
    </QueryBoundary>
  )
}

export function ReportsPage() {
  const [tab, setTab] = useState<Tab>('ventas')
  const [range, setRange] = useState<Range>(defaultRange())
  return (
    <>
      <PageHeader
        title="Reportes"
        description="Ventas, margen, stock, compras, deudas, gastos y resultado estimado."
      />
      <Tabs items={TABS} value={tab} onChange={setTab} />
      {NEEDS_RANGE[tab] && (
        <div className="mb-4">
          <DateRange value={range} onChange={setRange} />
        </div>
      )}
      {tab === 'ventas' && <SalesByDay range={range} />}
      {tab === 'productos' && <ByProduct range={range} />}
      {tab === 'categorias' && <ByCategory range={range} />}
      {tab === 'medios' && <ByMethod range={range} />}
      {tab === 'stock' && <StockReport />}
      {tab === 'compras' && <Purchases range={range} />}
      {tab === 'deudas' && <Debts />}
      {tab === 'gastos' && <Expenses range={range} />}
      {tab === 'resultado' && <ProfitCards range={range} />}
    </>
  )
}
