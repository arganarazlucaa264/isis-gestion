import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Badge, Card, CardHeader, QueryBoundary } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Checkbox, Input, Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Table, Td, Th, Thead, Tr } from '@/components/ui/Table'
import { useToast } from '@/components/ui/toast-context'
import { saveMaster, type MasterTable } from '@/features/catalog/api'
import { lookupKey, useLookup } from '@/features/lookups/useLookup'
import { toUserMessage } from '@/lib/errors'

interface Item {
  id: string
  name: string
  active: boolean
  hex?: string | null
  size_group?: string
  sort_order?: number
  parent_id?: string | null
}

const TITLES: Record<MasterTable, { title: string; singular: string }> = {
  categories: { title: 'Categorías', singular: 'categoría' },
  brands: { title: 'Marcas', singular: 'marca' },
  colors: { title: 'Colores', singular: 'color' },
  sizes: { title: 'Talles', singular: 'talle' },
}

function MasterCard({ table }: { table: MasterTable }) {
  const query = useLookup(table)
  const toast = useToast()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Item | 'new' | null>(null)
  const [name, setName] = useState('')
  const [hex, setHex] = useState('')
  const [group, setGroup] = useState('ropa')
  const [order, setOrder] = useState('0')
  const [active, setActive] = useState(true)

  const save = useMutation({
    mutationFn: () => {
      const values: Record<string, unknown> = { name: name.trim(), active }
      if (table === 'colors') values.hex = hex.trim() === '' ? null : hex.trim()
      if (table === 'sizes') {
        values.size_group = group.trim() || 'ropa'
        values.sort_order = Number(order) || 0
      }
      return saveMaster(table, editing === 'new' || editing === null ? null : editing.id, values)
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: lookupKey(table) })
      toast.success('Guardado')
      setEditing(null)
    },
    onError: (e) => {
      toast.error(toUserMessage(e))
    },
  })

  function open(item: Item | 'new') {
    setEditing(item)
    if (item === 'new') {
      setName('')
      setHex('')
      setGroup('ropa')
      setOrder('0')
      setActive(true)
    } else {
      setName(item.name)
      setHex(item.hex ?? '')
      setGroup(item.size_group ?? 'ropa')
      setOrder(String(item.sort_order ?? 0))
      setActive(item.active)
    }
  }

  const { title, singular } = TITLES[table]
  return (
    <Card>
      <CardHeader
        title={title}
        actions={
          <Button
            size="sm"
            icon="plus"
            onClick={() => {
              open('new')
            }}
          >
            Nuevo
          </Button>
        }
      />
      <QueryBoundary query={query}>
        {(rows) => (
          <div className="max-h-80 overflow-y-auto">
            <Table>
              <Thead>
                <tr>
                  <Th>Nombre</Th>
                  <Th />
                </tr>
              </Thead>
              <tbody>
                {(rows as unknown as Item[]).map((r) => (
                  <Tr key={r.id}>
                    <Td>
                      <span className="flex items-center gap-2">
                        {table === 'colors' && r.hex && (
                          <span
                            className="size-4 rounded-full border border-sand-300"
                            style={{ backgroundColor: r.hex }}
                          />
                        )}
                        {r.name}
                        {!r.active && <Badge tone="amber">Inactivo</Badge>}
                      </span>
                    </Td>
                    <Td className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        icon="edit"
                        onClick={() => {
                          open(r)
                        }}
                      >
                        Editar
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </QueryBoundary>
      <Modal
        open={editing !== null}
        title={editing === 'new' ? `Nueva ${singular}` : `Editar ${singular}`}
        onClose={() => {
          setEditing(null)
        }}
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setEditing(null)
              }}
            >
              Cancelar
            </Button>
            <Button
              loading={save.isPending}
              disabled={name.trim() === ''}
              onClick={() => {
                save.mutate()
              }}
            >
              Guardar
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
            autoFocus
          />
          {table === 'colors' && (
            <Input
              label="Color (opcional)"
              type="color"
              value={hex || '#000000'}
              onChange={(e) => {
                setHex(e.target.value)
              }}
            />
          )}
          {table === 'sizes' && (
            <>
              <Select
                label="Grupo"
                value={group}
                onChange={(e) => {
                  setGroup(e.target.value)
                }}
              >
                <option value="ropa">Ropa (S, M, L…)</option>
                <option value="numerico">Numérico (36, 38…)</option>
                <option value="general">General</option>
              </Select>
              <Input
                label="Orden"
                type="number"
                value={order}
                onChange={(e) => {
                  setOrder(e.target.value)
                }}
                hint="Define cómo se ordenan los talles"
              />
            </>
          )}
          <Checkbox
            label="Activo"
            checked={active}
            onChange={(e) => {
              setActive(e.target.checked)
            }}
          />
        </div>
      </Modal>
    </Card>
  )
}

export function MastersPanel() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <MasterCard table="categories" />
      <MasterCard table="brands" />
      <MasterCard table="colors" />
      <MasterCard table="sizes" />
    </div>
  )
}
