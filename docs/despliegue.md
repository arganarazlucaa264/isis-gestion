# Despliegue y verificación en un Supabase real

Los pasos de instalación están en el [README](../README.md) (secciones A y B). Este documento es el
**checklist de verificación** que hay que recorrer la primera vez, y qué hacer si algo falla.

Reemplazá `$URL` por `https://<project-ref>.supabase.co` y `$ANON` por la clave anon/publishable.

## Checklist (marcá cada punto)

### 1. Base de datos

- [ ] `npx supabase db push` terminó sin errores (13 migraciones).
- [ ] `supabase/checks/audit.sql` en el SQL Editor devuelve **0 filas**.
- [ ] En el SQL Editor: `select count(*) from public.payment_methods;` devuelve 6 y
      `select name from public.cash_registers;` devuelve «Caja principal».

### 2. Autenticación

- [ ] El registro público está bloqueado:
  ```bash
  curl -s -X POST "$URL/auth/v1/signup" -H "apikey: $ANON" -H "Content-Type: application/json" \
    -d '{"email":"prueba@example.com","password":"12345678"}'
  ```
  Esperado: error `signup_disabled` (HTTP 422). Si crea un usuario, **desactivá «Allow new users to sign up»**
  y borrá ese usuario desde _Authentication → Users_.
- [ ] El usuario anónimo no lee nada:
  ```bash
  curl -s "$URL/rest/v1/profiles?select=*" -H "apikey: $ANON"
  ```
  Esperado: `permission denied` (HTTP 401/403), nunca datos.
- [ ] `npm run create-owner` imprimió «Dueño creado». En el SQL Editor:
      `select email, role, active from public.profiles;` muestra al dueño con `role = owner`.
- [ ] Login en el frontend con el dueño → entra al tablero.
- [ ] Una contraseña incorrecta muestra «Email o contraseña incorrectos».

### 3. Edge Function `create-user`

- [ ] Sin sesión (o con un usuario que no es dueño) responde 401/403:
  ```bash
  curl -s -X POST "$URL/functions/v1/create-user" -H "apikey: $ANON" -H "Content-Type: application/json" \
    -d '{"email":"a@b.com","password":"12345678","full_name":"X","role":"cashier"}'
  ```
- [ ] CORS: solo el origen configurado recibe `Access-Control-Allow-Origin`:
  ```bash
  curl -si -X OPTIONS "$URL/functions/v1/create-user" -H "Origin: https://gestion.tu-dominio.com" | grep -i access-control
  curl -si -X OPTIONS "$URL/functions/v1/create-user" -H "Origin: https://otro-sitio.example"   | grep -i access-control
  ```
  El primero devuelve el origen; el segundo no devuelve `Access-Control-Allow-Origin`.
- [ ] Desde **Usuarios** (como dueño) crear una vendedora → aparece en la lista con rol «Vendedor/Cajero».
- [ ] Iniciar sesión como esa vendedora: ve Vender, Ventas, Caja, Gastos, Productos y Stock; **no** ve
      Reportes, Compras, Proveedores, Usuarios ni costos.
- [ ] Crear el mismo email otra vez → «Ya existe un usuario con ese email».

### 4. Flujo de negocio (con datos de prueba)

- [ ] Crear un producto con variantes (color y talle), un EAN válido y stock inicial.
- [ ] **Caja → Abrir** con $5.000.
- [ ] **Vender**: escanear/escribir el EAN, cobrar parte en efectivo y parte con transferencia.
- [ ] **Caja**: el efectivo esperado suma solo el efectivo (la transferencia aparece aparte).
- [ ] **Cerrar caja** con un contado distinto → muestra faltante/sobrante y queda en el historial.
- [ ] **Ventas → Ver → Devolución** repone stock y descuenta del efectivo esperado.
- [ ] **Compras** → nueva compra con pago parcial → saldo en **Proveedores → Cuenta corriente**.
- [ ] **Excel → Exportar → Stock**, abrirlo: SKU y EAN conservan los ceros iniciales.
- [ ] **Excel → Importar** el mismo archivo: la vista previa no marca errores y no hay diferencias de stock.
- [ ] En el SQL Editor: `select count(*) from public.v_stock_audit;` devuelve **0**.

### 5. Hosting del frontend

- [ ] Abrir una ruta profunda directamente (p. ej. `/productos`) y recargar: no da 404.
- [ ] Sin las variables `VITE_*` el sitio muestra «Falta configurar la aplicación» (no una pantalla en blanco).
- [ ] En las herramientas de desarrollo del navegador (Red) no aparece ninguna petición con la clave `service_role`.

## Si algo falla

| Síntoma                                                | Causa probable                                                              | Qué hacer                                                                                                            |
| ------------------------------------------------------ | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `db push` falla en una migración                       | Diferencia entre el Postgres real y el probado                              | Copiá el error completo y la migración; no edites la base a mano                                                     |
| `audit.sql` devuelve filas                             | Un permiso de la plataforma difiere                                         | Ejecutá `select public.harden_privileges();` y volvé a correrlo; si persiste, avisá                                  |
| Login: «Invalid login credentials»                     | Usuario inexistente o clave mal                                             | Revisá _Authentication → Users_; el dueño se crea solo con `create-owner`                                            |
| Entra pero ve «Tu cuenta no tiene acceso»              | El usuario no tiene perfil activo                                           | `select * from public.profiles where email = '…';` (el trigger lo crea al dar de alta)                               |
| Todo vacío / errores 401 en la consola                 | `VITE_SUPABASE_URL` o la clave mal cargadas, o se compiló sin las variables | Revisá las variables y volvé a compilar                                                                              |
| `create-user` devuelve 401 con sesión de dueño         | La plataforma rechaza el JWT con las claves nuevas                          | Reintentá con `npx supabase functions deploy create-user --no-verify-jwt` (la función igual verifica que seas dueño) |
| El navegador bloquea la llamada a `create-user` (CORS) | `ALLOWED_ORIGINS` no incluye el origen exacto                               | `npx supabase secrets set ALLOWED_ORIGINS=https://…` y reintentar (sin barra final)                                  |
| Un reporte parece incompleto                           | Se pidió un rango enorme                                                    | Los reportes paginan solos; si dudás, acotá el período                                                               |

## Rollback

Las migraciones no tienen «down». Antes de `db push` en un proyecto con datos reales hacé un backup
(_Database → Backups_, o `npx supabase db dump -f backup.sql`). Si una migración falla, la transacción se
revierte y la base queda como estaba.
