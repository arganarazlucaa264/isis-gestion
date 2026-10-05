import { useState, type SyntheticEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { signInWithPassword } from '@/features/auth/api'
import { loginSchema } from '@/features/auth/schemas'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: SyntheticEvent) {
    e.preventDefault()
    setError(null)
    const parsed = loginSchema.safeParse({ email: email.trim(), password })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos')
      return
    }
    setSubmitting(true)
    try {
      await signInWithPassword(parsed.data.email, parsed.data.password)
      // La redirección la hace <PublicOnly> al detectar la sesión.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="print-gold flex flex-col items-center justify-center bg-ink-900 px-8 py-14 text-center text-cream-100">
        <p className="font-display text-7xl font-semibold tracking-[0.25em] text-gold-400 sm:text-8xl">
          ISIS
        </p>
        <div className="print-strip my-5 w-40 rounded-full" />
        <p className="text-xs tracking-[0.45em] text-sand-300 uppercase">Gestión del local</p>
      </section>
      <section className="flex items-center justify-center px-6 py-12">
        <form
          onSubmit={(e) => void onSubmit(e)}
          className="flex w-full max-w-sm flex-col gap-4"
          noValidate
        >
          <div>
            <h1 className="text-4xl font-semibold">Ingresar</h1>
            <p className="mt-1 text-sm text-bronze-600">Accedé con tu usuario del local.</p>
          </div>
          <Input
            label="Email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
            }}
            autoFocus
          />
          <Input
            label="Contraseña"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
            }}
          />
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" variant="primary" loading={submitting}>
            Ingresar
          </Button>
          <p className="text-center text-xs text-bronze-500">
            El acceso lo crea el dueño. No hay registro público.
          </p>
        </form>
      </section>
    </div>
  )
}
