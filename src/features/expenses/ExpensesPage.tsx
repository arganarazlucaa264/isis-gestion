import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Badge, Card, EmptyState, PageHeader, QueryBoundary, Stat } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DateRange } from '@/components/ui/DateRange'
import { defaultRange, type Range } from '@/components/ui/date-range'
import { Select } from '@/components/ui/Field'
import { ReasonDialog } from '@/components/ui/ReasonDialog'
import { Table, Td, Th, Thead, Tr } from '@/components/ui/Table'
import { useToast } from '@/components/ui/toast-context'
import { ExpenseFormModal } from '@/features/expenses/ExpenseFormModal'
import { listExpenses, voidExpense, type ExpenseRow } from '@/features/expenses/api'
import { useCan } from '@/features/auth/useCan'
import { useLookup } from '@/features/lookups/useLookup'
import { toUserMessage } from '@/lib/errors'
import { docNumber, formatDate } from '@/lib/format'
import { formatMoney } from '@/lib/money'

export function ExpensesPage() {
  const canVoid = useCan('owner', 'manager')
  const toast = useToast()
  const qc = useQueryClient()
  const [range, setRange] = useState<Range>(defaultRange())
  const [categoryId, setCategoryId] = useState('')
  const [creating, setCreating] = useState(false)
  const [voiding, setVoiding] = useState<ExpenseRow | null>(null)
  const categories = useLookup('expense_categories')
  const query = useQuery({
    queryKey: ['expenses', range, categoryId],
    queryFn: () => listExpenses(range.from, range.to, categoryId || undefined),
  })

  const total = useMemo(
    () => (query.data ?? []).filter((e) => !e.voided_at).reduce((s, e) => s + e.amount, 0),
    [query.data],
  )

  const voidMutation = useMutation({
    mutationFn: (reason: string) => voidExpense(voiding?.id ?? '', reason),
    onSuccess: async () => {
      setVoiding(null)
      await qc.invalidateQueries({ queryKey: ['expenses'] })
      await qc.invalidateQueries({ queryKey: ['cash'] })
      toast.success('Gasto anulado')
    },
    onError: (e) => {
      toast.error(toUserMessage(e))
    },
  })

  return (
    <>
      <PageHeader
        title="Gastos"
        description="Gastos del local. Solo los pagados en efectivo desde la caja descuentan efectivo."
        actions={
          <Button
            icon="plus"
            variant="gold"
            onClick={() => {
              setCreating(true)
            }}
          >
            Nuevo gasto
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <DateRange value={range} onChange={setRange} />
        <Select
          label="Categoría"
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value)
          }}
        >
          <option value="">Todas</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <div className="ml-auto w-56">
          <Stat label="Total del período" value={formatMoney(total)} tone="dark" />
        </div>
      </div>
      <Card>
        <QueryBoundary
          query={query}
          empty={{
            check: (d) => d.length === 0,
            node: (
              <EmptyState
                title="Sin gastos"
                description="No hay gastos en el período seleccionado."
              />
            ),
          }}
        >
          {(rows) => (
            <Table>
              <Thead>
                <tr>
                  <Th>N°</Th>
                  <Th>Fecha</Th>
                  <Th>Categoría</Th>
                  <Th>Descripción</Th>
                  <Th>Medio</Th>
                  <Th>Caja</Th>
                  <Th className="text-right">Monto</Th>
                  <Th />
                </tr>
              </Thead>
              <tbody>
                {rows.map((e) => (
                  <Tr key={e.id} className={e.voided_at ? 'opacity-50' : ''}>
                    <Td>{docNumber('G', e.number)}</Td>
                    <Td>{formatDate(e.expense_date)}</Td>
                    <Td>{e.expense_categories?.name}</Td>
                    <Td>
                      {e.description}
                      {e.receipt_ref && (
                        <span className="block text-xs text-bronze-500">Comp. {e.receipt_ref}</span>
                      )}
                      {e.suppliers && (
                        <span className="block text-xs text-bronze-500">{e.suppliers.name}</span>
                      )}
                    </Td>
                    <Td>{e.payment_methods?.name}</Td>
                    <Td>
                      {e.paid_from_register ? (
                        <Badge tone="gold">Desde caja</Badge>
                      ) : (
                        <Badge>Fuera de caja</Badge>
                      )}
                    </Td>
                    <Td className="text-right tabular-nums">{formatMoney(e.amount)}</Td>
                    <Td className="text-right">
                      {e.voided_at ? (
                        <Badge tone="red">Anulado</Badge>
                      ) : (
                        canVoid && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setVoiding(e)
                            }}
                          >
                            Anular
                          </Button>
                        )
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </QueryBoundary>
      </Card>
      {creating && (
        <ExpenseFormModal
          onClose={() => {
            setCreating(false)
          }}
        />
      )}
      <ReasonDialog
        open={voiding !== null}
        title="Anular gasto"
        description="Si salió de la caja, se registra un movimiento inverso en la caja abierta."
        confirmLabel="Anular gasto"
        busy={voidMutation.isPending}
        onClose={() => {
          setVoiding(null)
        }}
        onConfirm={(reason) => {
          voidMutation.mutate(reason)
        }}
      />
    </>
  )
}
