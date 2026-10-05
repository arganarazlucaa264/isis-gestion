# Isis Gestión

Sistema de gestión interno para un local de ropa: productos y variantes (modelo + color + talle),
stock, inventario físico, ventas, caja, gastos, compras, proveedores y cuenta corriente,
reportes e importación/exportación de Excel. Preparado para códigos EAN.

Stack: React + Vite + TypeScript · Supabase (PostgreSQL, Auth, RLS).

## Estado

Sistema completo implementado (etapas 0 a 10 del plan en [docs/arquitectura.md](docs/arquitectura.md)):

| Área                  | Qué incluye                                                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acceso                | Supabase Auth (email + contraseña), sin registro público, 5 roles, RLS en todas las tablas, auditoría                                                               |
| Catálogo              | Categorías, marcas, colores, talles, productos y variantes (modelo + color + talle), SKU, EAN, costos, precios, historiales                                         |
| Stock                 | Ledger inmutable de movimientos, stock mínimo, ajustes, pérdidas/roturas, carga inicial, control de integridad                                                      |
| Inventario físico     | Conteo (manual, Excel o escáner), revisión, aplicación de diferencias, historial                                                                                    |
| Excel                 | Importar productos/variantes/stock con staging, validación y vista previa; exportar stock, productos, ventas, compras, movimientos, caja, proveedores e inventarios |
| Caja                  | Apertura, ingresos, retiros, gastos, pagos a proveedores, cierre con efectivo esperado vs. contado; solo el efectivo suma al efectivo físico                        |
| Ventas (POS)          | Búsqueda por nombre/SKU/EAN, carrito, descuentos, pagos mixtos, vuelto, comprobante interno, anulaciones y devoluciones                                             |
| Gastos                | Categorías, medio de pago, comprobante, impacto correcto en caja                                                                                                    |
| Proveedores y compras | Compras con pago total/parcial/pendiente, recepción (stock + costo promedio), cuenta corriente, vencimientos                                                        |
| Reportes y dashboard  | Ventas por día/producto/categoría/medio, stock bajo/sin stock/valorizado, deudas, gastos, margen y resultado estimado                                               |

Detalle de pruebas y pendientes en [docs/verificacion.md](docs/verificacion.md).

## Requisitos

- Node.js 22 (`.nvmrc`)
- Docker (solo para correr Supabase local)

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # completar con los valores de `npm run db:start` / `npx supabase status`
npm run db:start             # levanta Supabase local (requiere Docker)
npm run dev
```

### Crear el dueño inicial

El registro público está desactivado. El primer usuario (dueño) se crea una vez, desde una terminal
de confianza, con la service_role key (que **nunca** va al frontend ni al repo):

```bash
# local: la key sale de `npx supabase status`
SUPABASE_SERVICE_ROLE_KEY=... npm run create-owner -- dueno@isis.com 'una-clave-larga' 'Nombre Apellido'
# producción: además SUPABASE_URL=https://<proyecto>.supabase.co
```

Después el dueño crea al resto desde la pantalla **Usuarios** (usa la Edge Function `create-user`,
que verifica que quien llama sea dueño). Despliegue: `npx supabase functions deploy create-user`.

## Scripts

| Comando                        | Qué hace                                                |
| ------------------------------ | ------------------------------------------------------- |
| `npm run dev`                  | Servidor de desarrollo                                  |
| `npm run build`                | Typecheck + build de producción                         |
| `npm run check`                | Typecheck + lint + formato + tests (lo mismo que el CI) |
| `npm run test`                 | Tests del frontend (Vitest)                             |
| `npm run format`               | Formatea con Prettier                                   |
| `npm run db:start` / `db:stop` | Supabase local                                          |
| `npm run db:reset`             | Recrea la base local aplicando migraciones y `seed.sql` |
| `npm run db:test`              | Tests SQL (pgTAP) en `supabase/tests/database`          |
| `npm run db:types`             | Regenera `src/types/database.ts` desde la base local    |

## Estructura

```
docs/                 arquitectura, modelo de datos, decisiones (ADR)
supabase/             config, migrations/, seed.sql, tests/database, functions/
src/app/              router, providers, layout
src/components/ui/    componentes de UI compartidos
src/features/<área>/  una carpeta por área de negocio (api, hooks, components, pages, schemas)
src/lib/              cliente Supabase, env, helpers (money, ...)
src/types/            tipos generados de la base
```

## Documentación

- [Arquitectura](docs/arquitectura.md) ([PDF](docs/arquitectura.pdf))
- [Modelo de datos](docs/modelo-datos.md)
- [Seguridad y permisos](docs/seguridad.md)
- [Verificación](docs/verificacion.md)
- [Decisiones de arquitectura](docs/decisiones/README.md)
