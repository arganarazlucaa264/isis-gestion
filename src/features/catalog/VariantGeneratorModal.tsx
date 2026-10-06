import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Checkbox, Input } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/toast-context'
import { createVariant } from '@/features/catalog/api'
import { useLookup } from '@/features/lookups/useLookup'
import { suggestSku } from '@/lib/codes'
import { toUserMessage } from '@/lib/errors'
import { parseDecimal } from '@/lib/format'
import type { Variant } from '@/types/db'

/** Crea de una vez todas las combinaciones color x talle elegidas (omite las que ya existen). */
export function VariantGeneratorModal({
  open,
  productId,
  productCode,
  existing,
  onClose,
}: {
  open: boolean
  productId: string
  productCode: string
  existing: Variant[]
  onClose: () => void
}) {
  const toast = useToast()
  const qc = useQueryClient()
  const colors = useLookup('colors')
  const sizes = useLookup('sizes')
  const [colorIds, setColorIds] = useState<string[]>([])
  const [sizeIds, setSizeIds] = useState<string[]>([])
  const [price, setPrice] = useState('')
  const [cost, setCost] = useState('')
  const [minStock, setMinStock] = useState('1')
  const [busy, setBusy] = useState(false)

  function toggle(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
  }

  const exists = (c: string, s: string) => existing.some((v) => v.color_id === c && v.size_id === s)
  const combos = colorIds
    .flatMap((c) => sizeIds.map((s) => ({ c, s })))
    .filter(({ c, s }) => !exists(c, s))
  const priceN = parseDecimal(price)
  const valid = combos.length > 0 && !Number.isNaN(priceN) && priceN >= 0

  async function generate() {
    setBusy(true)
    let ok = 0
    const failures: string[] = []
    for (const { c, s } of combos) {
      const color = colors.data?.find((x) => x.id === c)?.name ?? ''
      const size = sizes.data?.find((x) => x.id === s)?.name ?? ''
      try {
        await createVariant({
          productId,
          colorId: c,
          sizeId: s,
          sku: suggestSku(productCode, color, size),
          ean: null,
          price: priceN,
          cost: cost.trim() === '' ? 0 : parseDecimal(cost),
          minStock: Number(minStock) || 0,
          initialStock: 0,
        })
        ok += 1
      } catch (e) {
        failures.push(`${color} ${size}: ${toUserMessage(e)}`)
      }
    }
    setBusy(false)
    await qc.invalidateQueries({ queryKey: ['variants'] })
    await qc.invalidateQueries({ queryKey: ['costs'] })
    if (failures.length > 0)
      toast.error(`${ok} creadas, ${failures.length} con error: ${failures[0] ?? ''}`)
    else toast.success(`${ok} variantes creadas`)
    if (ok > 0 && failures.length === 0) onClose()
  }

  return (
    <Modal
      open={open}
      title="Generar variantes"
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!valid}
            loading={busy}
            onClick={() => {
              void generate()
            }}
          >
            Crear {combos.length} variantes
          </Button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <fieldset>
          <legend className="mb-2 text-xs font-semibold tracking-wide text-bronze-600 uppercase">
            Colores
          </legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {colors.data
              ?.filter((c) => c.active)
              .map((c) => (
                <Checkbox
                  key={c.id}
                  label={c.name}
                  checked={colorIds.includes(c.id)}
                  onChange={() => {
                    setColorIds(toggle(colorIds, c.id))
                  }}
                />
              ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-xs font-semibold tracking-wide text-bronze-600 uppercase">
            Talles
          </legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {sizes.data
              ?.filter((s) => s.active)
              .map((s) => (
                <Checkbox
                  key={s.id}
                  label={s.name}
                  checked={sizeIds.includes(s.id)}
                  onChange={() => {
                    setSizeIds(toggle(sizeIds, s.id))
                  }}
                />
              ))}
          </div>
        </fieldset>
        <Input
          label="Precio de venta"
          value={price}
          inputMode="decimal"
          onChange={(e) => {
            setPrice(e.target.value)
          }}
        />
        <Input
          label="Costo (opcional)"
          value={cost}
          inputMode="decimal"
          onChange={(e) => {
            setCost(e.target.value)
          }}
        />
        <Input
          label="Stock mínimo"
          type="number"
          min={0}
          value={minStock}
          onChange={(e) => {
            setMinStock(e.target.value)
          }}
        />
      </div>
      <p className="mt-3 text-sm text-bronze-600">
        Los SKU se generan como MODELO-COLOR-TALLE. El EAN y el stock se cargan después (por Excel,
        por compra o por ajuste).
      </p>
    </Modal>
  )
}
