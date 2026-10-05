import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Badge,
  Card,
  CardHeader,
  ErrorState,
  PageHeader,
  QueryBoundary,
  Spinner,
  Stat,
} from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { ReasonDialog } from '@/components/ui/ReasonDialog'
import { Table, Td, Th, Thead, Tr } from '@/components/ui/Table'
import { useToast } from '@/components/ui/toast-context'
import { findVariantByCode } from '@/features/catalog/api'
import {
  applyCount,
  cancelCount,
  getInventory,
  listItems,
  recordCount,
  recordCountsBulk,
  reopenCount,
  STATUS_LABEL,
  submitReview,
  type InventoryItem,
} from '@/features/inventory/api'
import { CodeInput } from '@/features/scanner/CodeInput'
import { useCan } from '@/features/auth/useCan'
import { toUserMessage } from '@/lib/errors'
import { docNumber, formatDateTime } from '@/lib/format'
import { mapSheet } from '@/lib/excel/products'
import { downloadWorkbook, readFirstSheet } from '@/lib/excel/workbook'
import { formatNumber } from '@/lib/money'

function label(i: InventoryItem): string {
  const v = i.product_variants
  return `${v?.products?.name ?? ''} · ${v?.colors?.name ?? ''} · ${v?.sizes?.name ?? ''}`
}

export function InventoryDetailPage() {
  const { id = '' } = useParams()
  const canOperate = useCan('owner', 'manager', 'stock_clerk')
  const toast = useToast()
  const qc = useQueryClient()
  const [onlyPending, setOnlyPending] = useState(false)
  const [onlyDiff, setOnlyDiff] = useState(false)
  const [lastScan, setLastScan] = useState<string | null>(null)
  const [confirmApply, setConfirmApply] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const count = useQuery({ queryKey: ['inventory', id], queryFn: () => getInventory(id) })
  const items = useQuery({ queryKey: ['inventory-items', id], queryFn: () => listItems(id) })

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['inventory', id] })
    await qc.invalidateQueries({ queryKey: ['inventory-items', id] })
    await qc.invalidateQueries({ queryKey: ['inventories'] })
  }
  const onError = (e: unknown) => {
    toast.error(toUserMessage(e))
  }

  const setQty = useMutation({
    mutationFn: (v: { variantId: string; quantity: number; mode: 'set' | 'add' }) =>
      recordCount({ countId: id, variantId: v.variantId, quantity: v.quantity, mode: v.mode }),
    onSuccess: refresh,
    onError,
  })
  const review = useMutation({ mutationFn: () => submitReview(id), onSuccess: refresh, onError })
  const reopen = useMutation({ mutationFn: () => reopenCount(id), onSuccess: refresh, onError })
  const apply = useMutation({
    mutationFn: () => applyCount(id),
    onSuccess: async () => {
      setConfirmApply(false)
      await refresh()
      await qc.invalidateQueries({ queryKey: ['variants'] })
      await qc.invalidateQueries({ queryKey: ['movements'] })
      toast.success('Inventario aplicado: los ajustes quedaron registrados como movimientos')
    },
    onError,
  })
  const cancel = useMutation({
    mutationFn: (reason: string) => cancelCount(id, reason),
    onSuccess: async () => {
      setCancelling(false)
      await refresh()
    },
    onError,
  })

  async function onScan(code: string) {
    try {
      const variant = await findVariantByCode(code)
      if (!variant) {
        toast.error(`Código no encontrado: ${code}`)
        return
      }
      await setQty.mutateAsync({ variantId: variant.variant_id, quantity: 1, mode: 'add' })
      setLastScan(`${variant.product_name} · ${variant.color_name} · ${variant.size_name} (+1)`)
    } catch (e) {
      onError(e)
    }
  }

  async function onImportFile(file: File) {
    try {
      const mapped = mapSheet(await readFirstSheet(await file.arrayBuffer()))
      if (
        !mapped.recognized.stock ||
        (!mapped.recognized.ean && !mapped.recognized.sku && !mapped.recognized.variant_id)
      ) {
        toast.error(
          'El archivo necesita una columna de código (EAN, SKU o ID) y una de Stock/Contado',
        )
        return
      }
      const rows = mapped.rows.map((r) => ({
        ...(r.raw.variant_id ? { variant_id: r.raw.variant_id } : {}),
        ...(r.raw.ean ? { ean: r.raw.ean } : {}),
        ...(r.raw.sku ? { sku: r.raw.sku } : {}),
        counted_qty: r.raw.stock ?? '',
      }))
      let updated = 0
      const missing: string[] = []
      for (let i = 0; i < rows.length; i += 500) {
        const res = await recordCountsBulk(id, rows.slice(i, i + 500))
        updated += res.updated
        missing.push(...res.not_found, ...res.invalid)
      }
      await refresh()
      if (missing.length > 0)
        toast.error(
          `${updated} conteos cargados. No se pudieron cargar: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}`,
        )
      else toast.success(`${updated} conteos cargados`)
    } catch (e) {
      onError(e)
    }
  }

  const stats = useMemo(() => {
    const all = items.data ?? []
    const counted = all.filter((i) => i.counted_qty !== null)
    return {
      total: all.length,
      counted: counted.length,
      missing: counted.filter((i) => (i.counted_qty ?? 0) < i.expected_qty).length,
      surplus: counted.filter((i) => (i.counted_qty ?? 0) > i.expected_qty).length,
    }
  }, [items.data])

  const visible = useMemo(() => {
    let rows = items.data ?? []
    if (onlyPending) rows = rows.filter((i) => i.counted_qty === null)
    if (onlyDiff)
      rows = rows.filter((i) => i.counted_qty !== null && i.counted_qty !== i.expected_qty)
    return rows
  }, [items.data, onlyPending, onlyDiff])

  async function exportSheet() {
    const rows = (items.data ?? []).map((i) => ({
      sku: i.product_variants?.sku ?? '',
      ean: i.product_variants?.ean ?? '',
      product: i.product_variants?.products?.name ?? '',
      color: i.product_variants?.colors?.name ?? '',
      size: i.product_variants?.sizes?.name ?? '',
      expected: i.expected_qty,
      counted: i.counted_qty,
      difference: i.counted_qty === null ? null : i.counted_qty - i.expected_qty,
    }))
    await downloadWorkbook(`inventario-${docNumber('I', count.data?.number ?? 0)}`, [
      {
        name: 'Inventario',
        columns: [
          { header: 'SKU', key: 'sku', type: 'text', width: 20 },
          { header: 'EAN', key: 'ean', type: 'text', width: 18 },
          { header: 'Producto', key: 'product', type: 'text', width: 30 },
          { header: 'Color', key: 'color', type: 'text', width: 14 },
          { header: 'Talle', key: 'size', type: 'text', width: 10 },
          { header: 'Sistema (foto)', key: 'expected', type: 'int' },
          { header: 'Stock', key: 'counted', type: 'int' },
          { header: 'Diferencia', key: 'difference', type: 'int' },
        ],
        rows,
      },
    ])
  }

  if (count.isPending) return <Spinner />
  if (count.isError) return <ErrorState error={count.error} />
  const c = count.data
  const counting = c.status === 'counting'
  const inReview = c.status === 'review'

  return (
    <>
      <PageHeader
        title={`${docNumber('I', c.number)} · ${c.name}`}
        description={`${STATUS_LABEL[c.status] ?? c.status} · iniciado ${formatDateTime(c.started_at)}`}
        actions={
          <>
            <Link to="/inventarios" className="text-sm text-bronze-600 underline">
              ← Inventarios
            </Link>
            <Button
              variant="outline"
              icon="download"
              onClick={() => {
                void exportSheet()
              }}
            >
              Exportar
            </Button>
            {canOperate && counting && (
              <>
                <Button
                  variant="outline"
                  icon="upload"
                  onClick={() => {
                    fileRef.current?.click()
                  }}
                >
                  Cargar conteo (Excel)
                </Button>
                <Button
                  variant="gold"
                  icon="check"
                  loading={review.isPending}
                  onClick={() => {
                    review.mutate()
                  }}
                >
                  Pasar a revisión
                </Button>
              </>
            )}
            {canOperate && inReview && (
              <>
                <Button
                  variant="outline"
                  icon="undo"
                  loading={reopen.isPending}
                  onClick={() => {
                    reopen.mutate()
                  }}
                >
                  Volver a contar
                </Button>
                <Button
                  variant="gold"
                  icon="check"
                  onClick={() => {
                    setConfirmApply(true)
                  }}
                >
                  Aplicar ajustes
                </Button>
              </>
            )}
            {canOperate && (counting || inReview) && (
              <Button
                variant="danger"
                onClick={() => {
                  setCancelling(true)
                }}
              >
                Cancelar
              </Button>
            )}
          </>
        }
      />
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void onImportFile(f)
          e.target.value = ''
        }}
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Variantes" value={formatNumber(stats.total)} />
        <Stat label="Contadas" value={`${stats.counted} / ${stats.total}`} tone="dark" />
        <Stat label="Faltantes" value={stats.missing} tone={stats.missing ? 'danger' : 'neutral'} />
        <Stat label="Sobrantes" value={stats.surplus} tone="gold" />
      </div>
      {canOperate && counting && (
        <Card className="mb-4 p-3">
          <CodeInput
            autoFocus
            placeholder="Escaneá un código (EAN / SKU) para sumar 1 unidad al conteo"
            onSubmit={(code) => {
              void onScan(code)
            }}
          />
          {lastScan && <p className="mt-2 text-sm text-emerald-800">Último: {lastScan}</p>}
        </Card>
      )}
      <Card>
        <CardHeader
          title="Detalle del conteo"
          actions={
            <div className="flex gap-4">
              <Checkbox
                label="Solo pendientes"
                checked={onlyPending}
                onChange={(e) => {
                  setOnlyPending(e.target.checked)
                }}
              />
              <Checkbox
                label="Solo con diferencia"
                checked={onlyDiff}
                onChange={(e) => {
                  setOnlyDiff(e.target.checked)
                }}
              />
            </div>
          }
        />
        <QueryBoundary query={{ ...items, data: items.data ? visible : undefined }}>
          {(rows) => (
            <Table>
              <Thead>
                <tr>
                  <Th>Producto</Th>
                  <Th>SKU</Th>
                  <Th>EAN</Th>
                  <Th className="text-right">Sistema (foto)</Th>
                  <Th className="text-right">Contado</Th>
                  <Th className="text-right">Diferencia</Th>
                </tr>
              </Thead>
              <tbody>
                {rows.map((i) => {
                  const diff = i.counted_qty === null ? null : i.counted_qty - i.expected_qty
                  return (
                    <Tr key={i.id}>
                      <Td>{label(i)}</Td>
                      <Td className="font-mono text-xs">{i.product_variants?.sku}</Td>
                      <Td className="font-mono text-xs">{i.product_variants?.ean ?? '—'}</Td>
                      <Td className="text-right tabular-nums">{i.expected_qty}</Td>
                      <Td className="text-right">
                        {canOperate && counting ? (
                          <input
                            type="number"
                            min={0}
                            defaultValue={i.counted_qty ?? ''}
                            key={`${i.id}:${i.counted_qty ?? ''}`}
                            aria-label={`Contado ${i.product_variants?.sku ?? ''}`}
                            className="h-8 w-20 rounded border border-sand-300 bg-white px-2 text-right tabular-nums"
                            onBlur={(e) => {
                              const raw = e.target.value
                              if (raw === '' || Number(raw) === i.counted_qty) return
                              setQty.mutate({
                                variantId: i.variant_id,
                                quantity: Number(raw),
                                mode: 'set',
                              })
                            }}
                          />
                        ) : (
                          <span className="tabular-nums">{i.counted_qty ?? '—'}</span>
                        )}
                      </Td>
                      <Td className="text-right tabular-nums">
                        {c.status === 'applied' && i.difference !== null ? (
                          <Badge
                            tone={
                              i.difference === 0 ? 'neutral' : i.difference < 0 ? 'red' : 'green'
                            }
                          >
                            {i.difference > 0 ? '+' : ''}
                            {i.difference} (aplicado)
                          </Badge>
                        ) : diff === null ? (
                          <Badge tone="neutral">Pendiente</Badge>
                        ) : (
                          <Badge tone={diff === 0 ? 'neutral' : diff < 0 ? 'red' : 'green'}>
                            {diff > 0 ? '+' : ''}
                            {diff}
                          </Badge>
                        )}
                      </Td>
                    </Tr>
                  )
                })}
              </tbody>
            </Table>
          )}
        </QueryBoundary>
      </Card>
      <Modal
        open={confirmApply}
        title="Aplicar ajustes de inventario"
        onClose={() => {
          setConfirmApply(false)
        }}
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmApply(false)
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="gold"
              loading={apply.isPending}
              onClick={() => {
                apply.mutate()
              }}
            >
              Aplicar
            </Button>
          </>
        }
      >
        <p className="text-sm">
          Se generará un movimiento de stock por cada diferencia ({stats.missing} faltantes,{' '}
          {stats.surplus} sobrantes). Las variantes no contadas no se modifican. Esta acción no se
          puede deshacer; solo se corrige con nuevos movimientos.
        </p>
      </Modal>
      <ReasonDialog
        open={cancelling}
        title="Cancelar inventario"
        description="El inventario queda cancelado y no modifica el stock."
        confirmLabel="Cancelar inventario"
        busy={cancel.isPending}
        onClose={() => {
          setCancelling(false)
        }}
        onConfirm={(reason) => {
          cancel.mutate(reason)
        }}
      />
    </>
  )
}
