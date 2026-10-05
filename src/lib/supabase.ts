import { createClient } from '@supabase/supabase-js'
import { parseEnv } from '@/lib/env'
import type { Database } from '@/types/database'

const env = parseEnv(import.meta.env)

/** Cliente único de Supabase. Solo usa la anon key: la seguridad real la dan RLS y las RPC. */
export const supabase = createClient<Database>(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
