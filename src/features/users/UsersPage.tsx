import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type SyntheticEvent } from 'react'
import { ALL_ROLES, ROLE_LABELS, type AppRole, type Profile } from '@/features/auth/roles'
import { createUser, listProfiles, updateProfile } from '@/features/users/api'
import { createUserSchema } from '@/features/users/schemas'

function UserRow({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient()
  const [fullName, setFullName] = useState(profile.full_name)
  const [role, setRole] = useState<AppRole>(profile.role)
  const [active, setActive] = useState(profile.active)

  const save = useMutation({
    mutationFn: () => updateProfile({ id: profile.id, fullName, role, active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profiles'] }),
  })

  const dirty = fullName !== profile.full_name || role !== profile.role || active !== profile.active

  return (
    <tr className="border-t border-slate-200">
      <td className="p-2 text-slate-600">{profile.email}</td>
      <td className="p-2">
        <input
          value={fullName}
          onChange={(e) => {
            setFullName(e.target.value)
          }}
          className="w-full rounded border border-slate-300 px-2 py-1"
        />
      </td>
      <td className="p-2">
        <select
          value={role}
          onChange={(e) => {
            setRole(e.target.value as AppRole)
          }}
          className="rounded border border-slate-300 px-2 py-1"
        >
          {ALL_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </td>
      <td className="p-2 text-center">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => {
            setActive(e.target.checked)
          }}
          aria-label="Activo"
        />
      </td>
      <td className="p-2">
        <button
          type="button"
          disabled={!dirty || save.isPending}
          onClick={() => {
            save.mutate()
          }}
          className="rounded bg-slate-900 px-3 py-1 text-white disabled:opacity-40"
        >
          Guardar
        </button>
        {save.isError && <p className="text-xs text-red-700">{save.error.message}</p>}
      </td>
    </tr>
  )
}

function CreateUserForm() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ email: '', password: '', full_name: '', role: 'cashier' })
  const [formError, setFormError] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      setForm({ email: '', password: '', full_name: '', role: 'cashier' })
      return queryClient.invalidateQueries({ queryKey: ['profiles'] })
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

  const field = 'rounded border border-slate-300 px-2 py-1'
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3" noValidate>
      <input
        placeholder="Email"
        type="email"
        value={form.email}
        onChange={(e) => {
          setForm({ ...form, email: e.target.value })
        }}
        className={field}
      />
      <input
        placeholder="Nombre"
        value={form.full_name}
        onChange={(e) => {
          setForm({ ...form, full_name: e.target.value })
        }}
        className={field}
      />
      <input
        placeholder="Contraseña inicial"
        type="password"
        autoComplete="new-password"
        value={form.password}
        onChange={(e) => {
          setForm({ ...form, password: e.target.value })
        }}
        className={field}
      />
      <select
        value={form.role}
        onChange={(e) => {
          setForm({ ...form, role: e.target.value })
        }}
        className={field}
      >
        {ALL_ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={create.isPending}
        className="rounded bg-slate-900 px-3 py-1 text-white disabled:opacity-40"
      >
        Crear usuario
      </button>
      {(formError ?? (create.isError ? create.error.message : null)) && (
        <p role="alert" className="w-full text-sm text-red-700">
          {formError ?? create.error?.message}
        </p>
      )}
    </form>
  )
}

export function UsersPage() {
  const profiles = useQuery({ queryKey: ['profiles'], queryFn: listProfiles })

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Usuarios</h1>
      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Nuevo usuario</h2>
        <CreateUserForm />
      </section>
      <section>
        {profiles.isPending && <p>Cargando…</p>}
        {profiles.isError && <p className="text-red-700">{profiles.error.message}</p>}
        {profiles.data && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-slate-500">
                <th className="p-2">Email</th>
                <th className="p-2">Nombre</th>
                <th className="p-2">Rol</th>
                <th className="p-2 text-center">Activo</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {profiles.data.map((p) => (
                <UserRow key={`${p.id}:${p.updated_at}`} profile={p} />
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  )
}
