import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Checkbox, Input, Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/toast-context'
import { createVariant, setVariantCost, updateVariant } from '@/features/catalog/api'
import { useCan } from '@/features/auth/useCan'
import { useLookup } from '@/features/lookups/useLookup'
import { isValidGtin, normalizeEan, suggestSku } from '@/lib/codes'
import { toUserMessage } from '@/lib/errors'
import { parseDecimal } from '@/lib/format'
import type { Variant } from '@/types/db'

export function VariantFormModal({
  open,
  productId,
  productCode,
  variant,
  currentCost,
  onClose,
}: {
  open: boolean
  productId: string
  productCode: string
  variant: Variant | null
  currentCost: number | null
  onClose: () => void
}) {
  const toast = useToast()
  const qc = useQueryClient()
  const canEdit = useCan('owner', 'manager')
  const colors = useLookup('colors')
  const sizes = useLookup('sizes')

  const [colorId, setColorId] = useState(variant?.color_id ?? '')
  const [sizeId, setSizeId] = useState(variant?.size_id ?? '')
  const [sku, setSku] = useState(variant?.sku ?? '')
  const [skuTouched, setSkuTouched] = useState(variant !== null)
  const [ean, setEan] = useState(variant?.ean ?? '')
  const [price, setPrice] = useState(variant ? String(variant.price) : '')
  const [cost, setCost] = useState(currentCost !== null ? String(currentCost) : '')
  const [minStock, setMinStock] = useState(variant ? String(variant.min_stock) : '0')
  const [initialStock, setInitialStock] = useState('0')
  const [active, setActive] = useState(variant?.active ?? true)

  function autoSku(nextColor: string, nextSize: string) {
    if (skuTouched || variant) return
    const color = colors.data?.find((c) => c.id === nextColor)?.name ?? ''
    const size = sizes.data?.find((s) => s.id === nextSize)?.name ?? ''
    if (color && size) setSku(suggestSku(productCode, color, size))
  }

  const eanTrim = ean.replace(/\s/g, '')
  const eanState =
    eanTrim === ''
      ? 'empty'
      : isValidGtin(eanTrim)
        ? 'valid'
        : normalizeEan(eanTrim)
          ? 'fixable'
          : 'invalid'

  const save = useMutation({
    mutationFn: async () => {
      const priceN = parseDecimal(price)
      const costN = cost.trim() === '' ? 0 : parseDecimal(cost)
      const eanFinal = eanTrim === '' ? null : (normalizeEan(eanTrim) ?? eanTrim)
      if (variant) {
        await updateVariant(variant.variant_id, {
          sku: sku.trim(),
          ean: eanFinal,
          price: priceN,
          min_stock: Number(minStock) || 0,
          active,
        })
        if (canEdit && cost.trim() !== '' && costN !== currentCost)
          await setVariantCost(variant.variant_id, costN)
      } else {
        await createVariant({
          productId,
          colorId,
          sizeId,
          sku: sku.trim(),
          ean: eanFinal,
          price: priceN,
          cost: costN,
          minStock: Number(minStock) || 0,
          initialStock: Number(initialStock) || 0,
        })
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['variants'] })
      await qc.invalidateQueries({ queryKey: ['costs'] })
      await qc.invalidateQueries({ queryKey: ['stock'] })
      toast.success(variant ? 'Variante actualizada' : 'Variante creada')
      onClose()
    },
    onError: (e) => {
      toast.error(toUserMessage(e))
    },
  })

  const priceValid = !Number.isNaN(parseDecimal(price)) && parseDecimal(price) >= 0
  const valid =
    sku.trim() !== '' &&
    priceValid &&
    eanState !== 'invalid' &&
    (variant !== null || (colorId !== '' && sizeId !== ''))

  return (
    <Modal
      open={open}
      title={variant ? `Editar ${variant.sku}` : 'Nueva variante'}
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
        {!variant && (
          <>
            <Select
              label="Color"
              value={colorId}
              onChange={(e) => {
                setColorId(e.target.value)
                autoSku(e.target.value, sizeId)
              }}
            >
              <option value="">Elegí un color</option>
              {colors.data
                ?.filter((c) => c.active)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </Select>
            <Select
              label="Talle"
              value={sizeId}
              onChange={(e) => {
                setSizeId(e.target.value)
                autoSku(colorId, e.target.value)
              }}
            >
              <option value="">Elegí un talle</option>
              {sizes.data
                ?.filter((s) => s.active)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </Select>
          </>
        )}
        <Input
          label="SKU"
          value={sku}
          onChange={(e) => {
            setSku(e.target.value)
            setSkuTouched(true)
          }}
          hint="Código interno único (se guarda en mayúsculas)"
        />
        <Input
          label="EAN (código de barras)"
          value={ean}
          inputMode="numeric"
          onChange={(e) => {
            setEan(e.target.value)
          }}
          error={
            eanState === 'invalid'
              ? 'EAN inválido: revisá los dígitos (EAN-8, UPC-A, EAN-13 o EAN-14)'
              : undefined
          }
          hint={
            eanState === 'valid'
              ? 'EAN válido ✓'
              : eanState === 'fixable'
                ? `Se guardará como ${normalizeEan(eanTrim) ?? ''}`
                : 'Opcional. Se usará con el lector de códigos.'
          }
        />
        <Input
          label="Precio de venta"
          value={price}
          inputMode="decimal"
          onChange={(e) => {
            setPrice(e.target.value)
          }}
          error={price !== '' && !priceValid ? 'Precio inválido' : undefined}
        />
        {canEdit && (
          <Input
            label="Costo"
            value={cost}
            inputMode="decimal"
            onChange={(e) => {
              setCost(e.target.value)
            }}
            hint="Las compras lo actualizan por promedio ponderado"
          />
        )}
        <Input
          label="Stock mínimo"
          type="number"
          min={0}
          value={minStock}
          onChange={(e) => {
            setMinStock(e.target.value)
          }}
        />
        {!variant && (
          <Input
            label="Stock inicial"
            type="number"
            min={0}
            value={initialStock}
            onChange={(e) => {
              setInitialStock(e.target.value)
            }}
            hint="Genera un movimiento de carga inicial"
          />
        )}
        {variant && (
          <Checkbox
            label="Variante activa"
            checked={active}
            onChange={(e) => {
              setActive(e.target.checked)
            }}
            className="self-end pb-2"
          />
        )}
      </div>
    </Modal>
  )
}
