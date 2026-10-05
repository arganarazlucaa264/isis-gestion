# Isis Gestión

Sistema de gestión interno para un local de ropa: productos y variantes (modelo + color + talle), stock,
inventario físico, ventas (POS), caja, gastos, compras, proveedores con cuenta corriente, reportes e
importación/exportación de Excel. Preparado para códigos EAN.

Stack: React + Vite + TypeScript · Supabase (PostgreSQL, Auth, RLS, Edge Functions).

## Qué incluye

| Área                  | Qué incluye                                                                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Acceso                | Supabase Auth (email + contraseña), sin registro público, 5 roles, RLS en todas las tablas, auditoría                                         |
| Catálogo              | Categorías, marcas, colores, talles, productos y variantes, SKU, EAN, costos, precios, historiales                                            |
| Stock                 | Ledger inmutable de movimientos, stock mínimo, ajustes, pérdidas/roturas, carga inicial                                                       |
| Inventario físico     | Conteo (manual, Excel o escáner), revisión, aplicación de diferencias                                                                         |
| Excel                 | Importar productos/variantes/stock con vista previa; exportar stock, productos, ventas, compras, movimientos, caja, proveedores e inventarios |
| Caja                  | Apertura, ingresos, retiros, gastos, pagos a proveedores, cierre; solo el efectivo suma al efectivo físico                                    |
| Ventas (POS)          | Búsqueda por nombre/SKU/EAN, descuentos, pagos mixtos, vuelto, comprobante, anulaciones y devoluciones                                        |
| Compras y proveedores | Pago total/parcial/pendiente, recepción con costo promedio, cuenta corriente, vencimientos                                                    |
| Reportes y dashboard  | Ventas, margen, stock, deudas, gastos y resultado estimado                                                                                    |

## Requisitos

- Node.js 22 (`.nvmrc`) y npm.
- Docker (solo para correr Supabase en tu máquina).
- Una cuenta en <https://supabase.com> (solo para producción).

## Claves y secretos (leer antes de configurar)

| Variable                                                         | Dónde se define                                                                                                     | Quién la usa                   | ¿Es secreta?                      |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------ | --------------------------------- |
| `VITE_SUPABASE_URL`                                              | `.env.local` / variables del hosting (antes de compilar)                                                            | Frontend                       | No                                |
| `VITE_SUPABASE_ANON_KEY`                                         | ídem. Clave **anon** (`eyJ…`) o **publishable** (`sb_publishable_…`)                                                | Frontend                       | No (pública)                      |
| `SUPABASE_URL`                                                   | Solo en tu terminal, al correr `npm run create-owner`                                                               | Script del dueño               | No                                |
| `SUPABASE_SERVICE_ROLE_KEY`                                      | Solo en tu terminal, al correr `npm run create-owner`. Clave **service_role** (`eyJ…`) o **secret** (`sb_secret_…`) | Script del dueño               | **SÍ**                            |
| `ALLOWED_ORIGINS`                                                | Secreto de la Edge Function (`npx supabase secrets set …`)                                                          | Edge Function `create-user`    | No                                |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | **Las inyecta Supabase** en las Edge Functions; no hay que cargarlas                                                | Edge Function `create-user`    | La service_role sí                |
| `DB_URL`                                                         | Solo para `npm run db:types:url`                                                                                    | Generación de tipos sin Docker | Contiene la contraseña de la base |

Reglas: la service_role / secret **nunca** va en un `VITE_*`, ni en el repositorio, ni en el hosting del
frontend. El proyecto trae un test (`src/lib/no-secrets.node.test.ts`) que falla si aparece una en el
código o en el build.

---

## A. Desarrollo local

```bash
npm ci
npm run db:start                  # levanta Supabase local (Docker) y aplica migraciones + seed
npx supabase status               # muestra API URL, anon key y service_role key
cp .env.example .env.local        # completar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY con lo anterior

# Crear el usuario dueño (una sola vez). La service_role va solo en esta línea:
SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_SERVICE_ROLE_KEY='<service_role key de supabase status>' \
npm run create-owner -- dueno@isis.com 'una-clave-larga-123' 'Nombre Apellido'

npx supabase functions serve create-user   # (otra terminal) solo si vas a crear usuarios desde la pantalla Usuarios
npm run dev                       # http://localhost:5173
```

Ingresá con el email y la contraseña del dueño. Desde **Usuarios** el dueño crea al resto.

Pruebas locales: `npm run check` (typecheck + lint + formato + tests) y `npm run db:test` (pgTAP).

## B. Puesta en producción (Supabase cloud)

**1. Crear el proyecto** en <https://supabase.com/dashboard> (anotá el _project ref_ y la contraseña de la base).

**2. Vincular y subir las migraciones**

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push --dry-run     # revisá qué va a aplicar
npx supabase db push               # aplica las 13 migraciones
```

**3. Desactivar el registro público** (obligatorio). Dashboard → _Authentication_ → _Sign In / Providers_
(o _Providers → Email_) → desactivar **«Allow new users to sign up»**. Dejá _Site URL_ con la URL final del
frontend. (`config.toml` solo rige en local.)

**4. Auditar la base real.** Dashboard → _SQL Editor_ → pegá `supabase/checks/audit.sql` → _Run_.
Tiene que devolver **0 filas**. Si devuelve alguna, no sigas: avisame con el resultado.

**5. Edge Function de alta de usuarios**

```bash
npx supabase secrets set ALLOWED_ORIGINS=https://gestion.tu-dominio.com   # el origen EXACTO del frontend (varios: separados por coma)
npx supabase functions deploy create-user
```

**6. Crear el dueño** (una sola vez). La clave está en Dashboard → _Project Settings_ → _API Keys_
(service_role o secret). Para que no quede en el historial del shell:

```bash
read -rs SUPABASE_SERVICE_ROLE_KEY && export SUPABASE_SERVICE_ROLE_KEY
SUPABASE_URL=https://<project-ref>.supabase.co npm run create-owner -- dueno@isis.com 'una-clave-larga-123' 'Nombre Apellido'
unset SUPABASE_SERVICE_ROLE_KEY
```

**7. Compilar y publicar el frontend.** Cargá `VITE_SUPABASE_URL` (`https://<project-ref>.supabase.co`) y
`VITE_SUPABASE_ANON_KEY` (anon/publishable) como variables del hosting y compilá:

```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co VITE_SUPABASE_ANON_KEY=<anon-o-publishable> npm run build
```

Publicá la carpeta `dist/` en cualquier hosting estático (Netlify, Cloudflare Pages, Vercel). Las reglas para
que todas las rutas sirvan `index.html` ya están incluidas (`public/_redirects` y `vercel.json`).

**8. Verificación post-despliegue.** Seguí el checklist de [docs/despliegue.md](docs/despliegue.md)
(registro bloqueado, anon sin acceso, login, caja → venta → cierre, creación de usuario, CORS).

## Scripts

| Comando                        | Qué hace                                                                                                 |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `npm run dev`                  | Servidor de desarrollo                                                                                   |
| `npm run build`                | Typecheck + build de producción                                                                          |
| `npm run check`                | Typecheck + lint + formato + tests (lo mismo que el CI)                                                  |
| `npm run test`                 | Tests del frontend (Vitest, incluye el contrato frontend↔RPC y el escaneo de secretos)                   |
| `npm run db:start` / `db:stop` | Supabase local (Docker)                                                                                  |
| `npm run db:reset`             | Recrea la base local con migraciones y `seed.sql`                                                        |
| `npm run db:test`              | Tests SQL (pgTAP) en `supabase/tests/database`                                                           |
| `npm run db:types`             | Regenera `src/types/database.ts` desde la base local (Docker)                                            |
| `npm run db:types:url`         | Igual, contra cualquier Postgres migrado: `DB_URL='postgresql://…?sslmode=disable' npm run db:types:url` |
| `npm run create-owner`         | Crea el dueño inicial (necesita `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en tu terminal)             |

## Estructura

```
docs/                 arquitectura, modelo de datos, seguridad, despliegue, verificación, decisiones (ADR)
supabase/             config, migrations/, seed.sql, tests/database (pgTAP), checks/audit.sql, functions/create-user
src/app/              router, layout, providers
src/components/       UI compartida y gráficos
src/features/<área>/  una carpeta por área de negocio
src/lib/              cliente Supabase, RPC, Excel, helpers
src/types/            tipos generados de la base
scripts/              create-owner.mjs, gen-types.sh
```

## Documentación

- [Arquitectura](docs/arquitectura.md) · [Modelo de datos](docs/modelo-datos.md) · [Seguridad](docs/seguridad.md)
- [Despliegue y checklist](docs/despliegue.md) · [Verificación](docs/verificacion.md)
- [Decisiones de arquitectura](docs/decisiones/README.md)
