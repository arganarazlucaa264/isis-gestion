import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  PageHeader,
  Spinner,
  Stat,
} from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Field'
import { ReasonDialog } from '@/components/ui/ReasonDialog'
import { Table, Td, Th, Thead, Tr } from '@/components/ui/Table'
import { useToast } from '@/components/ui/toast-context'
import { findVariantByCode, searchVariants } from '@/features/catalog/api'
import {
  cancelPurchase,
  getLastCost,
  getPurchase,
  listPurchasePayments,
  receivePurchase,
  savePurchase,
  type PurchaseFull,
  type ReceivePayment,
} from '@/features/purchases/api'
import { PaymentBadge, PurchaseStatusBadge } from '@/features/purchases/PurchasesPage'
import { ReceiveModal } from '@/features/purchases/ReceiveModal'
import { CodeInput } from '@/features/scanner/CodeInput'
import { SupplierPaymentModal } from '@/features/suppliers/SupplierPaymentModal'
import { useCan } from '@/features/auth/useCan'
import { useLookup } from '@/features/lookups/useLookup'
import { useDebounced } from '@/components/ui/useDebounced'
import { toUserMessage } from '@/lib/errors'
import { docNumber, formatDate, formatDateTime, parseDecimal, todayISO } from '@/lib/format'
import { formatMoney, roundMoney } from '@/lib/money'
import type { Variant } from '@/types/db'

interface Line {
  variant: Pick<
    Variant,
    'variant_id' | 'sku' | 'product_name' | 'color_name' | 'size_name' | 'stock'
  >
  quantity: string
  unitCost: string
}

function Editor({ purchase }: { purchase: PurchaseFull | null }) {
  const toast = useToast()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const canPay = useCan('owner', 'manager')
  const canSave = useCan('owner', 'manager')
  const suppliers = useLookup('suppliers')

  const [supplierId, setSupplierId] = useState(
    purchase?.supplier_id ?? params.get('proveedor') ?? '',
  )
  const [invoice, setInvoice] = useState(purchase?.invoice_number ?? '')
  const [date, setDate] = useState(purchase?.purchase_date ?? todayISO())
  const [dueDate, setDueDate] = useState(purchase?.due_date ?? '')
  const [discount, setDiscount] = useState(
    purchase && purchase.discount_amount > 0 ? String(purchase.discount_amount) : '',
  )
  const [tax, setTax] = useState(
    purchase && purchase.tax_amount > 0 ? String(purchase.tax_amount) : '',
  )
  const [notes, setNotes] = useState(purchase?.notes ?? '')
  const [lines, setLines] = useState<Line[]>(() =>
    (purchase?.purchase_items ?? []).map((i) => ({
      variant: {
        variant_id: i.variant_id,
        sku: i.sku,
        product_name: i.product_name,
        color_name: i.color_name,
        size_name: i.size_name,
        stock: 0,
      },
      quantity: String(i.quantity),
      unitCost: String(i.unit_cost),
    })),
  )
  const [text, setText] = useState('')
  const [receiving, setReceiving] = useState(false)
  const debounced = useDebounced(text, 250)

  const results = useQuery({
    queryKey: ['purchase-search', debounced],
    queryFn: () => searchVariants(debounced.trim(), 15),
    enabled: debounced.trim().length >= 2,
  })

  async function addVariant(v: Variant) {
    if (lines.some((l) => l.variant.variant_id === v.variant_id)) {
      setLines(
        lines.map((l) =>
          l.variant.variant_id === v.variant_id
            ? { ...l, quantity: String((Number(l.quantity) || 0) + 1) }
            : l,
        ),
      )
      return
    }
    let cost = 0
    try {
      cost = await getLastCost(v.variant_id)
    } catch {
      cost = 0
    }
    setLines((prev) => [
      ...prev,
      { variant: v, quantity: '1', unitCost: cost > 0 ? String(cost) : '' },
    ])
  }

  async function onCode(code: string) {
    try {
      const v = await findVariantByCode(code)
      if (v) {
        await addVariant(v)
        setText('')
      } else {
        setText(code)
        toast.error(`No se encontró el código "${code}"`)
      }
    } catch (e) {
      toast.error(toUserMessage(e))
    }
  }

  const parsed = lines.map((l) => ({ ...l, q: Number(l.quantity), c: parseDecimal(l.unitCost) }))
  const subtotal = roundMoney(
    parsed.reduce((s, l) => s + (Number.isFinite(l.q) && !Number.isNaN(l.c) ? l.q * l.c : 0), 0),
  )
  const discountN = discount.trim() === '' ? 0 : parseDecimal(discount)
  const taxN = tax.trim() === '' ? 0 : parseDecimal(tax)
  const total = roundMoney(
    subtotal - (Number.isNaN(discountN) ? 0 : discountN) + (Number.isNaN(taxN) ? 0 : taxN),
  )
  const linesValid =
    parsed.length > 0 &&
    parsed.every((l) => Number.isInteger(l.q) && l.q > 0 && !Number.isNaN(l.c) && l.c >= 0)
  const valid =
    supplierId !== '' &&
    linesValid &&
    !Number.isNaN(discountN) &&
    !Number.isNaN(taxN) &&
    discountN >= 0 &&
    taxN >= 0 &&
    discountN <= subtotal

  const input = useMemo(
    () => ({
      purchaseId: purchase?.id ?? null,
      supplierId,
      invoiceNumber: invoice.trim() || null,
      purchaseDate: date,
      dueDate: dueDate || null,
      discount: Number.isNaN(discountN) ? 0 : discountN,
      tax: Number.isNaN(taxN) ? 0 : taxN,
      notes: notes.trim() || null,
      items: parsed.map((l) => ({
        variant_id: l.variant.variant_id,
        quantity: l.q,
        unit_cost: l.c,
      })),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [purchase?.id, supplierId, invoice, date, dueDate, discountN, taxN, notes, lines],
  )

  const refresh = async () => {
    await Promise.all(
      ['purchases', 'purchase', 'variants', 'suppliers', 'cash', 'dashboard', 'movements'].map(
        (k) => qc.invalidateQueries({ queryKey: [k] }),
      ),
    )
  }

  const save = useMutation({
    mutationFn: () => savePurchase(input),
    onSuccess: async (p) => {
      await refresh()
      toast.success('Borrador guardado')
      void navigate(`/compras/${p.id}`, { replace: true })
    },
    onError: (e) => {
      toast.error(toUserMessage(e))
    },
  })

  async function saveAndReceive(payment: ReceivePayment | null) {
    const p = await savePurchase(input)
    await receivePurchase(p.id, payment)
    await refresh()
    toast.success('Compra recibida: stock, costos y cuenta corriente actualizados')
    void navigate(`/compras/${p.id}`, { replace: true })
  }

  const supplierOptions = suppliers.data?.filter((s) => s.active || s.id === supplierId) ?? []

  return (
    <>
      <PageHeader
        title={purchase ? `Compra ${docNumber('C', purchase.number)} (borrador)` : 'Nueva compra'}
        description="Cargá los productos, costos, descuentos e impuestos. Al recibirla entra el stock y se asienta la deuda."
        actions={
          <Link to="/compras" className="text-sm text-bronze-600 underline">
            ← Compras
          </Link>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Datos de la compra" />
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <Select
                label="Proveedor"
                value={supplierId}
                onChange={(e) => {
                  setSupplierId(e.target.value)
                }}
              >
                <option value="">Elegí un proveedor</option>
                {supplierOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
              <Input
                label="N° de factura"
                value={invoice}
                onChange={(e) => {
                  setInvoice(e.target.value)
                }}
              />
              <Input
                label="Fecha"
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value)
                }}
              />
              <Input
                label="Vencimiento"
                type="date"
                value={dueDate}
                min={date}
                onChange={(e) => {
                  setDueDate(e.target.value)
                }}
                hint="Vacío: se calcula con el plazo del proveedor"
              />
            </div>
          </Card>
          <Card>
            <CardHeader title="Productos" />
            <div className="p-3">
              <CodeInput
                onChange={setText}
                onSubmit={(c) => {
                  void onCode(c)
                }}
                placeholder="Escaneá EAN / SKU o buscá por nombre y presioná Enter"
              />
              {debounced.trim().length >= 2 && (results.data?.length ?? 0) > 0 && (
                <ul className="mt-2 max-h-56 divide-y divide-sand-200 overflow-y-auto rounded-lg border border-sand-300 bg-white">
                  {results.data?.map((v) => (
                    <li key={v.variant_id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-sand-100"
                        onClick={() => {
                          void addVariant(v)
                          setText('')
                        }}
                      >
                        <span>
                          {v.product_name} · {v.color_name} · {v.size_name}{' '}
                          <span className="font-mono text-xs text-bronze-500">{v.sku}</span>
                        </span>
                        <Badge>Stock {v.stock}</Badge>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {lines.length === 0 ? (
              <EmptyState title="Sin productos" description="Agregá al menos una variante." />
            ) : (
              <Table>
                <Thead>
                  <tr>
                    <Th>Producto</Th>
                    <Th className="text-right">Cantidad</Th>
                    <Th className="text-right">Costo unit.</Th>
                    <Th className="text-right">Subtotal</Th>
                    <Th />
                  </tr>
                </Thead>
                <tbody>
                  {parsed.map((l, idx) => (
                    <Tr key={l.variant.variant_id}>
                      <Td>
                        {l.variant.product_name}{' '}
                        <span className="text-bronze-500">
                          {l.variant.color_name} · {l.variant.size_name}
                        </span>
                        <br />
                        <span className="font-mono text-xs text-bronze-600">{l.variant.sku}</span>
                      </Td>
                      <Td className="text-right">
                        <input
                          type="number"
                          min={1}
                          value={l.quantity}
                          aria-label={`Cantidad ${l.variant.sku}`}
                          onChange={(e) => {
                            setLines(
                              lines.map((x, i) =>
                                i === idx ? { ...x, quantity: e.target.value } : x,
                              ),
                            )
                          }}
                          className="h-8 w-20 rounded border border-sand-300 px-2 text-right tabular-nums"
                        />
                      </Td>
                      <Td className="text-right">
                        <input
                          inputMode="decimal"
                          value={l.unitCost}
                          aria-label={`Costo ${l.variant.sku}`}
                          onChange={(e) => {
                            setLines(
                              lines.map((x, i) =>
                                i === idx ? { ...x, unitCost: e.target.value } : x,
                              ),
                            )
                          }}
                          className="h-8 w-28 rounded border border-sand-300 px-2 text-right tabular-nums"
                        />
                      </Td>
                      <Td className="text-right tabular-nums">
                        {Number.isFinite(l.q) && !Number.isNaN(l.c)
                          ? formatMoney(roundMoney(l.q * l.c))
                          : '—'}
                      </Td>
                      <Td className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          icon="x"
                          aria-label="Quitar"
                          onClick={() => {
                            setLines(lines.filter((_, i) => i !== idx))
                          }}
                        />
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
          <Textarea
            label="Notas"
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value)
            }}
          />
        </div>
        <Card className="h-fit p-4 lg:sticky lg:top-4">
          <div className="grid gap-3">
            <Input
              label="Descuento ($)"
              value={discount}
              inputMode="decimal"
              placeholder="0"
              onChange={(e) => {
                setDiscount(e.target.value)
              }}
            />
            <Input
              label="Impuestos / IVA ($)"
              value={tax}
              inputMode="decimal"
              placeholder="0"
              onChange={(e) => {
                setTax(e.target.value)
              }}
              hint="No integra el costo de la mercadería"
            />
          </div>
          <dl className="mt-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd className="tabular-nums">{formatMoney(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Descuento</dt>
              <dd className="tabular-nums">
                -{formatMoney(Number.isNaN(discountN) ? 0 : discountN)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Impuestos</dt>
              <dd className="tabular-nums">{formatMoney(Number.isNaN(taxN) ? 0 : taxN)}</dd>
            </div>
            <div className="flex justify-between border-t border-sand-300 pt-2 font-display text-3xl font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatMoney(total)}</dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-col gap-2">
            {canSave && (
              <Button
                variant="outline"
                disabled={!valid}
                loading={save.isPending}
                onClick={() => {
                  save.mutate()
                }}
              >
                Guardar borrador
              </Button>
            )}
            <Button
              variant="gold"
              size="lg"
              disabled={!valid || total <= 0}
              onClick={() => {
                setReceiving(true)
              }}
            >
              Recibir mercadería
            </Button>
          </div>
        </Card>
      </div>
      {receiving && (
        <ReceiveModal
          total={total}
          canPay={canPay}
          onClose={() => {
            setReceiving(false)
          }}
          onConfirm={async (payment) => {
            await saveAndReceive(payment)
          }}
        />
      )}
    </>
  )
}

function Viewer({ purchase }: { purchase: PurchaseFull }) {
  const toast = useToast()
  const qc = useQueryClient()
  const canPay = useCan('owner', 'manager')
  const [paying, setPaying] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const payments = useQuery({
    queryKey: ['purchase', 'payments', purchase.id],
    queryFn: () => listPurchasePayments(purchase.id),
  })
  const cancel = useMutation({
    mutationFn: (reason: string) => cancelPurchase(purchase.id, reason),
    onSuccess: async () => {
      setCancelling(false)
      await Promise.all(
        ['purchases', 'purchase', 'variants', 'suppliers', 'movements', 'dashboard'].map((k) =>
          qc.invalidateQueries({ queryKey: [k] }),
        ),
      )
      toast.success('Compra anulada')
    },
    onError: (e) => {
      toast.error(toUserMessage(e))
    },
  })
  const pending = purchase.total - purchase.paid_amount

  return (
    <>
      <PageHeader
        title={`Compra ${docNumber('C', purchase.number)}`}
        description={`${purchase.suppliers?.name ?? ''} · ${formatDate(purchase.purchase_date)}${purchase.invoice_number ? ` · Factura ${purchase.invoice_number}` : ''}`}
        actions={
          <>
            <Link to="/compras" className="text-sm text-bronze-600 underline">
              ← Compras
            </Link>
            {canPay && purchase.status === 'received' && pending > 0 && (
              <Button
                variant="gold"
                icon="dollar"
                onClick={() => {
                  setPaying(true)
                }}
              >
                Registrar pago
              </Button>
            )}
            {canPay && purchase.status !== 'cancelled' && (
              <Button
                variant="danger"
                onClick={() => {
                  setCancelling(true)
                }}
              >
                Anular compra
              </Button>
            )}
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <PurchaseStatusBadge status={purchase.status} />
        {purchase.status === 'received' && <PaymentBadge status={purchase.payment_status} />}
        {purchase.received_at && (
          <span className="text-sm text-bronze-600">
            Recibida {formatDateTime(purchase.received_at)}
          </span>
        )}
        {purchase.cancelled_at && (
          <span className="text-sm text-red-800">
            Anulada {formatDateTime(purchase.cancelled_at)}: {purchase.cancel_reason}
          </span>
        )}
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total" value={formatMoney(purchase.total)} tone="dark" />
        <Stat label="Pagado" value={formatMoney(purchase.paid_amount)} />
        <Stat
          label="Pendiente"
          value={formatMoney(purchase.status === 'received' ? pending : 0)}
          tone={pending > 0 && purchase.status === 'received' ? 'danger' : 'neutral'}
        />
        <Stat label="Vencimiento" value={formatDate(purchase.due_date)} />
      </div>
      <Card className="mb-4">
        <CardHeader title="Productos" />
        <Table>
          <Thead>
            <tr>
              <Th>Producto</Th>
              <Th>SKU</Th>
              <Th className="text-right">Cantidad</Th>
              <Th className="text-right">Costo unit.</Th>
              <Th className="text-right">Subtotal</Th>
            </tr>
          </Thead>
          <tbody>
            {purchase.purchase_items.map((i) => (
              <Tr key={i.id}>
                <Td>
                  {i.product_name}{' '}
                  <span className="text-bronze-500">
                    {i.color_name} · {i.size_name}
                  </span>
                </Td>
                <Td className="font-mono text-xs">{i.sku}</Td>
                <Td className="text-right tabular-nums">{i.quantity}</Td>
                <Td className="text-right tabular-nums">{formatMoney(i.unit_cost)}</Td>
                <Td className="text-right tabular-nums">{formatMoney(i.line_total)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
        <dl className="ml-auto max-w-xs space-y-1 p-4 text-sm">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd className="tabular-nums">{formatMoney(purchase.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Descuento</dt>
            <dd className="tabular-nums">-{formatMoney(purchase.discount_amount)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Impuestos</dt>
            <dd className="tabular-nums">{formatMoney(purchase.tax_amount)}</dd>
          </div>
          <div className="flex justify-between border-t border-sand-300 pt-1 font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatMoney(purchase.total)}</dd>
          </div>
        </dl>
      </Card>
      {(payments.data?.length ?? 0) > 0 && (
        <Card>
          <CardHeader title="Pagos aplicados" />
          <Table>
            <Thead>
              <tr>
                <Th>Pago</Th>
                <Th>Fecha</Th>
                <Th>Medio</Th>
                <Th>Referencia</Th>
                <Th className="text-right">Aplicado</Th>
              </tr>
            </Thead>
            <tbody>
              {payments.data?.map((p, idx) => (
                <Tr key={idx} className={p.supplier_payments?.voided_at ? 'opacity-50' : ''}>
                  <Td>
                    {p.supplier_payments ? docNumber('P', p.supplier_payments.number) : '—'}{' '}
                    {p.supplier_payments?.voided_at && <Badge tone="red">Anulado</Badge>}
                  </Td>
                  <Td>{formatDateTime(p.supplier_payments?.paid_at)}</Td>
                  <Td>{p.supplier_payments?.payment_methods?.name}</Td>
                  <Td>{p.supplier_payments?.reference ?? '—'}</Td>
                  <Td className="text-right tabular-nums">{formatMoney(p.amount)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
      {paying && (
        <SupplierPaymentModal
          supplierId={purchase.supplier_id}
          openPurchases={[purchase]}
          presetPurchaseId={purchase.id}
          onClose={() => {
            setPaying(false)
          }}
        />
      )}
      <ReasonDialog
        open={cancelling}
        title="Anular compra"
        description={
          purchase.status === 'received'
            ? 'Se revierte el stock (movimiento de devolución a proveedor) y la deuda (nota de crédito). Los pagos ya hechos quedan como saldo a favor.'
            : 'El borrador queda anulado sin efectos.'
        }
        confirmLabel="Anular compra"
        busy={cancel.isPending}
        onClose={() => {
          setCancelling(false)
        }}
        onConfirm={(reason) => {
          cancel.mutate(reason)
        }}
      />
    </>
  )
}

export function PurchaseEditorPage() {
  const { id } = useParams()
  const query = useQuery({
    queryKey: ['purchase', id],
    queryFn: () => getPurchase(id ?? ''),
    enabled: id !== undefined,
  })

  if (id === undefined) return <Editor purchase={null} />
  if (query.isPending) return <Spinner />
  if (query.isError) return <ErrorState error={query.error} />
  return query.data.status === 'draft' ? (
    <Editor key={query.data.id} purchase={query.data} />
  ) : (
    <Viewer purchase={query.data} />
  )
}
