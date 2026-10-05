import { ALL_ROLES, type AppRole } from '@/features/auth/roles'

export interface NavItem {
  to: string
  label: string
  roles: readonly AppRole[]
}

// Cada etapa agrega sus entradas acá. Ocultar un ítem es solo UI: el acceso real lo define RLS.
export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'Inicio', roles: ALL_ROLES },
  { to: '/usuarios', label: 'Usuarios', roles: ['owner'] },
]
