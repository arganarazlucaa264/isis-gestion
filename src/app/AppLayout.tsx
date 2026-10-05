import { NavLink, Outlet } from 'react-router-dom'
import { NAV_ITEMS } from '@/app/navigation'
import { useAuth } from '@/features/auth/auth-context'
import { ROLE_LABELS, hasRole } from '@/features/auth/roles'

export function AppLayout() {
  const { profile, signOut } = useAuth()

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <nav className="flex gap-4 text-sm font-medium">
          {NAV_ITEMS.filter((item) => hasRole(profile, item.roles)).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => (isActive ? 'text-slate-900' : 'text-slate-500')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-600">
            {profile?.full_name} · {profile ? ROLE_LABELS[profile.role] : ''}
          </span>
          <button
            type="button"
            className="rounded border border-slate-300 px-3 py-1"
            onClick={() => void signOut()}
          >
            Salir
          </button>
        </div>
      </header>
      <Outlet />
    </div>
  )
}
