import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  PageHeader,
  QueryBoundary,
  Spinner,
} from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Table, Td, Th, Thead, Tr } from '@/components/ui/Table'
import { getProduct, listCosts, listVariants } from '@/features/catalog/api'
import { PriceHistoryModal } from '@/features/catalog/PriceHistoryModal'
import { ProductFormModal } from '@/features/catalog/ProductFormModal'
import { VariantFormModal } from '@/features/catalog/VariantFormModal'
import { VariantGeneratorModal } from '@/features/catalog/VariantGeneratorModal'
import { useCan } from '@/features/auth/useCan'
import { formatMoney, formatNumber } from '@/lib/money'
import type { Variant } from '@/types/db'

export function ProductDetailPage() {
  const { id = '' } = useParams()
  const canEdit = useCan('owner', 'manager')
  const canSeeCost = useCan('owner', 'manager', 'stock_clerk', 'viewer')
  const [editingProduct, setEditingProduct] = useState(false)
  const [variantModal, setVariantModal] = useState<Variant | 'new' | null>(null)
  const [generator, setGenerator] = useState(false)
  const [history, setHistory] = useState<Variant | null>(null)

  const product = useQuery({ queryKey: ['product', id], queryFn: () => getProduct(id) })
  const variants = useQuery({
    queryKey: ['variants', 'product', id],
    queryFn: () => listVariants({ productId: id, includeInactive: true }),
  })
  const costs = useQuery({
    queryKey: ['costs', id],
    queryFn: () => listCosts(id),
    enabled: canSeeCost,
  })
  const costOf = (variantId: string) => costs.data?.find((c) => c.variant_id === variantId)

  if (product.isPending) return <Spinner />
  if (product.isError) return <ErrorState error={product.error} />
  const p = product.data

  return (
    <>
      <PageHeader
        title={p.name}
        description={`Código ${p.code}${p.active ? '' : ' · Producto inactivo'}`}
        actions={
          <>
            <Link to="/productos" className="text-sm text-bronze-600 underline">
              ← Productos
            </Link>
            {canEdit && (
              <>
                <Button
                  variant="outline"
                  icon="edit"
                  onClick={() => {
                    setEditingProduct(true)
                  }}
                >
                  Editar
                </Button>
                <Button
                  variant="outline"
                  icon="layers"
                  onClick={() => {
                    setGenerator(true)
                  }}
                >
                  Generar variantes
                </Button>
                <Button
                  variant="gold"
                  icon="plus"
                  onClick={() => {
                    setVariantModal('new')
                  }}
                >
                  Nueva variante
                </Button>
              </>
            )}
          </>
        }
      />
      {p.description && <p className="mb-4 text-sm text-bronze-700">{p.description}</p>}
      <Card>
        <CardHeader title="Variantes (modelo + color + talle)" />
        <QueryBoundary
          query={variants}
          empty={{
            check: (d) => d.length === 0,
            node: (
              <EmptyState
                title="Sin variantes"
                description="Agregá colores y talles para poder vender y controlar stock."
              />
            ),
          }}
        >
          {(rows) => (
            <Table>
              <Thead>
                <tr>
                  <Th>Color</Th>
                  <Th>Talle</Th>
                  <Th>SKU</Th>
                  <Th>EAN</Th>
                  <Th className="text-right">Precio</Th>
                  {canSeeCost && <Th className="text-right">Costo prom.</Th>}
                  <Th className="text-right">Stock</Th>
                  <Th className="text-right">Mín.</Th>
                  <Th />
                </tr>
              </Thead>
              <tbody>
                {rows.map((v) => (
                  <Tr key={v.variant_id} className={v.active ? '' : 'opacity-60'}>
                    <Td>
                      <span className="flex items-center gap-2">
                        {v.color_hex && (
                          <span
                            className="size-3.5 rounded-full border border-sand-300"
                            style={{ backgroundColor: v.color_hex }}
                          />
                        )}
                        {v.color_name}
                      </span>
                    </Td>
                    <Td>{v.size_name}</Td>
                    <Td className="font-mono text-xs">{v.sku}</Td>
                    <Td className="font-mono text-xs">{v.ean ?? '—'}</Td>
                    <Td className="text-right tabular-nums">{formatMoney(v.price)}</Td>
                    {canSeeCost && (
                      <Td className="text-right tabular-nums">
                        {formatMoney(costOf(v.variant_id)?.avg_cost ?? 0)}
                      </Td>
                    )}
                    <Td className="text-right tabular-nums">
                      {formatNumber(v.stock)}{' '}
                      {v.stock <= 0 ? (
                        <Badge tone="red">Sin stock</Badge>
                      ) : v.min_stock > 0 && v.stock <= v.min_stock ? (
                        <Badge tone="amber">Bajo</Badge>
                      ) : null}
                    </Td>
                    <Td className="text-right tabular-nums">{v.min_stock}</Td>
                    <Td className="text-right whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setHistory(v)
                        }}
                      >
                        Historial
                      </Button>
                      {canEdit && (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon="edit"
                          onClick={() => {
                            setVariantModal(v)
                          }}
                        >
                          Editar
                        </Button>
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </QueryBoundary>
      </Card>
      {editingProduct && (
        <ProductFormModal
          open
          product={p}
          onClose={() => {
            setEditingProduct(false)
          }}
          onSaved={() => {
            setEditingProduct(false)
          }}
        />
      )}
      {variantModal !== null && (
        <VariantFormModal
          open
          productId={p.id}
          productCode={p.code}
          variant={variantModal === 'new' ? null : variantModal}
          currentCost={
            variantModal === 'new' ? null : (costOf(variantModal.variant_id)?.avg_cost ?? null)
          }
          onClose={() => {
            setVariantModal(null)
          }}
        />
      )}
      {generator && (
        <VariantGeneratorModal
          open
          productId={p.id}
          productCode={p.code}
          existing={variants.data ?? []}
          onClose={() => {
            setGenerator(false)
          }}
        />
      )}
      {history && (
        <PriceHistoryModal
          variantId={history.variant_id}
          title={history.sku}
          onClose={() => {
            setHistory(null)
          }}
        />
      )}
    </>
  )
}
