begin;
select plan(40);

-- ---------------------------------------------------------------------------
-- Usuarios de prueba (se insertan como superusuario; el trigger crea los perfiles)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@test.local',   '{"role":"owner"}',   '{"full_name":"Dueña"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'owner2@test.local',  '{"role":"owner"}',   '{"full_name":"Socio"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'cashier@test.local', '{"role":"cashier"}', '{"full_name":"Caja"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'norole@test.local',  '{}',                 '{"role":"owner"}'),
  ('00000000-0000-0000-0000-0000000000d1', 'hacker@test.local',  '{"role":"hacker"}',  '{}');

-- 1-6: alta automática de perfiles
select has_table('public', 'profiles', 'existe profiles');
select has_table('public', 'audit_log', 'existe audit_log');
select has_table('public', 'app_settings', 'existe app_settings');
select is(
  (select role::text from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  'owner', 'el rol sale de app_metadata');
select is(
  (select role::text from public.profiles where id = '00000000-0000-0000-0000-0000000000c1'),
  'viewer', 'user_metadata.role se ignora (queda viewer)');
select is(
  (select role::text from public.profiles where id = '00000000-0000-0000-0000-0000000000d1'),
  'viewer', 'un rol inválido en app_metadata cae a viewer');

-- ---------------------------------------------------------------------------
-- Dueño
-- ---------------------------------------------------------------------------
do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true); end $$;
set local role authenticated;

-- 7-10
select is(public.auth_role()::text, 'owner', 'auth_role() devuelve owner');
select ok(public.has_role('owner'), 'has_role(owner) = true');
select ok(public.has_role('manager', 'owner'), 'has_role con varios roles');
select ok(not public.has_role('cashier'), 'has_role(cashier) = false');

-- 11
select is((select count(*)::int from public.profiles), 5, 'el dueño ve todos los perfiles');

-- 12-14: el dueño tampoco escribe directo
select throws_ok(
  $$update public.profiles set role = 'owner' where id = '00000000-0000-0000-0000-0000000000b1'$$,
  '42501', null, 'ni el dueño puede UPDATE directo sobre profiles');
select throws_ok(
  $$insert into public.profiles (id) values (gen_random_uuid())$$,
  '42501', null, 'ni el dueño puede INSERT directo sobre profiles');
select throws_ok(
  $$delete from public.profiles$$,
  '42501', null, 'ni el dueño puede DELETE directo sobre profiles');

-- 15-17: RPC de administración
select is(
  (select role::text from public.admin_update_profile(
    '00000000-0000-0000-0000-0000000000b1', 'Caja Uno', 'manager', true)),
  'manager', 'el dueño cambia el rol por RPC');
select throws_ok(
  $$select public.admin_update_profile('00000000-0000-0000-0000-0000000000b1', '  ', 'manager', true)$$,
  '22023', null, 'nombre vacío rechazado');
select throws_ok(
  $$select public.admin_update_profile(gen_random_uuid(), 'X', 'viewer', true)$$,
  'P0002', null, 'usuario inexistente rechazado');

-- 18-19: auditoría visible para el dueño
select ok(
  (select count(*) from public.audit_log
   where table_name = 'profiles' and action = 'UPDATE'
     and record_id = '00000000-0000-0000-0000-0000000000b1'
     and user_id = '00000000-0000-0000-0000-0000000000a1') >= 1,
  'el cambio de rol quedó en audit_log con el usuario que lo hizo');
select ok(
  (select (old_data ->> 'role') = 'cashier' and (new_data ->> 'role') = 'manager'
   from public.audit_log
   where table_name = 'profiles' and action = 'UPDATE'
     and record_id = '00000000-0000-0000-0000-0000000000b1'
   order by id desc limit 1),
  'audit_log guarda el valor anterior y el nuevo');

-- 20: audit_log no se puede modificar desde la API
select throws_ok(
  $$delete from public.audit_log$$,
  '42501', null, 'audit_log: DELETE rechazado para el dueño');

-- 21-22: regla del último dueño (hay 2 dueños activos: se puede degradar a uno)
select lives_ok(
  $$select public.admin_update_profile('00000000-0000-0000-0000-0000000000a2', 'Socio', 'viewer', false)$$,
  'se puede degradar a un dueño si queda otro activo');
select throws_ok(
  $$select public.admin_update_profile('00000000-0000-0000-0000-0000000000a1', 'Dueña', 'manager', true)$$,
  '23514', null, 'no se puede degradar al último dueño activo');

-- 23-24: configuración
select is(
  (select value::text from public.set_app_setting('allow_negative_stock', 'true')),
  'true', 'el dueño modifica la configuración');
select throws_ok(
  $$select public.set_app_setting('clave_inexistente', '1')$$,
  'P0002', null, 'solo claves existentes');

-- ---------------------------------------------------------------------------
-- Vendedor/cajero (en este punto el perfil b1 es manager: lo devolvemos a cashier)
-- ---------------------------------------------------------------------------
do $$ begin perform public.admin_update_profile('00000000-0000-0000-0000-0000000000b1', 'Caja Uno', 'cashier', true); end $$;
reset role;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true); end $$;
set local role authenticated;

-- 25-28
select is(public.auth_role()::text, 'cashier', 'auth_role() devuelve cashier');
select is((select count(*)::int from public.profiles), 1, 'el cajero solo ve su propio perfil');
select is((select count(*)::int from public.audit_log), 0, 'el cajero no ve audit_log');
select ok((select count(*) from public.app_settings) >= 4, 'el cajero lee la configuración');

-- 29-33
select throws_ok(
  $$select public.admin_update_profile('00000000-0000-0000-0000-0000000000b1', 'Caja', 'owner', true)$$,
  '42501', null, 'el cajero no puede auto-promoverse');
select throws_ok(
  $$update public.profiles set role = 'owner' where id = '00000000-0000-0000-0000-0000000000b1'$$,
  '42501', null, 'el cajero no puede UPDATE directo');
select throws_ok(
  $$select public.set_app_setting('store_name', '"Hack"')$$,
  '42501', null, 'el cajero no modifica la configuración');
select throws_ok(
  $$update public.app_settings set value = 'true'$$,
  '42501', null, 'el cajero no hace UPDATE directo en app_settings');
select is(
  (select full_name from public.update_own_profile('Nuevo Nombre')),
  'Nuevo Nombre', 'cada usuario puede cambiar su propio nombre');

-- ---------------------------------------------------------------------------
-- Anónimo
-- ---------------------------------------------------------------------------
reset role;
do $$ begin perform set_config('request.jwt.claims', '{"role":"anon"}', true); end $$;
set local role anon;

-- 34-35
select throws_ok($$select * from public.profiles$$, '42501', null, 'anon no lee profiles');
select throws_ok($$select public.auth_role()$$, '42501', null, 'anon no ejecuta auth_role()');

-- ---------------------------------------------------------------------------
-- Usuario desactivado
-- ---------------------------------------------------------------------------
reset role;
update public.profiles set active = false where id = '00000000-0000-0000-0000-0000000000b1';
do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true); end $$;
set local role authenticated;

-- 36-38
select ok(public.auth_role() is null, 'usuario desactivado: auth_role() es NULL');
select ok(not public.has_role('cashier', 'viewer', 'manager', 'owner', 'stock_clerk'), 'usuario desactivado: sin ningún rol');
select is((select count(*)::int from public.app_settings), 0, 'usuario desactivado: no lee configuración');

-- ---------------------------------------------------------------------------
-- Inmutabilidad de audit_log incluso para el superusuario
-- ---------------------------------------------------------------------------
reset role;
-- 39-40
select throws_ok($$update public.audit_log set table_name = 'x'$$, '42501', null, 'audit_log: UPDATE bloqueado por trigger');
select throws_ok($$truncate public.audit_log$$, '42501', null, 'audit_log: TRUNCATE bloqueado por trigger');

select * from finish();
rollback;
