import { z } from 'zod'

const envSchema = z.object({
  VITE_SUPABASE_URL: z.url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
})

export type Env = z.infer<typeof envSchema>

/** Valida las variables de entorno públicas. Falla con un mensaje claro si falta alguna. */
export function parseEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw)
  if (!result.success) {
    const detail = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new Error(
      `Variables de entorno inválidas (revisá .env.local, ver .env.example): ${detail}`,
    )
  }
  return result.data
}
