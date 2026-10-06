import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Badge,
  Card,
  CardHeader,
  ErrorState,
  QueryBoundary,
  Spinner,
  Stat,
} from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Checkbox, Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Table, Td, Th, Thead, Tr } from '@/components/ui/Table'
import { useToast } from '@/components/ui/toast-context'
import {
  addRows,
  applyBatch,
  createBatch,
  discardBatch,
  getBatch,
  listBatchRows,
  listBatches,
  MODE_LABEL,
  validateBatch,
  type ImportMode,
  type ImportRow,
} from '@/features/excel/api'
import { downloadTemplate } from '@/features/excel/exports'
import { useCan } from '@/features/auth/useCan'
import { toUserMessage } from '@/lib/errors'
import { docNumber, formatDateTime } from '@/lib/format'
import { IMPORT_HEADERS, type ImportKey } from '@/lib/excel/columns'
import { mapSheet, type MappedSheet } from '@/lib/excel/products'
import { downloadWorkbook, readFirstSheet } from '@/lib/excel/workbook'

const STATUS_TONE: Record<string, 'green' | 'amber' | 'red' | 'neutral'> = {
  ok: 'green',
  warning: 'amber',
  error: 'red',
  pending: 'neutral',
}
const STATUS_LABEL: Record<string, string> = {
  ok: 'OK',
  warning: 'Advertencia',
  error: 'Error',
  pending: 'Pendiente',
}
const ACTION_LABEL: Record<string, string> = {
  create: 'Crear',
  update: 'Actualizar',
  skip: 'Omitir',
}

type Filter = 'all' | 'error' | 'warning'

function Preview({ batchId, onDone }: { batchId: string; onDone: () => void }) {
  const toast = useToast()
  const qc = useQueryClient()
  const [filter, setFilter] = useState<Filter>('all')
  const [confirm, setConfirm] = useState(false)
  const [result, setResult] = useState<{ rows: number; movements: number } | null>(null)
  const batch = useQuery({
    queryKey: ['import', 'batch', batchId],
    queryFn: () => getBatch(batchId),
  })
  const rows = useQuery({
    queryKey: ['import', 'rows', batchId],
    queryFn: () => listBatchRows(batchId),
  })

  const apply = useMutation({
    mutationFn: (onlyValid: boolean) => applyBatch(batchId, onlyValid),
    onSuccess: async (b) => {
      setConfirm(false)
      const summary = (b.summary ?? {}) as { applied_rows?: number; stock_movements?: number }
      setResult({ rows: summary.applied_rows ?? 0, movements: summary.stock_movements ?? 0 })
      await Promise.all(
        ['variants', 'movements', 'import', 'dashboard', 'lookup'].map((k) =>
          qc.invalidateQueries({ queryKey: [k] }),
        ),
      )
      toast.success('Importación aplicada')
    },
    onError: (e) => {
      setConfirm(false)
      toast.error(toUserMessage(e))
      void qc.invalidateQueries({ queryKey: ['import'] })
    },
  })
  const discard = useMutation({
    mutationFn: () => discardBatch(batchId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['import'] })
      onDone()
    },
    onError: (e) => {
      toast.error(toUserMessage(e))
    },
  })

  const visible = useMemo(() => {
    const all = rows.data ?? []
    return filter === 'all' ? all : all.filter((r) => r.status === filter)
  }, [rows.data, filter])

  async function downloadErrors() {
    const bad = (rows.data ?? []).filter((r) => r.status === 'error' || r.status === 'warning')
    await downloadWorkbook(`importacion-errores-${docNumber('X', batch.data?.number ?? 0)}`, [
      {
        name: 'Errores y advertencias',
        columns: [
          { header: 'Fila', key: 'row', type: 'int', width: 8 },
          { header: 'Estado', key: 'status', type: 'text', width: 12 },
          { header: 'SKU', key: 'sku', type: 'text', width: 20 },
          { header: 'EAN', key: 'ean', type: 'text', width: 18 },
          { header: 'Errores', key: 'errors', type: 'text', width: 60 },
          { header: 'Advertencias', key: 'warnings', type: 'text', width: 60 },
        ],
        rows: bad.map((r) => ({
          row: r.row_number,
          status: STATUS_LABEL[r.status] ?? r.status,
          sku: (r.raw as Record<string, string>).sku ?? '',
          ean: (r.raw as Record<string, string>).ean ?? '',
          errors: (r.errors as string[]).join(' | '),
          warnings: (r.warnings as string[]).join(' | '),
        })),
      },
    ])
  }

  if (batch.isPending || rows.isPending) return <Spinner label="Validando…" />
  if (batch.isError) return <ErrorState error={batch.error} />
  if (rows.isError) return <ErrorState error={rows.error} />
  const b = batch.data
  const summary = (b.summary ?? {}) as { create?: number; update?: number; skip?: number }

  if (b.status === 'applied') {
    return (
      <Card>
        <CardHeader title="Importación aplicada" />
        <div className="space-y-3 p-4">
          <p>
            Se aplicaron{' '}
            {result?.rows ?? (b.summary as { applied_rows?: number } | null)?.applied_rows ?? 0}{' '}
            filas y se registraron{' '}
            {result?.movements ??
              (b.summary as { stock_movements?: number } | null)?.stock_movements ??
              0}{' '}
            movimientos de stock (solo por las diferencias).
          </p>
          <div className="flex gap-2">
            <Link to="/stock">
              <Button variant="outline">Ver stock</Button>
            </Link>
            <Button variant="gold" onClick={onDone}>
              Nueva importación
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Filas" value={b.total_rows} />
        <Stat label="Correctas" value={b.ok_rows} tone="dark" />
        <Stat label="Advertencias" value={b.warning_rows} tone="gold" />
        <Stat
          label="Con error"
          value={b.error_rows}
          tone={b.error_rows > 0 ? 'danger' : 'neutral'}
        />
        <Stat
          label="Crear / actualizar"
          value={`${summary.create ?? 0} / ${summary.update ?? 0}`}
        />
      </div>
      <Card>
        <CardHeader
          title="Vista previa"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value as Filter)
                }}
                aria-label="Filtro"
              >
                <option value="all">Todas las filas</option>
                <option value="error">Solo errores</option>
                <option value="warning">Solo advertencias</option>
              </Select>
              {(b.error_rows > 0 || b.warning_rows > 0) && (
                <Button
                  size="sm"
                  variant="outline"
                  icon="download"
                  onClick={() => {
                    void downloadErrors()
                  }}
                >
                  Descargar errores
                </Button>
              )}
            </div>
          }
        />
        <div className="max-h-[28rem] overflow-y-auto">
          <Table>
            <Thead>
              <tr>
                <Th>Fila</Th>
                <Th>Estado</Th>
                <Th>Acción</Th>
                <Th>SKU</Th>
                <Th>EAN</Th>
                <Th>Producto</Th>
                <Th>Color / Talle</Th>
                <Th className="text-right">Precio</Th>
                <Th className="text-right">Stock</Th>
                <Th>Mensajes</Th>
              </tr>
            </Thead>
            <tbody>
              {visible.map((r: ImportRow) => {
                const p = (r.parsed ?? {}) as Record<string, string | number | undefined>
                const raw = r.raw as Record<string, string>
                return (
                  <Tr key={r.id}>
                    <Td>{r.row_number}</Td>
                    <Td>
                      <Badge tone={STATUS_TONE[r.status] ?? 'neutral'}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </Badge>
                    </Td>
                    <Td>{r.action ? ACTION_LABEL[r.action] : '—'}</Td>
                    <Td className="font-mono text-xs">{String(p.sku ?? raw.sku ?? '')}</Td>
                    <Td className="font-mono text-xs">{String(p.ean ?? raw.ean ?? '')}</Td>
                    <Td>{String(p.product_name ?? raw.product_name ?? raw.product_code ?? '')}</Td>
                    <Td>
                      {String(p.color ?? raw.color ?? '')} {String(p.size ?? raw.size ?? '')}
                    </Td>
                    <Td className="text-right tabular-nums">{p.price ?? ''}</Td>
                    <Td className="text-right tabular-nums">{p.stock ?? ''}</Td>
                    <Td className="min-w-72 text-xs">
                      {(r.errors as string[]).map((m, i) => (
                        <p key={`e${i}`} className="text-red-800">
                          • {m}
                        </p>
                      ))}
                      {(r.warnings as string[]).map((m, i) => (
                        <p key={`w${i}`} className="text-amber-800">
                          • {m}
                        </p>
                      ))}
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-sand-200 p-3">
          <p className="text-sm text-bronze-600">
            Nada se escribe en el sistema hasta que confirmes.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              loading={discard.isPending}
              onClick={() => {
                discard.mutate()
              }}
            >
              Descartar
            </Button>
            <Button
              variant="gold"
              disabled={b.ok_rows + b.warning_rows === 0}
              onClick={() => {
                setConfirm(true)
              }}
            >
              Aplicar importación…
            </Button>
          </div>
        </div>
      </Card>
      <Modal
        open={confirm}
        title="Confirmar importación"
        size="sm"
        onClose={() => {
          setConfirm(false)
        }}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setConfirm(false)
              }}
            >
              Cancelar
            </Button>
            {b.error_rows > 0 ? (
              <Button
                variant="gold"
                loading={apply.isPending}
                onClick={() => {
                  apply.mutate(true)
                }}
              >
                Aplicar solo las {b.ok_rows + b.warning_rows} filas válidas
              </Button>
            ) : (
              <Button
                variant="gold"
                loading={apply.isPending}
                onClick={() => {
                  apply.mutate(false)
                }}
              >
                Aplicar
              </Button>
            )}
          </>
        }
      >
        <p className="text-sm">
          {b.error_rows > 0
            ? `${b.error_rows} filas tienen errores y se omitirán. `
            : 'Todas las filas son válidas. '}
          Se crearán {summary.create ?? 0} variantes y se actualizarán {summary.update ?? 0}. El
          stock se ajusta con movimientos solo por la diferencia. Todo se aplica en una única
          transacción.
        </p>
      </Modal>
    </>
  )
}

export function ImportPanel() {
  const toast = useToast()
  const qc = useQueryClient()
  const isCatalogRole = useCan('owner', 'manager')
  const [mode, setMode] = useState<ImportMode>(isCatalogRole ? 'catalog_stock' : 'stock')
  const [createMissing, setCreateMissing] = useState(false)
  const [mapped, setMapped] = useState<{ file: string; sheet: MappedSheet } | null>(null)
  const [batchId, setBatchId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const history = useQuery({ queryKey: ['import', 'history'], queryFn: listBatches })

  async function onFile(file: File) {
    try {
      const parsed = mapSheet(await readFirstSheet(await file.arrayBuffer()))
      setMapped({ file: file.name, sheet: parsed })
    } catch (e) {
      toast.error(toUserMessage(e))
    }
  }

  const keys = Object.keys(mapped?.sheet.recognized ?? {}) as ImportKey[]
  const hasIdentity = keys.includes('sku') || keys.includes('ean') || keys.includes('variant_id')
  const missing: string[] = []
  if (mapped) {
    if (
      !hasIdentity &&
      !(mode !== 'stock' && (keys.includes('product_code') || keys.includes('product_name')))
    )
      missing.push('SKU, EAN o ID de variante')
    if (mode === 'stock' && !keys.includes('stock')) missing.push('Stock')
  }

  async function upload() {
    if (!mapped) return
    setBusy(true)
    try {
      const batch = await createBatch(mode, mapped.file, createMissing)
      await addRows(batch.id, mapped.sheet.rows)
      await validateBatch(batch.id)
      await qc.invalidateQueries({ queryKey: ['import'] })
      setBatchId(batch.id)
    } catch (e) {
      toast.error(toUserMessage(e))
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setBatchId(null)
    setMapped(null)
  }

  if (batchId) return <Preview batchId={batchId} onDone={reset} />

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <Card>
        <CardHeader
          title="Importar desde Excel"
          actions={
            <Button
              size="sm"
              variant="outline"
              icon="download"
              onClick={() => {
                void downloadTemplate()
              }}
            >
              Descargar plantilla
            </Button>
          }
        />
        <div className="flex flex-col gap-4 p-4">
          <Select
            label="¿Qué querés importar?"
            value={mode}
            onChange={(e) => {
              setMode(e.target.value as ImportMode)
            }}
          >
            {(Object.keys(MODE_LABEL) as ImportMode[])
              .filter((m) => isCatalogRole || m === 'stock')
              .map((m) => (
                <option key={m} value={m}>
                  {MODE_LABEL[m]}
                </option>
              ))}
          </Select>
          {mode !== 'stock' && (
            <div>
              <Checkbox
                label="Crear categorías, marcas, colores y talles que no existan"
                checked={createMissing}
                onChange={(e) => {
                  setCreateMissing(e.target.checked)
                }}
              />
              <p className="mt-1 text-xs text-bronze-600">
                Si lo dejás apagado, un color o talle desconocido se marca como error (evita
                duplicados por errores de tipeo).
              </p>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onFile(f)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            onClick={() => {
              fileRef.current?.click()
            }}
            onDragOver={(e) => {
              e.preventDefault()
            }}
            onDrop={(e) => {
              e.preventDefault()
              const f = e.dataTransfer.files[0]
              if (f) void onFile(f)
            }}
            className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-sand-400 bg-cream-50 p-8 text-bronze-600 hover:border-gold-500"
          >
            <span className="text-gold-600">⬆</span>
            <span className="font-medium">
              {mapped ? mapped.file : 'Elegí un archivo .xlsx o arrastralo acá'}
            </span>
            <span className="text-xs">
              SKU y EAN se leen como texto para conservar los ceros iniciales
            </span>
          </button>
          {mapped && (
            <div className="rounded-lg bg-sand-100 p-3 text-sm">
              <p>
                <strong>{mapped.sheet.rows.length}</strong> filas · columnas reconocidas:{' '}
                {keys.map((k) => IMPORT_HEADERS[k]).join(', ') || 'ninguna'}
              </p>
              {mapped.sheet.unrecognized.length > 0 && (
                <p className="text-amber-800">
                  Se ignorarán: {mapped.sheet.unrecognized.join(', ')}
                </p>
              )}
              {missing.length > 0 && (
                <p role="alert" className="text-red-800">
                  Falta la columna: {missing.join(' y ')}
                </p>
              )}
            </div>
          )}
          <Button
            variant="gold"
            size="lg"
            disabled={!mapped || missing.length > 0 || mapped.sheet.rows.length === 0}
            loading={busy}
            onClick={() => {
              void upload()
            }}
          >
            Validar y ver vista previa
          </Button>
        </div>
      </Card>
      <Card>
        <CardHeader title="Últimas importaciones" />
        <QueryBoundary
          query={history}
          empty={{
            check: (d) => d.length === 0,
            node: <p className="p-4 text-sm text-bronze-600">Todavía no hay importaciones.</p>,
          }}
        >
          {(rows) => (
            <ul className="divide-y divide-sand-200 text-sm">
              {rows.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-2 p-3">
                  <div>
                    <p className="font-medium">
                      {docNumber('X', b.number)} · {b.file_name}
                    </p>
                    <p className="text-xs text-bronze-500">
                      {formatDateTime(b.created_at)} · {b.total_rows} filas
                    </p>
                  </div>
                  <Badge
                    tone={
                      b.status === 'applied'
                        ? 'green'
                        : b.status === 'discarded'
                          ? 'neutral'
                          : 'amber'
                    }
                  >
                    {b.status === 'applied'
                      ? 'Aplicada'
                      : b.status === 'discarded'
                        ? 'Descartada'
                        : 'Pendiente'}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </QueryBoundary>
      </Card>
    </div>
  )
}
