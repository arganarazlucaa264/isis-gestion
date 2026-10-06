import { FunctionsHttpError } from '@supabase/supabase-js'
import type { AppRole, Profile } from '@/features/auth/roles'
import type { CreateUserInput } from '@/features/users/schemas'
import { supabase } from '@/lib/supabase'

export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('*').order('full_name')
  if (error) throw new Error(error.message)
  return data
}

export async function updateProfile(input: {
  id: string
  fullName: string
  role: AppRole
  active: boolean
}): Promise<Profile> {
  const { data, error } = await supabase.rpc('admin_update_profile', {
    p_user_id: input.id,
    p_full_name: input.fullName,
    p_role: input.role,
    p_active: input.active,
  })
  if (error) throw new Error(error.message)
  return data
}

/** Alta de usuario vía Edge Function (usa la service_role key del lado servidor). */
export async function createUser(input: CreateUserInput): Promise<void> {
  const result = await supabase.functions.invoke<unknown>('create-user', { body: input })
  const error: unknown = result.error
  if (!error) return
  if (error instanceof FunctionsHttpError) {
    const response = error.context as Response
    const body = (await response.json()) as { error?: string }
    throw new Error(body.error ?? 'No se pudo crear el usuario')
  }
  throw new Error(error instanceof Error ? error.message : 'No se pudo crear el usuario')
}
