-- Auditoría de seguridad e integridad (SOLO LECTURA).
--
-- Cómo usarla en el proyecto Supabase real:
--   Dashboard → SQL Editor → pegar este archivo → Run.
--   o:  npx supabase db query --linked -f supabase/checks/audit.sql   (si tu CLI lo soporta)
--
-- RESULTADO ESPERADO: 0 filas. Cada fila es un problema: la columna `problema` dice qué y `objeto` dónde.

-- 1) Toda tabla de public debe tener RLS
select 'tabla sin RLS' as problema, c.relname::text as objeto
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity

union all
-- 2) anon no debe tener ningún privilegio sobre tablas ni vistas
select 'anon con privilegios sobre tabla/vista', c.relname::text
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
  and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('anon', c.oid, 'insert')
       or has_table_privilege('anon', c.oid, 'update') or has_table_privilege('anon', c.oid, 'delete'))

union all
-- 3) La API nunca borra datos
select 'authenticated puede DELETE', c.relname::text
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p') and has_table_privilege('authenticated', c.oid, 'delete')

union all
-- 4) Ledgers y documentos: solo se escriben por RPC (la API no tiene INSERT/UPDATE)
select 'authenticated puede escribir una tabla transaccional', c.relname::text
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('stock_movements', 'stock_levels', 'cash_movements', 'cash_session_totals', 'cash_sessions',
    'supplier_ledger', 'supplier_payments', 'supplier_payment_allocations', 'purchases', 'purchase_items',
    'sales', 'sale_items', 'sale_item_costs', 'sale_payments', 'sale_returns', 'sale_return_items', 'expenses',
    'audit_log', 'profiles', 'app_settings', 'variant_costs', 'price_history', 'cost_history',
    'inventory_counts', 'inventory_count_items', 'import_batches', 'import_batch_rows')
  and (has_table_privilege('authenticated', c.oid, 'insert') or has_table_privilege('authenticated', c.oid, 'update'))

union all
-- 5) Ningún ledger sin su trigger de inmutabilidad
select 'ledger sin trigger de inmutabilidad', t.table_name
from (values ('stock_movements'), ('cash_movements'), ('supplier_ledger'), ('audit_log'),
             ('price_history'), ('cost_history')) as t(table_name)
where not exists (
  select 1 from pg_trigger g join pg_class c on c.oid = g.tgrelid join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = t.table_name and not g.tgisinternal
    and (g.tgname like '%no_update_delete' or g.tgname like '%immutable'))

union all
-- 6) anon no ejecuta ninguna función de public
select 'anon ejecuta función', p.oid::regprocedure::text
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f' and has_function_privilege('anon', p.oid, 'execute')

union all
-- 7) Las funciones internas no son ejecutables por la API
select 'authenticated ejecuta función interna', p.oid::regprocedure::text
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f'
  and (p.proname like 'internal\_%' or p.proname in ('secure_table', 'harden_privileges'))
  and has_function_privilege('authenticated', p.oid, 'execute')

union all
-- 8) Toda función SECURITY DEFINER fija su search_path
select 'SECURITY DEFINER sin search_path', p.oid::regprocedure::text
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
  and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')

union all
-- 9) Las vistas respetan RLS (security_invoker), salvo la de reportes (inaccesible desde la API)
select 'vista sin security_invoker', c.relname::text
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'v' and c.relname <> 'v_variants_all'
  and not coalesce(c.reloptions @> array['security_invoker=true'], false)

union all
select 'vista con costos accesible desde la API', 'v_variants_all'
where has_table_privilege('authenticated', 'public.v_variants_all', 'select')
   or has_table_privilege('anon', 'public.v_variants_all', 'select')

union all
-- 10) Las secuencias no son accesibles desde la API
select 'secuencia accesible desde la API', c.relname::text
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'S'
  and (has_sequence_privilege('authenticated', c.oid, 'usage') or has_sequence_privilege('anon', c.oid, 'usage'))

union all
-- 11) Configuración mínima de negocio
select 'no hay un dueño activo', 'profiles'
where not exists (select 1 from public.profiles where role = 'owner' and active)

union all
select 'usuario de auth sin perfil', u.email
from auth.users u where not exists (select 1 from public.profiles p where p.id = u.id)

union all
select 'el medio de pago efectivo no está marcado como efectivo', 'payment_methods'
where not exists (select 1 from public.payment_methods where code = 'cash' and is_cash)

union all
select 'un medio de pago electrónico está marcado como efectivo', code
from public.payment_methods where code in ('transfer', 'debit', 'credit', 'mercadopago') and is_cash

union all
-- 12) Integridad del stock: el saldo debe coincidir con la suma del ledger
select 'stock no coincide con el ledger', variant_id::text from public.v_stock_audit;
