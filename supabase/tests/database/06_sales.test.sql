begin;
select plan(45);

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

-- Caja abierta por el cajero (100 de dinero inicial)
select public.t_as('00000000-0000-0000-0000-0000000000b1');
select public.open_cash_session((select id from public.cash_registers limit 1), 100, null);

-- Sin caja abierta no se vende (otro cajero)
select public.t_as('00000000-0000-0000-0000-0000000000b2');
select throws_ok(
  format($$select public.register_sale('[{"variant_id":"%s","quantity":1}]'::jsonb, '[{"payment_method_id":"%s","amount":1000}]'::jsonb, gen_random_uuid())$$,
    (select id from public.product_variants where sku = 'P1-NEG-S'), (select id from public.payment_methods where code = 'cash')),
  '23514', null, 'sin caja abierta no se puede vender');

select public.t_as('00000000-0000-0000-0000-0000000000b1');

-- Venta 1: 2 unidades en efectivo con billete de 5000 (vuelto 3000). El cliente-precio se ignora.
select is((select total from public.register_sale(
  format('[{"variant_id":"%s","quantity":2,"unit_price":1}]', (select id from public.product_variants where sku = 'P1-NEG-S'))::jsonb,
  format('[{"payment_method_id":"%s","amount":2000,"amount_tendered":5000}]', (select id from public.payment_methods where code = 'cash'))::jsonb,
  '30000000-0000-0000-0000-000000000001')), 2000.00::numeric, 'venta en efectivo: el precio lo fija el servidor');
select is((select quantity from public.stock_levels where variant_id = (select id from public.product_variants where sku = 'P1-NEG-S')), 8, 'la venta descuenta stock');
select public.t_reset();
select is((select count(*)::int from public.stock_movements where movement_type = 'sale_out' and reference_type = 'sale'), 1, 'la venta genera un movimiento sale_out');
select is((select change_given from public.sale_payments), 3000.00::numeric, 'se registra el vuelto');
select is((select expected_cash_live from public.v_cash_sessions), 2100.00::numeric, 'a la caja entra solo el neto cobrado (100 inicial + 2000), no el billete');
select is((select product_name || '|' || sku || '|' || color_name || '|' || size_name from public.sale_items), 'Remera|P1-NEG-S|Negro|S', 'el ítem guarda un snapshot del producto');
select is((select unit_cost from public.sale_item_costs), 100.0000::numeric, 'se guarda el costo del momento (visible solo con permisos)');
select public.t_as('00000000-0000-0000-0000-0000000000b1');

-- Idempotencia
select is((select number from public.register_sale(
  format('[{"variant_id":"%s","quantity":2}]', (select id from public.product_variants where sku = 'P1-NEG-S'))::jsonb,
  format('[{"payment_method_id":"%s","amount":2000}]', (select id from public.payment_methods where code = 'cash'))::jsonb,
  '30000000-0000-0000-0000-000000000001')), (select number from public.sales), 'el mismo request devuelve la misma venta');
select is((select count(*)::int from public.sales), 1, 'y no duplica la venta');
select is((select quantity from public.stock_levels where variant_id = (select id from public.product_variants where sku = 'P1-NEG-S')), 8, 'ni el descuento de stock');

-- Venta 2 con pago mixto: efectivo 1000 + transferencia 1000 (venta de 2000 = 2 x beige M precio 2000? no: 1 x 2000)
select is((select total from public.register_sale(
  format('[{"variant_id":"%s","quantity":1}]', (select id from public.product_variants where sku = 'P1-BEI-M'))::jsonb,
  format('[{"payment_method_id":"%s","amount":1000},{"payment_method_id":"%s","amount":1000,"reference":"CBU 123"}]',
         (select id from public.payment_methods where code = 'cash'), (select id from public.payment_methods where code = 'transfer'))::jsonb,
  '30000000-0000-0000-0000-000000000002')), 2000.00::numeric, 'venta con pago mixto');
select is((select expected_cash_live from public.v_cash_sessions), 3100.00::numeric, 'del pago mixto solo el efectivo suma al efectivo (2100 + 1000)');
select is((select net from public.v_cash_method_totals where code = 'transfer'), 1000.00::numeric, 'la transferencia queda en su propio total');

-- Validaciones
select throws_ok(
  format($$select public.register_sale('[{"variant_id":"%s","quantity":1}]'::jsonb, '[{"payment_method_id":"%s","amount":500}]'::jsonb, gen_random_uuid())$$,
    (select id from public.product_variants where sku = 'P1-NEG-S'), (select id from public.payment_methods where code = 'cash')),
  '22023', null, 'los pagos deben sumar el total');
select throws_ok(
  format($$select public.register_sale('[{"variant_id":"%s","quantity":9}]'::jsonb, '[{"payment_method_id":"%s","amount":9000}]'::jsonb, gen_random_uuid())$$,
    (select id from public.product_variants where sku = 'P1-NEG-S'), (select id from public.payment_methods where code = 'cash')),
  '23514', null, 'stock insuficiente: se rechaza la venta');
select is((select count(*)::int from public.sales), 2, 'una venta rechazada no deja rastros (transaccional)');
select throws_ok(
  format($$select public.register_sale('[{"variant_id":"%s","quantity":1}]'::jsonb, '[{"payment_method_id":"%s","amount":1000,"amount_tendered":500}]'::jsonb, gen_random_uuid())$$,
    (select id from public.product_variants where sku = 'P1-NEG-S'), (select id from public.payment_methods where code = 'cash')),
  '22023', null, 'el efectivo recibido no puede ser menor al monto');
select throws_ok(
  format($$select public.register_sale('[{"variant_id":"%s","quantity":1,"discount_amount":300}]'::jsonb, '[{"payment_method_id":"%s","amount":700}]'::jsonb, gen_random_uuid())$$,
    (select id from public.product_variants where sku = 'P1-NEG-S'), (select id from public.payment_methods where code = 'cash')),
  '42501', null, 'un cajero no supera el tope de descuento (10%)');
select throws_ok(
  format($$select public.register_sale('[]'::jsonb, '[{"payment_method_id":"%s","amount":1}]'::jsonb, gen_random_uuid())$$, (select id from public.payment_methods where code = 'cash')),
  '22023', null, 'una venta sin productos se rechaza');

-- Descuento dentro del tope: 100 sobre 1000 (10%)
select is((select total from public.register_sale(
  format('[{"variant_id":"%s","quantity":1,"discount_amount":100}]', (select id from public.product_variants where sku = 'P1-NEG-M'))::jsonb,
  format('[{"payment_method_id":"%s","amount":900}]', (select id from public.payment_methods where code = 'transfer'))::jsonb,
  '30000000-0000-0000-0000-000000000003')), 900.00::numeric, 'descuento dentro del tope permitido');

-- Visibilidad / permisos del cajero
select is((select count(*)::int from public.sale_item_costs), 0, 'el cajero NO ve costos de venta');
select is((select count(*)::int from public.sales), 3, 'el cajero ve sus ventas');
select throws_ok($$select public.void_sale((select id from public.sales limit 1), 'x')$$, '42501', null, 'el cajero no anula ventas');
select throws_ok($$update public.sales set total = 1$$, '42501', null, 'la API no modifica ventas');
select throws_ok($$delete from public.sale_items$$, '42501', null, 'la API no borra ítems');
select public.t_as('00000000-0000-0000-0000-0000000000b2');
select is((select count(*)::int from public.sales), 0, 'otro cajero no ve ventas ajenas');

-- Descuento general prorrateado (dueño sin tope): 2 líneas, descuento general 301
select public.t_as('00000000-0000-0000-0000-0000000000a1');
select is((select total from public.register_sale(
  format('[{"variant_id":"%s","quantity":1},{"variant_id":"%s","quantity":1}]', (select id from public.product_variants where sku = 'P1-NEG-S'), (select id from public.product_variants where sku = 'P1-BEI-M'))::jsonb,
  format('[{"payment_method_id":"%s","amount":2699}]', (select id from public.payment_methods where code = 'cash'))::jsonb,
  '30000000-0000-0000-0000-000000000004', null, 301)), 2699.00::numeric, 'el dueño aplica un descuento general sin tope');
select is((select sum(line_total) from public.sale_items i join public.sales s on s.id = i.sale_id where s.client_request_id = '30000000-0000-0000-0000-000000000004'), 2699.00::numeric,
  'el descuento general se prorratea y los ítems suman exactamente el total');

-- Devolución parcial de la venta 1 (2 unidades, se devuelve 1) en efectivo
select is((select refund_amount from public.register_return(
  (select id from public.sales where client_request_id = '30000000-0000-0000-0000-000000000001'),
  format('[{"sale_item_id":"%s","quantity":1}]', (select i.id from public.sale_items i join public.sales s on s.id = i.sale_id where s.client_request_id = '30000000-0000-0000-0000-000000000001'))::jsonb,
  (select id from public.payment_methods where code = 'cash'), 'No le quedó bien', true)), 1000.00::numeric, 'devolución parcial: reembolso proporcional');
select is((select quantity from public.stock_levels where variant_id = (select id from public.product_variants where sku = 'P1-NEG-S')), 8 - 1 + 1, 'la devolución repone stock (8 - 1 de la venta 4 + 1 devuelto)');
select ok(exists (select 1 from public.cash_movements where kind = 'sale_refund' and direction = 'out' and amount = 1000), 'el reembolso en efectivo sale de la caja');
select throws_ok(
  format($$select public.register_return('%s', '[{"sale_item_id":"%s","quantity":2}]'::jsonb, '%s', 'x')$$,
    (select id from public.sales where client_request_id = '30000000-0000-0000-0000-000000000001'),
    (select i.id from public.sale_items i join public.sales s on s.id = i.sale_id where s.client_request_id = '30000000-0000-0000-0000-000000000001'),
    (select id from public.payment_methods where code = 'cash')),
  '23514', null, 'no se puede devolver más de lo vendido');
select is((select refund_amount from public.register_return(
  (select id from public.sales where client_request_id = '30000000-0000-0000-0000-000000000001'),
  format('[{"sale_item_id":"%s","quantity":1}]', (select i.id from public.sale_items i join public.sales s on s.id = i.sale_id where s.client_request_id = '30000000-0000-0000-0000-000000000001'))::jsonb,
  (select id from public.payment_methods where code = 'cash'), 'Defectuoso', false)), 1000.00::numeric, 'segunda devolución (sin reposición por defecto)');
select is((select quantity from public.stock_levels where variant_id = (select id from public.product_variants where sku = 'P1-NEG-S')), 8, 'sin reposición no se mueve el stock');
select throws_ok($$select public.void_sale((select id from public.sales where client_request_id = '30000000-0000-0000-0000-000000000001'), 'x')$$, '23514', null, 'una venta con devoluciones no se anula');

-- Anulación de la venta 2 (pago mixto)
select is((select status from public.void_sale((select id from public.sales where client_request_id = '30000000-0000-0000-0000-000000000002'), 'Error de carga')), 'voided', 'el dueño anula una venta');
select is((select quantity from public.stock_levels where variant_id = (select id from public.product_variants where sku = 'P1-BEI-M')), 9, 'la anulación repone el stock (10 - 1 venta 2 + 1 anulación - 1 venta 4)');
select ok(exists (select 1 from public.cash_movements where kind = 'sale_void' and direction = 'out' and amount = 1000), 'se revierten los cobros en la caja (efectivo)');
select is((select count(*)::int from public.cash_movements where kind = 'sale_void'), 2, 'se revierten también los cobros electrónicos (en su propio medio)');
select throws_ok($$select public.void_sale((select id from public.sales where client_request_id = '30000000-0000-0000-0000-000000000002'), 'otra vez')$$, '23514', null, 'no se anula dos veces');

-- Inmutabilidad (superusuario)
select public.t_reset();
select throws_ok($$update public.sale_items set quantity = 99$$, '42501', null, 'sale_items inmutable');
select throws_ok($$update public.sales set total = 1 where status = 'completed'$$, '23514', null, 'los importes de una venta no se pueden modificar');
select throws_ok($$delete from public.sales$$, '42501', null, 'no se borran ventas');
select is((select count(*)::int from public.v_stock_audit), 0, 'el stock sigue consistente con el ledger');

select * from finish();
rollback;
