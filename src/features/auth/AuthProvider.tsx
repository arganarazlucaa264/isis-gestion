import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { fetchProfile, signOut } from '@/features/auth/api'
import { AuthContext, type AuthState, type AuthStatus } from '@/features/auth/auth-context'
import { supabase } from '@/lib/supabase'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setInitializing(false)
    })
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      if (event === 'SIGNED_OUT') queryClient.clear()
    })
    return () => {
      data.subscription.unsubscribe()
    }
  }, [queryClient])

  const userId = session?.user.id
  const profileQuery = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => fetchProfile(userId ?? ''),
    enabled: userId !== undefined,
  })

  const profile = profileQuery.data ?? null

  const status: AuthStatus = useMemo(() => {
    if (initializing) return 'loading'
    if (!session) return 'signed_out'
    if (profileQuery.isPending) return 'loading'
    if (profile?.active !== true) return 'no_access'
    return 'ready'
  }, [initializing, session, profileQuery.isPending, profile])

  const value = useMemo<AuthState>(
    () => ({ status, session, profile, signOut }),
    [status, session, profile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
