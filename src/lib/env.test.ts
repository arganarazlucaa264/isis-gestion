import { describe, expect, it } from 'vitest'
import { parseEnv } from '@/lib/env'

describe('parseEnv', () => {
  it('acepta variables válidas', () => {
    const env = parseEnv({
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_ANON_KEY: 'k',
    })
    expect(env.VITE_SUPABASE_URL).toBe('http://127.0.0.1:54321')
  })

  it('falla con un mensaje claro si falta algo', () => {
    expect(() => parseEnv({ VITE_SUPABASE_URL: 'no-es-url' })).toThrow(
      /Variables de entorno inválidas/,
    )
  })
})
