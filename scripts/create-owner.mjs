#!/usr/bin/env node
// Crea el usuario DUEÑO inicial (bootstrap). Se ejecuta a mano por quien administra el proyecto.
//
//   SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...  \
//   npm run create-owner -- dueno@isis.com 'ContraseñaLarga' 'Nombre Apellido'
//
// La service_role key se lee SOLO del entorno de esta terminal: no es una variable VITE_
// y jamás debe ir al frontend ni al repositorio.
import { createClient } from '@supabase/supabase-js'

const [email, password, fullName = 'Dueño'] = process.argv.slice(2)
const url = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!email || !password) {
  console.error("Uso: npm run create-owner -- <email> <contraseña> ['Nombre completo']")
  process.exit(1)
}
if (password.length < 8) {
  console.error('La contraseña debe tener al menos 8 caracteres')
  process.exit(1)
}
if (!serviceKey) {
  console.error(
    'Falta SUPABASE_SERVICE_ROLE_KEY en el entorno (ver `npx supabase status` en local)',
  )
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: fullName },
  app_metadata: { role: 'owner' },
})

if (error) {
  console.error(`No se pudo crear el usuario: ${error.message}`)
  process.exit(1)
}
console.log(`Dueño creado: ${data.user.email} (${data.user.id})`)
