begin;
select plan(34);

create function public.t_as(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function public.t_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end $$;
create function public.t_reset() returns void language plpgsql as $$
begin
  perform set_config('role', session_user, true);
end $$;

insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@t.local', '{"role":"owner"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'manager@t.local', '{"role":"manager"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'cashier@t.local', '{"role":"cashier"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'cashier2@t.local', '{"role":"cashier"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'stock@t.local', '{"role":"stock_clerk"}'),
  ('00000000-0000-0000-0000-0000000000d1', 'viewer@t.local', '{"role":"viewer"}');

-- Catálogo base: 1 modelo, 3 variantes con stock 10 y costo 100 / precio 1000
insert into public.products (id, code, name) values ('10000000-0000-0000-0000-000000000001', 'P1', 'Remera');
insert into public.suppliers (id, name, payment_terms_days) values ('20000000-0000-0000-0000-000000000001', 'Proveedor Uno', 30);
select public.t_as('00000000-0000-0000-0000-0000000000a1');
select public.create_variant('10000000-0000-0000-0000-000000000001', (select id from public.colors where name = 'Negro'), (select id from public.sizes where name = 'S'), 'P1-NEG-S', '4006381333931', 1000, 100, 2, 10);
select public.create_variant('10000000-0000-0000-0000-000000000001', (select id from public.colors where name = 'Negro'), (select id from public.sizes where name = 'M'), 'P1-NEG-M', null, 1000, 100, 2, 10);
select public.create_variant('10000000-0000-0000-0000-000000000001', (select id from public.colors where name = 'Beige'), (select id from public.sizes where name = 'M'), 'P1-BEI-M', null, 2000, 200, 0, 10);
select public.t_reset();

-- Datos: caja abierta, dos ventas, una devolución con reposición y un gasto fuera de caja
select public.t_as('00000000-0000-0000-0000-0000000000b1');
select public.open_cash_session((select id from public.cash_registers limit 1), 100, null);
select public.register_sale(
  format('[{"variant_id":"%s","quantity":2}]', (select id from public.product_variants where sku = 'P1-NEG-S'))::jsonb,
  format('[{"payment_method_id":"%s","amount":2000}]', (select id from public.payment_methods where code = 'cash'))::jsonb,
  gen_random_uuid());
select public.register_sale(
  format('[{"variant_id":"%s","quantity":1}]', (select id from public.product_variants where sku = 'P1-BEI-M'))::jsonb,
  format('[{"payment_method_id":"%s","amount":2000}]', (select id from public.payment_methods where code = 'transfer'))::jsonb,
  gen_random_uuid());
select public.register_return(
  (select id from public.sales order by number limit 1),
  format('[{"sale_item_id":"%s","quantity":1}]', (select i.id from public.sale_items i where i.sale_id = (select id from public.sales order by number limit 1) limit 1))::jsonb,
  (select id from public.payment_methods where code = 'cash'), 'Cambio de opinión', true);

select public.t_as('00000000-0000-0000-0000-0000000000a1');
select public.register_expense(null, (select id from public.expense_categories where name = 'Alquiler'), 'Alquiler del mes', 500,
  (select id from public.payment_methods where code = 'transfer'), false);
select public.adjust_stock((select id from public.product_variants where sku = 'P1-NEG-M'), 'adjustment_out', 8, 'Merma', null);

-- Reportes
select is((select tickets from public.report_sales_by_day(public.business_date(), public.business_date())), 2::bigint, 'ventas por día: 2 tickets');
select is((select sales_amount from public.report_sales_by_day(public.business_date(), public.business_date())), 4000.00::numeric, 'ventas brutas del día');
select is((select returns_amount from public.report_sales_by_day(public.business_date(), public.business_date())), 1000.00::numeric, 'devoluciones del día');
select is((select net_amount from public.report_sales_by_day(public.business_date(), public.business_date())), 3000.00::numeric, 'ventas netas = ventas - devoluciones');
select is((select cogs from public.report_sales_by_day(public.business_date(), public.business_date())), 300.00::numeric, 'costo de lo vendido (la devolución repuesta lo revierte)');
select is((select margin from public.report_sales_by_day(public.business_date(), public.business_date())), 2700.00::numeric, 'margen bruto');
select is((select count(*)::int from public.report_sales_by_day(public.business_date() - 2, public.business_date())), 3, 'incluye los días sin ventas');
select is((select units from public.report_sales_by_product(public.business_date(), public.business_date()) where sku = 'P1-NEG-S'), 1::bigint, 'ventas por producto: unidades netas');
select is((select net_amount from public.report_sales_by_category(public.business_date(), public.business_date())), 3000.00::numeric, 'ventas por categoría');
select is((select net from public.report_sales_by_payment_method(public.business_date(), public.business_date()) where code = 'cash'), 1000.00::numeric, 'por medio de pago: efectivo neto (cobrado - reintegrado)');
select is((select net from public.report_sales_by_payment_method(public.business_date(), public.business_date()) where code = 'transfer'), 2000.00::numeric, 'por medio de pago: transferencia');
select is((select estimated_result from public.report_profit(public.business_date(), public.business_date())), 2200.00::numeric, 'resultado estimado = margen (2700) - gastos (500)');
select is((select total from public.report_expenses_by_category(public.business_date(), public.business_date()) where category_name = 'Alquiler'), 500.00::numeric, 'gastos por categoría');
select is((select stock_status from public.report_stock() where sku = 'P1-NEG-M'), 'low', 'stock bajo (stock <= mínimo)');
select is((select stock_status from public.report_stock() where sku = 'P1-BEI-M'), 'ok', 'stock normal');
select is((select value_cost from public.report_stock() where sku = 'P1-BEI-M'), 9 * 200.00::numeric, 'valorización del stock a costo');
select is((select (public.dashboard_summary() -> 'today' ->> 'sales')::numeric), 3000.00::numeric, 'dashboard: ventas del día');
select is((select (public.dashboard_summary() -> 'stock' ->> 'low_stock')::int), 1, 'dashboard: stock bajo');
select is((select jsonb_array_length(public.dashboard_summary() -> 'series')), 14, 'dashboard: serie de 14 días');

-- Los reportes (con costos) no son para vendedores ni depósito
select public.t_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok($$select * from public.report_profit(public.business_date(), public.business_date())$$, '42501', null, 'el cajero no accede a reportes');
select throws_ok($$select public.dashboard_summary()$$, '42501', null, 'ni al dashboard');
select public.t_as('00000000-0000-0000-0000-0000000000c1');
select throws_ok($$select * from public.report_stock()$$, '42501', null, 'el depósito tampoco');
select public.t_as('00000000-0000-0000-0000-0000000000d1');
select lives_ok($$select * from public.report_stock()$$, 'el rol solo lectura sí ve reportes');
select throws_ok($$select public.adjust_stock((select id from public.product_variants limit 1), 'adjustment_in', 1, 'x', null)$$, '42501', null, 'pero no escribe nada');

-- Revisión estructural de seguridad (como superusuario)
select public.t_reset();
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity), 0, 'TODAS las tablas de public tienen RLS activado');
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'v') and
        (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('anon', c.oid, 'insert')
         or has_table_privilege('anon', c.oid, 'update') or has_table_privilege('anon', c.oid, 'delete'))), 0,
  'anon no tiene ningún privilegio sobre tablas ni vistas');
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and has_table_privilege('authenticated', c.oid, 'delete')), 0,
  'ninguna tabla permite DELETE desde la API');
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname in ('stock_movements', 'stock_levels', 'cash_movements', 'cash_session_totals',
    'cash_sessions', 'supplier_ledger', 'supplier_payments', 'supplier_payment_allocations', 'purchases', 'purchase_items',
    'sales', 'sale_items', 'sale_item_costs', 'sale_payments', 'sale_returns', 'sale_return_items', 'expenses',
    'audit_log', 'profiles', 'app_settings', 'variant_costs', 'price_history', 'cost_history',
    'inventory_counts', 'inventory_count_items', 'import_batches', 'import_batch_rows')
    and (has_table_privilege('authenticated', c.oid, 'insert') or has_table_privilege('authenticated', c.oid, 'update'))), 0,
  'ledgers y documentos no se escriben desde la API (solo RPC)');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f' and p.proname not like 't\_%' and has_function_privilege('anon', p.oid, 'execute')), 0,
  'anon no ejecuta ninguna función de public');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f' and p.proname like 'internal\_%' and has_function_privilege('authenticated', p.oid, 'execute')), 0,
  'las funciones internas no son ejecutables desde la API');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')), 0,
  'toda función SECURITY DEFINER fija su search_path');
select ok(not has_table_privilege('authenticated', 'public.v_variants_all', 'select'), 'la vista con costos (v_variants_all) no es accesible desde la API');
select ok(has_function_privilege('authenticated', 'public.register_sale(jsonb, jsonb, uuid, uuid, numeric, text, uuid)', 'execute'), 'los usuarios autenticados sí ejecutan las RPC de negocio');
select is((select count(*)::int from public.v_stock_audit), 0, 'integridad final: el stock coincide con el ledger');

select * from finish();
rollback;
