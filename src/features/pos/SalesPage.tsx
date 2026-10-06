import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  QueryBoundary,
  Spinner,
  Stat,
} from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Checkbox, Input, Select, Textarea } from '@/components/ui/Field'
import { DateRange } from '@/components/ui/DateRange'
import { defaultRange, type Range } from '@/components/ui/date-range'
import { Modal } from '@/components/ui/Modal'
import { ReasonDialog } from '@/components/ui/ReasonDialog'
import { Table, Td, Th, Thead, Tr } from '@/components/ui/Table'
import { useToast } from '@/components/ui/toast-context'
import { getSale, listSales, registerReturn, voidSale, type SaleDetail } from '@/features/pos/api'
import { Receipt } from '@/features/pos/Receipt'
import { useCan } from '@/features/auth/useCan'
import { useLookup } from '@/features/lookups/useLookup'
import { toUserMessage } from '@/lib/errors'
import { docNumber, formatDateTime } from '@/lib/format'
import { formatMoney } from '@/lib/money'

function ReturnModal({ sale, onClose }: { sale: SaleDetail; onClose: () => void }) {
  const toast = useToast()
  const qc = useQueryClient()
  const methods = useLookup('payment_methods')
  const [qty, setQty] = useState<Record<string, string>>({})
  const [methodId, setMethodId] = useState('')
  const [restock, setRestock] = useState(true)
  const [reason, setReason] = useState('')

  const returnedByItem = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of sale.sale_returns)
      for (const i of r.sale_return_items)
        m.set(i.sale_item_id, (m.get(i.sale_item_id) ?? 0) + i.quantity)
    return m
  }, [sale.sale_returns])

  const lines = sale.sale_items.map((i) => {
    const already = returnedByItem.get(i.id) ?? 0
    const max = i.quantity - already
    const n = Math.min(max, Math.max(0, Number(qty[i.id] ?? 0) || 0))
    return { item: i, max, n, approx: (i.line_total * n) / i.quantity }
  })
  const chosen = lines.filter((l) => l.n > 0)
  const approx = chosen.reduce((s, l) => s + l.approx, 0)
  const activeMethods = methods.data?.filter((m) => m.active) ?? []
  const effective = methodId || activeMethods[0]?.id || ''

  const save = useMutation({
    mutationFn: () =>
      registerReturn({
        saleId: sale.id,
        items: chosen.map((l) => ({ sale_item_id: l.item.id, quantity: l.n })),
        refundMethodId: effective,
        reason: reason.trim(),
        restock,
      }),
    onSuccess: async () => {
      await Promise.all(
        ['sale', 'sales', 'variants', 'cash', 'dashboard', 'movements'].map((k) =>
          qc.invalidateQueries({ queryKey: [k] }),
        ),
      )
      toast.success('Devolución registrada')
      onClose()
    },
    onError: (e) => {
      toast.error(toUserMessage(e))
    },
  })

  return (
    <Modal
      open
      title={`Devolución · venta ${docNumber('V', sale.number)}`}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="gold"
            disabled={chosen.length === 0 || reason.trim() === '' || effective === ''}
            loading={save.isPending}
            onClick={() => {
              save.mutate()
            }}
          >
            Registrar devolución
          </Button>
        </>
      }
    >
      <Table>
        <Thead>
          <tr>
            <Th>Producto</Th>
            <Th className="text-right">Vendido</Th>
            <Th className="text-right">Ya devuelto</Th>
            <Th className="text-right">Devolver</Th>
          </tr>
        </Thead>
        <tbody>
          {lines.map((l) => (
            <Tr key={l.item.id}>
              <Td>
                {l.item.product_name}{' '}
                <span className="text-bronze-500">
                  {l.item.color_name} · {l.item.size_name}
                </span>
              </Td>
              <Td className="text-right tabular-nums">{l.item.quantity}</Td>
              <Td className="text-right tabular-nums">{l.item.quantity - l.max}</Td>
              <Td className="text-right">
                <input
                  type="number"
                  min={0}
                  max={l.max}
                  disabled={l.max === 0}
                  value={qty[l.item.id] ?? ''}
                  placeholder="0"
                  aria-label={`Devolver ${l.item.sku}`}
                  onChange={(e) => {
                    setQty({ ...qty, [l.item.id]: e.target.value })
                  }}
                  className="h-8 w-20 rounded border border-sand-300 px-2 text-right tabular-nums disabled:bg-sand-100"
                />
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Select
          label="Reintegro por"
          value={effective}
          onChange={(e) => {
            setMethodId(e.target.value)
          }}
        >
          {activeMethods.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {m.is_cash ? '' : ' (no es efectivo)'}
            </option>
          ))}
        </Select>
        <Stat
          label="Reintegro estimado"
          value={formatMoney(approx)}
          tone="dark"
          hint="El importe exacto lo calcula el sistema"
        />
        <Checkbox
          label="Devolver la mercadería al stock"
          checked={restock}
          onChange={(e) => {
            setRestock(e.target.checked)
          }}
        />
        <Textarea
          label="Motivo (obligatorio)"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value)
          }}
          wrapperClassName="sm:col-span-2"
        />
      </div>
      <p className="mt-2 text-xs text-bronze-600">
        El reintegro sale de la caja abierta: si es en efectivo descuenta del efectivo esperado; por
        otro medio queda registrado sin tocar el efectivo.
      </p>
    </Modal>
  )
}

function SaleDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const canVoid = useCan('owner', 'manager')
  const canReturn = useCan('owner', 'manager', 'cashier')
  const toast = useToast()
  const qc = useQueryClient()
  const [returning, setReturning] = useState(false)
  const [voiding, setVoiding] = useState(false)
  const query = useQuery({ queryKey: ['sale', id], queryFn: () => getSale(id) })

  const voidMutation = useMutation({
    mutationFn: (reason: string) => voidSale(id, reason),
    onSuccess: async () => {
      setVoiding(false)
      await Promise.all(
        ['sale', 'sales', 'variants', 'cash', 'dashboard', 'movements'].map((k) =>
          qc.invalidateQueries({ queryKey: [k] }),
        ),
      )
      toast.success('Venta anulada: stock repuesto y cobros revertidos en la caja')
    },
    onError: (e) => {
      toast.error(toUserMessage(e))
    },
  })

  const sale = query.data
  const hasReturns = (sale?.sale_returns.length ?? 0) > 0
  return (
    <Modal
      open
      title={sale ? `Venta ${docNumber('V', sale.number)}` : 'Venta'}
      size="lg"
      onClose={onClose}
    >
      {query.isPending && <Spinner />}
      {query.isError && <ErrorState error={query.error} />}
      {sale && (
        <>
          {sale.status === 'voided' && (
            <p className="mb-3 rounded-lg bg-red-100 p-3 text-sm text-red-900">
              Anulada el {formatDateTime(sale.voided_at)}: {sale.void_reason}
            </p>
          )}
          {hasReturns && (
            <div className="mb-3 rounded-lg bg-amber-100 p-3 text-sm text-amber-900">
              {sale.sale_returns.map((r) => (
                <p key={r.id}>
                  Devolución {docNumber('D', r.number)} · {formatDateTime(r.created_at)} ·{' '}
                  {formatMoney(r.refund_amount)} por {r.payment_methods?.name} — {r.reason}
                </p>
              ))}
            </div>
          )}
          <Receipt sale={sale} />
          <div className="mt-4 flex flex-wrap justify-center gap-2 print:hidden">
            {canReturn && sale.status === 'completed' && (
              <Button
                variant="outline"
                icon="undo"
                onClick={() => {
                  setReturning(true)
                }}
              >
                Devolución
              </Button>
            )}
            {canVoid && sale.status === 'completed' && !hasReturns && (
              <Button
                variant="danger"
                onClick={() => {
                  setVoiding(true)
                }}
              >
                Anular venta
              </Button>
            )}
          </div>
          {returning && (
            <ReturnModal
              sale={sale}
              onClose={() => {
                setReturning(false)
              }}
            />
          )}
          <ReasonDialog
            open={voiding}
            title="Anular venta"
            description="Se repone el stock y se revierten los cobros en la caja abierta. La venta queda en el historial como anulada."
            confirmLabel="Anular venta"
            busy={voidMutation.isPending}
            onClose={() => {
              setVoiding(false)
            }}
            onConfirm={(reason) => {
              voidMutation.mutate(reason)
            }}
          />
        </>
      )}
    </Modal>
  )
}

export function SalesPage() {
  const [range, setRange] = useState<Range>(defaultRange())
  const [status, setStatus] = useState('')
  const [number, setNumber] = useState('')
  const [detail, setDetail] = useState<string | null>(null)
  const query = useQuery({
    queryKey: ['sales', range, status, number],
    queryFn: () => listSales(range.from, range.to, status, number),
  })

  const total = useMemo(
    () =>
      (query.data ?? []).filter((s) => s.status === 'completed').reduce((a, s) => a + s.total, 0),
    [query.data],
  )

  return (
    <>
      <PageHeader
        title="Ventas"
        description="Historial de ventas, comprobantes, devoluciones y anulaciones."
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
          <option value="">Todas</option>
          <option value="completed">Completadas</option>
          <option value="voided">Anuladas</option>
        </Select>
        <Input
          label="N° de venta"
          value={number}
          inputMode="numeric"
          onChange={(e) => {
            setNumber(e.target.value.replace(/\D/g, ''))
          }}
        />
        <div className="ml-auto w-56">
          <Stat label="Total vendido" value={formatMoney(total)} tone="dark" />
        </div>
      </div>
      <Card>
        <QueryBoundary
          query={query}
          empty={{
            check: (d) => d.length === 0,
            node: (
              <EmptyState
                title="Sin ventas"
                description="No hay ventas en el período seleccionado."
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
                  <Th>Vendedor</Th>
                  <Th>Cliente</Th>
                  <Th>Estado</Th>
                  <Th className="text-right">Descuento</Th>
                  <Th className="text-right">Total</Th>
                  <Th />
                </tr>
              </Thead>
              <tbody>
                {rows.map((s) => (
                  <Tr key={s.id} className={s.status === 'voided' ? 'opacity-60' : ''}>
                    <Td className="font-medium">{docNumber('V', s.number)}</Td>
                    <Td>{formatDateTime(s.created_at)}</Td>
                    <Td>{s.seller_name ?? '—'}</Td>
                    <Td>{s.customers?.name ?? 'Consumidor final'}</Td>
                    <Td>
                      {s.status === 'voided' ? (
                        <Badge tone="red">Anulada</Badge>
                      ) : (
                        <Badge tone="green">Completada</Badge>
                      )}
                    </Td>
                    <Td className="text-right tabular-nums">
                      {s.discount_amount > 0 ? formatMoney(s.discount_amount) : '—'}
                    </Td>
                    <Td className="text-right font-semibold tabular-nums">
                      {formatMoney(s.total)}
                    </Td>
                    <Td className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setDetail(s.id)
                        }}
                      >
                        Ver
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </QueryBoundary>
      </Card>
      {detail && (
        <SaleDetailModal
          id={detail}
          onClose={() => {
            setDetail(null)
          }}
        />
      )}
    </>
  )
}
