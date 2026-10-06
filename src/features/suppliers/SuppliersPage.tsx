import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Card, EmptyState, PageHeader, QueryBoundary, Stat } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SearchBox } from '@/components/ui/SearchBox'
import { Table, Td, Th, Thead, Tr } from '@/components/ui/Table'
import { listBalances } from '@/features/suppliers/api'
import { SupplierFormModal } from '@/features/suppliers/SupplierFormModal'
import { useCan } from '@/features/auth/useCan'
import { formatDate } from '@/lib/format'
import { formatMoney } from '@/lib/money'

export function SuppliersPage() {
  const canEdit = useCan('owner', 'manager')
  const canSeeBalance = useCan('owner', 'manager', 'viewer')
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')
  const query = useQuery({
    queryKey: ['suppliers', 'balances'],
    queryFn: listBalances,
    enabled: canSeeBalance,
  })
  const q = search.trim().toLowerCase()
  const rows = (query.data ?? []).filter((s) => q === '' || s.name.toLowerCase().includes(q))
  const debt = (query.data ?? []).reduce((s, b) => s + Math.max(0, b.balance), 0)
  const overdue = (query.data ?? []).reduce((s, b) => s + b.overdue_amount, 0)

  return (
    <>
      <PageHeader
        title="Proveedores"
        description="Proveedores, deuda y cuenta corriente."
        actions={
          canEdit && (
            <Button
              icon="plus"
              variant="gold"
              onClick={() => {
                setCreating(true)
              }}
            >
              Nuevo proveedor
            </Button>
          )
        }
      />
      {canSeeBalance && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <Stat label="Deuda total con proveedores" value={formatMoney(debt)} tone="dark" />
          <Stat
            label="Deuda vencida"
            value={formatMoney(overdue)}
            tone={overdue > 0 ? 'danger' : 'neutral'}
          />
        </div>
      )}
      <Card>
        <div className="border-b border-sand-200 p-3">
          <SearchBox value={search} onChange={setSearch} placeholder="Buscar proveedor…" />
        </div>
        <QueryBoundary
          query={{ ...query, data: query.data ? rows : undefined }}
          empty={{
            check: (d) => d.length === 0,
            node: (
              <EmptyState
                title="Sin proveedores"
                description="Cargá el primero para registrar compras."
              />
            ),
          }}
        >
          {(data) => (
            <Table>
              <Thead>
                <tr>
                  <Th>Proveedor</Th>
                  <Th className="text-right">Plazo</Th>
                  <Th className="text-right">Saldo</Th>
                  <Th className="text-right">Vencido</Th>
                  <Th>Próx. vencimiento</Th>
                </tr>
              </Thead>
              <tbody>
                {data.map((s) => (
                  <Tr key={s.supplier_id} className={s.active ? '' : 'opacity-60'}>
                    <Td className="font-medium">
                      <Link className="underline" to={`/proveedores/${s.supplier_id}`}>
                        {s.name}
                      </Link>{' '}
                      {!s.active && <Badge tone="amber">Inactivo</Badge>}
                    </Td>
                    <Td className="text-right tabular-nums">{s.payment_terms_days} días</Td>
                    <Td className="text-right font-semibold tabular-nums">
                      {formatMoney(s.balance)}
                    </Td>
                    <Td className="text-right tabular-nums">
                      {s.overdue_amount > 0 ? (
                        <Badge tone="red">{formatMoney(s.overdue_amount)}</Badge>
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td>{formatDate(s.next_due_date)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </QueryBoundary>
      </Card>
      {creating && (
        <SupplierFormModal
          supplier={null}
          onClose={() => {
            setCreating(false)
          }}
        />
      )}
    </>
  )
}
