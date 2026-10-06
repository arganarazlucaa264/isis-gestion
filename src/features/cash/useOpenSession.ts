import { useQuery } from '@tanstack/react-query'
import { listOpenSessions } from '@/features/cash/api'
import { useAuth } from '@/features/auth/auth-context'

/** Caja abierta del usuario actual (o la única abierta si es dueño/encargado). */
export function useOpenSession() {
  const { profile } = useAuth()
  const query = useQuery({
    queryKey: ['cash', 'open'],
    queryFn: listOpenSessions,
    refetchInterval: 60_000,
  })
  const sessions = query.data ?? []
  const mine = sessions.find((s) => s.opened_by === profile?.id)
  const session = mine ?? (sessions.length === 1 ? sessions[0] : undefined)
  return { ...query, sessions, session }
}
