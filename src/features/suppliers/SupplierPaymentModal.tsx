import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Checkbox, Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Table, Td, Th, Thead, Tr } from '@/components/ui/Table'
import { useToast } from '@/components/ui/toast-context'
import { useOpenSession } from '@/features/cash/useOpenSession'
import { registerSupplierPayment } from '@/features/suppliers/api'
import { useLookup } from '@/features/lookups/useLookup'
import { toUserMessage } from '@/lib/errors'
import { docNumber, formatDate, parseDecimal } from '@/lib/format'
import { formatMoney, roundMoney } from '@/lib/money'
import type { Row } from '@/types/db'

export function SupplierPaymentModal({
  supplierId,
  openPurchases,
  presetPurchaseId,
  onClose,
}: {
  supplierId: string
  openPurchases: Row<'purchases'>[]
  presetPurchaseId?: string
  onClose: () => void
}) {
  const toast = useToast()
  const qc = useQueryClient()
  const methods = useLookup('payment_methods')
  const { session } = useOpenSession()
  const pending = openPurchases.filter(
    (p) => p.status === 'received' && p.total - p.paid_amount > 0,
  )
  const preset = pending.find((p) => p.id === presetPurchaseId)

  const [amount, setAmount] = useState(
    preset ? String(roundMoney(preset.total - preset.paid_amount)) : '',
  )
  const [methodId, setMethodId] = useState('')
  const [fromRegister, setFromRegister] = useState<boolean | null>(null)
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [mode, setMode] = useState<'auto' | 'manual'>(preset ? 'manual' : 'auto')
  const [manual, setManual] = useState<Record<string, string>>(
    preset ? { [preset.id]: String(roundMoney(preset.total - preset.paid_amount)) } : {},
  )

  const active = methods.data?.filter((m) => m.active) ?? []
  const method = active.find((m) => m.id === (methodId || active[0]?.id))
  const effectiveMethod = method?.id ?? ''
  const fromReg = fromRegister ?? (method?.is_cash === true && session !== undefined)
  const amountN = parseDecimal(amount)
  const allocations = Object.entries(manual)
    .map(([purchase_id, v]) => ({ purchase_id, amount: parseDecimal(v) }))
    .filter((a) => !Number.isNaN(a.amount) && a.amount > 0)
  const allocated = roundMoney(allocations.reduce((s, a) => s + a.amount, 0))
  const manualValid = mode === 'auto' || (allocations.length > 0 && allocated <= amountN)
  const valid =
    amountN > 0 && effectiveMethod !== '' && manualValid && (!fromReg || session !== undefined)

  const save = useMutation({
    mutationFn: () =>
      registerSupplierPayment({
        supplierId,
        methodId: effectiveMethod,
        amount: amountN,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
        allocations: mode === 'manual' ? allocations : null,
        fromRegister: fromReg,
        sessionId: fromReg ? (session?.id ?? null) : null,
      }),
    onSuccess: async () => {
      await Promise.all(
        ['suppliers', 'purchase', 'purchases', 'cash', 'dashboard'].map((k) =>
          qc.invalidateQueries({ queryKey: [k] }),
        ),
      )
      toast.success('Pago registrado')
      onClose()
    },
    onError: (e) => {
      toast.error(toUserMessage(e))
    },
  })

  return (
    <Modal
      open
      title="Registrar pago a proveedor"
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="gold"
            disabled={!valid}
            loading={save.isPending}
            onClick={() => {
              save.mutate()
            }}
          >
            Registrar pago
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Monto"
          value={amount}
          inputMode="decimal"
          onChange={(e) => {
            setAmount(e.target.value)
          }}
          autoFocus
        />
        <Select
          label="Medio de pago"
          value={effectiveMethod}
          onChange={(e) => {
            setMethodId(e.target.value)
            setFromRegister(null)
          }}
        >
          {active.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
        <div className="sm:col-span-2">
          <Checkbox
            label="Sale de la caja (afecta el cierre)"
            checked={fromReg}
            onChange={(e) => {
              setFromRegister(e.target.checked)
            }}
          />
          <p className="mt-1 text-xs text-bronze-600">
            {fromReg
              ? method?.is_cash
                ? 'Descuenta del efectivo esperado de la caja abierta.'
                : 'Queda registrado en la caja sin descontar efectivo.'
              : 'No toca la caja (se paga desde otra cuenta).'}
          </p>
          {fromReg && session === undefined && (
            <p role="alert" className="text-xs text-red-700">
              No hay una caja abierta.
            </p>
          )}
        </div>
        <Input
          label="Referencia"
          value={reference}
          onChange={(e) => {
            setReference(e.target.value)
          }}
          hint="N° de transferencia, recibo, cheque…"
        />
        <Select
          label="Aplicar a"
          value={mode}
          onChange={(e) => {
            setMode(e.target.value as 'auto' | 'manual')
          }}
        >
          <option value="auto">Las compras más antiguas primero (automático)</option>
          <option value="manual">Elegir compras</option>
        </Select>
      </div>
      {mode === 'manual' && (
        <div className="mt-3">
          {pending.length === 0 ? (
            <p className="text-sm text-bronze-600">No hay compras con saldo pendiente.</p>
          ) : (
            <Table>
              <Thead>
                <tr>
                  <Th>Compra</Th>
                  <Th>Vence</Th>
                  <Th className="text-right">Pendiente</Th>
                  <Th className="text-right">Aplicar</Th>
                </tr>
              </Thead>
              <tbody>
                {pending.map((p) => (
                  <Tr key={p.id}>
                    <Td>
                      {docNumber('C', p.number)}
                      {p.invoice_number ? ` · ${p.invoice_number}` : ''}
                    </Td>
                    <Td>{formatDate(p.due_date)}</Td>
                    <Td className="text-right tabular-nums">
                      {formatMoney(p.total - p.paid_amount)}
                    </Td>
                    <Td className="text-right">
                      <input
                        inputMode="decimal"
                        value={manual[p.id] ?? ''}
                        aria-label={`Aplicar a compra ${p.number}`}
                        onChange={(e) => {
                          setManual({ ...manual, [p.id]: e.target.value })
                        }}
                        className="h-8 w-28 rounded border border-sand-300 px-2 text-right tabular-nums"
                      />
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
          <p className="mt-1 text-xs text-bronze-600">
            Asignado {formatMoney(allocated)} de {formatMoney(Number.isNaN(amountN) ? 0 : amountN)}.
            Lo no asignado queda como saldo a favor.
          </p>
        </div>
      )}
      <Textarea
        label="Notas"
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value)
        }}
        wrapperClassName="mt-3"
      />
    </Modal>
  )
}
