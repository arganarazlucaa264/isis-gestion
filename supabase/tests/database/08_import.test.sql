begin;
select plan(38);

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

select public.t_as('00000000-0000-0000-0000-0000000000a2');
select is((select status from public.create_import_batch('catalog_stock', 'prueba.xlsx', '{}'::jsonb)), 'uploaded', 'se crea un lote de importación');
select is(public.add_import_rows((select id from public.import_batches limit 1), $json$[
  {"row_number":2,"raw":{"sku":"imp-001","ean":"5901234123457","product_code":"IMP","product_name":"Camisa importada","category":"Camisas","color":"Negro","size":"M","price":"1.234,50","cost":"600","stock":"7","min_stock":"2"}},
  {"row_number":3,"raw":{"sku":"IMP-002","ean":"01234565","product_code":"IMP","product_name":"Camisa importada","category":"Camisas","color":"Negro","size":"L","price":"1500","stock":"3"}},
  {"row_number":4,"raw":{"sku":"IMP-003","ean":"4006381333932","product_code":"IMP","color":"Negro","size":"S","price":"1500","stock":"3"}},
  {"row_number":5,"raw":{"sku":"IMP-004","product_code":"IMP","product_name":"Camisa importada","color":"Violeta","size":"M","price":"1500","stock":"3"}},
  {"row_number":6,"raw":{"sku":"IMP-003","product_code":"IMP","product_name":"Camisa importada","color":"Blanco","size":"M","price":"1500"}},
  {"row_number":7,"raw":{"sku":"IMP-005","product_code":"IMP","color":"Blanco","size":"L","price":"abc"}},
  {"row_number":8,"raw":{"sku":"IMP-006","product_code":"IMP","color":"Blanco","size":"S","price":"900","stock":"-4"}},
  {"row_number":9,"raw":{}}
]$json$::jsonb), 8, 'se cargan las filas crudas en staging');

select is((select status from public.validate_import_batch((select id from public.import_batches limit 1))), 'validated', 'el lote se valida');
select is((select status from public.import_batch_rows where row_number = 2), 'ok', 'fila válida (SKU en minúsculas, precio con formato argentino)') ;
select is((select (parsed ->> 'price')::numeric from public.import_batch_rows where row_number = 2), 1234.50::numeric, 'el precio "1.234,50" se interpreta como 1234.50');
select is((select parsed ->> 'sku' from public.import_batch_rows where row_number = 2), 'IMP-001', 'el SKU se normaliza a mayúsculas');
select is((select action from public.import_batch_rows where row_number = 2), 'create', 'variante nueva => create');
select is((select parsed ->> 'ean' from public.import_batch_rows where row_number = 3), '01234565', 'un EAN-8 que empieza con 0 es válido y se conserva como texto');
select is((select errors from public.import_batch_rows where row_number = 3), '[]'::jsonb, 'sin errores en la fila 3');
select ok((select errors::text from public.import_batch_rows where row_number = 4) like '%EAN inválido%', 'EAN con dígito verificador incorrecto => error');
select ok((select errors::text from public.import_batch_rows where row_number = 5) like '%Color inexistente%', 'color inexistente => error (sin crear faltantes)');
select ok((select errors::text from public.import_batch_rows where row_number = 6) like '%SKU repetido%', 'SKU repetido dentro del archivo => error');
select ok((select errors::text from public.import_batch_rows where row_number = 3) not like '%SKU repetido%' and (select errors::text from public.import_batch_rows where row_number = 2) not like '%SKU repetido%',
  'las filas únicas no se marcan como duplicadas');
select ok((select errors::text from public.import_batch_rows where row_number = 7) like '%Precio inválido%', 'precio no numérico => error');
select ok((select errors::text from public.import_batch_rows where row_number = 8) like '%Stock inválido%', 'stock negativo => error');
select is((select action from public.import_batch_rows where row_number = 9), 'skip', 'fila vacía => se ignora');
select is((select error_rows from public.import_batches limit 1), 5, 'el lote cuenta 5 filas con error');

-- Vista previa: nada se escribió todavía
select is((select count(*)::int from public.product_variants where sku like 'IMP-%'), 0, 'la validación no escribe en el catálogo');

-- Con errores no se aplica nada
select throws_ok($$select public.apply_import_batch((select id from public.import_batches limit 1), false)$$, '23514', null, 'con errores no se aplica el lote completo');
select is((select count(*)::int from public.product_variants where sku like 'IMP-%'), 0, 'y la transacción no deja nada a medias');

-- Aplicar solo las válidas
select is((select status from public.apply_import_batch((select id from public.import_batches limit 1), true)), 'applied', 'se aplican solo las filas válidas');
select is((select count(*)::int from public.product_variants where sku like 'IMP-%'), 2, 'se crearon las 2 variantes válidas');
select is((select price from public.product_variants where sku = 'IMP-001'), 1234.50::numeric, 'precio importado');
select is((select ean from public.product_variants where sku = 'IMP-002'), '01234565', 'el EAN conserva su cero inicial como texto');
select is((select quantity from public.stock_levels where variant_id = (select id from public.product_variants where sku = 'IMP-001')), 7, 'el stock inicial se carga');
select ok(exists (select 1 from public.stock_movements m join public.product_variants v on v.id = m.variant_id
   where v.sku = 'IMP-001' and m.movement_type = 'initial_load' and m.reference_type = 'import_batch'), 'mediante un movimiento initial_load referenciado al lote');
select is((select avg_cost from public.variant_costs where variant_id = (select id from public.product_variants where sku = 'IMP-001')), 600.0000::numeric, 'el costo importado se guarda');
select throws_ok($$select public.apply_import_batch((select id from public.import_batches limit 1), true)$$, '23514', null, 'un lote aplicado no se aplica de nuevo');

-- Modo stock: ajuste por diferencia, identificando por EAN con ceros perdidos
select is((select status from public.create_import_batch('stock', 'stock.xlsx', '{}'::jsonb)), 'uploaded', 'nuevo lote en modo stock');
select public.add_import_rows((select id from public.import_batches where mode = 'stock'), $json$[
  {"row_number":2,"raw":{"ean":"1234565","stock":"5"}},
  {"row_number":3,"raw":{"sku":"IMP-001","stock":"7"}},
  {"row_number":4,"raw":{"sku":"NO-EXISTE","stock":"1"}}
]$json$::jsonb);
select public.validate_import_batch((select id from public.import_batches where mode = 'stock'));
select ok((select errors::text from public.import_batch_rows r join public.import_batches b on b.id = r.batch_id where b.mode = 'stock' and row_number = 4) like '%Variante no encontrada%', 'en modo stock una variante inexistente es un error');
select ok((select warnings::text from public.import_batch_rows r join public.import_batches b on b.id = r.batch_id where b.mode = 'stock' and row_number = 2) like '%EAN completado con ceros%', 'el EAN que perdió su cero inicial se recupera con advertencia');
select public.apply_import_batch((select id from public.import_batches where mode = 'stock'), true);
select is((select quantity from public.stock_levels where variant_id = (select id from public.product_variants where sku = 'IMP-002')), 5, 'el stock se ajusta a 5 (EAN identificado pese a los ceros)');
select is((select quantity from public.stock_movements m join public.product_variants v on v.id = m.variant_id where v.sku = 'IMP-002' and m.movement_type = 'import_adjustment'), 2,
  'se registra solo la diferencia (3 -> 5 = +2) como import_adjustment');
select is((select count(*)::int from public.stock_movements m join public.product_variants v on v.id = m.variant_id where v.sku = 'IMP-001' and m.movement_type = 'import_adjustment'), 0, 'sin diferencia no hay movimiento');

-- Permisos
select public.t_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok($$select public.create_import_batch('stock')$$, '42501', null, 'el cajero no importa');
select public.t_as('00000000-0000-0000-0000-0000000000c1');
select throws_ok($$select public.create_import_batch('catalog')$$, '42501', null, 'el depósito no importa catálogo');
select is((select status from public.create_import_batch('stock')), 'uploaded', 'pero sí puede importar stock');
select is((select count(*)::int from public.import_batches), 1, 'y solo ve sus propios lotes');

select * from finish();
rollback;
