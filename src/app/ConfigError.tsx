/** Pantalla que se muestra si faltan las variables de entorno públicas (en vez de una pantalla en blanco). */
export function ConfigError({ message }: { message: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-3 p-6">
      <h1 className="text-4xl font-semibold">Falta configurar la aplicación</h1>
      <p className="text-sm text-bronze-700">{message}</p>
      <p className="text-sm text-bronze-700">
        Completá <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> (archivo{' '}
        <code>.env.local</code> en desarrollo, variables del hosting en producción) y volvé a
        compilar. Ver README, sección «Variables de entorno».
      </p>
    </main>
  )
}
