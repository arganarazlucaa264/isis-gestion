// Edge Function: alta de usuarios. Solo la puede ejecutar un DUEÑO activo.
// Usa la service_role key (variable de entorno del runtime de Supabase, nunca va al navegador).
// El rol se asigna en app_metadata (no editable por el usuario); el trigger handle_new_user
// crea el perfil a partir de ahí.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ROLES = ['owner', 'manager', 'cashier', 'stock_clerk', 'viewer']

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authorization = req.headers.get('Authorization')
  if (!url || !anonKey || !serviceKey) return json({ error: 'Configuración incompleta' }, 500)
  if (!authorization) return json({ error: 'No autenticado' }, 401)

  // 1) Verificar con el JWT del llamador que es un dueño activo (auth_role() respeta RLS/estado).
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
  })
  const { data: callerRole, error: roleError } = await caller.rpc('auth_role')
  if (roleError) return json({ error: 'No autenticado' }, 401)
  if (callerRole !== 'owner') return json({ error: 'Solo el dueño puede crear usuarios' }, 403)

  // 2) Validar la entrada.
  let payload: Record<string, unknown>
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
  const password = typeof payload.password === 'string' ? payload.password : ''
  const fullName = typeof payload.full_name === 'string' ? payload.full_name.trim() : ''
  const role = typeof payload.role === 'string' ? payload.role : ''
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Email inválido' }, 400)
  if (password.length < 8)
    return json({ error: 'La contraseña debe tener al menos 8 caracteres' }, 400)
  if (fullName.length === 0 || fullName.length > 120) return json({ error: 'Nombre inválido' }, 400)
  if (!ROLES.includes(role)) return json({ error: 'Rol inválido' }, 400)

  // 3) Crear el usuario con privilegios de administración.
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata: { role },
  })
  if (error) return json({ error: error.message }, 400)

  return json({ id: data.user.id, email: data.user.email, role }, 201)
})
