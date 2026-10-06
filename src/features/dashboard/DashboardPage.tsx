import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { BarChart, HBarList } from '@/components/charts/BarChart'
import {
  Badge,
  Card,
  CardHeader,
  ErrorState,
  PageHeader,
  Spinner,
  Stat,
} from '@/components/ui/Card'
import { Table, Td, Th, Thead, Tr } from '@/components/ui/Table'
import { useAuth } from '@/features/auth/auth-context'
import { rpc } from '@/lib/rpc'
import { formatDate, formatDateTime } from '@/lib/format'
import { formatMoney, formatMoneyInt, formatNumber } from '@/lib/money'
import { MOVEMENT_LABELS, type StockMovementType } from '@/types/db'

interface Dashboard {
  today: { sales: number; units: number; tickets: number; margin: number }
  month: {
    sales: number
    units: number
    tickets: number
    margin: number
    expenses: number
    estimated_result: number
  }
  today_expenses: number
  payments_today: { code: string; name: string; is_cash: boolean; net: number }[]
  stock: { out_of_stock: number; low_stock: number; value_cost: number }
  supplier_debt: number
  series: { day: string; net: number }[]
  top_products: { name: string; color: string; size: string; units: number; amount: number }[]
  recent_movements: {
    id: number
    at: string
    type: StockMovementType
    quantity: number
    sku: string
    name: string
    color: string
    size: string
  }[]
  open_sessions: number
}

export function DashboardPage() {
  const { profile } = useAuth()
  const query = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => (await rpc('dashboard_summary')) as unknown as Dashboard,
    refetchInterval: 60_000,
  })

  if (query.isPending) return <Spinner />
  if (query.isError) return <ErrorState error={query.error} />
  const d = query.data

  const cash = d.payments_today.filter((p) => p.is_cash).reduce((s, p) => s + p.net, 0)
  const transfer = d.payments_today
    .filter((p) => p.code === 'transfer')
    .reduce((s, p) => s + p.net, 0)
  const other = d.payments_today
    .filter((p) => !p.is_cash && p.code !== 'transfer')
    .reduce((s, p) => s + p.net, 0)

  return (
    <>
      <PageHeader
        title={`Hola, ${profile?.full_name ?? ''}`}
        description="Resumen del local. Se actualiza solo cada minuto."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Ventas de hoy"
          value={formatMoneyInt(d.today.sales)}
          tone="dark"
          hint={`${d.today.tickets} tickets · ${formatNumber(d.today.units)} unidades`}
        />
        <Stat
          label="Ventas del mes"
          value={formatMoneyInt(d.month.sales)}
          hint={`${d.month.tickets} tickets · ${formatNumber(d.month.units)} unidades`}
        />
        <Stat
          label="Gastos del mes"
          value={formatMoneyInt(d.month.expenses)}
          hint={`Hoy ${formatMoney(d.today_expenses)}`}
        />
        <Stat
          label="Resultado estimado del mes"
          value={formatMoneyInt(d.month.estimated_result)}
          tone={d.month.estimated_result < 0 ? 'danger' : 'gold'}
          hint={`Margen bruto ${formatMoney(d.month.margin)} − gastos`}
        />
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Stat
          label="Efectivo cobrado hoy"
          value={formatMoneyInt(cash)}
          hint="Neto de devoluciones"
        />
        <Stat label="Transferencias hoy" value={formatMoneyInt(transfer)} />
        <Stat
          label="Otros medios hoy"
          value={formatMoneyInt(other)}
          hint="Débito, crédito, Mercado Pago y otros"
        />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Ventas netas · últimos 14 días" />
          <div className="p-4">
            <BarChart
              ariaLabel="Ventas netas de los últimos 14 días"
              data={d.series.map((s) => ({ label: formatDate(s.day), value: s.net }))}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="Alertas" />
          <div className="flex flex-col gap-3 p-4 text-sm">
            <Link
              to="/reportes"
              className="flex items-center justify-between rounded-lg bg-red-50 p-3 hover:bg-red-100"
            >
              <span>Productos sin stock</span>
              <Badge tone="red">{d.stock.out_of_stock}</Badge>
            </Link>
            <Link
              to="/reportes"
              className="flex items-center justify-between rounded-lg bg-amber-50 p-3 hover:bg-amber-100"
            >
              <span>Stock bajo (≤ mínimo)</span>
              <Badge tone="amber">{d.stock.low_stock}</Badge>
            </Link>
            <Link
              to="/proveedores"
              className="flex items-center justify-between rounded-lg bg-sand-100 p-3 hover:bg-sand-200"
            >
              <span>Deuda con proveedores</span>
              <strong className="tabular-nums">{formatMoney(d.supplier_debt)}</strong>
            </Link>
            <div className="flex items-center justify-between rounded-lg bg-sand-100 p-3">
              <span>Stock valorizado a costo</span>
              <strong className="tabular-nums">{formatMoney(d.stock.value_cost)}</strong>
            </div>
            <Link
              to="/caja"
              className="flex items-center justify-between rounded-lg bg-sand-100 p-3 hover:bg-sand-200"
            >
              <span>Cajas abiertas</span>
              <Badge tone={d.open_sessions > 0 ? 'green' : 'neutral'}>{d.open_sessions}</Badge>
            </Link>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Más vendidos · últimos 30 días" />
          <div className="p-4">
            {d.top_products.length === 0 ? (
              <p className="text-sm text-bronze-600">Sin ventas en el período.</p>
            ) : (
              <HBarList
                format={(n) => `${n} u.`}
                data={d.top_products.map((p) => ({
                  label: `${p.name} · ${p.color} · ${p.size}`,
                  value: p.units,
                }))}
              />
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Últimos movimientos de stock" />
          <Table>
            <Thead>
              <tr>
                <Th>Fecha</Th>
                <Th>Producto</Th>
                <Th>Tipo</Th>
                <Th className="text-right">Cant.</Th>
              </tr>
            </Thead>
            <tbody>
              {d.recent_movements.map((m) => (
                <Tr key={m.id}>
                  <Td className="whitespace-nowrap">{formatDateTime(m.at)}</Td>
                  <Td>
                    {m.name}{' '}
                    <span className="text-bronze-500">
                      {m.color} {m.size}
                    </span>
                  </Td>
                  <Td>{MOVEMENT_LABELS[m.type]}</Td>
                  <Td
                    className={`text-right font-semibold tabular-nums ${m.quantity > 0 ? 'text-emerald-800' : 'text-red-800'}`}
                  >
                    {m.quantity > 0 ? '+' : ''}
                    {m.quantity}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </>
  )
}
