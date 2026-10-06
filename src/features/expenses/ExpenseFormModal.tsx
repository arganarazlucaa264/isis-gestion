import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Checkbox, Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/toast-context'
import { useOpenSession } from '@/features/cash/useOpenSession'
import { registerExpense } from '@/features/expenses/api'
import { useLookup } from '@/features/lookups/useLookup'
import { toUserMessage } from '@/lib/errors'
import { parseDecimal, todayISO } from '@/lib/format'

export function ExpenseFormModal({ onClose }: { onClose: () => void }) {
  const toast = useToast()
  const qc = useQueryClient()
  const categories = useLookup('expense_categories')
  const methods = useLookup('payment_methods')
  const suppliers = useLookup('suppliers')
  const { session } = useOpenSession()

  const [date, setDate] = useState(todayISO())
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [methodId, setMethodId] = useState('')
  const [fromRegister, setFromRegister] = useState<boolean | null>(null)
  const [supplierId, setSupplierId] = useState('')
  const [receipt, setReceipt] = useState('')
  const [notes, setNotes] = useState('')

  const activeMethods = methods.data?.filter((m) => m.active) ?? []
  const method = activeMethods.find((m) => m.id === methodId)
  // Por defecto, un gasto en efectivo sale de la caja si hay una abierta.
  const paidFromRegister = fromRegister ?? (method?.is_cash === true && session !== undefined)
  const amountN = parseDecimal(amount)
  const valid =
    categoryId !== '' &&
    methodId !== '' &&
    description.trim() !== '' &&
    amountN > 0 &&
    (!paidFromRegister || session !== undefined)

  const save = useMutation({
    mutationFn: () =>
      registerExpense({
        date,
        categoryId,
        description: description.trim(),
        amount: amountN,
        paymentMethodId: methodId,
        paidFromRegister,
        supplierId: supplierId || null,
        receiptRef: receipt.trim() || null,
        notes: notes.trim() || null,
        sessionId: paidFromRegister ? (session?.id ?? null) : null,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['expenses'] })
      await qc.invalidateQueries({ queryKey: ['cash'] })
      await qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Gasto registrado')
      onClose()
    },
    onError: (e) => {
      toast.error(toUserMessage(e))
    },
  })

  return (
    <Modal
      open
      title="Nuevo gasto"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!valid}
            loading={save.isPending}
            onClick={() => {
              save.mutate()
            }}
          >
            Registrar gasto
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Fecha"
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value)
          }}
        />
        <Select
          label="Categoría"
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value)
          }}
        >
          <option value="">Elegí una categoría</option>
          {categories.data
            ?.filter((c) => c.active)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </Select>
        <Input
          label="Descripción"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value)
          }}
          wrapperClassName="sm:col-span-2"
        />
        <Input
          label="Monto"
          value={amount}
          inputMode="decimal"
          onChange={(e) => {
            setAmount(e.target.value)
          }}
        />
        <Select
          label="Medio de pago"
          value={methodId}
          onChange={(e) => {
            setMethodId(e.target.value)
            setFromRegister(null)
          }}
        >
          <option value="">Elegí un medio</option>
          {activeMethods.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
        <div className="sm:col-span-2">
          <Checkbox
            label="Se paga desde la caja (afecta el cierre)"
            checked={paidFromRegister}
            onChange={(e) => {
              setFromRegister(e.target.checked)
            }}
          />
          <p className="mt-1 text-xs text-bronze-600">
            {paidFromRegister
              ? method?.is_cash
                ? 'Descuenta del efectivo esperado de la caja abierta.'
                : 'Queda registrado en la caja pero NO descuenta efectivo (no es efectivo físico).'
              : 'No toca la caja: se pagó desde otra cuenta o de bolsillo.'}
          </p>
          {paidFromRegister && session === undefined && (
            <p role="alert" className="mt-1 text-xs text-red-700">
              No hay una caja abierta. Abrila para pagar desde la caja.
            </p>
          )}
        </div>
        <Select
          label="Proveedor (opcional)"
          value={supplierId}
          onChange={(e) => {
            setSupplierId(e.target.value)
          }}
        >
          <option value="">Sin proveedor</option>
          {suppliers.data
            ?.filter((s) => s.active)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </Select>
        <Input
          label="Comprobante (opcional)"
          value={receipt}
          onChange={(e) => {
            setReceipt(e.target.value)
          }}
          hint="N° de factura, ticket o recibo"
        />
        <Textarea
          label="Observaciones"
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value)
          }}
          wrapperClassName="sm:col-span-2"
        />
      </div>
    </Modal>
  )
}
