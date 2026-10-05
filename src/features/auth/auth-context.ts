import type { Session } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'
import type { Profile } from '@/features/auth/roles'

export type AuthStatus =
  | 'loading' // resolviendo la sesión o el perfil
  | 'signed_out' // sin sesión
  | 'no_access' // sesión válida pero sin perfil o desactivado
  | 'ready' // sesión + perfil activo

export interface AuthState {
  status: AuthStatus
  session: Session | null
  profile: Profile | null
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
