# Seguridad

Resumen de cómo está protegido el sistema. La seguridad real vive en PostgreSQL (RLS + funciones
RPC); los guards de React son solo comodidad de interfaz.

## Principios

1. **RLS en TODAS las tablas de `public`** (verificado por el test `09_reports_security`).
2. **Las tablas no se escriben desde la API** salvo los maestros chicos (categorías, marcas, colores,
   talles, productos, variantes, proveedores, clientes, medios de pago, cajas, categorías de gasto),
   y solo por rol. Nunca hay `DELETE`: se desactiva o se anula.
3. **Ledgers y documentos solo por RPC** `SECURITY DEFINER` con `search_path = ''` y verificación de rol
   adentro (`require_role`). Los ledgers (`stock_movements`, `cash_movements`, `supplier_ledger`,
   `audit_log`, `price_history`, `cost_history`) son inmutables por trigger, incluso para superusuarios.
4. **Costos aislados**: `variant_costs`, `cost_history` y `sale_item_costs` tienen RLS más estricta
   (los vendedores no los ven). Los reportes con costos usan una vista sin acceso desde la API.
5. **`service_role` solo del lado servidor**: la usan la Edge Function `create-user` y el script
   `create-owner`. El frontend usa únicamente la `anon key`.
6. **Registro público desactivado**; solo el dueño crea usuarios. El rol se toma de
   `app_metadata` (solo escribible por `service_role`), nunca de `user_metadata`.
7. **Funciones**: `anon` no ejecuta ninguna; `internal_*` no son ejecutables por la API; toda función
   `SECURITY DEFINER` fija su `search_path` (tests estructurales lo verifican).

## Matriz de permisos implementada

| Capacidad                     |        Dueño        |      Encargado      | Vendedor/Cajero |  Depósito  | Solo lectura |
| ----------------------------- | :-----------------: | :-----------------: | :-------------: | :--------: | :----------: |
| Vender / devolver             |         ✅          |         ✅          | ✅ (sus ventas) |     —      |      —       |
| Anular ventas                 |         ✅          |         ✅          |        —        |     —      |      —       |
| Abrir/cerrar caja             |         ✅          |         ✅          |   ✅ (propia)   |     —      |      —       |
| Retiros de efectivo           |         ✅          |         ✅          |        —        |     —      |      —       |
| Reabrir caja cerrada          |         ✅          |          —          |        —        |     —      |      —       |
| Gastos                        |         ✅          |         ✅          |       ✅        |     —      |      —       |
| Anular gastos                 |         ✅          |         ✅          |        —        |     —      |      —       |
| Productos, variantes, precios |         ✅          |         ✅          |        —        |     —      |      —       |
| Ver costos                    |         ✅          |         ✅          |        —        |     ✅     |      ✅      |
| Ajustes de stock / inventario |         ✅          |         ✅          |        —        |     ✅     |      —       |
| Importar Excel                | ✅ catálogo y stock | ✅ catálogo y stock |        —        | solo stock |      —       |
| Compras (crear, anular)       |         ✅          |         ✅          |        —        |     —      |      —       |
| Recibir mercadería            |         ✅          |         ✅          |        —        |     ✅     |      —       |
| Pagos a proveedores           |         ✅          |         ✅          |        —        |     —      |      —       |
| Ajustes de cuenta corriente   |         ✅          |          —          |        —        |     —      |      —       |
| Reportes y dashboard          |         ✅          |         ✅          |        —        |     —      |      ✅      |
| Usuarios, configuración       |         ✅          | gastos (categorías) |        —        |     —      |      —       |

El descuento de un vendedor/cajero está topeado por `cashier_max_discount_pct` (10% por defecto),
validado en `register_sale`.

## Qué se revisó

- Test estructural: todas las tablas con RLS; `anon` sin privilegios; ninguna tabla con `DELETE`;
  ledgers y documentos sin `INSERT/UPDATE` para la API; `internal_*` no ejecutables; toda función
  definer con `search_path` fijo; `v_variants_all` inaccesible.
- Tests por rol: cada RPC crítica se prueba con un rol permitido y uno denegado.
- Concurrencia: dos ventas simultáneas de la última unidad (una se completa, la otra recibe
  "Stock insuficiente"; el stock queda en 0 y `v_stock_audit` vacío).
- Idempotencia de `register_sale` con `client_request_id` (más un lock por clave).

## Pendientes recomendados para producción

- Activar MFA/CAPTCHA y políticas de contraseña en Supabase Auth.
- Restringir el origen CORS de la Edge Function al dominio real.
- Rotar las claves si alguna vez se compartieron; guardar `service_role` solo en secretos del servidor.
- Backups programados y prueba de restauración.
