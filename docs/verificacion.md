# Verificación

Qué se probó, cómo y qué no pudo ejecutarse en el entorno de desarrollo (sin Docker).

## Comandos

```bash
npm run typecheck     # TypeScript estricto
npm run lint          # ESLint (typescript-eslint strictTypeChecked)
npm run format:check  # Prettier
npm run test          # Vitest: lógica del frontend
npm run build         # tsc + vite build
npm run db:test       # pgTAP (requiere Docker + Supabase local)
```

## Resultado (última corrida)

| Prueba                  | Resultado                                                                                                                          |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| typecheck               | OK                                                                                                                                 |
| lint                    | OK, sin advertencias                                                                                                               |
| format check            | OK                                                                                                                                 |
| Tests frontend (Vitest) | 51 tests: EAN/GTIN, dinero, fechas, errores, carrito y pagos del POS, Excel (SKU/EAN como texto), guards de rutas, roles, esquemas |
| build                   | OK (pantallas con carga bajo demanda; `exceljs` solo se descarga al usar Excel)                                                    |
| Migraciones             | Aplican limpias, en orden, sobre PostgreSQL 16                                                                                     |
| Tests SQL               | **332 aserciones** en 10 archivos (`supabase/tests/database`), todas OK                                                            |
| Concurrencia            | Dos ventas simultáneas de la última unidad: una OK, otra "Stock insuficiente"                                                      |
| Humo de interfaz        | Todas las rutas cargan sin errores de consola (Playwright con API simulada), en escritorio y celular                               |

## Cómo se ejecutaron los tests SQL acá

Este entorno no tiene el daemon de Docker, así que `supabase start` / `supabase test db` no pudieron
correr. Los tests SQL se ejecutaron contra un **PostgreSQL 16 real** con:

- un esquema `auth` mínimo (`auth.users`, `auth.uid()`) y los roles `anon`/`authenticated`/`service_role`;
- una implementación mínima de las funciones de pgTAP usadas (`ok`, `is`, `throws_ok`, `lives_ok`,
  `has_table`, `has_function`, `cmp_ok`, `finish`).

Los archivos `.test.sql` son pgTAP estándar y deben correr igual con `supabase test db` (el job
`database` del CI lo ejecuta). **Primera ejecución real pendiente** en un entorno con Docker.

## No ejecutado en este entorno

- `supabase start`, `supabase db reset` y `supabase test db` reales (sin Docker).
- La Edge Function `create-user` y el script `create-owner` contra un Supabase real.
- Login y flujos completos contra un backend real (la interfaz se verificó con una API simulada).
- Lector de código de barras físico y escaneo con cámara en un celular (la arquitectura está
  preparada; la cámara usa `BarcodeDetector`, disponible en Chrome/Android).
- Impresión de comprobantes en una impresora térmica real.
