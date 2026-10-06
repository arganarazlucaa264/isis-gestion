begin;
select plan(40);

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

-- Apertura
select public.t_as('00000000-0000-0000-0000-0000000000b1');
select is((select status from public.open_cash_session((select id from public.cash_registers limit 1), 1000, 'turno mañana')), 'open', 'el cajero abre la caja');
select is((select count(*)::int from public.cash_movements where kind = 'opening_float' and amount = 1000), 1, 'el dinero inicial es un movimiento opening_float');
select throws_ok($$select public.open_cash_session((select id from public.cash_registers limit 1), 0, null)$$, '23505', null, 'no se puede abrir una caja ya abierta');
select throws_ok($$select public.open_cash_session((select id from public.cash_registers limit 1), -5, null)$$, '22023', null, 'el dinero inicial no puede ser negativo');

-- Ingresos, retiros y la regla de oro (solo el efectivo suma al efectivo)
select is((select amount from public.register_cash_movement('income', (select id from public.payment_methods where code = 'cash'), 200, 'Cambio ingresado')), 200.00::numeric, 'ingreso manual en efectivo');
select is((select affects_physical_cash from public.register_cash_movement('income', (select id from public.payment_methods where code = 'transfer'), 500, 'Seña por transferencia')), false,
  'una transferencia NO afecta el efectivo físico');
select is((select affects_physical_cash from public.register_cash_movement('income', (select id from public.payment_methods where code = 'mercadopago'), 300, 'Pago MP')), false, 'Mercado Pago NO afecta el efectivo físico');
select is((select expected_cash_live from public.v_cash_sessions), 1200.00::numeric, 'efectivo esperado = inicial + ingresos en efectivo (sin transferencias ni MP)');
select throws_ok($$select public.register_cash_movement('withdrawal', (select id from public.payment_methods where code = 'cash'), 300, 'Retiro')$$,
  '42501', null, 'el cajero no puede hacer retiros');
select throws_ok($$select public.register_cash_movement('sale', (select id from public.payment_methods where code = 'cash'), 1, 'x')$$,
  '22023', null, 'no se pueden registrar ventas como movimiento manual');

-- Gastos
select throws_ok($$select public.register_expense(null, (select id from public.expense_categories limit 1), 'Limpieza', 0, (select id from public.payment_methods where code = 'cash'), true)$$,
  '22023', null, 'el gasto debe ser mayor a 0');
select is((select amount from public.register_expense(null, (select id from public.expense_categories where name = 'Limpieza'), 'Artículos de limpieza',
  100, (select id from public.payment_methods where code = 'cash'), true, null, 'Ticket 123')), 100.00::numeric, 'gasto pagado en efectivo desde la caja');
select is((select expected_cash_live from public.v_cash_sessions), 1100.00::numeric, 'el gasto en efectivo descuenta del efectivo esperado');
select is((select count(*)::int from public.cash_movements where kind = 'expense' and direction = 'out'), 1, 'el gasto generó un egreso en la caja');
select public.register_expense(null, (select id from public.expense_categories where name = 'Servicios'), 'Internet', 80, (select id from public.payment_methods where code = 'transfer'), false);
select is((select expected_cash_live from public.v_cash_sessions), 1100.00::numeric, 'un gasto pagado por transferencia (fuera de caja) no toca el efectivo');
select public.register_expense(null, (select id from public.expense_categories where name = 'Servicios'), 'Luz', 70, (select id from public.payment_methods where code = 'transfer'), true);
select is((select expected_cash_live from public.v_cash_sessions), 1100.00::numeric, 'un gasto electrónico registrado en caja tampoco toca el efectivo');
select throws_ok($$select public.void_expense((select id from public.expenses limit 1), 'x')$$, '42501', null, 'el cajero no anula gastos');

-- Retiro por el dueño
select public.t_as('00000000-0000-0000-0000-0000000000a1');
select is((select amount from public.register_cash_movement('withdrawal', (select id from public.payment_methods where code = 'cash'), 300, 'Retiro a caja fuerte')), 300.00::numeric, 'el dueño hace un retiro de efectivo');
select throws_ok($$select public.register_cash_movement('withdrawal', (select id from public.payment_methods where code = 'transfer'), 10, 'x')$$,
  '23514', null, 'un retiro no puede ser en un medio electrónico');
select is((select expected_cash_live from public.v_cash_sessions), 800.00::numeric, 'efectivo esperado = 1000 + 200 - 100 - 300');
select is((select net from public.v_cash_method_totals where code = 'transfer' and session_id = (select id from public.v_cash_sessions)), 500.00 - 70.00::numeric,
  'el neto por transferencia se lleva aparte');

-- Anulación de un gasto (movimiento inverso en la caja abierta)
select is((select voided_at is not null from public.void_expense((select id from public.expenses where description = 'Artículos de limpieza'), 'Error de carga')), true, 'el dueño anula un gasto');
select is((select expected_cash_live from public.v_cash_sessions), 900.00::numeric, 'la anulación reintegra el efectivo con un movimiento inverso');
select throws_ok($$select public.void_expense((select id from public.expenses where description = 'Artículos de limpieza'), 'otra vez')$$, '23514', null, 'no se anula dos veces');

-- Visibilidad
select public.t_as('00000000-0000-0000-0000-0000000000b2');
select is((select count(*)::int from public.cash_sessions), 0, 'otro cajero no ve cajas ajenas');
select is((select count(*)::int from public.cash_movements), 0, 'ni sus movimientos');

-- Cierre con diferencia
select public.t_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok($$select public.close_cash_session((select id from public.cash_sessions limit 1), -1, null)$$, '22023', null, 'el efectivo contado no puede ser negativo');
select is((select cash_difference from public.close_cash_session((select id from public.cash_sessions limit 1), 890, 'faltan 10', '{"transfer": 430}'::jsonb)), -10.00::numeric,
  'diferencia = contado (890) - esperado (900)');
select is((select expected_cash from public.cash_sessions limit 1), 900.00::numeric, 'se guarda el efectivo esperado');
select is((select status from public.cash_sessions limit 1), 'closed', 'la caja queda cerrada');
select is((select expected from public.cash_session_totals t join public.payment_methods pm on pm.id = t.payment_method_id where pm.code = 'transfer'), 430.00::numeric,
  'se guarda el total por medio de pago (transferencia aparte)');
select is((select reported from public.cash_session_totals t join public.payment_methods pm on pm.id = t.payment_method_id where pm.code = 'transfer'), 430.00::numeric,
  'se guarda lo informado por la terminal/banco');
select throws_ok($$select public.register_cash_movement('income', (select id from public.payment_methods where code = 'cash'), 1, 'x')$$, '23514', null, 'una caja cerrada no admite movimientos (sin caja abierta)');
select throws_ok($$select public.close_cash_session((select id from public.cash_sessions limit 1), 890, null)$$, '23514', null, 'no se cierra dos veces');

-- Inmutabilidad y permisos estructurales
select public.t_reset();
select throws_ok($$update public.cash_movements set amount = 1$$, '42501', null, 'cash_movements inmutable (UPDATE)');
select throws_ok($$delete from public.cash_movements$$, '42501', null, 'cash_movements inmutable (DELETE)');
select throws_ok($$select public.internal_post_cash_movement((select id from public.cash_sessions limit 1), (select id from public.payment_methods where code = 'cash'), 'income', 'in', 5)$$,
  '23514', null, 'el trigger rechaza movimientos en una caja cerrada');
select throws_ok($$update public.payment_methods set is_cash = true where code = 'transfer'$$, '23514', null, 'no se puede convertir un medio electrónico en efectivo');

-- Reapertura solo del dueño
select public.t_as('00000000-0000-0000-0000-0000000000a2');
select throws_ok($$select public.reopen_cash_session((select id from public.cash_sessions limit 1), 'x')$$, '42501', null, 'el encargado no reabre cajas');
select public.t_as('00000000-0000-0000-0000-0000000000a1');
select is((select status from public.reopen_cash_session((select id from public.cash_sessions limit 1), 'Falta cargar un gasto')), 'open', 'el dueño reabre una caja con motivo');

select * from finish();
rollback;
