import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Card, EmptyState, PageHeader, QueryBoundary } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DateRange } from '@/components/ui/DateRange'
import { type Range } from '@/components/ui/date-range'
import { Select } from '@/components/ui/Field'
import { Table, Td, Th, Thead, Tr } from '@/components/ui/Table'
import { listPurchases } from '@/features/purchases/api'
import { useCan } from '@/features/auth/useCan'
import { useLookup } from '@/features/lookups/useLookup'
import { addDaysISO, docNumber, formatDate, todayISO } from '@/lib/format'
import { formatMoney } from '@/lib/money'

export function PaymentBadge({ status }: { status: string }) {
  return (
    <Badge tone={status === 'paid' ? 'green' : status === 'partial' ? 'amber' : 'red'}>
      {status === 'paid' ? 'Pagada' : status === 'partial' ? 'Parcial' : 'Pendiente'}
    </Badge>
  )
}

export function PurchaseStatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={status === 'received' ? 'green' : status === 'draft' ? 'amber' : 'red'}>
      {status === 'received' ? 'Recibida' : status === 'draft' ? 'Borrador' : 'Anulada'}
    </Badge>
  )
}

export function PurchasesPage() {
  const canCreate = useCan('owner', 'manager')
  const [range, setRange] = useState<Range>({ from: addDaysISO(todayISO(), -90), to: todayISO() })
  const [status, setStatus] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const suppliers = useLookup('suppliers')
  const query = useQuery({
    queryKey: ['purchases', range, status, supplierId],
    queryFn: () => listPurchases(range.from, range.to, status, supplierId),
  })

  return (
    <>
      <PageHeader
        title="Compras"
        description="Compras a proveedores: recepción de mercadería, costos y deuda."
        actions={
          canCreate && (
            <Link to="/compras/nueva">
              <Button icon="plus" variant="gold">
                Nueva compra
              </Button>
            </Link>
          )
        }
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <DateRange value={range} onChange={setRange} />
        <Select
          label="Estado"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
          }}
        >
          <option value="">Todos</option>
          <option value="draft">Borrador</option>
          <option value="received">Recibida</option>
          <option value="cancelled">Anulada</option>
        </Select>
        <Select
          label="Proveedor"
          value={supplierId}
          onChange={(e) => {
            setSupplierId(e.target.value)
          }}
        >
          <option value="">Todos</option>
          {suppliers.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>
      <Card>
        <QueryBoundary
          query={query}
          empty={{
            check: (d) => d.length === 0,
            node: (
              <EmptyState
                title="Sin compras"
                description="No hay compras en el período seleccionado."
              />
            ),
          }}
        >
          {(rows) => (
            <Table>
              <Thead>
                <tr>
                  <Th>N°</Th>
                  <Th>Fecha</Th>
                  <Th>Proveedor</Th>
                  <Th>Factura</Th>
                  <Th>Vence</Th>
                  <Th>Estado</Th>
                  <Th>Pago</Th>
                  <Th className="text-right">Total</Th>
                  <Th className="text-right">Pagado</Th>
                </tr>
              </Thead>
              <tbody>
                {rows.map((p) => (
                  <Tr key={p.id}>
                    <Td>
                      <Link className="font-medium underline" to={`/compras/${p.id}`}>
                        {docNumber('C', p.number)}
                      </Link>
                    </Td>
                    <Td>{formatDate(p.purchase_date)}</Td>
                    <Td>{p.suppliers?.name}</Td>
                    <Td>{p.invoice_number ?? '—'}</Td>
                    <Td>{formatDate(p.due_date)}</Td>
                    <Td>
                      <PurchaseStatusBadge status={p.status} />
                    </Td>
                    <Td>
                      {p.status === 'received' ? <PaymentBadge status={p.payment_status} /> : '—'}
                    </Td>
                    <Td className="text-right tabular-nums">{formatMoney(p.total)}</Td>
                    <Td className="text-right tabular-nums">{formatMoney(p.paid_amount)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </QueryBoundary>
      </Card>
    </>
  )
}
