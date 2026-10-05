import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Card, EmptyState, PageHeader, QueryBoundary } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DateRange } from '@/components/ui/DateRange'
import { defaultRange, type Range } from '@/components/ui/date-range'
import { Select } from '@/components/ui/Field'
import { useDebounced } from '@/components/ui/useDebounced'
import { Table, Td, Th, Thead, Tr } from '@/components/ui/Table'
import { Tabs } from '@/components/ui/Tabs'
import { listVariants } from '@/features/catalog/api'
import { CodeInput } from '@/features/scanner/CodeInput'
import { AdjustStockModal } from '@/features/stock/AdjustStockModal'
import { listMovements } from '@/features/stock/api'
import { useCan } from '@/features/auth/useCan'
import { useLookup } from '@/features/lookups/useLookup'
import { formatDateTime } from '@/lib/format'
import { formatNumber } from '@/lib/money'
import { MOVEMENT_LABELS, type StockMovementType, type Variant } from '@/types/db'

type Status = '' | 'low' | 'out'

function StockTable() {
  const canAdjust = useCan('owner', 'manager', 'stock_clerk')
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [status, setStatus] = useState<Status>('')
  const [adjusting, setAdjusting] = useState<Variant | null>(null)
  const debounced = useDebounced(search)
  const categories = useLookup('categories')
  const query = useQuery({
    queryKey: ['variants', 'stock', debounced, categoryId],
    queryFn: () => listVariants({ search: debounced, categoryId: categoryId || undefined }),
  })

  const rows = useMemo(() => {
    const all = query.data ?? []
    if (status === 'out') return all.filter((v) => v.stock <= 0)
    if (status === 'low')
      return all.filter((v) => v.stock > 0 && v.min_stock > 0 && v.stock <= v.min_stock)
    return all
  }, [query.data, status])

  return (
    <Card>
      <div className="flex flex-wrap gap-3 border-b border-sand-200 p-3">
        <CodeInput
          className="min-w-64 flex-1"
          allowCamera
          clearOnSubmit={false}
          placeholder="Buscar o escanear (EAN / SKU / nombre)…"
          onChange={setSearch}
          onSubmit={setSearch}
        />
        <Select
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value)
          }}
          aria-label="Categoría"
        >
          <option value="">Todas las categorías</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as Status)
          }}
          aria-label="Estado"
        >
          <option value="">Todo el stock</option>
          <option value="low">Stock bajo</option>
          <option value="out">Sin stock</option>
        </Select>
      </div>
      <QueryBoundary
        query={{ ...query, data: query.data ? rows : undefined }}
        empty={{
          check: (d) => d.length === 0,
          node: (
            <EmptyState
              title="Sin resultados"
              description="Cambiá los filtros o cargá productos."
            />
          ),
        }}
      >
        {(data) => (
          <Table>
            <Thead>
              <tr>
                <Th>Producto</Th>
                <Th>Color</Th>
                <Th>Talle</Th>
                <Th>SKU</Th>
                <Th>EAN</Th>
                <Th className="text-right">Stock</Th>
                <Th className="text-right">Mínimo</Th>
                <Th />
              </tr>
            </Thead>
            <tbody>
              {data.map((v) => (
                <Tr key={v.variant_id}>
                  <Td className="font-medium">
                    <Link className="hover:underline" to={`/productos/${v.product_id}`}>
                      {v.product_name}
                    </Link>
                  </Td>
                  <Td>{v.color_name}</Td>
                  <Td>{v.size_name}</Td>
                  <Td className="font-mono text-xs">{v.sku}</Td>
                  <Td className="font-mono text-xs">{v.ean ?? '—'}</Td>
                  <Td className="text-right tabular-nums">
                    {formatNumber(v.stock)}{' '}
                    {v.stock <= 0 ? (
                      <Badge tone="red">Sin stock</Badge>
                    ) : v.min_stock > 0 && v.stock <= v.min_stock ? (
                      <Badge tone="amber">Bajo</Badge>
                    ) : null}
                  </Td>
                  <Td className="text-right tabular-nums">{v.min_stock}</Td>
                  <Td className="text-right">
                    {canAdjust && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setAdjusting(v)
                        }}
                      >
                        Ajustar
                      </Button>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </QueryBoundary>
      {adjusting && (
        <AdjustStockModal
          variant={adjusting}
          onClose={() => {
            setAdjusting(null)
          }}
        />
      )}
    </Card>
  )
}

function MovementsTable() {
  const [range, setRange] = useState<Range>(defaultRange())
  const [type, setType] = useState<StockMovementType | ''>('')
  const [limit, setLimit] = useState(100)
  const query = useQuery({
    queryKey: ['movements', range, type, limit],
    queryFn: () => listMovements({ from: range.from, to: range.to, type, limit }),
  })

  return (
    <Card>
      <div className="flex flex-wrap items-end gap-3 border-b border-sand-200 p-3">
        <DateRange value={range} onChange={setRange} />
        <Select
          label="Tipo"
          value={type}
          onChange={(e) => {
            setType(e.target.value as StockMovementType | '')
          }}
        >
          <option value="">Todos</option>
          {(Object.keys(MOVEMENT_LABELS) as StockMovementType[]).map((t) => (
            <option key={t} value={t}>
              {MOVEMENT_LABELS[t]}
            </option>
          ))}
        </Select>
      </div>
      <QueryBoundary
        query={query}
        empty={{
          check: (d) => d.length === 0,
          node: (
            <EmptyState
              title="Sin movimientos"
              description="No hay movimientos de stock en el período."
            />
          ),
        }}
      >
        {(rows) => (
          <>
            <Table>
              <Thead>
                <tr>
                  <Th>Fecha</Th>
                  <Th>Producto</Th>
                  <Th>Tipo</Th>
                  <Th className="text-right">Cant.</Th>
                  <Th className="text-right">Antes → Después</Th>
                  <Th>Motivo</Th>
                </tr>
              </Thead>
              <tbody>
                {rows.map((m) => (
                  <Tr key={m.id}>
                    <Td className="whitespace-nowrap">{formatDateTime(m.created_at)}</Td>
                    <Td>
                      {m.product_variants?.products?.name ?? '—'}{' '}
                      <span className="text-bronze-500">
                        {m.product_variants?.colors?.name} {m.product_variants?.sizes?.name}
                      </span>
                      <br />
                      <span className="font-mono text-xs text-bronze-600">
                        {m.product_variants?.sku}
                      </span>
                    </Td>
                    <Td>{MOVEMENT_LABELS[m.movement_type]}</Td>
                    <Td
                      className={`text-right font-semibold tabular-nums ${m.quantity > 0 ? 'text-emerald-800' : 'text-red-800'}`}
                    >
                      {m.quantity > 0 ? '+' : ''}
                      {m.quantity}
                    </Td>
                    <Td className="text-right tabular-nums">
                      {m.stock_before} → {m.stock_after}
                    </Td>
                    <Td className="max-w-64 truncate" title={m.reason ?? ''}>
                      {m.reason ?? '—'}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            {rows.length >= limit && limit < 1000 && (
              <div className="p-3 text-center">
                <Button
                  variant="outline"
                  onClick={() => {
                    setLimit(Math.min(1000, limit + 300))
                  }}
                >
                  Cargar más
                </Button>
              </div>
            )}
            {rows.length >= 1000 && (
              <p className="p-3 text-center text-xs text-bronze-600">
                Se muestran los últimos 1000 movimientos. Para ver más, acotá el período o exportá a
                Excel.
              </p>
            )}
          </>
        )}
      </QueryBoundary>
    </Card>
  )
}

export function StockPage() {
  const canSeeMovements = useCan('owner', 'manager', 'stock_clerk', 'viewer')
  const [tab, setTab] = useState<'stock' | 'movimientos'>('stock')
  return (
    <>
      <PageHeader
        title="Stock"
        description="Stock actual por modelo, color y talle. Todo cambio queda registrado como movimiento."
      />
      {canSeeMovements && (
        <Tabs
          items={[
            { value: 'stock', label: 'Stock actual' },
            { value: 'movimientos', label: 'Movimientos' },
          ]}
          value={tab}
          onChange={setTab}
        />
      )}
      {tab === 'stock' || !canSeeMovements ? <StockTable /> : <MovementsTable />}
    </>
  )
}
