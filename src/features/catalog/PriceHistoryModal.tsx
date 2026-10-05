import { useQuery } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { QueryBoundary } from '@/components/ui/Card'
import { Table, Td, Th, Thead, Tr } from '@/components/ui/Table'
import { listCostHistory, listPriceHistory } from '@/features/catalog/api'
import { useCan } from '@/features/auth/useCan'
import { formatDateTime } from '@/lib/format'
import { formatMoney } from '@/lib/money'

export function PriceHistoryModal({
  variantId,
  title,
  onClose,
}: {
  variantId: string
  title: string
  onClose: () => void
}) {
  const canSeeCost = useCan('owner', 'manager', 'stock_clerk', 'viewer')
  const prices = useQuery({
    queryKey: ['price-history', variantId],
    queryFn: () => listPriceHistory(variantId),
  })
  const costs = useQuery({
    queryKey: ['cost-history', variantId],
    queryFn: () => listCostHistory(variantId),
    enabled: canSeeCost,
  })

  return (
    <Modal open title={`Historial · ${title}`} onClose={onClose} size="lg">
      <h3 className="mb-1 text-xl font-semibold">Precios</h3>
      <QueryBoundary query={prices}>
        {(rows) => (
          <Table>
            <Thead>
              <tr>
                <Th>Fecha</Th>
                <Th className="text-right">Anterior</Th>
                <Th className="text-right">Nuevo</Th>
              </tr>
            </Thead>
            <tbody>
              {rows.map((r) => (
                <Tr key={r.id}>
                  <Td>{formatDateTime(r.changed_at)}</Td>
                  <Td className="text-right tabular-nums">
                    {r.old_price === null ? '—' : formatMoney(r.old_price)}
                  </Td>
                  <Td className="text-right tabular-nums">{formatMoney(r.new_price)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </QueryBoundary>
      {canSeeCost && (
        <>
          <h3 className="mt-4 mb-1 text-xl font-semibold">Costos</h3>
          <QueryBoundary query={costs}>
            {(rows) => (
              <Table>
                <Thead>
                  <tr>
                    <Th>Fecha</Th>
                    <Th className="text-right">Costo último</Th>
                    <Th className="text-right">Costo promedio</Th>
                  </tr>
                </Thead>
                <tbody>
                  {rows.map((r) => (
                    <Tr key={r.id}>
                      <Td>{formatDateTime(r.changed_at)}</Td>
                      <Td className="text-right tabular-nums">{formatMoney(r.new_last_cost)}</Td>
                      <Td className="text-right tabular-nums">{formatMoney(r.new_avg_cost)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </QueryBoundary>
        </>
      )}
    </Modal>
  )
}
