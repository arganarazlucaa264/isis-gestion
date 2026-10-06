import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Checkbox, Input, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/toast-context'
import { saveSupplier } from '@/features/catalog/api'
import { toUserMessage } from '@/lib/errors'
import type { Row } from '@/types/db'

export function SupplierFormModal({
  supplier,
  onClose,
  onSaved,
}: {
  supplier: Row<'suppliers'> | null
  onClose: () => void
  onSaved?: (s: Row<'suppliers'>) => void
}) {
  const toast = useToast()
  const qc = useQueryClient()
  const [name, setName] = useState(supplier?.name ?? '')
  const [taxId, setTaxId] = useState(supplier?.tax_id ?? '')
  const [contact, setContact] = useState(supplier?.contact ?? '')
  const [phone, setPhone] = useState(supplier?.phone ?? '')
  const [email, setEmail] = useState(supplier?.email ?? '')
  const [address, setAddress] = useState(supplier?.address ?? '')
  const [terms, setTerms] = useState(String(supplier?.payment_terms_days ?? 0))
  const [notes, setNotes] = useState(supplier?.notes ?? '')
  const [active, setActive] = useState(supplier?.active ?? true)

  const clean = (s: string) => (s.trim() === '' ? null : s.trim())
  const save = useMutation({
    mutationFn: () =>
      saveSupplier(supplier?.id ?? null, {
        name: name.trim(),
        tax_id: clean(taxId),
        contact: clean(contact),
        phone: clean(phone),
        email: clean(email),
        address: clean(address),
        payment_terms_days: Math.max(0, Number(terms) || 0),
        notes: clean(notes),
        active,
      }),
    onSuccess: async (s) => {
      await qc.invalidateQueries({ queryKey: ['suppliers'] })
      await qc.invalidateQueries({ queryKey: ['lookup', 'suppliers'] })
      toast.success('Proveedor guardado')
      onSaved?.(s)
      onClose()
    },
    onError: (e) => {
      toast.error(toUserMessage(e))
    },
  })

  return (
    <Modal
      open
      title={supplier ? 'Editar proveedor' : 'Nuevo proveedor'}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={name.trim() === ''}
            loading={save.isPending}
            onClick={() => {
              save.mutate()
            }}
          >
            Guardar
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Nombre / razón social"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
          }}
          autoFocus
          wrapperClassName="sm:col-span-2"
        />
        <Input
          label="CUIT"
          value={taxId}
          onChange={(e) => {
            setTaxId(e.target.value)
          }}
        />
        <Input
          label="Contacto"
          value={contact}
          onChange={(e) => {
            setContact(e.target.value)
          }}
        />
        <Input
          label="Teléfono"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value)
          }}
        />
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
          }}
        />
        <Input
          label="Dirección"
          value={address}
          onChange={(e) => {
            setAddress(e.target.value)
          }}
          wrapperClassName="sm:col-span-2"
        />
        <Input
          label="Plazo de pago (días)"
          type="number"
          min={0}
          value={terms}
          onChange={(e) => {
            setTerms(e.target.value)
          }}
          hint="Define el vencimiento por defecto de sus compras"
        />
        {supplier && (
          <Checkbox
            label="Proveedor activo"
            checked={active}
            onChange={(e) => {
              setActive(e.target.checked)
            }}
            className="self-end pb-2"
          />
        )}
        <Textarea
          label="Notas"
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
