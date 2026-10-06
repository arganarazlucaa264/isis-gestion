import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'

/** Pide un motivo obligatorio antes de una acción sensible (anular, reabrir, cancelar...). */
export function ReasonDialog({
  open,
  title,
  description,
  confirmLabel,
  danger = true,
  busy = false,
  onClose,
  onConfirm,
}: {
  open: boolean
  title: string
  description?: string
  confirmLabel: string
  danger?: boolean
  busy?: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  const valid = reason.trim().length >= 3

  function close() {
    setReason('')
    onClose()
  }

  return (
    <Modal
      open={open}
      title={title}
      onClose={close}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={close}>
            Cancelar
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            disabled={!valid}
            loading={busy}
            onClick={() => {
              onConfirm(reason.trim())
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description && <p className="mb-3 text-sm text-bronze-600">{description}</p>}
      <Textarea
        label="Motivo (obligatorio)"
        value={reason}
        onChange={(e) => {
          setReason(e.target.value)
        }}
        autoFocus
      />
    </Modal>
  )
}
