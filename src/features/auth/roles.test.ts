import { describe, expect, it } from 'vitest'
import { ALL_ROLES, ROLE_LABELS, hasRole } from '@/features/auth/roles'

describe('hasRole', () => {
  it('permite un rol incluido y activo', () => {
    expect(hasRole({ role: 'owner', active: true }, ['owner', 'manager'])).toBe(true)
  })
  it('rechaza un rol no incluido', () => {
    expect(hasRole({ role: 'cashier', active: true }, ['owner', 'manager'])).toBe(false)
  })
  it('rechaza usuarios desactivados aunque tengan el rol', () => {
    expect(hasRole({ role: 'owner', active: false }, ['owner'])).toBe(false)
  })
  it('rechaza si no hay perfil', () => {
    expect(hasRole(null, ALL_ROLES)).toBe(false)
  })
})

describe('roles', () => {
  it('todos los roles tienen etiqueta', () => {
    for (const role of ALL_ROLES) expect(ROLE_LABELS[role]).toBeTruthy()
  })
})
