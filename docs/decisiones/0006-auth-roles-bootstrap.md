# 0006 · Autenticación, roles y alta de usuarios

**Estado:** aceptada

## Decisión

- Supabase Auth con email y contraseña. Registro público desactivado (`enable_signup = false`).
- `profiles` (1:1 con `auth.users`) guarda `role` (enum `app_role`) y `active`. Lo crea el trigger
  `handle_new_user`.
- **El rol se toma de `raw_app_meta_data`**, que solo puede escribir el `service_role`. Nunca de
  `user_metadata` (el usuario puede modificarlo). Sin rol válido => `viewer`.
- `auth_role()` y `has_role(variadic roles)` son `SECURITY DEFINER` (evitan recursión de RLS) y
  devuelven NULL/false para usuarios sin perfil o desactivados.
- `profiles`, `audit_log` y `app_settings` solo tienen política de SELECT. Toda escritura va por RPC
  (`admin_update_profile`, `update_own_profile`, `set_app_setting`) que verifican el rol adentro.
- Siempre debe quedar al menos un dueño activo (validado en `admin_update_profile`).
- `audit_log` es inmutable (triggers bloquean UPDATE/DELETE/TRUNCATE) y legible solo por el dueño.
- Alta de usuarios: Edge Function `create-user` (verifica que el llamador sea dueño y usa la
  service_role del runtime). Dueño inicial: script `scripts/create-owner.mjs`, ejecutado a mano.
- Los guards de React (`RequireAuth`, `RequireRole`, `PublicOnly`) son solo UX; la seguridad real es
  RLS + RPC.

## Consecuencias

- Desactivar un perfil corta todo acceso a datos de inmediato (RLS), aunque su sesión JWT siga vigente
  hasta expirar. La UI lo muestra como "cuenta sin acceso".
- Sumar un rol requiere agregarlo al enum (migración) y a `ROLE_LABELS`.
