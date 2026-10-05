# Isis Gestión

Sistema de gestión interno para un local de ropa: productos y variantes (modelo + color + talle),
stock, inventario físico, ventas, caja, gastos, compras, proveedores y cuenta corriente,
reportes e importación/exportación de Excel. Preparado para códigos EAN.

Stack: React + Vite + TypeScript · Supabase (PostgreSQL, Auth, RLS).

## Estado

**Etapa 0 (fundación) completa.** Todavía no hay funcionalidad de negocio.
Plan de etapas en [docs/arquitectura.md](docs/arquitectura.md) (sección 13).

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
- [Decisiones de arquitectura](docs/decisiones/README.md)
