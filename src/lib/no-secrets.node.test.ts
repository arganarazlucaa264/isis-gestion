import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Ninguna clave privilegiada (service_role / secret key) puede terminar en el navegador.
 * Se revisa el código fuente del frontend y, si existe, el build (dist/).
 */

const ROOT = process.cwd()

function walk(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (name === 'node_modules' || name === '.git') return []
    if (statSync(full).isDirectory()) return walk(full)
    return /\.(ts|tsx|js|mjs|css|html|json|svg|env.*)$/.test(name) ? [full] : []
  })
}

function leaks(text: string): string[] {
  const found: string[] = []
  for (const m of text.matchAll(/sb_secret_[A-Za-z0-9_-]{16,}/g)) found.push(m[0].slice(0, 20))
  for (const m of text.matchAll(
    /eyJ[A-Za-z0-9_-]{10,}\.([A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/g,
  )) {
    try {
      const claims = JSON.parse(Buffer.from(m[1] ?? '', 'base64url').toString()) as {
        role?: string
      }
      if (claims.role === 'service_role') found.push('JWT con role=service_role')
    } catch {
      // no es un JWT
    }
  }
  return found
}

describe('sin claves privilegiadas en el frontend', () => {
  const files = [
    ...walk(join(ROOT, 'src')),
    ...walk(join(ROOT, 'public')),
    ...walk(join(ROOT, 'dist')),
    join(ROOT, 'index.html'),
    join(ROOT, '.env.example'),
  ].filter((f) => existsSync(f))

  it('el código y el build no contienen service_role ni secret keys', () => {
    const offenders = files.flatMap((f) => leaks(readFileSync(f, 'utf8')).map((l) => `${f}: ${l}`))
    expect(offenders).toEqual([])
  })

  it('el frontend solo lee variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY', () => {
    const used = new Set<string>()
    for (const f of walk(join(ROOT, 'src')).filter((x) => !x.endsWith('.test.ts'))) {
      for (const m of readFileSync(f, 'utf8').matchAll(/import\.meta\.env\.(\w+)/g))
        used.add(m[1] ?? '')
    }
    for (const v of used) expect(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']).toContain(v)
  })

  it('.env.example no define variables VITE_ con nombres de claves privadas', () => {
    const example = readFileSync(join(ROOT, '.env.example'), 'utf8')
    expect(example).not.toMatch(/^\s*VITE_\w*(SERVICE|SECRET)\w*=/m)
  })

  it('los .env reales están ignorados por git', () => {
    const ignore = readFileSync(join(ROOT, '.gitignore'), 'utf8')
    expect(ignore).toMatch(/^\.env$/m)
    expect(ignore).toMatch(/^\.env\.\*$/m)
    expect(ignore).toMatch(/^!\.env\.example$/m)
  })
})
