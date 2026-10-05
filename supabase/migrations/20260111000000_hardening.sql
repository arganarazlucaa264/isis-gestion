-- Endurecimiento final de permisos. Se vuelve a ejecutar al final de cada migración futura:
--   select public.harden_privileges();
--
-- * Las funciones de la API (RPC) quedan ejecutables solo por usuarios autenticados.
-- * Las funciones internas (prefijo internal_) no son ejecutables por la API.
-- * Las vistas son solo lectura y solo para usuarios autenticados (respetan RLS: security_invoker).
-- * Las secuencias no son accesibles desde la API.

create function public.harden_privileges()
returns void
language plpgsql
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig, p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    if r.proname like 'internal\_%' or r.proname in ('secure_table', 'harden_privileges') then
      execute format('revoke execute on function %s from authenticated', r.sig);
    else
      execute format('grant execute on function %s to authenticated', r.sig);
    end if;
  end loop;

  for r in
    select c.oid::regclass as rel, c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'v'
  loop
    execute format('revoke all on %s from anon, authenticated', r.rel);
    -- v_variants_all expone costos y no usa RLS: solo la leen las funciones definer de reportes.
    if r.relname <> 'v_variants_all' then
      execute format('grant select on %s to authenticated', r.rel);
    end if;
  end loop;

  for r in
    select c.oid::regclass as rel
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'S'
  loop
    execute format('revoke all on sequence %s from anon, authenticated', r.rel);
  end loop;
end;
$$;

select public.harden_privileges();
