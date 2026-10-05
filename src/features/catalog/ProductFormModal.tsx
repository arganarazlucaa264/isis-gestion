import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Checkbox, Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/toast-context'
import { createProduct, updateProduct, type ProductInput } from '@/features/catalog/api'
import { useLookup } from '@/features/lookups/useLookup'
import { toUserMessage } from '@/lib/errors'
import type { Row } from '@/types/db'

export function ProductFormModal({
  open,
  product,
  onClose,
  onSaved,
}: {
  open: boolean
  product: Row<'products'> | null
  onClose: () => void
  onSaved: (product: Row<'products'>) => void
}) {
  const toast = useToast()
  const qc = useQueryClient()
  const categories = useLookup('categories')
  const brands = useLookup('brands')
  const suppliers = useLookup('suppliers')

  const [code, setCode] = useState(product?.code ?? '')
  const [name, setName] = useState(product?.name ?? '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [categoryId, setCategoryId] = useState(product?.category_id ?? '')
  const [brandId, setBrandId] = useState(product?.brand_id ?? '')
  const [supplierId, setSupplierId] = useState(product?.supplier_id ?? '')
  const [active, setActive] = useState(product?.active ?? true)

  const save = useMutation({
    mutationFn: () => {
      const input: ProductInput = {
        code: code.trim(),
        name: name.trim(),
        description: description.trim() === '' ? null : description.trim(),
        category_id: categoryId || null,
        brand_id: brandId || null,
        supplier_id: supplierId || null,
        active,
      }
      return product ? updateProduct(product.id, input) : createProduct(input)
    },
    onSuccess: async (saved) => {
      await qc.invalidateQueries({ queryKey: ['variants'] })
      await qc.invalidateQueries({ queryKey: ['product'] })
      toast.success(product ? 'Producto actualizado' : 'Producto creado')
      onSaved(saved)
    },
    onError: (e) => {
      toast.error(toUserMessage(e))
    },
  })

  const valid = code.trim() !== '' && name.trim() !== ''
  return (
    <Modal
      open={open}
      title={product ? 'Editar producto' : 'Nuevo producto'}
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
            Guardar
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Código de modelo"
          value={code}
          onChange={(e) => {
            setCode(e.target.value)
          }}
          hint="Ej: REM-001"
          autoFocus
        />
        <Input
          label="Nombre"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
          }}
        />
        <Select
          label="Categoría"
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value)
          }}
        >
          <option value="">Sin categoría</option>
          {categories.data
            ?.filter((c) => c.active || c.id === categoryId)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </Select>
        <Select
          label="Marca"
          value={brandId}
          onChange={(e) => {
            setBrandId(e.target.value)
          }}
        >
          <option value="">Sin marca</option>
          {brands.data
            ?.filter((b) => b.active || b.id === brandId)
            .map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
        </Select>
        <Select
          label="Proveedor habitual"
          value={supplierId}
          onChange={(e) => {
            setSupplierId(e.target.value)
          }}
        >
          <option value="">Sin proveedor</option>
          {suppliers.data
            ?.filter((s) => s.active || s.id === supplierId)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </Select>
        {product && (
          <Checkbox
            label="Producto activo"
            checked={active}
            onChange={(e) => {
              setActive(e.target.checked)
            }}
            className="self-end pb-2"
          />
        )}
        <Textarea
          label="Descripción"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value)
          }}
          wrapperClassName="sm:col-span-2"
        />
      </div>
    </Modal>
  )
}
