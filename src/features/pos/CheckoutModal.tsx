import { useMutation } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/toast-context'
import { registerSale, type CartLine } from '@/features/pos/api'
import {
  paymentSummary,
  toPaymentInputs,
  validatePayments,
  type PaymentRow,
} from '@/features/pos/cart'
import { useLookup } from '@/features/lookups/useLookup'
import { toUserMessage } from '@/lib/errors'
import { parseDecimal } from '@/lib/format'
import { formatMoney } from '@/lib/money'
import type { Row } from '@/types/db'

export function CheckoutModal({
  total,
  items,
  generalDiscount,
  customerId,
  sessionId,
  onClose,
  onDone,
}: {
  total: number
  items: CartLine[]
  generalDiscount: number
  customerId: string | null
  sessionId: string
  onClose: () => void
  onDone: (saleId: string) => void
}) {
  const toast = useToast()
  const methods = useLookup('payment_methods')
  const [rows, setRows] = useState<PaymentRow[]>([])
  // Una clave por intento de cobro: si el usuario hace doble clic, la base devuelve la misma venta.
  const [requestId] = useState(() => crypto.randomUUID())

  const active = useMemo(() => methods.data?.filter((m) => m.active) ?? [], [methods.data])
  const summary = paymentSummary(rows, total, parseDecimal)
  const error = validatePayments(rows, parseDecimal)

  function addRow(m: Row<'payment_methods'>) {
    const remaining = Math.max(0, summary.remaining)
    setRows([
      ...rows,
      {
        id: crypto.randomUUID(),
        methodId: m.id,
        code: m.code,
        isCash: m.is_cash,
        amount: remaining > 0 ? String(remaining) : '',
        tendered: '',
        installments: m.code === 'credit' ? '1' : '',
        reference: '',
      },
    ])
  }
  function patch(id: string, p: Partial<PaymentRow>) {
    setRows(rows.map((r) => (r.id === id ? { ...r, ...p } : r)))
  }

  const pay = useMutation({
    mutationFn: () =>
      registerSale({
        items,
        payments: toPaymentInputs(rows, parseDecimal),
        clientRequestId: requestId,
        customerId,
        generalDiscount,
        notes: null,
        sessionId,
      }),
    onSuccess: (sale) => {
      onDone(sale.id)
    },
    onError: (e) => {
      toast.error(toUserMessage(e))
    },
  })

  return (
    <Modal
      open
      title="Cobrar"
      size="md"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Volver
          </Button>
          <Button
            variant="gold"
            size="lg"
            disabled={!summary.balanced || error !== null}
            loading={pay.isPending}
            onClick={() => {
              pay.mutate()
            }}
          >
            Confirmar venta
          </Button>
        </>
      }
    >
      <div className="mb-4 rounded-xl bg-ink-900 p-4 text-center text-cream-50">
        <p className="text-xs tracking-wide uppercase opacity-70">Total a cobrar</p>
        <p className="font-display text-5xl font-semibold text-gold-400 tabular-nums">
          {formatMoney(total)}
        </p>
      </div>

      <p className="mb-2 text-xs font-semibold tracking-wide text-bronze-600 uppercase">
        Agregar medio de pago
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        {active.map((m) => (
          <Button
            key={m.id}
            size="sm"
            variant="outline"
            icon="plus"
            onClick={() => {
              addRow(m)
            }}
          >
            {m.name}
          </Button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {rows.map((r) => {
          const method = active.find((m) => m.id === r.methodId)
          const amount = parseDecimal(r.amount)
          const tendered = r.tendered.trim() === '' ? amount : parseDecimal(r.tendered)
          return (
            <div key={r.id} className="rounded-lg border border-sand-300 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-semibold">
                  {method?.name}
                  {!r.isCash && (
                    <span className="ml-2 text-xs font-normal text-bronze-500">
                      (no es efectivo físico)
                    </span>
                  )}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  icon="x"
                  aria-label="Quitar pago"
                  onClick={() => {
                    setRows(rows.filter((x) => x.id !== r.id))
                  }}
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  label="Monto a cobrar"
                  value={r.amount}
                  inputMode="decimal"
                  onChange={(e) => {
                    patch(r.id, { amount: e.target.value })
                  }}
                />
                {r.isCash ? (
                  <Input
                    label="Efectivo recibido"
                    value={r.tendered}
                    inputMode="decimal"
                    placeholder={r.amount}
                    onChange={(e) => {
                      patch(r.id, { tendered: e.target.value })
                    }}
                    hint={
                      !Number.isNaN(tendered) && tendered > amount
                        ? `Vuelto: ${formatMoney(tendered - amount)}`
                        : undefined
                    }
                  />
                ) : r.code === 'credit' ? (
                  <Select
                    label="Cuotas"
                    value={r.installments}
                    onChange={(e) => {
                      patch(r.id, { installments: e.target.value })
                    }}
                  >
                    {[1, 2, 3, 6, 12].map((n) => (
                      <option key={n} value={n}>
                        {n} {n === 1 ? 'pago' : 'cuotas'}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    label="Referencia (opcional)"
                    value={r.reference}
                    onChange={(e) => {
                      patch(r.id, { reference: e.target.value })
                    }}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>

      {rows.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-lg bg-sand-100 p-2">
            <p className="text-xs text-bronze-600">Cobrado</p>
            <p className="font-semibold tabular-nums">{formatMoney(summary.paid)}</p>
          </div>
          <div
            className={`rounded-lg p-2 ${summary.remaining === 0 ? 'bg-emerald-100' : 'bg-amber-100'}`}
          >
            <p className="text-xs text-bronze-600">
              {summary.remaining < 0 ? 'Excedente' : 'Falta cobrar'}
            </p>
            <p className="font-semibold tabular-nums">{formatMoney(Math.abs(summary.remaining))}</p>
          </div>
          <div className="rounded-lg bg-gold-300/40 p-2">
            <p className="text-xs text-bronze-600">Vuelto</p>
            <p className="font-semibold tabular-nums">{formatMoney(summary.change)}</p>
          </div>
        </div>
      )}
      {error && rows.length > 0 && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </Modal>
  )
}
