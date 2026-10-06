begin;
select plan(37);

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
  ('00000000-0000-0000-0000-0000000000c1', 'stock@t.local', '{"role":"stock_clerk"}'),
  ('00000000-0000-0000-0000-0000000000d1', 'viewer@t.local', '{"role":"viewer"}');

-- 1-6 · validación de códigos
select ok(public.is_valid_gtin('4006381333931'), 'EAN-13 válido');
select ok(not public.is_valid_gtin('4006381333932'), 'EAN-13 con dígito verificador incorrecto');
select ok(public.is_valid_gtin('96385074'), 'EAN-8 válido');
select ok(public.is_valid_gtin('036000291452'), 'UPC-A (12) válido');
select ok(not public.is_valid_gtin('ABC12345'), 'letras no son un EAN');
select is(public.normalize_ean('1234565'), '01234565', 'normalize_ean recupera ceros perdidos por Excel');

-- 7-9 · el catálogo lo gestiona dueño/encargado
select public.t_as('00000000-0000-0000-0000-0000000000a2');
insert into public.products (id, code, name, category_id)
select '10000000-0000-0000-0000-000000000001', ' rem-001 ', 'Remera básica', id
from public.categories where name = 'Remeras';
select is((select code from public.products where id = '10000000-0000-0000-0000-000000000001'),
  'REM-001', 'el código de modelo se normaliza a mayúsculas');

select is(
  (select sku from public.create_variant(
    '10000000-0000-0000-0000-000000000001',
    (select id from public.colors where name = 'Negro'),
    (select id from public.sizes where name = 'M'),
    ' rem-001-neg-m ', '4006381333931', 15000, 6000, 3, 10)),
  'REM-001-NEG-M', 'create_variant normaliza el SKU');

select public.t_reset();
select is(
  (select quantity from public.stock_levels sl join public.product_variants v on v.id = sl.variant_id
   where v.sku = 'REM-001-NEG-M'), 10, 'el stock inicial queda en stock_levels');
select ok(exists (select 1 from public.stock_movements m join public.product_variants v on v.id = m.variant_id
   where v.sku = 'REM-001-NEG-M' and m.movement_type = 'initial_load' and m.quantity = 10
     and m.stock_before = 0 and m.stock_after = 10), 'el stock inicial genera un movimiento initial_load');
select is((select avg_cost from public.variant_costs vc join public.product_variants v on v.id = vc.variant_id
   where v.sku = 'REM-001-NEG-M'), 6000.0000::numeric, 'el costo inicial se guarda en variant_costs');
select ok(exists (select 1 from public.price_history ph join public.product_variants v on v.id = ph.variant_id
   where v.sku = 'REM-001-NEG-M' and ph.old_price is null and ph.new_price = 15000), 'precio inicial en price_history');

-- 14-18 · restricciones
select public.t_as('00000000-0000-0000-0000-0000000000a2');
select throws_ok(
  $$select public.create_variant('10000000-0000-0000-0000-000000000001',
      (select id from public.colors where name = 'Blanco'), (select id from public.sizes where name = 'M'),
      'otro', '4006381333932', 1000, 0, 0, 0)$$,
  '23514', null, 'EAN con dígito verificador inválido rechazado');
select throws_ok(
  $$select public.create_variant('10000000-0000-0000-0000-000000000001',
      (select id from public.colors where name = 'Blanco'), (select id from public.sizes where name = 'M'),
      'rem-001-neg-m', null, 1000, 0, 0, 0)$$,
  '23505', null, 'SKU duplicado (sin distinguir mayúsculas) rechazado');
select throws_ok(
  $$select public.create_variant('10000000-0000-0000-0000-000000000001',
      (select id from public.colors where name = 'Blanco'), (select id from public.sizes where name = 'M'),
      'otro', '04006381333931', 1000, 0, 0, 0)$$,
  '23505', null, 'EAN duplicado ignorando ceros a la izquierda rechazado');
select throws_ok(
  $$select public.create_variant('10000000-0000-0000-0000-000000000001',
      (select id from public.colors where name = 'Negro'), (select id from public.sizes where name = 'M'),
      'otro-sku', null, 1000, 0, 0, 0)$$,
  '23505', null, 'misma combinación modelo + color + talle rechazada');
select throws_ok(
  $$select public.create_variant('10000000-0000-0000-0000-000000000001',
      (select id from public.colors where name = 'Blanco'), (select id from public.sizes where name = 'S'),
      'sku-neg', null, -5, 0, 0, 0)$$,
  '23514', null, 'precio negativo rechazado');

-- 19-20 · historial de precios
select lives_ok(
  $$update public.product_variants set price = 18000 where sku = 'REM-001-NEG-M'$$,
  'el encargado actualiza el precio');
select public.t_reset();
select ok(exists (select 1 from public.price_history ph join public.product_variants v on v.id = ph.variant_id
   where v.sku = 'REM-001-NEG-M' and ph.old_price = 15000 and ph.new_price = 18000),
  'el cambio de precio queda en price_history');

-- 21-23 · el historial es inmutable
select throws_ok($$update public.price_history set new_price = 1$$, '42501', null, 'price_history inmutable (UPDATE)');
select throws_ok($$delete from public.price_history$$, '42501', null, 'price_history inmutable (DELETE)');

-- 24-27 · vendedor: ve variantes y stock, NO costos, no modifica catálogo
select public.t_as('00000000-0000-0000-0000-0000000000b1');
select is((select count(*)::int from public.v_variants where sku = 'REM-001-NEG-M'), 1, 'el cajero ve las variantes');
select is((select count(*)::int from public.variant_costs), 0, 'el cajero NO ve los costos');
select throws_ok(
  $$insert into public.products (code, name) values ('X', 'X')$$,
  '42501', null, 'el cajero no puede crear productos');
select throws_ok(
  $$select public.create_variant('10000000-0000-0000-0000-000000000001',
      (select id from public.colors where name = 'Rojo'), (select id from public.sizes where name = 'M'),
      'x', null, 1, 0, 0, 0)$$,
  '42501', null, 'el cajero no puede crear variantes');

-- 28-29 · depósito: ve costos pero no cambia precios
select public.t_as('00000000-0000-0000-0000-0000000000c1');
select is((select count(*)::int from public.variant_costs), 1, 'el depósito ve los costos');
select lives_ok($$update public.product_variants set price = 1 where sku = 'REM-001-NEG-M'$$, 'update sin filas permitidas no falla');
select public.t_reset();
select is((select price from public.product_variants where sku = 'REM-001-NEG-M'), 18000.00::numeric,
  'pero el depósito no logró cambiar el precio (RLS)');

-- 31-34 · búsqueda por código
select public.t_as('00000000-0000-0000-0000-0000000000b1');
select is((select sku from public.find_variant_by_code('rem-001-neg-m')), 'REM-001-NEG-M', 'find_variant_by_code por SKU (sin mayúsculas)');
select is((select sku from public.find_variant_by_code('4006381333931')), 'REM-001-NEG-M', 'find_variant_by_code por EAN');
select is((select sku from public.find_variant_by_code('04006381333931')), 'REM-001-NEG-M', 'find_variant_by_code por EAN con ceros extra');
select is((select count(*)::int from public.search_variants('remera')), 1, 'search_variants por nombre');

-- 35-36 · anónimo
select public.t_anon();
select throws_ok($$select * from public.products$$, '42501', null, 'anon no lee productos');
select throws_ok($$select * from public.v_variants$$, '42501', null, 'anon no lee v_variants');

-- 37-39 · auditoría y permisos estructurales
select public.t_reset();
select ok(exists (select 1 from public.audit_log where table_name = 'products' and action = 'INSERT'
   and record_id = '10000000-0000-0000-0000-000000000001'), 'el alta de producto queda en audit_log');
select ok(exists (select 1 from public.audit_log where table_name = 'product_variants' and action = 'UPDATE'),
  'el cambio de variante queda en audit_log');
select is((select count(*)::int from public.v_stock_audit), 0, 'el saldo coincide con el ledger');

select * from finish();
rollback;
