import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/auth-context'
import { hasRole, type AppRole } from '@/features/auth/roles'

function FullScreenMessage({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-3xl font-semibold">{title}</h1>
      {children}
    </main>
  )
}

/** Exige sesión y perfil activo. Sin sesión redirige a /login recordando a dónde iba. */
export function RequireAuth() {
  const { status, signOut } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullScreenMessage title="Cargando…" />
  if (status === 'signed_out') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (status === 'no_access') {
    return (
      <FullScreenMessage title="Tu cuenta no tiene acceso">
        <p className="text-bronze-600">
          Tu usuario está desactivado o no tiene perfil. Pedile al dueño que lo habilite.
        </p>
        <button
          type="button"
          className="rounded-lg bg-ink-900 px-4 py-2 text-cream-50"
          onClick={() => void signOut()}
        >
          Cerrar sesión
        </button>
      </FullScreenMessage>
    )
  }
  return <Outlet />
}

/** Exige uno de los roles indicados. Es solo comodidad de UI: la seguridad real es RLS/RPC. */
export function RequireRole({ roles }: { roles: readonly AppRole[] }) {
  const { profile } = useAuth()
  if (!hasRole(profile, roles)) {
    return (
      <FullScreenMessage title="Sin permiso">
        <p className="text-bronze-600">No tenés permiso para ver esta sección.</p>
      </FullScreenMessage>
    )
  }
  return <Outlet />
}

/** Para /login: si ya hay sesión válida, manda al inicio. */
export function PublicOnly() {
  const { status } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from

  if (status === 'loading') return <FullScreenMessage title="Cargando…" />
  if (status === 'ready') return <Navigate to={from ?? '/'} replace />
  return <Outlet />
}
