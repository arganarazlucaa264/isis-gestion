import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Badge, Card, CardHeader, PageHeader, QueryBoundary } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Checkbox, Input } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Table, Td, Th, Thead, Tr } from '@/components/ui/Table'
import { useToast } from '@/components/ui/toast-context'
import { useAuth } from '@/features/auth/auth-context'
import { lookupKey, useLookup, type LookupTable } from '@/features/lookups/useLookup'
import { SETTINGS_KEY, useSettings } from '@/features/settings/useSettings'
import { toUserMessage } from '@/lib/errors'
import { unwrap } from '@/lib/api'
import { rpc } from '@/lib/rpc'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/types/database'

function SettingsCard() {
  const { settings } = useSettings()
  const toast = useToast()
  const qc = useQueryClient()
  const [storeName, setStoreName] = useState<string | null>(null)
  const [pct, setPct] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: async (v: { key: string; value: Json }) =>
      rpc('set_app_setting', { p_key: v.key, p_value: v.value }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: SETTINGS_KEY })
      toast.success('Configuración guardada')
    },
    onError: (e) => {
      toast.error(toUserMessage(e))
    },
  })

  return (
    <Card>
      <CardHeader title="Configuración general" />
      <div className="grid gap-4 p-4 md:grid-cols-2">
        <div className="flex items-end gap-2">
          <Input
            label="Nombre del local"
            value={storeName ?? settings.store_name}
            onChange={(e) => {
              setStoreName(e.target.value)
            }}
            wrapperClassName="flex-1"
          />
          <Button
            variant="outline"
            disabled={storeName === null || storeName.trim() === ''}
            onClick={() => {
              if (storeName) save.mutate({ key: 'store_name', value: storeName.trim() })
            }}
          >
            Guardar
          </Button>
        </div>
        <div className="flex items-end gap-2">
          <Input
            label="Descuento máximo del vendedor/cajero (%)"
            type="number"
            min={0}
            max={100}
            value={pct ?? String(settings.cashier_max_discount_pct)}
            onChange={(e) => {
              setPct(e.target.value)
            }}
            wrapperClassName="flex-1"
          />
          <Button
            variant="outline"
            disabled={pct === null || Number.isNaN(Number(pct))}
            onClick={() => {
              save.mutate({ key: 'cashier_max_discount_pct', value: Number(pct) })
            }}
          >
            Guardar
          </Button>
        </div>
        <div className="md:col-span-2">
          <Checkbox
            label="Permitir vender con stock insuficiente (el stock puede quedar negativo)"
            checked={settings.allow_negative_stock}
            onChange={(e) => {
              save.mutate({ key: 'allow_negative_stock', value: e.target.checked })
            }}
          />
          <p className="mt-1 text-xs text-bronze-600">
            Recomendado: apagado. Con esto apagado el sistema bloquea ventas y ajustes que dejarían
            el stock en negativo.
          </p>
        </div>
        <p className="text-sm text-bronze-600 md:col-span-2">
          Moneda: {settings.currency} · Zona horaria: {settings.timezone}
        </p>
      </div>
    </Card>
  )
}

function SimpleList({
  table,
  title,
  extra,
}: {
  table: Extract<LookupTable, 'payment_methods' | 'cash_registers' | 'expense_categories'>
  title: string
  extra?: boolean
}) {
  const query = useLookup(table)
  const toast = useToast()
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [isCash, setIsCash] = useState(false)

  const refresh = () => qc.invalidateQueries({ queryKey: lookupKey(table) })
  const onError = (e: unknown) => {
    toast.error(toUserMessage(e))
  }

  const create = useMutation({
    mutationFn: async () => {
      const values: Record<string, unknown> = { name: name.trim() }
      if (table === 'payment_methods') {
        values.code = code
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '_')
        values.is_cash = isCash
        values.sort_order = 50
      }
      unwrap(
        await supabase
          .from(table)
          .insert(values as never)
          .select('id')
          .single(),
      )
    },
    onSuccess: async () => {
      await refresh()
      setAdding(false)
      setName('')
      setCode('')
      setIsCash(false)
    },
    onError,
  })
  const toggle = useMutation({
    mutationFn: async (v: { id: string; active: boolean }) => {
      unwrap(
        await supabase
          .from(table)
          .update({ active: v.active })
          .eq('id', v.id)
          .select('id')
          .single(),
      )
    },
    onSuccess: refresh,
    onError,
  })

  return (
    <Card>
      <CardHeader
        title={title}
        actions={
          <Button
            size="sm"
            icon="plus"
            onClick={() => {
              setAdding(true)
            }}
          >
            Nuevo
          </Button>
        }
      />
      <QueryBoundary query={query}>
        {(rows) => (
          <Table>
            <Thead>
              <tr>
                <Th>Nombre</Th>
                {extra && <Th>Tipo</Th>}
                <Th>Estado</Th>
                <Th />
              </tr>
            </Thead>
            <tbody>
              {(
                rows as {
                  id: string
                  name: string
                  active: boolean
                  is_cash?: boolean
                  is_system?: boolean
                }[]
              ).map((r) => (
                <Tr key={r.id}>
                  <Td>{r.name}</Td>
                  {extra && (
                    <Td>
                      {r.is_cash ? (
                        <Badge tone="gold">Efectivo físico</Badge>
                      ) : (
                        <Badge>No es efectivo</Badge>
                      )}
                    </Td>
                  )}
                  <Td>
                    {r.active ? (
                      <Badge tone="green">Activo</Badge>
                    ) : (
                      <Badge tone="amber">Inactivo</Badge>
                    )}
                  </Td>
                  <Td className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        toggle.mutate({ id: r.id, active: !r.active })
                      }}
                    >
                      {r.active ? 'Desactivar' : 'Activar'}
                    </Button>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </QueryBoundary>
      <Modal
        open={adding}
        title={`Nuevo: ${title.toLowerCase()}`}
        size="sm"
        onClose={() => {
          setAdding(false)
        }}
        footer={
          <Button
            disabled={name.trim() === '' || (table === 'payment_methods' && code.trim() === '')}
            loading={create.isPending}
            onClick={() => {
              create.mutate()
            }}
          >
            Guardar
          </Button>
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
          {table === 'payment_methods' && (
            <>
              <Input
                label="Código interno"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value)
                }}
                hint="Letras minúsculas y números. No se puede cambiar después."
              />
              <Checkbox
                label="Es efectivo físico (suma al efectivo de la caja)"
                checked={isCash}
                onChange={(e) => {
                  setIsCash(e.target.checked)
                }}
              />
              <p className="text-xs text-red-800">
                Atención: esta propiedad no se puede cambiar después de crear el medio de pago.
              </p>
            </>
          )}
        </div>
      </Modal>
    </Card>
  )
}

export function SettingsPage() {
  const { profile } = useAuth()
  const isOwner = profile?.role === 'owner'
  return (
    <>
      <PageHeader
        title="Configuración"
        description="Parámetros del sistema, medios de pago, cajas y categorías de gasto."
      />
      <div className="flex flex-col gap-4">
        {isOwner && <SettingsCard />}
        <div className="grid gap-4 lg:grid-cols-2">
          {isOwner && <SimpleList table="payment_methods" title="Medios de pago" extra />}
          {isOwner && <SimpleList table="cash_registers" title="Cajas" />}
          <SimpleList table="expense_categories" title="Categorías de gasto" />
        </div>
      </div>
    </>
  )
}
