import { useAuth } from '@/features/auth/auth-context'

export function HomePage() {
  const { profile } = useAuth()
  return (
    <main className="mx-auto flex max-w-xl flex-col items-center gap-2 p-10 text-center">
      <h1 className="text-3xl font-semibold">Hola, {profile?.full_name}</h1>
      <p className="text-slate-600">Isis Gestión. Los módulos se habilitan etapa por etapa.</p>
    </main>
  )
}
