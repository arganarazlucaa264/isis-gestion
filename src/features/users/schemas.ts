import { z } from 'zod'
import { ALL_ROLES } from '@/features/auth/roles'

export const createUserSchema = z.object({
  email: z.email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  full_name: z.string().trim().min(1, 'Ingresá el nombre').max(120, 'Nombre demasiado largo'),
  role: z.enum(ALL_ROLES as [string, ...string[]], 'Rol inválido'),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
