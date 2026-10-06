import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Card, CardHeader, EmptyState, PageHeader, Spinner } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useDebounced } from '@/components/ui/useDebounced'
import { useToast } from '@/components/ui/toast-context'
import { findVariantByCode, searchVariants } from '@/features/catalog/api'
import { useOpenSession } from '@/features/cash/useOpenSession'
import { CheckoutModal } from '@/features/pos/CheckoutModal'
import { Receipt } from '@/features/pos/Receipt'
import { createCustomer, getSale } from '@/features/pos/api'
import {
  addToCart,
  cartTotals,
  lineGross,
  toCartLines,
  validateCart,
  type CartItem,
} from '@/features/pos/cart'
import { CodeInput } from '@/features/scanner/CodeInput'
import { useAuth } from '@/features/auth/auth-context'
import { useLookup } from '@/features/lookups/useLookup'
import { useSettings } from '@/features/settings/useSettings'
import { toUserMessage } from '@/lib/errors'
import { docNumber, parseDecimal } from '@/lib/format'
import { formatMoney, roundMoney } from '@/lib/money'
import type { Variant } from '@/types/db'

export function PosPage() {
  const toast = useToast()
  const qc = useQueryClient()
  const { profile } = useAuth()
  const { settings } = useSettings()
  const { session, isPending: sessionPending } = useOpenSession()
  const customers = useLookup('customers')

  const [items, setItems] = useState<CartItem[]>([])
  const [text, setText] = useState('')
  const [discountMode, setDiscountMode] = useState<'amount' | 'pct'>('amount')
  const [discountInput, setDiscountInput] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [checkout, setCheckout] = useState(false)
  const [doneSaleId, setDoneSaleId] = useState<string | null>(null)
  const [newCustomer, setNewCustomer] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const debounced = useDebounced(text, 250)

  const results = useQuery({
    queryKey: ['pos-search', debounced],
    queryFn: () => searchVariants(debounced.trim()),
    enabled: debounced.trim().length >= 2,
  })

  const subtotal = roundMoney(items.reduce((s, i) => s + lineGross(i), 0))
  const rawDiscount = parseDecimal(discountInput)
  const generalDiscount = Number.isNaN(rawDiscount)
    ? 0
    : discountMode === 'pct'
      ? roundMoney(((subtotal - items.reduce((s, i) => s + i.discount, 0)) * rawDiscount) / 100)
      : rawDiscount
  const totals = cartTotals(items, generalDiscount)
  const cartError = validateCart(items, totals)
  const isCashier = profile?.role === 'cashier'
  const overCap = isCashier && totals.discountPct > settings.cashier_max_discount_pct
  const canCharge = cartError === null && !overCap && session !== undefined

  function add(variant: Variant) {
    const r = addToCart(items, variant, { allowNegative: settings.allow_negative_stock })
    if (r.error) toast.error(r.error)
    else setItems(r.items)
  }

  async function onCode(code: string) {
    try {
      const v = await findVariantByCode(code)
      if (v) {
        add(v)
        setText('')
      } else {
        setText(code)
        toast.error(`No se encontró el código "${code}"`)
      }
    } catch (e) {
      toast.error(toUserMessage(e))
    }
  }

  function patchItem(variantId: string, patch: Partial<CartItem>) {
    setItems(items.map((i) => (i.variant.variant_id === variantId ? { ...i, ...patch } : i)))
  }

  function setQty(i: CartItem, qty: number) {
    if (qty <= 0) {
      setItems(items.filter((x) => x !== i))
      return
    }
    if (!settings.allow_negative_stock && qty > i.variant.stock) {
      toast.error(`Stock disponible: ${i.variant.stock}`)
      return
    }
    patchItem(i.variant.variant_id, { quantity: qty })
  }

  function reset() {
    setItems([])
    setDiscountInput('')
    setCustomerId('')
    setText('')
    setDoneSaleId(null)
  }

  const sale = useQuery({
    queryKey: ['sale', doneSaleId],
    queryFn: () => getSale(doneSaleId ?? ''),
    enabled: doneSaleId !== null,
  })

  const resultRows = useMemo(() => results.data ?? [], [results.data])

  if (sessionPending) return <Spinner />
  if (!session) {
    return (
      <>
        <PageHeader title="Vender" />
        <Card>
          <EmptyState
            title="No hay una caja abierta"
            description="Para registrar ventas primero abrí la caja con el dinero inicial."
            action={
              <Link to="/caja">
                <Button variant="gold">Ir a Caja</Button>
              </Link>
            }
          />
        </Card>
      </>
    )
  }

  const cart = (
    <Card className="flex flex-col">
      <CardHeader
        title={`Carrito (${items.reduce((s, i) => s + i.quantity, 0)})`}
        actions={
          items.length > 0 && (
            <Button size="sm" variant="ghost" onClick={reset}>
              Vaciar
            </Button>
          )
        }
      />
      {items.length === 0 ? (
        <EmptyState title="Carrito vacío" description="Escaneá un código o buscá un producto." />
      ) : (
        <ul className="divide-y divide-sand-200">
          {items.map((i) => (
            <li key={i.variant.variant_id} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{i.variant.product_name}</p>
                  <p className="text-xs text-bronze-600">
                    {i.variant.color_name} · {i.variant.size_name} ·{' '}
                    <span className="font-mono">{i.variant.sku}</span>
                  </p>
                </div>
                <p className="font-semibold tabular-nums">
                  {formatMoney(lineGross(i) - i.discount)}
                </p>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  icon="minus"
                  aria-label="Menos"
                  onClick={() => {
                    setQty(i, i.quantity - 1)
                  }}
                />
                <input
                  type="number"
                  min={1}
                  value={i.quantity}
                  aria-label="Cantidad"
                  onChange={(e) => {
                    setQty(i, Number(e.target.value))
                  }}
                  className="h-8 w-14 rounded border border-sand-300 text-center tabular-nums"
                />
                <Button
                  size="sm"
                  variant="outline"
                  icon="plus"
                  aria-label="Más"
                  onClick={() => {
                    setQty(i, i.quantity + 1)
                  }}
                />
                <span className="text-xs text-bronze-500">× {formatMoney(i.variant.price)}</span>
                <label className="ml-auto flex items-center gap-1 text-xs text-bronze-600">
                  Desc. $
                  <input
                    inputMode="decimal"
                    value={i.discount === 0 ? '' : String(i.discount)}
                    placeholder="0"
                    aria-label="Descuento de la línea"
                    onChange={(e) => {
                      const n = parseDecimal(e.target.value)
                      patchItem(i.variant.variant_id, {
                        discount: Number.isNaN(n) ? 0 : Math.max(0, n),
                      })
                    }}
                    className="h-8 w-20 rounded border border-sand-300 px-2 text-right tabular-nums"
                  />
                </label>
                <Button
                  size="sm"
                  variant="ghost"
                  icon="x"
                  aria-label="Quitar"
                  onClick={() => {
                    setItems(items.filter((x) => x !== i))
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="border-t border-sand-200 p-3">
        <div className="mb-3 flex items-end gap-2">
          <Select
            label="Cliente (opcional)"
            value={customerId}
            onChange={(e) => {
              setCustomerId(e.target.value)
            }}
            wrapperClassName="flex-1"
          >
            <option value="">Consumidor final</option>
            {customers.data
              ?.filter((c) => c.active)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </Select>
          <Button
            variant="outline"
            icon="plus"
            aria-label="Nuevo cliente"
            onClick={() => {
              setNewCustomer(true)
            }}
          />
        </div>
        <div className="mb-3 flex items-end gap-2">
          <Input
            label="Descuento general"
            value={discountInput}
            inputMode="decimal"
            placeholder="0"
            onChange={(e) => {
              setDiscountInput(e.target.value)
            }}
            wrapperClassName="flex-1"
          />
          <Select
            value={discountMode}
            onChange={(e) => {
              setDiscountMode(e.target.value as 'amount' | 'pct')
            }}
            aria-label="Tipo de descuento"
          >
            <option value="amount">$</option>
            <option value="pct">%</option>
          </Select>
        </div>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd className="tabular-nums">{formatMoney(totals.subtotal)}</dd>
          </div>
          {totals.discountTotal > 0 && (
            <div className="flex justify-between text-bronze-600">
              <dt>Descuentos ({totals.discountPct.toFixed(1)}%)</dt>
              <dd className="tabular-nums">-{formatMoney(totals.discountTotal)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-sand-300 pt-2 font-display text-3xl font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatMoney(totals.total)}</dd>
          </div>
        </dl>
        {overCap && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            El descuento supera el máximo permitido para tu rol ({settings.cashier_max_discount_pct}
            %).
          </p>
        )}
        {cartError && items.length > 0 && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {cartError}
          </p>
        )}
        <Button
          className="mt-3 w-full"
          size="lg"
          variant="gold"
          disabled={!canCharge}
          onClick={() => {
            setCheckout(true)
          }}
        >
          Cobrar {items.length > 0 ? formatMoney(totals.total) : ''}
        </Button>
      </div>
    </Card>
  )

  return (
    <>
      <PageHeader
        title="Vender"
        description={`Caja ${docNumber('C', session.number)} abierta · ${profile?.full_name ?? ''}`}
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_26rem]">
        <div className="flex flex-col gap-3">
          <Card className="p-3">
            <CodeInput
              autoFocus
              onChange={setText}
              onSubmit={(c) => {
                void onCode(c)
              }}
              placeholder="Escaneá EAN / SKU o buscá por nombre y presioná Enter"
            />
          </Card>
          <Card>
            {debounced.trim().length < 2 ? (
              <EmptyState
                title="Buscá un producto"
                description="Escribí al menos 2 letras, o escaneá el código de barras."
              />
            ) : results.isPending ? (
              <Spinner />
            ) : resultRows.length === 0 ? (
              <EmptyState
                title="Sin resultados"
                description="Probá con otro nombre, SKU o color."
              />
            ) : (
              <ul className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
                {resultRows.map((v) => (
                  <li key={v.variant_id}>
                    <button
                      type="button"
                      onClick={() => {
                        add(v)
                      }}
                      disabled={v.stock <= 0 && !settings.allow_negative_stock}
                      className="flex h-full w-full flex-col gap-1 rounded-lg border border-sand-300 bg-white p-3 text-left transition hover:border-gold-500 hover:shadow disabled:opacity-50"
                    >
                      <span className="font-medium">{v.product_name}</span>
                      <span className="text-xs text-bronze-600">
                        {v.color_name} · Talle {v.size_name}
                      </span>
                      <span className="font-mono text-[11px] text-bronze-500">{v.sku}</span>
                      <span className="mt-auto flex items-center justify-between pt-1">
                        <span className="font-semibold tabular-nums">{formatMoney(v.price)}</span>
                        {v.stock <= 0 ? (
                          <Badge tone="red">Sin stock</Badge>
                        ) : (
                          <Badge
                            tone={v.min_stock > 0 && v.stock <= v.min_stock ? 'amber' : 'neutral'}
                          >
                            Stock {v.stock}
                          </Badge>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div className="lg:sticky lg:top-4 lg:self-start">{cart}</div>
      </div>

      {items.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 border-t border-ink-700 bg-ink-900 px-4 py-3 text-cream-50 lg:hidden print:hidden">
          <div>
            <p className="text-[11px] tracking-wide text-sand-400 uppercase">
              {items.reduce((s, i) => s + i.quantity, 0)} artículos
            </p>
            <p className="font-display text-2xl font-semibold text-gold-400 tabular-nums">
              {formatMoney(totals.total)}
            </p>
          </div>
          <Button
            variant="gold"
            size="lg"
            disabled={!canCharge}
            onClick={() => {
              setCheckout(true)
            }}
          >
            Cobrar
          </Button>
        </div>
      )}
      <div className="h-20 lg:hidden" aria-hidden="true" />
      {checkout && (
        <CheckoutModal
          total={totals.total}
          items={toCartLines(items)}
          generalDiscount={totals.generalDiscount}
          customerId={customerId || null}
          sessionId={session.id}
          onClose={() => {
            setCheckout(false)
          }}
          onDone={(id) => {
            setCheckout(false)
            setDoneSaleId(id)
            void qc.invalidateQueries({ queryKey: ['variants'] })
            void qc.invalidateQueries({ queryKey: ['cash'] })
            void qc.invalidateQueries({ queryKey: ['sales'] })
            void qc.invalidateQueries({ queryKey: ['dashboard'] })
            void qc.invalidateQueries({ queryKey: ['pos-search'] })
            void qc.invalidateQueries({ queryKey: ['movements'] })
          }}
        />
      )}
      <Modal
        open={doneSaleId !== null}
        title="Venta registrada"
        size="sm"
        onClose={reset}
        footer={
          <Button variant="gold" size="lg" icon="plus" onClick={reset}>
            Nueva venta
          </Button>
        }
      >
        {sale.isPending ? <Spinner /> : sale.data ? <Receipt sale={sale.data} /> : null}
      </Modal>
      <Modal
        open={newCustomer}
        title="Nuevo cliente"
        size="sm"
        onClose={() => {
          setNewCustomer(false)
        }}
        footer={
          <Button
            disabled={customerName.trim() === ''}
            onClick={() => {
              void createCustomer(customerName.trim(), null)
                .then(async (c) => {
                  await qc.invalidateQueries({ queryKey: ['lookup', 'customers'] })
                  setCustomerId(c.id)
                  setNewCustomer(false)
                  setCustomerName('')
                })
                .catch((e: unknown) => {
                  toast.error(toUserMessage(e))
                })
            }}
          >
            Guardar
          </Button>
        }
      >
        <Input
          label="Nombre"
          value={customerName}
          onChange={(e) => {
            setCustomerName(e.target.value)
          }}
          autoFocus
        />
      </Modal>
    </>
  )
}
