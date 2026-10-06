import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Badge,
  Card,
  ErrorState,
  PageHeader,
  QueryBoundary,
  Spinner,
  Stat,
} from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { ReasonDialog } from '@/components/ui/ReasonDialog'
import { Table, Td, Th, Thead, Tr } from '@/components/ui/Table'
import { Tabs } from '@/components/ui/Tabs'
import { useToast } from '@/components/ui/toast-context'
import {
  addLedgerEntry,
  getBalance,
  getSupplier,
  listStatement,
  listSupplierPayments,
  listSupplierProducts,
  listSupplierPurchases,
  voidSupplierPayment,
} from '@/features/suppliers/api'
import { SupplierFormModal } from '@/features/suppliers/SupplierFormModal'
import { SupplierPaymentModal } from '@/features/suppliers/SupplierPaymentModal'
import { useCan } from '@/features/auth/useCan'
import { toUserMessage } from '@/lib/errors'
import { docNumber, formatDate, formatDateTime, parseDecimal } from '@/lib/format'
import { formatMoney } from '@/lib/money'
import type { SupplierLedgerType } from '@/types/db'

const ENTRY_LABEL: Record<SupplierLedgerType, string> = {
  purchase: 'Compra',
  payment: 'Pago',
  payment_void: 'Anulación de pago',
  credit_note: 'Nota de crédito',
  adjustment: 'Ajuste',
  opening_balance: 'Saldo inicial',
}

function LedgerEntryModal({ supplierId, onClose }: { supplierId: string; onClose: () => void }) {
  const toast = useToast()
  const qc = useQueryClient()
  const [type, setType] = useState<'opening_balance' | 'adjustment'>('opening_balance')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const n = parseDecimal(amount)
  const save = useMutation({
    mutationFn: () => addLedgerEntry(supplierId, type, n, notes.trim()),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success('Asiento registrado')
      onClose()
    },
    onError: (e) => {
      toast.error(toUserMessage(e))
    },
  })
  return (
    <Modal
      open
      title="Saldo inicial / ajuste"
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={Number.isNaN(n) || n === 0 || notes.trim() === ''}
            loading={save.isPending}
            onClick={() => {
              save.mutate()
            }}
          >
            Registrar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Select
          label="Tipo"
          value={type}
          onChange={(e) => {
            setType(e.target.value as 'opening_balance' | 'adjustment')
          }}
        >
          <option value="opening_balance">Saldo inicial (deuda previa)</option>
          <option value="adjustment">Ajuste manual</option>
        </Select>
        <Input
          label="Importe"
          value={amount}
          inputMode="decimal"
          onChange={(e) => {
            setAmount(e.target.value)
          }}
          hint="Positivo: le debemos más. Negativo: le debemos menos."
        />
        <Textarea
          label="Motivo (obligatorio)"
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value)
          }}
        />
      </div>
    </Modal>
  )
}

export function SupplierDetailPage() {
  const { id = '' } = useParams()
  const canPay = useCan('owner', 'manager')
  const isOwner = useCan('owner')
  const canSeeLedger = useCan('owner', 'manager', 'viewer')
  const toast = useToast()
  const qc = useQueryClient()
  const [tab, setTab] = useState<'cuenta' | 'compras' | 'pagos' | 'productos'>('cuenta')
  const [editing, setEditing] = useState(false)
  const [paying, setPaying] = useState(false)
  const [entry, setEntry] = useState(false)
  const [voiding, setVoiding] = useState<string | null>(null)

  const supplier = useQuery({ queryKey: ['suppliers', 'one', id], queryFn: () => getSupplier(id) })
  const balance = useQuery({
    queryKey: ['suppliers', 'balance', id],
    queryFn: () => getBalance(id),
    enabled: canSeeLedger,
  })
  const statement = useQuery({
    queryKey: ['suppliers', 'statement', id],
    queryFn: () => listStatement(id),
    enabled: canSeeLedger && tab === 'cuenta',
  })
  const purchases = useQuery({
    queryKey: ['suppliers', 'purchases', id],
    queryFn: () => listSupplierPurchases(id),
  })
  const payments = useQuery({
    queryKey: ['suppliers', 'payments', id],
    queryFn: () => listSupplierPayments(id),
    enabled: canSeeLedger && tab === 'pagos',
  })
  const products = useQuery({
    queryKey: ['suppliers', 'products', id],
    queryFn: () => listSupplierProducts(id),
    enabled: tab === 'productos',
  })

  const voidMutation = useMutation({
    mutationFn: (reason: string) => voidSupplierPayment(voiding ?? '', reason),
    onSuccess: async () => {
      setVoiding(null)
      await Promise.all(
        ['suppliers', 'purchase', 'cash', 'dashboard'].map((k) =>
          qc.invalidateQueries({ queryKey: [k] }),
        ),
      )
      toast.success('Pago anulado')
    },
    onError: (e) => {
      toast.error(toUserMessage(e))
    },
  })

  if (supplier.isPending) return <Spinner />
  if (supplier.isError) return <ErrorState error={supplier.error} />
  const s = supplier.data
  const b = balance.data

  return (
    <>
      <PageHeader
        title={s.name}
        description={
          [s.tax_id && `CUIT ${s.tax_id}`, s.phone, s.email, s.contact]
            .filter(Boolean)
            .join(' · ') || 'Proveedor'
        }
        actions={
          <>
            <Link to="/proveedores" className="text-sm text-bronze-600 underline">
              ← Proveedores
            </Link>
            {canPay && (
              <>
                <Button
                  variant="outline"
                  icon="edit"
                  onClick={() => {
                    setEditing(true)
                  }}
                >
                  Editar
                </Button>
                <Link to={`/compras/nueva?proveedor=${id}`}>
                  <Button variant="outline" icon="plus">
                    Nueva compra
                  </Button>
                </Link>
                <Button
                  variant="gold"
                  icon="dollar"
                  onClick={() => {
                    setPaying(true)
                  }}
                >
                  Registrar pago
                </Button>
              </>
            )}
          </>
        }
      />
      {canSeeLedger && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Saldo (deuda)"
            value={formatMoney(b?.balance ?? 0)}
            tone="dark"
            hint={(b?.balance ?? 0) < 0 ? 'Saldo a favor nuestro' : undefined}
          />
          <Stat
            label="Vencido"
            value={formatMoney(b?.overdue_amount ?? 0)}
            tone={(b?.overdue_amount ?? 0) > 0 ? 'danger' : 'neutral'}
          />
          <Stat label="Próximo vencimiento" value={formatDate(b?.next_due_date)} />
          <Stat label="Plazo de pago" value={`${s.payment_terms_days} días`} />
        </div>
      )}
      {!s.active && (
        <p className="mb-3">
          <Badge tone="amber">Proveedor inactivo</Badge>
        </p>
      )}
      <Tabs
        items={[
          ...(canSeeLedger ? [{ value: 'cuenta' as const, label: 'Cuenta corriente' }] : []),
          { value: 'compras' as const, label: 'Compras' },
          ...(canSeeLedger ? [{ value: 'pagos' as const, label: 'Pagos' }] : []),
          { value: 'productos' as const, label: 'Productos' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <Card>
        {tab === 'cuenta' && canSeeLedger && (
          <>
            {isOwner && (
              <div className="flex justify-end border-b border-sand-200 p-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEntry(true)
                  }}
                >
                  Saldo inicial / ajuste
                </Button>
              </div>
            )}
            <QueryBoundary
              query={statement}
              empty={{
                check: (d) => d.length === 0,
                node: (
                  <p className="p-6 text-center text-sm text-bronze-600">
                    Sin movimientos en la cuenta corriente.
                  </p>
                ),
              }}
            >
              {(rows) => (
                <Table>
                  <Thead>
                    <tr>
                      <Th>Fecha</Th>
                      <Th>Concepto</Th>
                      <Th>Detalle</Th>
                      <Th className="text-right">Debe (+)</Th>
                      <Th className="text-right">Haber (−)</Th>
                      <Th className="text-right">Saldo</Th>
                    </tr>
                  </Thead>
                  <tbody>
                    {rows.map((r) => (
                      <Tr key={r.id}>
                        <Td>{formatDate(r.entry_date)}</Td>
                        <Td>{ENTRY_LABEL[r.entry_type]}</Td>
                        <Td className="max-w-80 truncate">{r.notes}</Td>
                        <Td className="text-right tabular-nums">
                          {r.amount > 0 ? formatMoney(r.amount) : ''}
                        </Td>
                        <Td className="text-right tabular-nums">
                          {r.amount < 0 ? formatMoney(-r.amount) : ''}
                        </Td>
                        <Td className="text-right font-semibold tabular-nums">
                          {formatMoney(r.running_balance)}
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </QueryBoundary>
          </>
        )}
        {tab === 'compras' && (
          <QueryBoundary
            query={purchases}
            empty={{
              check: (d) => d.length === 0,
              node: <p className="p-6 text-center text-sm text-bronze-600">Sin compras.</p>,
            }}
          >
            {(rows) => (
              <Table>
                <Thead>
                  <tr>
                    <Th>N°</Th>
                    <Th>Fecha</Th>
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
                        <Link className="underline" to={`/compras/${p.id}`}>
                          {docNumber('C', p.number)}
                        </Link>
                      </Td>
                      <Td>{formatDate(p.purchase_date)}</Td>
                      <Td>{p.invoice_number ?? '—'}</Td>
                      <Td>{formatDate(p.due_date)}</Td>
                      <Td>
                        <Badge
                          tone={
                            p.status === 'received'
                              ? 'green'
                              : p.status === 'draft'
                                ? 'amber'
                                : 'red'
                          }
                        >
                          {p.status === 'received'
                            ? 'Recibida'
                            : p.status === 'draft'
                              ? 'Borrador'
                              : 'Anulada'}
                        </Badge>
                      </Td>
                      <Td>
                        {p.status === 'received' ? (
                          <Badge
                            tone={
                              p.payment_status === 'paid'
                                ? 'green'
                                : p.payment_status === 'partial'
                                  ? 'amber'
                                  : 'red'
                            }
                          >
                            {p.payment_status === 'paid'
                              ? 'Pagada'
                              : p.payment_status === 'partial'
                                ? 'Parcial'
                                : 'Pendiente'}
                          </Badge>
                        ) : (
                          '—'
                        )}
                      </Td>
                      <Td className="text-right tabular-nums">{formatMoney(p.total)}</Td>
                      <Td className="text-right tabular-nums">{formatMoney(p.paid_amount)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </QueryBoundary>
        )}
        {tab === 'pagos' && canSeeLedger && (
          <QueryBoundary
            query={payments}
            empty={{
              check: (d) => d.length === 0,
              node: <p className="p-6 text-center text-sm text-bronze-600">Sin pagos.</p>,
            }}
          >
            {(rows) => (
              <Table>
                <Thead>
                  <tr>
                    <Th>N°</Th>
                    <Th>Fecha</Th>
                    <Th>Medio</Th>
                    <Th>Referencia</Th>
                    <Th>Caja</Th>
                    <Th className="text-right">Monto</Th>
                    <Th />
                  </tr>
                </Thead>
                <tbody>
                  {rows.map((p) => (
                    <Tr key={p.id} className={p.voided_at ? 'opacity-50' : ''}>
                      <Td>{docNumber('P', p.number)}</Td>
                      <Td>{formatDateTime(p.paid_at)}</Td>
                      <Td>{p.payment_methods?.name}</Td>
                      <Td>{p.reference ?? '—'}</Td>
                      <Td>{p.cash_session_id ? <Badge tone="gold">Desde caja</Badge> : '—'}</Td>
                      <Td className="text-right tabular-nums">{formatMoney(p.amount)}</Td>
                      <Td className="text-right">
                        {p.voided_at ? (
                          <Badge tone="red">Anulado</Badge>
                        ) : (
                          canPay && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setVoiding(p.id)
                              }}
                            >
                              Anular
                            </Button>
                          )
                        )}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </QueryBoundary>
        )}
        {tab === 'productos' && (
          <QueryBoundary
            query={products}
            empty={{
              check: (d) => d.length === 0,
              node: (
                <p className="p-6 text-center text-sm text-bronze-600">
                  No hay productos asignados a este proveedor.
                </p>
              ),
            }}
          >
            {(rows) => (
              <Table>
                <Thead>
                  <tr>
                    <Th>Código</Th>
                    <Th>Producto</Th>
                    <Th />
                  </tr>
                </Thead>
                <tbody>
                  {rows.map((p) => (
                    <Tr key={p.id}>
                      <Td className="font-mono text-xs">{p.code}</Td>
                      <Td>
                        <Link className="underline" to={`/productos/${p.id}`}>
                          {p.name}
                        </Link>
                      </Td>
                      <Td>{!p.active && <Badge tone="amber">Inactivo</Badge>}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </QueryBoundary>
        )}
      </Card>
      {editing && (
        <SupplierFormModal
          supplier={s}
          onClose={() => {
            setEditing(false)
          }}
        />
      )}
      {paying && (
        <SupplierPaymentModal
          supplierId={id}
          openPurchases={purchases.data ?? []}
          onClose={() => {
            setPaying(false)
          }}
        />
      )}
      {entry && (
        <LedgerEntryModal
          supplierId={id}
          onClose={() => {
            setEntry(false)
          }}
        />
      )}
      <ReasonDialog
        open={voiding !== null}
        title="Anular pago"
        description="Se revierte la asignación a las compras y, si salió de la caja, se registra el reintegro en la caja abierta."
        confirmLabel="Anular pago"
        busy={voidMutation.isPending}
        onClose={() => {
          setVoiding(null)
        }}
        onConfirm={(reason) => {
          voidMutation.mutate(reason)
        }}
      />
    </>
  )
}
