import { describe, expect, it } from 'vitest'
import { createUserSchema } from '@/features/users/schemas'

const valid = { email: 'a@b.com', password: '12345678', full_name: 'Ana', role: 'cashier' }

describe('createUserSchema', () => {
  it('acepta datos válidos', () => {
    expect(createUserSchema.safeParse(valid).success).toBe(true)
  })
  it('rechaza contraseñas cortas', () => {
    expect(createUserSchema.safeParse({ ...valid, password: '123' }).success).toBe(false)
  })
  it('rechaza roles inexistentes', () => {
    expect(createUserSchema.safeParse({ ...valid, role: 'superadmin' }).success).toBe(false)
  })
  it('rechaza nombre vacío', () => {
    expect(createUserSchema.safeParse({ ...valid, full_name: '  ' }).success).toBe(false)
  })
})
