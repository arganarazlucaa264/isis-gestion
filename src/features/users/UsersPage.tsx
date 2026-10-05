import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type SyntheticEvent } from 'react'
import { Badge, Card, CardHeader, PageHeader, QueryBoundary } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Table, Td, Th, Thead, Tr } from '@/components/ui/Table'
import { useToast } from '@/components/ui/toast-context'
import { ALL_ROLES, ROLE_LABELS, type AppRole, type Profile } from '@/features/auth/roles'
import { createUser, listProfiles, updateProfile } from '@/features/users/api'
import { createUserSchema } from '@/features/users/schemas'
import { toUserMessage } from '@/lib/errors'

function UserRow({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [fullName, setFullName] = useState(profile.full_name)
  const [role, setRole] = useState<AppRole>(profile.role)
  const [active, setActive] = useState(profile.active)

  const save = useMutation({
    mutationFn: () => updateProfile({ id: profile.id, fullName, role, active }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['profiles'] })
      toast.success('Usuario actualizado')
    },
    onError: (e) => {
      toast.error(toUserMessage(e))
    },
  })

  const dirty = fullName !== profile.full_name || role !== profile.role || active !== profile.active

  return (
    <Tr>
      <Td className="text-bronze-600">{profile.email}</Td>
      <Td>
        <input
          value={fullName}
          aria-label="Nombre"
          onChange={(e) => {
            setFullName(e.target.value)
          }}
          className="h-9 w-full min-w-40 rounded-lg border border-sand-300 bg-white px-2"
        />
      </Td>
      <Td>
        <select
          value={role}
          aria-label="Rol"
          onChange={(e) => {
            setRole(e.target.value as AppRole)
          }}
          className="h-9 rounded-lg border border-sand-300 bg-white px-2"
        >
          {ALL_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </Td>
      <Td className="text-center">
        <input
          type="checkbox"
          checked={active}
          aria-label="Activo"
          onChange={(e) => {
            setActive(e.target.checked)
          }}
          className="size-4 accent-gold-500"
        />
      </Td>
      <Td>
        <Button
          size="sm"
          disabled={!dirty}
          loading={save.isPending}
          onClick={() => {
            save.mutate()
          }}
        >
          Guardar
        </Button>
      </Td>
    </Tr>
  )
}

function CreateUserModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [form, setForm] = useState({ email: '', password: '', full_name: '', role: 'cashier' })
  const [formError, setFormError] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: createUser,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['profiles'] })
      toast.success('Usuario creado')
      onClose()
    },
    onError: (e) => {
      setFormError(toUserMessage(e))
    },
  })

  function onSubmit(e: SyntheticEvent) {
    e.preventDefault()
    setFormError(null)
    const parsed = createUserSchema.safeParse(form)
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Datos inválidos')
      return
    }
    create.mutate(parsed.data)
  }

  return (
    <Modal
      open
      title="Nuevo usuario"
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button loading={create.isPending} onClick={onSubmit}>
            Crear usuario
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
        <Input
          label="Nombre"
          value={form.full_name}
          onChange={(e) => {
            setForm({ ...form, full_name: e.target.value })
          }}
          autoFocus
        />
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => {
            setForm({ ...form, email: e.target.value })
          }}
        />
        <Input
          label="Contraseña inicial"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={(e) => {
            setForm({ ...form, password: e.target.value })
          }}
          hint="Mínimo 8 caracteres. El usuario podrá cambiarla."
        />
        <Select
          label="Rol"
          value={form.role}
          onChange={(e) => {
            setForm({ ...form, role: e.target.value })
          }}
        >
          {ALL_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </Select>
        {formError && (
          <p role="alert" className="text-sm text-red-700">
            {formError}
          </p>
        )}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}

export function UsersPage() {
  const profiles = useQuery({ queryKey: ['profiles'], queryFn: listProfiles })
  const [creating, setCreating] = useState(false)

  return (
    <>
      <PageHeader
        title="Usuarios"
        description="Solo el dueño crea usuarios y asigna roles. Desactivar un usuario corta su acceso de inmediato."
        actions={
          <Button
            icon="plus"
            variant="gold"
            onClick={() => {
              setCreating(true)
            }}
          >
            Nuevo usuario
          </Button>
        }
      />
      <Card>
        <CardHeader
          title="Equipo"
          actions={<Badge tone="gold">Siempre debe quedar un dueño activo</Badge>}
        />
        <QueryBoundary query={profiles}>
          {(rows) => (
            <Table>
              <Thead>
                <tr>
                  <Th>Email</Th>
                  <Th>Nombre</Th>
                  <Th>Rol</Th>
                  <Th className="text-center">Activo</Th>
                  <Th />
                </tr>
              </Thead>
              <tbody>
                {rows.map((p) => (
                  <UserRow key={`${p.id}:${p.updated_at}`} profile={p} />
                ))}
              </tbody>
            </Table>
          )}
        </QueryBoundary>
      </Card>
      {creating && (
        <CreateUserModal
          onClose={() => {
            setCreating(false)
          }}
        />
      )}
    </>
  )
}
