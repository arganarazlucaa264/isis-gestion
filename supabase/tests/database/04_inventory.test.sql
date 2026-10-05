begin;
select plan(22);

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

-- Creación y conteo
select public.t_as('00000000-0000-0000-0000-0000000000c1');
select is((select status from public.create_inventory_count('Inventario general', 'all')), 'counting', 'se crea un inventario en conteo');
select is((select count(*)::int from public.inventory_count_items), 3, 'incluye todas las variantes activas con su foto de stock');
select is((select expected_qty from public.inventory_count_items i join public.product_variants v on v.id = i.variant_id where v.sku = 'P1-NEG-S'), 10, 'expected_qty es la foto del sistema');

select is((select counted_qty from public.record_inventory_count(
  (select id from public.inventory_counts limit 1), (select id from public.product_variants where sku = 'P1-NEG-S'), 8, 'set', null)),
  8, 'se carga el conteo (set)');
select is((select counted_qty from public.record_inventory_count(
  (select id from public.inventory_counts limit 1), (select id from public.product_variants where sku = 'P1-NEG-S'), 1, 'add', null)),
  9, 'el modo add suma (conteo por escaneo +1)');
select throws_ok($$select public.record_inventory_count((select id from public.inventory_counts limit 1), (select id from public.product_variants where sku = 'P1-NEG-S'), -1, 'set', null)$$,
  '22023', null, 'no admite cantidades negativas');

-- carga masiva por EAN / SKU
select is((select (public.record_inventory_counts_bulk((select id from public.inventory_counts limit 1),
  '[{"ean":"4006381333931","counted_qty":"8"},{"sku":"p1-neg-m","counted_qty":"12"},{"sku":"NO-EXISTE","counted_qty":"1"},{"sku":"P1-BEI-M","counted_qty":"x"}]'::jsonb)) ->> 'updated')::int,
  2, 'carga masiva: actualiza por EAN y por SKU');
select is((select jsonb_array_length(public.record_inventory_counts_bulk((select id from public.inventory_counts limit 1),
  '[{"sku":"NO-EXISTE","counted_qty":"1"}]'::jsonb) -> 'not_found')), 1, 'carga masiva: informa códigos no encontrados');

-- el flujo exige el orden correcto
select throws_ok($$select public.apply_inventory_count((select id from public.inventory_counts limit 1))$$,
  '23514', null, 'no se puede aplicar un inventario que sigue en conteo');
select is((select status from public.submit_inventory_review((select id from public.inventory_counts limit 1))), 'review', 'pasa a revisión');
select throws_ok($$select public.record_inventory_count((select id from public.inventory_counts limit 1), (select id from public.product_variants where sku = 'P1-NEG-S'), 1, 'set', null)$$,
  '23514', null, 'en revisión ya no se puede contar');

-- Simula una venta durante el conteo: el conteo de P1-NEG-M (12) se hizo "hace una hora";
-- antes de eso el sistema tenía 10 y después se descontó 1 unidad (venta).
select public.t_reset();
alter table public.stock_movements disable trigger stock_movements_no_update_delete;
update public.stock_movements set created_at = now() - interval '2 hours';
alter table public.stock_movements enable trigger stock_movements_no_update_delete;
update public.inventory_count_items set counted_at = now() - interval '1 hour';
select public.internal_post_stock_movement((select id from public.product_variants where sku = 'P1-NEG-M'), 'sale_out', -1, 100, 'venta durante el conteo', 'sale', null, null);

select public.t_as('00000000-0000-0000-0000-0000000000c1');
select is((select status from public.apply_inventory_count((select id from public.inventory_counts limit 1))), 'applied', 'se aplica el inventario');
select public.t_reset();
-- P1-NEG-S: contado 8 vs sistema al contar 10 => -2 (stock 10 -> 8)
select is((select quantity from public.stock_levels where variant_id = (select id from public.product_variants where sku = 'P1-NEG-S')), 8,
  'diferencia negativa descontada del stock');
-- P1-NEG-M: contado 12 vs sistema al contar 10 => +2; hubo una venta de 1 => 10 + (-1) + 2 = 11
select is((select quantity from public.stock_levels where variant_id = (select id from public.product_variants where sku = 'P1-NEG-M')), 11,
  'las ventas hechas durante el conteo no se cuentan como faltante');
select is((select difference from public.inventory_count_items i join public.product_variants v on v.id = i.variant_id where v.sku = 'P1-NEG-M'), 2,
  'se guarda la diferencia calculada');
select is((select system_qty_at_count from public.inventory_count_items i join public.product_variants v on v.id = i.variant_id where v.sku = 'P1-NEG-M'), 10,
  'se guarda el stock del sistema al momento de contar');
select is((select quantity from public.stock_levels where variant_id = (select id from public.product_variants where sku = 'P1-BEI-M')), 10,
  'lo no contado no se modifica');
select ok(exists (select 1 from public.stock_movements where movement_type = 'inventory_adjustment' and reference_type = 'inventory_count'),
  'los ajustes generan movimientos inventory_adjustment con referencia al inventario');
select is((select count(*)::int from public.v_stock_audit), 0, 'el saldo sigue coincidiendo con el ledger');

-- permisos y cancelación
select public.t_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok($$select public.create_inventory_count('x', 'all')$$, '42501', null, 'el cajero no crea inventarios');
select is((select count(*)::int from public.inventory_counts), 0, 'el cajero no ve inventarios');
select public.t_as('00000000-0000-0000-0000-0000000000a2');
select throws_ok($$select public.cancel_inventory_count((select id from public.inventory_counts limit 1), 'x')$$, '23514', null, 'un inventario aplicado no se cancela');

select * from finish();
rollback;
