import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Checkbox, Input, Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/toast-context'
import { useOpenSession } from '@/features/cash/useOpenSession'
import { useLookup } from '@/features/lookups/useLookup'
import { toUserMessage } from '@/lib/errors'
import { parseDecimal } from '@/lib/format'
import { formatMoney } from '@/lib/money'
import type { ReceivePayment } from '@/features/purchases/api'

type Mode = 'pending' | 'full' | 'partial'

/** Recepción: stock + costos + deuda; opcionalmente paga en el acto (total o parcial). */
export function ReceiveModal({
  total,
  canPay,
  busyExternal = false,
  onConfirm,
  onClose,
}: {
  total: number
  canPay: boolean
  busyExternal?: boolean
  onConfirm: (payment: ReceivePayment | null) => Promise<void>
  onClose: () => void
}) {
  const toast = useToast()
  const methods = useLookup('payment_methods')
  const { session } = useOpenSession()
  const [mode, setMode] = useState<Mode>('pending')
  const [methodId, setMethodId] = useState('')
  const [partial, setPartial] = useState('')
  const [reference, setReference] = useState('')
  const [fromRegister, setFromRegister] = useState<boolean | null>(null)

  const active = methods.data?.filter((m) => m.active) ?? []
  const method = active.find((m) => m.id === (methodId || active[0]?.id))
  const fromReg = fromRegister ?? (method?.is_cash === true && session !== undefined)
  const amount = mode === 'full' ? total : parseDecimal(partial)
  const valid =
    mode === 'pending' ||
    (amount > 0 && amount <= total && method !== undefined && (!fromReg || session !== undefined))

  const run = useMutation({
    mutationFn: () =>
      onConfirm(
        mode === 'pending' || !method
          ? null
          : {
              payment_method_id: method.id,
              amount,
              from_register: fromReg,
              ...(reference.trim() ? { reference: reference.trim() } : {}),
            },
      ),
    onError: (e) => {
      toast.error(toUserMessage(e))
    },
  })

  return (
    <Modal
      open
      title="Recibir mercadería"
      size="md"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="gold"
            disabled={!valid}
            loading={run.isPending || busyExternal}
            onClick={() => {
              run.mutate()
            }}
          >
            Confirmar recepción
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm">
        Al confirmar: entra el stock, se actualiza el costo (promedio ponderado) y se asienta la
        deuda de <strong>{formatMoney(total)}</strong> en la cuenta corriente del proveedor.
      </p>
      {canPay ? (
        <div className="flex flex-col gap-3">
          <Select
            label="Pago"
            value={mode}
            onChange={(e) => {
              setMode(e.target.value as Mode)
            }}
          >
            <option value="pending">Pendiente (queda a cuenta corriente)</option>
            <option value="full">Pagada en su totalidad</option>
            <option value="partial">Pago parcial</option>
          </Select>
          {mode !== 'pending' && (
            <>
              {mode === 'partial' && (
                <Input
                  label="Monto pagado ahora"
                  value={partial}
                  inputMode="decimal"
                  onChange={(e) => {
                    setPartial(e.target.value)
                  }}
                  hint={
                    amount > 0 && amount <= total
                      ? `Quedan ${formatMoney(total - amount)} pendientes`
                      : undefined
                  }
                />
              )}
              <Select
                label="Medio de pago"
                value={method?.id ?? ''}
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
              <Checkbox
                label="Sale de la caja (afecta el cierre)"
                checked={fromReg}
                onChange={(e) => {
                  setFromRegister(e.target.checked)
                }}
              />
              {fromReg && session === undefined && (
                <p role="alert" className="text-xs text-red-700">
                  No hay una caja abierta.
                </p>
              )}
              <Input
                label="Referencia"
                value={reference}
                onChange={(e) => {
                  setReference(e.target.value)
                }}
              />
            </>
          )}
        </div>
      ) : (
        <p className="text-sm text-bronze-600">
          La compra quedará pendiente de pago (los pagos los registra el dueño o el encargado).
        </p>
      )}
    </Modal>
  )
}
