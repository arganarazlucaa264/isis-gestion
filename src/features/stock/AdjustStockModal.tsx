import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/toast-context'
import { adjustStock, type ManualAdjustType } from '@/features/stock/api'
import { toUserMessage } from '@/lib/errors'
import { MOVEMENT_LABELS, type Variant } from '@/types/db'

const TYPES: ManualAdjustType[] = [
  'adjustment_in',
  'adjustment_out',
  'damage_out',
  'theft_out',
  'internal_use_out',
  'initial_load',
]

export function AdjustStockModal({ variant, onClose }: { variant: Variant; onClose: () => void }) {
  const toast = useToast()
  const qc = useQueryClient()
  const [type, setType] = useState<ManualAdjustType>('adjustment_in')
  const [quantity, setQuantity] = useState('1')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')

  const sign = type === 'adjustment_in' || type === 'initial_load' ? 1 : -1
  const qty = Number(quantity)
  const valid = Number.isInteger(qty) && qty > 0 && reason.trim() !== ''

  const save = useMutation({
    mutationFn: () =>
      adjustStock({
        variantId: variant.variant_id,
        type,
        quantity: qty,
        reason: reason.trim(),
        notes: notes.trim() || null,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['variants'] })
      await qc.invalidateQueries({ queryKey: ['movements'] })
      await qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Stock actualizado')
      onClose()
    },
    onError: (e) => {
      toast.error(toUserMessage(e))
    },
  })

  return (
    <Modal
      open
      title="Ajustar stock"
      onClose={onClose}
      size="sm"
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
            Registrar movimiento
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm">
        <strong>{variant.product_name}</strong> · {variant.color_name} · {variant.size_name}
        <br />
        <span className="font-mono text-xs text-bronze-600">{variant.sku}</span> — Stock actual:{' '}
        <strong>{variant.stock}</strong>
      </p>
      <div className="flex flex-col gap-3">
        <Select
          label="Tipo de movimiento"
          value={type}
          onChange={(e) => {
            setType(e.target.value as ManualAdjustType)
          }}
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {MOVEMENT_LABELS[t]}
            </option>
          ))}
        </Select>
        <Input
          label="Cantidad"
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => {
            setQuantity(e.target.value)
          }}
          hint={valid ? `Stock resultante: ${variant.stock + sign * qty}` : undefined}
        />
        <Input
          label="Motivo (obligatorio)"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value)
          }}
        />
        <Textarea
          label="Observaciones"
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value)
          }}
        />
      </div>
    </Modal>
  )
}
