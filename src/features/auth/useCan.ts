import { useAuth } from '@/features/auth/auth-context'
import { hasRole, type AppRole } from '@/features/auth/roles'

/** ¿El usuario actual tiene alguno de estos roles? (solo para UI; la seguridad real es RLS/RPC) */
export function useCan(...roles: AppRole[]): boolean {
  const { profile } = useAuth()
  return hasRole(profile, roles)
}
