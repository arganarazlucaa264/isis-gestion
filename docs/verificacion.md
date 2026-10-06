# Verificación

Qué se probó, cómo y qué todavía necesita una prueba contra un Supabase real.

## Comandos

```bash
npm run typecheck     # TypeScript estricto
npm run lint          # ESLint (typescript-eslint strictTypeChecked)
npm run format:check  # Prettier
npm run test          # Vitest: lógica, contrato frontend↔RPC, escaneo de secretos
npm run build         # tsc + vite build
npm run db:test       # pgTAP (requiere Docker + Supabase local)
```

## Verificado (entorno de desarrollo sin Docker)

| Qué                        | Cómo                                                                                                                                                                                                                                                               | Resultado                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| Calidad del frontend       | typecheck, lint, formato, build                                                                                                                                                                                                                                    | OK                                                       |
| Tests frontend             | Vitest: 59 tests (EAN, dinero, fechas, carrito/pagos del POS, Excel, guards, contrato rpc↔SQL, sin claves privilegiadas)                                                                                                                                           | OK                                                       |
| Migraciones                | Aplicadas en orden sobre PostgreSQL 16                                                                                                                                                                                                                             | OK, sin errores                                          |
| Funciones PL/pgSQL         | `plpgsql_check` sobre las 80 funciones                                                                                                                                                                                                                             | 0 errores                                                |
| Tests SQL                  | 334 aserciones pgTAP en 10 archivos (RLS, RPC, ledgers, caja, ventas, compras, importación, reportes)                                                                                                                                                              | OK                                                       |
| Cobertura de funciones     | `track_functions` durante pgTAP + integración: toda función pública se ejecutó                                                                                                                                                                                     | OK                                                       |
| **API real**               | **PostgREST 12.2.3 real** delante de la base migrada, con JWT por rol (dueño, encargado, cajero, depósito, solo lectura, anónimo)                                                                                                                                  | OK                                                       |
| Capa de datos del frontend | 18 tests de integración que ejecutan los módulos `api.ts` reales contra PostgREST: catálogo, stock, inventario, caja, ventas (pago mixto, vuelto), devoluciones, anulaciones, compras, cuenta corriente, importación, 8 exportaciones, reportes, tablero, usuarios | OK                                                       |
| Todas las pantallas        | Navegador real (Playwright) contra PostgREST, 19 rutas × 5 roles                                                                                                                                                                                                   | Sin errores HTTP ni de consola                           |
| Flujo de interfaz          | Abrir caja → vender con vuelto → escanear EAN → pago mixto → historial → cerrar caja con diferencia                                                                                                                                                                | OK; efectivo esperado correcto, la transferencia no suma |
| Edge Function              | Ejecutada en Deno 2 (`deno check` + servidor) contra un gateway que simula Auth: 401/403/400/201, duplicados, CORS                                                                                                                                                 | OK                                                       |
| Script `create-owner`      | Contra el mismo gateway: éxito, duplicado, claves inválidas                                                                                                                                                                                                        | OK                                                       |
| Concurrencia               | Dos ventas simultáneas de la última unidad                                                                                                                                                                                                                         | Una OK, otra «Stock insuficiente»                        |
| Volumen                    | 1.200 variantes/clientes: lecturas y reportes paginan y no truncan                                                                                                                                                                                                 | OK                                                       |

### Problemas encontrados y corregidos en esta etapa

- **Truncamiento silencioso a 1000 filas** (límite de Supabase/PostgREST): reportes (stock valorizado, ventas por
  producto…), lookups, cuenta corriente y listados podían salir incompletos. Ahora paginan (`rpcAll`, `fetchAll`) y los
  reportes tienen orden determinístico.
- **CORS abierto (`*`)** en la Edge Function: ahora solo responde a `ALLOWED_ORIGINS`.
- Mensaje de email duplicado en inglés; `create-owner` no detectaba el uso de la anon key por error.
- Pantalla en blanco si faltaban las variables `VITE_*`: ahora muestra qué falta.
- CI: no ejecutaba lint SQL, auditoría ni chequeo de tipos; no validaba la Edge Function.
- README sin instrucciones exactas de producción.

## Cómo se simuló Supabase (y por qué no reemplaza una prueba real)

La base es PostgreSQL 16 real con un esquema `auth` mínimo (`auth.users`, `auth.uid()`) y los roles de Supabase.
PostgREST es el binario oficial. **GoTrue (Auth) y Kong no estuvieron**: un gateway de prueba imitó
`/auth/v1/admin/users`, y las sesiones se fabricaron firmando JWT con el secreto de prueba.

## Necesita prueba real (contra Supabase)

1. `supabase start`, `db reset`, `db lint` y `supabase test db` sobre la imagen oficial (Docker) — lo hace el job `database` del CI.
2. `supabase db push` sobre un proyecto real (checklist en [despliegue.md](despliegue.md)).
3. Login real con GoTrue (email + contraseña), expiración/renovación de sesión.
4. La Edge Function desplegada: JWT de plataforma, secretos inyectados, CORS desde el dominio real.
5. `npm run db:types` contra el stack local oficial (el paso del CI queda con `continue-on-error` hasta la primera corrida real).
6. Lector de código de barras físico, cámara en un celular real e impresora térmica.
7. Rendimiento con datos reales (miles de ventas): índices revisados, pero no medidos.
