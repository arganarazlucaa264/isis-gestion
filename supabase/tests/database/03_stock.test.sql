begin;
select plan(24);

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

-- 1-4 · ajustes manuales por el depósito
select public.t_as('00000000-0000-0000-0000-0000000000c1');
select is((select stock_after from public.adjust_stock(
  (select id from public.product_variants where sku = 'P1-NEG-S'), 'adjustment_in', 5, 'Reposición', null)),
  15, 'adjustment_in suma stock y registra stock_after');
select is((select stock_before from public.stock_movements
  where movement_type = 'adjustment_in' order by id desc limit 1), 10, 'el movimiento guarda stock_before');
select is((select quantity from public.stock_movements
  where movement_type = 'adjustment_in' order by id desc limit 1), 5, 'las entradas tienen signo positivo');
select is((select quantity from public.adjust_stock(
  (select id from public.product_variants where sku = 'P1-NEG-S'), 'damage_out', 2, 'Rotura', 'Se rompió')),
  -2, 'una rotura registra cantidad negativa');

-- 5-8 · validaciones
select throws_ok($$select public.adjust_stock((select id from public.product_variants where sku = 'P1-NEG-S'), 'adjustment_out', 100, 'x', null)$$,
  '23514', null, 'no permite stock negativo por defecto');
select throws_ok($$select public.adjust_stock((select id from public.product_variants where sku = 'P1-NEG-S'), 'adjustment_in', 1, '  ', null)$$,
  '22023', null, 'el motivo es obligatorio');
select throws_ok($$select public.adjust_stock((select id from public.product_variants where sku = 'P1-NEG-S'), 'adjustment_in', 0, 'x', null)$$,
  '22023', null, 'la cantidad debe ser positiva');
select throws_ok($$select public.adjust_stock((select id from public.product_variants where sku = 'P1-NEG-S'), 'sale_out', 1, 'x', null)$$,
  '22023', null, 'un ajuste manual no puede usar tipos de venta');

-- 9 · carga inicial solo sin movimientos previos
select throws_ok($$select public.adjust_stock((select id from public.product_variants where sku = 'P1-NEG-S'), 'initial_load', 1, 'x', null)$$,
  '23514', null, 'initial_load rechazada en variante con movimientos');

-- 10-11 · permisos
select public.t_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok($$select public.adjust_stock((select id from public.product_variants where sku = 'P1-NEG-S'), 'adjustment_in', 1, 'x', null)$$,
  '42501', null, 'el cajero no puede ajustar stock');
select is((select count(*)::int from public.stock_movements), 0, 'el cajero no ve el ledger de movimientos');
select ok((select count(*) from public.stock_levels) >= 3, 'pero sí ve el stock disponible');

-- 13-15 · la API no escribe stock directamente
select throws_ok($$insert into public.stock_movements (variant_id, movement_type, quantity) values ((select id from public.product_variants limit 1), 'adjustment_in', 1)$$,
  '42501', null, 'INSERT directo en stock_movements denegado');
select throws_ok($$update public.stock_levels set quantity = 999$$, '42501', null, 'UPDATE directo en stock_levels denegado');
select public.t_as('00000000-0000-0000-0000-0000000000a1');
select throws_ok($$delete from public.stock_movements$$, '42501', null, 'ni el dueño borra movimientos');

-- 16-19 · inmutabilidad incluso para el superusuario
select public.t_reset();
select throws_ok($$update public.stock_movements set quantity = 99$$, '42501', null, 'stock_movements: UPDATE bloqueado por trigger');
select throws_ok($$delete from public.stock_movements$$, '42501', null, 'stock_movements: DELETE bloqueado por trigger');
select throws_ok($$truncate public.stock_movements$$, '42501', null, 'stock_movements: TRUNCATE bloqueado por trigger');
select throws_ok($$insert into public.stock_movements (variant_id, movement_type, quantity)
  values ((select id from public.product_variants where sku = 'P1-NEG-S'), 'adjustment_in', -1)$$,
  '23514', null, 'el signo debe corresponder al tipo de movimiento');

-- 20-21 · stock negativo solo con configuración explícita
select public.t_as('00000000-0000-0000-0000-0000000000a1');
select public.set_app_setting('allow_negative_stock', 'true');
select is((select stock_after from public.adjust_stock(
  (select id from public.product_variants where sku = 'P1-BEI-M'), 'adjustment_out', 15, 'Prueba', null)),
  -5, 'con allow_negative_stock=true se permite quedar negativo');
select public.set_app_setting('allow_negative_stock', 'false');
select throws_ok($$select public.adjust_stock((select id from public.product_variants where sku = 'P1-BEI-M'), 'adjustment_out', 1, 'x', null)$$,
  '23514', null, 'al desactivarlo vuelve a bloquear');

-- 22-24 · auditoría del stock: saldo == suma del ledger
select public.t_reset();
select is((select count(*)::int from public.v_stock_audit), 0, 'v_stock_audit vacío: saldos == ledger');
update public.stock_levels set quantity = quantity + 1 where variant_id = (select id from public.product_variants where sku = 'P1-NEG-M');
select is((select difference from public.v_stock_audit), 1, 'v_stock_audit detecta una manipulación del saldo');
update public.stock_levels set quantity = quantity - 1 where variant_id = (select id from public.product_variants where sku = 'P1-NEG-M');
select is((select count(*)::int from public.v_stock_audit), 0, 'al revertir, vuelve a coincidir');

select * from finish();
rollback;
