import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Card, EmptyState, PageHeader, QueryBoundary } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Field'
import { SearchBox } from '@/components/ui/SearchBox'
import { useDebounced } from '@/components/ui/useDebounced'
import { Table, Td, Th, Thead, Tr } from '@/components/ui/Table'
import { Tabs } from '@/components/ui/Tabs'
import { listVariants } from '@/features/catalog/api'
import { MastersPanel } from '@/features/catalog/MastersPanel'
import { ProductFormModal } from '@/features/catalog/ProductFormModal'
import { useCan } from '@/features/auth/useCan'
import { useLookup } from '@/features/lookups/useLookup'
import { formatMoney, formatNumber } from '@/lib/money'
import type { Variant } from '@/types/db'

interface ProductRow {
  id: string
  code: string
  name: string
  category: string | null
  variants: number
  stock: number
  minPrice: number
  maxPrice: number
  low: boolean
}

function groupByProduct(variants: Variant[]): ProductRow[] {
  const map = new Map<string, ProductRow>()
  for (const v of variants) {
    const row = map.get(v.product_id) ?? {
      id: v.product_id,
      code: v.product_code,
      name: v.product_name,
      category: v.category_name,
      variants: 0,
      stock: 0,
      minPrice: Number.POSITIVE_INFINITY,
      maxPrice: 0,
      low: false,
    }
    row.variants += 1
    row.stock += v.stock
    row.minPrice = Math.min(row.minPrice, v.price)
    row.maxPrice = Math.max(row.maxPrice, v.price)
    if (v.stock <= 0 || (v.min_stock > 0 && v.stock <= v.min_stock)) row.low = true
    map.set(v.product_id, row)
  }
  return [...map.values()]
}

export function ProductsPage() {
  const navigate = useNavigate()
  const canEdit = useCan('owner', 'manager')
  const [tab, setTab] = useState<'productos' | 'maestros'>('productos')
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [creating, setCreating] = useState(false)
  const debounced = useDebounced(search)
  const categories = useLookup('categories')

  const query = useQuery({
    queryKey: ['variants', 'products-list', debounced, categoryId],
    queryFn: () => listVariants({ search: debounced, categoryId: categoryId || undefined }),
  })
  const rows = useMemo(() => (query.data ? groupByProduct(query.data) : []), [query.data])

  return (
    <>
      <PageHeader
        title="Productos"
        description="Modelos con sus variantes por color y talle."
        actions={
          canEdit && (
            <Button
              icon="plus"
              variant="gold"
              onClick={() => {
                setCreating(true)
              }}
            >
              Nuevo producto
            </Button>
          )
        }
      />
      {canEdit && (
        <Tabs
          items={[
            { value: 'productos', label: 'Productos' },
            { value: 'maestros', label: 'Categorías, marcas, colores y talles' },
          ]}
          value={tab}
          onChange={setTab}
        />
      )}
      {tab === 'maestros' && canEdit ? (
        <MastersPanel />
      ) : (
        <Card>
          <div className="flex flex-wrap gap-3 border-b border-sand-200 p-3">
            <SearchBox
              value={search}
              onChange={setSearch}
              placeholder="Buscar por nombre, código, SKU, color o EAN…"
              className="min-w-64 flex-1"
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
          </div>
          <QueryBoundary
            query={{ ...query, data: rows.length === 0 && query.isPending ? undefined : rows }}
            empty={{
              check: (d) => d.length === 0,
              node: (
                <EmptyState
                  title="Sin productos"
                  description="Creá el primer producto o cambiá los filtros."
                />
              ),
            }}
          >
            {(data) => (
              <Table>
                <Thead>
                  <tr>
                    <Th>Código</Th>
                    <Th>Producto</Th>
                    <Th>Categoría</Th>
                    <Th className="text-right">Variantes</Th>
                    <Th className="text-right">Stock total</Th>
                    <Th className="text-right">Precio</Th>
                  </tr>
                </Thead>
                <tbody>
                  {data.map((p) => (
                    <Tr
                      key={p.id}
                      className="cursor-pointer"
                      onClick={() => {
                        void navigate(`/productos/${p.id}`)
                      }}
                    >
                      <Td className="font-mono text-xs">{p.code}</Td>
                      <Td className="font-medium">{p.name}</Td>
                      <Td>{p.category ?? '—'}</Td>
                      <Td className="text-right tabular-nums">{p.variants}</Td>
                      <Td className="text-right tabular-nums">
                        {formatNumber(p.stock)} {p.low && <Badge tone="amber">Stock bajo</Badge>}
                      </Td>
                      <Td className="text-right tabular-nums">
                        {p.minPrice === p.maxPrice
                          ? formatMoney(p.minPrice)
                          : `${formatMoney(p.minPrice)} – ${formatMoney(p.maxPrice)}`}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </QueryBoundary>
        </Card>
      )}
      {creating && (
        <ProductFormModal
          open
          product={null}
          onClose={() => {
            setCreating(false)
          }}
          onSaved={(p) => {
            void navigate(`/productos/${p.id}`)
          }}
        />
      )}
    </>
  )
}
