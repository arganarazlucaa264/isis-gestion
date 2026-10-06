import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Contrato frontend ↔ base: `rpc()` recibe los argumentos como un objeto sin tipar, así que un
 * nombre mal escrito solo fallaría en producción. Este test compara cada llamada del código contra
 * los argumentos reales de la función SQL (según src/types/database.ts, generado de la base).
 */

const SRC = join(process.cwd(), 'src')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return walk(full)
    return /\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts') && !name.includes('database.ts')
      ? [full]
      : []
  })
}

interface FnSpec {
  all: Set<string>
  required: Set<string>
}

function balanced(source: string, open: number): string {
  let depth = 0
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++
    if (source[i] === '}') {
      depth--
      if (depth === 0) return source.slice(open + 1, i)
    }
  }
  return ''
}

function parseFunctions(): Map<string, FnSpec> {
  const types = readFileSync(join(SRC, 'types/database.ts'), 'utf8')
  const start = types.indexOf('Functions: {')
  const end = types.indexOf('Enums: {', start)
  const block = types.slice(start, end)
  const out = new Map<string, FnSpec>()
  for (const m of block.matchAll(/\n {6}(\w+): \{\s+Args: /g)) {
    const name = m[1] ?? ''
    const argsStart = m.index + m[0].length
    const all = new Set<string>()
    const required = new Set<string>()
    if (block[argsStart] === '{') {
      for (const a of balanced(block, argsStart).matchAll(/(\w+)(\?)?:/g)) {
        all.add(a[1] ?? '')
        if (!a[2]) required.add(a[1] ?? '')
      }
    }
    // sobrecargas: se queda con la unión de argumentos (ninguna función de negocio está sobrecargada)
    const prev = out.get(name)
    out.set(
      name,
      prev
        ? {
            all: new Set([...prev.all, ...all]),
            required: new Set([...required].filter((r) => prev.required.has(r))),
          }
        : { all, required },
    )
  }
  return out
}

/** Extrae el literal de objeto que sigue a `rpc('nombre', ` respetando llaves anidadas. */
function callArgs(source: string, from: number): string | null {
  const open = source.indexOf('{', from)
  if (open === -1) return null
  let depth = 0
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++
    if (source[i] === '}') {
      depth--
      if (depth === 0) return source.slice(open + 1, i)
    }
  }
  return null
}

/** Solo las claves de primer nivel (descarta lo que está dentro de llaves/corchetes anidados). */
function topLevelKeys(body: string): string[] {
  const keys: string[] = []
  let depth = 0
  let token = ''
  for (const ch of body) {
    if ('{[('.includes(ch)) depth++
    if ('}])'.includes(ch)) depth--
    if (depth === 0) token += ch
    if (depth === 0 && ch === ',') {
      keys.push(token)
      token = ''
    }
  }
  keys.push(token)
  return keys.flatMap((t) => {
    const m = /^\s*(p_\w+)\s*(?::|$|,)/.exec(t)
    return m?.[1] ? [m[1]] : []
  })
}

describe('contrato rpc() ↔ funciones SQL', () => {
  const fns = parseFunctions()
  const calls: { file: string; name: string; keys: string[] }[] = []
  for (const file of walk(SRC)) {
    const source = readFileSync(file, 'utf8')
    for (const m of source.matchAll(/\brpc(?:All)?\(\s*'(\w+)'/g)) {
      const name = m[1] ?? ''
      const after = m.index + m[0].length
      // ¿hay un segundo argumento (objeto)? ")" inmediato = sin argumentos
      const rest = source.slice(after).trimStart()
      const body = rest.startsWith(',') ? callArgs(source, after) : null
      calls.push({ file: file.replace(SRC, 'src'), name, keys: body ? topLevelKeys(body) : [] })
    }
  }

  it('encuentra las llamadas del código y las funciones generadas', () => {
    expect(fns.size).toBeGreaterThan(40)
    expect(calls.length).toBeGreaterThan(40)
  })

  it('toda función llamada existe en la base', () => {
    const missing = calls.filter((c) => !fns.has(c.name)).map((c) => `${c.file}: ${c.name}`)
    expect(missing).toEqual([])
  })

  it('cada llamada usa solo argumentos que existen y no omite los obligatorios', () => {
    const problems: string[] = []
    for (const c of calls) {
      const spec = fns.get(c.name)
      if (!spec) continue
      for (const k of c.keys)
        if (!spec.all.has(k)) problems.push(`${c.file}: ${c.name} recibe "${k}" que no existe`)
      for (const r of spec.required)
        if (!c.keys.includes(r)) problems.push(`${c.file}: ${c.name} no envía "${r}"`)
    }
    expect(problems).toEqual([])
  })

  it('las funciones internas nunca se llaman desde el frontend', () => {
    expect(calls.filter((c) => c.name.startsWith('internal_'))).toEqual([])
  })
})
