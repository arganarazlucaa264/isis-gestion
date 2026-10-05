import type { Database } from '@/types/database'

export type AppRole = Database['public']['Enums']['app_role']
export type Profile = Database['public']['Tables']['profiles']['Row']

export const ALL_ROLES: readonly AppRole[] = [
  'owner',
  'manager',
  'cashier',
  'stock_clerk',
  'viewer',
]

export const ROLE_LABELS: Record<AppRole, string> = {
  owner: 'Dueño',
  manager: 'Encargado',
  cashier: 'Vendedor/Cajero',
  stock_clerk: 'Depósito',
  viewer: 'Solo lectura',
}

/** true si el perfil está activo y su rol está entre los indicados. Espejo de has_role() en SQL. */
export function hasRole(
  profile: Pick<Profile, 'role' | 'active'> | null,
  roles: readonly AppRole[],
) {
  return profile !== null && profile.active && roles.includes(profile.role)
}
