import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Badge, Card, EmptyState, PageHeader, QueryBoundary } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Table, Td, Th, Thead, Tr } from '@/components/ui/Table'
import { useToast } from '@/components/ui/toast-context'
import { createInventory, listInventories, STATUS_LABEL } from '@/features/inventory/api'
import { useCan } from '@/features/auth/useCan'
import { useLookup } from '@/features/lookups/useLookup'
import { toUserMessage } from '@/lib/errors'
import { docNumber, formatDateTime } from '@/lib/format'

const TONE: Record<string, 'gold' | 'amber' | 'green' | 'neutral'> = {
  counting: 'gold',
  review: 'amber',
  applied: 'green',
  cancelled: 'neutral',
}

function NewInventoryModal({ onClose }: { onClose: () => void }) {
  const toast = useToast()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const categories = useLookup('categories')
  const [name, setName] = useState(`Inventario ${new Date().toLocaleDateString('es-AR')}`)
  const [scope, setScope] = useState<'all' | 'category'>('all')
  const [categoryId, setCategoryId] = useState('')
  const [notes, setNotes] = useState('')

  const create = useMutation({
    mutationFn: () =>
      createInventory({
        name: name.trim(),
        scope,
        categoryId: scope === 'category' ? categoryId : null,
        variantIds: null,
        notes: notes.trim() || null,
      }),
    onSuccess: async (count) => {
      await qc.invalidateQueries({ queryKey: ['inventories'] })
      toast.success('Inventario creado')
      void navigate(`/inventarios/${count.id}`)
    },
    onError: (e) => {
      toast.error(toUserMessage(e))
    },
  })

  return (
    <Modal
      open
      title="Nuevo inventario físico"
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={name.trim() === '' || (scope === 'category' && categoryId === '')}
            loading={create.isPending}
            onClick={() => {
              create.mutate()
            }}
          >
            Crear e iniciar conteo
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Input
          label="Nombre"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
          }}
        />
        <Select
          label="Alcance"
          value={scope}
          onChange={(e) => {
            setScope(e.target.value as 'all' | 'category')
          }}
        >
          <option value="all">Todo el local</option>
          <option value="category">Una categoría</option>
        </Select>
        {scope === 'category' && (
          <Select
            label="Categoría"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value)
            }}
          >
            <option value="">Elegí una categoría</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
        <Textarea
          label="Notas"
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value)
          }}
        />
        <p className="text-sm text-bronze-600">
          Se toma una foto del stock actual de cada variante. Las ventas durante el conteo no
          generan diferencias falsas.
        </p>
      </div>
    </Modal>
  )
}

export function InventoriesPage() {
  const canCreate = useCan('owner', 'manager', 'stock_clerk')
  const [creating, setCreating] = useState(false)
  const query = useQuery({ queryKey: ['inventories'], queryFn: listInventories })

  return (
    <>
      <PageHeader
        title="Inventario físico"
        description="Conteo de mercadería, revisión de diferencias y aplicación de ajustes."
        actions={
          canCreate && (
            <Button
              icon="plus"
              variant="gold"
              onClick={() => {
                setCreating(true)
              }}
            >
              Nuevo inventario
            </Button>
          )
        }
      />
      <Card>
        <QueryBoundary
          query={query}
          empty={{
            check: (d) => d.length === 0,
            node: (
              <EmptyState
                title="Todavía no hay inventarios"
                description="Creá uno para empezar a contar."
              />
            ),
          }}
        >
          {(rows) => (
            <Table>
              <Thead>
                <tr>
                  <Th>N°</Th>
                  <Th>Nombre</Th>
                  <Th>Alcance</Th>
                  <Th>Estado</Th>
                  <Th>Inicio</Th>
                  <Th>Aplicado</Th>
                </tr>
              </Thead>
              <tbody>
                {rows.map((c) => (
                  <Tr key={c.id}>
                    <Td>
                      <Link className="font-medium underline" to={`/inventarios/${c.id}`}>
                        {docNumber('I', c.number)}
                      </Link>
                    </Td>
                    <Td>{c.name}</Td>
                    <Td>
                      {c.scope === 'all'
                        ? 'Todo el local'
                        : c.scope === 'category'
                          ? 'Categoría'
                          : 'Selección'}
                    </Td>
                    <Td>
                      <Badge tone={TONE[c.status] ?? 'neutral'}>
                        {STATUS_LABEL[c.status] ?? c.status}
                      </Badge>
                    </Td>
                    <Td>{formatDateTime(c.started_at)}</Td>
                    <Td>{formatDateTime(c.applied_at)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </QueryBoundary>
      </Card>
      {creating && (
        <NewInventoryModal
          onClose={() => {
            setCreating(false)
          }}
        />
      )}
    </>
  )
}
