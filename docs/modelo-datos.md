# Modelo de datos

Modelo aprobado en la etapa de diseño (ver [arquitectura.md](./arquitectura.md)). Es la referencia
de las migraciones de `supabase/migrations/`: cada tabla se crea en la etapa indicada en el plan
de desarrollo y, si el diseño cambia al implementarla, **este documento se actualiza en el mismo commit**.

## Estado de implementación

Todas las etapas del plan están implementadas en `supabase/migrations/` (orden cronológico):

| Migración                     | Contenido                                                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `20260101000000_foundation`   | `set_updated_at()`, `business_date()`                                                                                                                  |
| `20260102000000_auth_roles`   | `app_role`, `profiles`, `auth_role()`, `has_role()`, RPC de usuarios                                                                                   |
| `20260102000100_audit_log`    | `audit_log` inmutable, `audit_trigger()`                                                                                                               |
| `20260102000200_app_settings` | `app_settings`, `set_app_setting()`                                                                                                                    |
| `20260103000000_catalog`      | categorías, marcas, colores, talles, **proveedores**, productos, variantes, `variant_costs`, `price_history`, `cost_history`, validación GTIN/EAN      |
| `20260104000000_stock`        | `stock_levels`, `stock_movements` (ledger), `adjust_stock`, `create_variant`, `find_variant_by_code`, `search_variants`, `v_variants`, `v_stock_audit` |
| `20260105000000_inventory`    | `inventory_counts`, `inventory_count_items` y su flujo (contar → revisar → aplicar)                                                                    |
| `20260106000000_cash`         | medios de pago, cajas, sesiones, `cash_movements` (ledger), totales de cierre, gastos                                                                  |
| `20260107000000_sales`        | clientes, ventas, ítems (snapshot), costos de venta, pagos, devoluciones, `register_sale`, `void_sale`, `register_return`                              |
| `20260108000000_purchases`    | compras, pagos a proveedores, `supplier_ledger`, `register_supplier_payment`, vistas de saldo y estado de cuenta                                       |
| `20260109000000_import_excel` | staging de importación, validación y aplicación atómica                                                                                                |
| `20260110000000_reports`      | reportes y `dashboard_summary()`                                                                                                                       |
| `20260111000000_hardening`    | `harden_privileges()`: permisos de funciones, vistas y secuencias                                                                                      |

### Diferencias respecto del diseño original

- `suppliers` se crea completa en la migración de catálogo (la necesita `products.supplier_id`).
- Se agregaron `cost_history` (el historial de costos no puede ir en `price_history`: los vendedores
  no deben ver costos) y las vistas `v_variants`, `v_stock_audit`, `v_cash_sessions`,
  `v_cash_method_totals`, `v_supplier_balances` y `v_supplier_statement` (todas `security_invoker`).
- `v_variants_all` (con costos, sin RLS) existe solo para las funciones de reportes y no es accesible
  desde la API.
- Funciones `internal_*`: uso interno entre RPC (mover stock, movimientos de caja, asientos de
  proveedor). No son ejecutables por la API.
- Los estados (`status`) de ventas, compras, cajas, inventarios e importaciones son `text` con `CHECK`
  (no enums), salvo los tipos de movimiento (`stock_movement_type`, `cash_movement_kind`,
  `supplier_ledger_type`) y `app_role`.
- El EAN es único ignorando ceros a la izquierda (UPC-A 12 dígitos == EAN-13 con un 0 delante).
- `sale_items.discount_amount` incluye el prorrateo del descuento general; así `line_total` suma
  exactamente `sales.total` y las devoluciones reintegran lo efectivamente pagado.
- Criterios de reportes: las ventas cuentan en el día de la venta, las devoluciones en el día de la
  devolución, las ventas anuladas no cuentan. Costo = promedio ponderado vigente al vender.
- `cash_count_details` (conteo por denominación) quedó fuera de esta versión.

## Tablas por etapa (referencia del diseño)

| Etapa                | Tablas                                                                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Auth y roles      | `profiles`, `app_settings`, `audit_log`                                                                                                  |
| 2. Catálogo          | `categories`, `brands`, `colors`, `sizes`, `products`, `product_variants`, `variant_costs`, `price_history`, `cost_history`, `suppliers` |
| 3. Stock             | `stock_levels`, `stock_movements`                                                                                                        |
| 4. Excel             | `import_batches`, `import_batch_rows`                                                                                                    |
| 5. Inventario físico | `inventory_counts`, `inventory_count_items`                                                                                              |
| 6. Caja              | `payment_methods`, `cash_registers`, `cash_sessions`, `cash_movements`, `cash_session_totals`, `expense_categories`, `expenses`          |
| 7. Ventas            | `customers`, `sales`, `sale_items`, `sale_item_costs`, `sale_payments`, `sale_returns`, `sale_return_items`                              |
| 8. Compras           | `purchases`, `purchase_items`, `supplier_payments`, `supplier_payment_allocations`, `supplier_ledger`                                    |

## Convenciones

**Convenciones:** claves `uuid` (los documentos tienen además un número secuencial legible); dinero `numeric(14,2)`; stock `integer`; fechas `timestamptz`; todas las tablas con `created_at` y `created_by` (y `updated_at/by` si son editables); borrado lógico en maestros.

### 1 Seguridad y configuración

| Tabla          | Campos clave                                                                                                                        |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`     | `id` (= `auth.users.id`), `email` (copia sincronizada), `full_name`, `role` (enum `app_role`), `active`, `created_at`, `updated_at` |
| `app_settings` | `key` PK, `value` jsonb (ej. `allow_negative_stock=false`, `store_name`, `sale_number_prefix`)                                      |
| `audit_log`    | `id`, `table_name`, `record_id`, `action`, `old_data`, `new_data`, `user_id`, `at`                                                  |

### 2 Catálogo

| Tabla               | Campos clave                                                                                                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `categories`        | `id`, `name`, `parent_id`, `active`                                                                                                                                           |
| `brands`            | `id`, `name`, `active`                                                                                                                                                        |
| `colors`            | `id`, `name` (único), `hex`                                                                                                                                                   |
| `sizes`             | `id`, `name` (S, M, 38...), `size_group`, `sort_order`                                                                                                                        |
| `products` (modelo) | `id`, `code` (único), `name`, `description`, `category_id`, `brand_id`, `supplier_id`, `active`                                                                               |
| `product_variants`  | `id`, `product_id`, `color_id`, `size_id`, **`sku`** (único), **`ean`** (texto, único si no es nulo), `price`, `min_stock`, `active`. `UNIQUE(product_id, color_id, size_id)` |
| `variant_costs`     | `variant_id` PK, `last_cost`, `avg_cost`, `updated_at`                                                                                                                        |
| `price_history`     | `id`, `variant_id`, `old_price`, `new_price`, `old_cost`, `new_cost`, `changed_by`, `changed_at`                                                                              |

**El costo va en una tabla aparte** porque RLS filtra filas, no columnas, y en Supabase todos los usuarios comparten el rol `authenticated`. En `variant_costs` una política RLS lo restringe a dueño, encargado y depósito.

### 3 Stock e inventario

| Tabla                      | Campos clave                                                                                                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stock_levels`             | `variant_id` PK, `quantity`, `updated_at`. Solo la modifica el trigger de `stock_movements`                                                                                              |
| `stock_movements` (ledger) | `id`, `variant_id`, `movement_type`, `quantity` (con signo), `stock_before`, `stock_after`, `unit_cost`, `reason`, `reference_type`, `reference_id`, `notes`, `created_by`, `created_at` |
| `inventory_counts`         | `id`, `number`, `status` (draft, counting, review, applied, cancelled), `scope`, `started_at`, `applied_at`, `created_by`, `applied_by`, `notes`                                         |
| `inventory_count_items`    | `id`, `count_id`, `variant_id`, `expected_qty`, `counted_qty`, `counted_at`, `counted_by`, `difference`, `notes`. `UNIQUE(count_id, variant_id)`                                         |

`movement_type`: `purchase_in`, `sale_out`, `sale_return_in`, `sale_void_in`, `purchase_return_out`, `adjustment_in`, `adjustment_out`, `inventory_adjustment`, `import_adjustment`, `initial_load`, `damage_out`, `theft_out`, `internal_use_out`.

### 4 Ventas

| Tabla                                | Campos clave                                                                                                                                                                                                                      |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `customers` (opcional)               | `id`, `name`, `phone`, `email`, `document`, `notes`                                                                                                                                                                               |
| `sales`                              | `id`, `number`, `cash_session_id`, `customer_id`, `status` (completed, voided), `subtotal`, `discount_amount`, `total`, `notes`, `client_request_id` (único), `created_by`, `created_at`, `voided_by`, `voided_at`, `void_reason` |
| `sale_items`                         | `id`, `sale_id`, `variant_id`, `quantity`, `unit_price`, `discount_amount`, `line_total`, snapshot: `product_name`, `sku`, `ean`, `color`, `size`                                                                                 |
| `sale_item_costs`                    | `sale_item_id` PK, `unit_cost` (restringido por RLS)                                                                                                                                                                              |
| `sale_payments`                      | `id`, `sale_id`, `payment_method_id`, `amount`, `amount_tendered`, `change_given`, `installments`, `reference`                                                                                                                    |
| `sale_returns` / `sale_return_items` | `sale_id`, ítems devueltos, `refund_method_id`, `refund_amount`, `reason`, `restock`                                                                                                                                              |

### 5 Caja y gastos

| Tabla                           | Campos clave                                                                                                                                                                                                                                    |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `payment_methods`               | `id`, `code` (cash, transfer, debit, credit, mercadopago, other), `name`, **`is_cash`**, `active`, `sort_order`, `is_system`                                                                                                                    |
| `cash_registers`                | `id`, `name`, `active`                                                                                                                                                                                                                          |
| `cash_sessions`                 | `id`, `register_id`, `status` (open, closed), `opened_by`, `opened_at`, `opening_amount`, `closed_by`, `closed_at`, `expected_cash`, `counted_cash`, `cash_difference`, `closing_notes`. Índice único parcial: una sola sesión abierta por caja |
| `cash_movements` (ledger)       | `id`, `cash_session_id`, `payment_method_id`, `kind`, `direction` (in/out), `amount` (> 0), `affects_physical_cash`, `description`, `reference_type`, `reference_id`, `created_by`, `created_at`                                                |
| `cash_session_totals`           | `session_id`, `payment_method_id`, `expected`, `reported`                                                                                                                                                                                       |
| `cash_count_details` (opcional) | `session_id`, `denomination`, `quantity`                                                                                                                                                                                                        |
| `expense_categories`            | `id`, `name`                                                                                                                                                                                                                                    |
| `expenses`                      | `id`, `date`, `category_id`, `description`, `amount`, `payment_method_id`, `paid_from_register`, `cash_session_id`, `supplier_id`, `receipt_ref`, `created_by`, `voided_at`                                                                     |

`cash_movements.kind`: `opening_float`, `sale`, `sale_void`, `sale_refund`, `income`, `expense`, `withdrawal`, `supplier_payment`, `adjustment`.

### 6 Proveedores y compras

| Tabla                          | Campos clave                                                                                                                                                                                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `suppliers`                    | `id`, `name`, `tax_id`, `contact`, `phone`, `email`, `address`, `payment_terms_days`, `notes`, `active`                                                                                                                                                                   |
| `purchases`                    | `id`, `number`, `supplier_id`, `invoice_number`, `purchase_date`, `due_date`, `status` (draft, received, cancelled), `subtotal`, `discount_amount`, `tax_amount`, `total`, `paid_amount`, `payment_status` (pending, partial, paid), `received_at`, `notes`, `created_by` |
| `purchase_items`               | `id`, `purchase_id`, `variant_id`, `quantity`, `unit_cost`, `line_total`                                                                                                                                                                                                  |
| `supplier_payments`            | `id`, `supplier_id`, `payment_method_id`, `amount`, `paid_at`, `cash_session_id`, `reference`, `notes`, `created_by`                                                                                                                                                      |
| `supplier_payment_allocations` | `payment_id`, `purchase_id`, `amount`                                                                                                                                                                                                                                     |
| `supplier_ledger` (ledger)     | `id`, `supplier_id`, `entry_type` (purchase, payment, credit_note, adjustment, opening_balance), `amount` (con signo), `reference_type`, `reference_id`, `entry_date`, `notes`, `created_by`                                                                              |

### 7 Importación Excel

| Tabla               | Campos clave                                                                                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `import_batches`    | `id`, `kind` (catalog, stock), `mode`, `file_name`, `status` (uploaded, validated, applied, failed), `total_rows`, `ok_rows`, `warning_rows`, `error_rows`, `created_by`, `applied_at`, `summary` |
| `import_batch_rows` | `id`, `batch_id`, `row_number`, `raw`, `parsed`, `status` (ok, warning, error), `errors`, `action` (create, update, skip), `variant_id`                                                           |

### 8 Relaciones principales

```
categories, brands, suppliers --< products --< product_variants >-- colors, sizes
product_variants -- variant_costs (1:1)
product_variants -- stock_levels (1:1) <-- trigger -- stock_movements
product_variants --< sale_items >-- sales >-- cash_sessions >-- cash_registers
product_variants --< purchase_items >-- purchases >-- suppliers
product_variants --< inventory_count_items >-- inventory_counts
sales --< sale_payments >-- payment_methods --< cash_movements >-- cash_sessions
expenses / supplier_payments (si salen de caja) --> cash_movements
purchases / supplier_payments --> supplier_ledger
```
