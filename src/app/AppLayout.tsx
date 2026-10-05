import { Suspense, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { NAV_GROUPS } from '@/app/navigation'
import { Spinner } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { useAuth } from '@/features/auth/auth-context'
import { ROLE_LABELS, hasRole } from '@/features/auth/roles'
import { useSettings } from '@/features/settings/useSettings'
import { cx } from '@/lib/cx'

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { profile, signOut } = useAuth()
  const { settings } = useSettings()

  return (
    <div className="print-gold flex h-full flex-col bg-ink-900 text-cream-100">
      <div className="px-5 pt-6 pb-4">
        <p className="font-display text-4xl leading-none font-semibold tracking-widest text-gold-400">
          {settings.store_name.toUpperCase()}
        </p>
        <p className="mt-1 text-[11px] tracking-[0.35em] text-sand-400 uppercase">Gestión</p>
        <div className="print-strip mt-4 rounded-full" />
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((i) => hasRole(profile, i.roles))
          if (items.length === 0) return null
          return (
            <div key={group.title ?? 'main'} className="mt-3">
              {group.title && (
                <p className="px-3 pb-1 text-[10px] font-semibold tracking-[0.2em] text-bronze-400 uppercase">
                  {group.title}
                </p>
              )}
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cx(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                      isActive
                        ? 'bg-ink-700 text-gold-300 shadow-[inset_3px_0_0_0_#d9b567]'
                        : 'text-cream-100/80 hover:bg-ink-800 hover:text-cream-50',
                    )
                  }
                >
                  <Icon name={item.icon} size={18} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          )
        })}
      </nav>
      <div className="border-t border-ink-600 p-4">
        <p className="truncate text-sm font-medium">{profile?.full_name}</p>
        <p className="text-xs text-sand-400">{profile ? ROLE_LABELS[profile.role] : ''}</p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-3 flex items-center gap-2 text-xs text-sand-300 hover:text-gold-300"
        >
          <Icon name="logout" size={16} /> Cerrar sesión
        </button>
      </div>
    </div>
  )
}

export function AppLayout() {
  const [open, setOpen] = useState(false)
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block print:hidden">
        <Sidebar />
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between bg-ink-900 px-4 py-3 text-cream-50 lg:hidden print:hidden">
        <button
          type="button"
          aria-label="Abrir menú"
          onClick={() => {
            setOpen(true)
          }}
          className="rounded-lg p-1 hover:bg-ink-700"
        >
          <Icon name="menu" size={24} />
        </button>
        <span className="font-display text-2xl font-semibold tracking-widest text-gold-400">
          ISIS
        </span>
        <span className="w-8" />
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden print:hidden">
          <div
            className="absolute inset-0 bg-ink-950/60"
            onClick={() => {
              setOpen(false)
            }}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw]">
            <Sidebar
              onNavigate={() => {
                setOpen(false)
              }}
            />
          </div>
        </div>
      )}

      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl p-4 sm:p-6">
          <Suspense fallback={<Spinner />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
