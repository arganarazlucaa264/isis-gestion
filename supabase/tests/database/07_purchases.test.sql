begin;
select plan(48);

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

-- Compra A: 10 x P1-NEG-S a 200 y 10 x P1-NEG-M a 100, descuento 100, IVA 210. Hay stock 10 a costo 100.
select public.t_as('00000000-0000-0000-0000-0000000000a2');
select is((select total from public.save_purchase(null, '20000000-0000-0000-0000-000000000001', 'A-0001', null, null, 100, 210, 'Primera compra',
  format('[{"variant_id":"%s","quantity":10,"unit_cost":200},{"variant_id":"%s","quantity":10,"unit_cost":100}]',
    (select id from public.product_variants where sku = 'P1-NEG-S'), (select id from public.product_variants where sku = 'P1-NEG-M'))::jsonb)),
  3110.00::numeric, 'total = subtotal (3000) - descuento (100) + impuestos (210)');
select is((select due_date - purchase_date from public.purchases), 30, 'el vencimiento toma los días de plazo del proveedor');
select is((select count(*)::int from public.purchase_items), 2, 'se guardan los ítems con snapshot');
select is((select quantity from public.stock_levels where variant_id = (select id from public.product_variants where sku = 'P1-NEG-S')), 10, 'un borrador no mueve el stock');
select is((select count(*)::int from public.supplier_ledger), 0, 'un borrador no genera deuda');

-- Editar borrador (reemplaza ítems)
select is((select subtotal from public.save_purchase((select id from public.purchases limit 1), '20000000-0000-0000-0000-000000000001', 'A-0001', null, null, 100, 210, 'Editada',
  format('[{"variant_id":"%s","quantity":10,"unit_cost":200},{"variant_id":"%s","quantity":10,"unit_cost":100}]',
    (select id from public.product_variants where sku = 'P1-NEG-S'), (select id from public.product_variants where sku = 'P1-NEG-M'))::jsonb)),
  3000.00::numeric, 'se puede editar un borrador');
select throws_ok($$select public.save_purchase(null, '20000000-0000-0000-0000-000000000001', 'X', null, null, 0, 0, null, '[]'::jsonb)$$, '22023', null, 'una compra sin productos se rechaza');
select throws_ok(
  format($$select public.save_purchase(null, '20000000-0000-0000-0000-000000000001', 'X', null, null, 5000, 0, null, '[{"variant_id":"%s","quantity":1,"unit_cost":10}]'::jsonb)$$, (select id from public.product_variants where sku = 'P1-NEG-S')),
  '22023', null, 'el descuento no puede superar el subtotal');

-- Permisos
select public.t_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok($$select public.receive_purchase((select id from public.purchases limit 1))$$, '42501', null, 'el cajero no recibe compras');
select is((select count(*)::int from public.purchases), 0, 'el cajero no ve compras');
select is((select count(*)::int from public.supplier_ledger), 0, 'ni la cuenta corriente');
select public.t_as('00000000-0000-0000-0000-0000000000c1');
select throws_ok($$select public.save_purchase(null, '20000000-0000-0000-0000-000000000001', 'X', null, null, 0, 0, null, '[]'::jsonb)$$, '42501', null, 'el depósito no crea compras');

-- Recepción por el depósito (sin pago): stock, costo promedio ponderado y deuda
select is((select status from public.receive_purchase((select id from public.purchases limit 1))), 'received', 'el depósito recibe la mercadería');
select public.t_as('00000000-0000-0000-0000-0000000000a2');
-- factor de descuento = (3000-100)/3000 = 0.96667: costo efectivo S = 193.3333; M = 96.6667
select is((select quantity from public.stock_levels where variant_id = (select id from public.product_variants where sku = 'P1-NEG-S')), 20, 'la recepción suma el stock');
select is((select last_cost from public.variant_costs where variant_id = (select id from public.product_variants where sku = 'P1-NEG-S')), 193.3333::numeric, 'último costo con el descuento prorrateado (sin impuestos)');
select is((select avg_cost from public.variant_costs where variant_id = (select id from public.product_variants where sku = 'P1-NEG-S')), 146.6667::numeric, 'costo promedio ponderado: (10 x 100 + 10 x 193.3333) / 20');
select ok(exists (select 1 from public.stock_movements where movement_type = 'purchase_in' and reference_type = 'purchase'), 'la recepción genera movimientos purchase_in');
select is((select amount from public.supplier_ledger where entry_type = 'purchase'), 3110.00::numeric, 'la deuda (con impuestos) se asienta en la cuenta corriente');
select is((select balance from public.v_supplier_balances), 3110.00::numeric, 'saldo del proveedor');
select is((select payment_status from public.purchases), 'pending', 'la compra queda pendiente de pago');
select throws_ok($$select public.receive_purchase((select id from public.purchases limit 1))$$, '23514', null, 'no se recibe dos veces');
select throws_ok($$select public.save_purchase((select id from public.purchases limit 1), '20000000-0000-0000-0000-000000000001', 'X', null, null, 0, 0, null,
  '[{"variant_id":"00000000-0000-0000-0000-000000000000","quantity":1,"unit_cost":1}]'::jsonb)$$, '23514', null, 'una compra recibida no se edita');

-- Compra B recibida y pagada en el acto (parte en efectivo desde la caja)
select public.t_as('00000000-0000-0000-0000-0000000000b1');
select public.open_cash_session((select id from public.cash_registers limit 1), 5000, null);
select public.t_as('00000000-0000-0000-0000-0000000000a2');
select public.save_purchase(null, '20000000-0000-0000-0000-000000000001', 'A-0002', null, null, 0, 0, null,
  format('[{"variant_id":"%s","quantity":5,"unit_cost":400}]', (select id from public.product_variants where sku = 'P1-BEI-M'))::jsonb);
select is((select payment_status from public.receive_purchase((select id from public.purchases where invoice_number = 'A-0002'),
  format('{"payment_method_id":"%s","amount":800,"from_register":true}', (select id from public.payment_methods where code = 'cash'))::jsonb)), 'partial',
  'pago parcial al recibir => compra parcialmente pagada');
select is((select paid_amount from public.purchases where invoice_number = 'A-0002'), 800.00::numeric, 'paid_amount refleja el pago');
select is((select expected_cash_live from public.v_cash_sessions), 4200.00::numeric, 'el pago en efectivo desde la caja descuenta del efectivo esperado');
select is((select balance from public.v_supplier_balances), 3110.00 + 2000.00 - 800.00::numeric, 'saldo = compras (5110) - pagos (800)');

-- Pago FIFO por transferencia (no sale de caja): cubre lo pendiente de A-0001 y parte de A-0002
select is((select amount from public.register_supplier_payment('20000000-0000-0000-0000-000000000001',
  (select id from public.payment_methods where code = 'transfer'), 3500, null, 'Transf 99')), 3500.00::numeric, 'pago a proveedor por transferencia');
select is((select payment_status from public.purchases where invoice_number = 'A-0001'), 'paid', 'FIFO: se cancela primero la compra más antigua');
select is((select paid_amount from public.purchases where invoice_number = 'A-0002'), 1190.00::numeric, 'y el resto se aplica a la siguiente (800 + 390)');
select is((select expected_cash_live from public.v_cash_sessions), 4200.00::numeric, 'una transferencia a proveedor NO toca el efectivo');
select is((select balance from public.v_supplier_balances), 810.00::numeric, 'saldo actualizado');
select throws_ok($$select public.register_supplier_payment('20000000-0000-0000-0000-000000000001', (select id from public.payment_methods where code = 'cash'), 0)$$, '22023', null, 'el pago debe ser mayor a 0');
select throws_ok(
  format($$select public.register_supplier_payment('20000000-0000-0000-0000-000000000001', '%s', 10, null, null, null,
    '[{"purchase_id":"%s","amount":5000}]'::jsonb)$$, (select id from public.payment_methods where code = 'cash'), (select id from public.purchases where invoice_number = 'A-0002')),
  '22023', null, 'una asignación no puede superar el monto del pago / la deuda');

-- Pago en efectivo desde la caja, asignado explícitamente, y su anulación
select is((select cash_session_id is not null from public.register_supplier_payment('20000000-0000-0000-0000-000000000001',
  (select id from public.payment_methods where code = 'cash'), 300, null, null, null,
  format('[{"purchase_id":"%s","amount":300}]', (select id from public.purchases where invoice_number = 'A-0002'))::jsonb, true)), true, 'pago en efectivo desde la caja');
select is((select expected_cash_live from public.v_cash_sessions), 3900.00::numeric, 'descuenta del efectivo esperado');
select is((select voided_at is not null from public.void_supplier_payment((select id from public.supplier_payments where amount = 300), 'Error')), true, 'se anula el pago');
select is((select expected_cash_live from public.v_cash_sessions), 4200.00::numeric, 'la anulación reintegra el efectivo con un movimiento inverso');
select is((select paid_amount from public.purchases where invoice_number = 'A-0002'), 1190.00::numeric, 'la compra vuelve a su monto pagado anterior');
select is((select balance from public.v_supplier_balances), 810.00::numeric, 'el saldo se restablece');
select is((select running_balance from public.v_supplier_statement order by id desc limit 1), 810.00::numeric, 'el estado de cuenta termina en el saldo actual');

-- Ajuste manual / saldo inicial (solo dueño)
select throws_ok($$select public.add_supplier_ledger_entry('20000000-0000-0000-0000-000000000001', 'adjustment', 10, 'x')$$, '42501', null, 'el encargado no ajusta la cuenta corriente');
select public.t_as('00000000-0000-0000-0000-0000000000a1');
select is((select amount from public.add_supplier_ledger_entry('20000000-0000-0000-0000-000000000001', 'opening_balance', 1000, 'Saldo inicial')), 1000.00::numeric, 'el dueño carga un saldo inicial');

-- Anulación de compra recibida: movimiento inverso de stock y asiento de crédito
select public.t_as('00000000-0000-0000-0000-0000000000a2');
select is((select status from public.cancel_purchase((select id from public.purchases where invoice_number = 'A-0002'), 'Devuelta al proveedor')), 'cancelled', 'se anula una compra recibida');
select ok(exists (select 1 from public.stock_movements where movement_type = 'purchase_return_out'), 'se revierte el stock con purchase_return_out');
select ok(exists (select 1 from public.supplier_ledger where entry_type = 'credit_note' and amount = -2000), 'y la deuda con una nota de crédito');

-- Inmutabilidad
select public.t_reset();
select throws_ok($$update public.supplier_ledger set amount = 1$$, '42501', null, 'supplier_ledger inmutable (UPDATE)');
select throws_ok($$delete from public.supplier_ledger$$, '42501', null, 'supplier_ledger inmutable (DELETE)');
select throws_ok($$update public.purchases set total = 1 where invoice_number = 'A-0001'$$, '23514', null, 'una compra recibida no cambia sus importes');

select * from finish();
rollback;
