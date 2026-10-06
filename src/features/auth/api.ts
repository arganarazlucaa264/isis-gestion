import { supabase } from '@/lib/supabase'
import type { Profile } from '@/features/auth/roles'

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(translateAuthError(error.message))
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error(error.message)
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

function translateAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Email o contraseña incorrectos'
  if (/email not confirmed/i.test(message)) return 'El email todavía no fue confirmado'
  return message
}
