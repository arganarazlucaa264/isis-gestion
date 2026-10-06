begin;
select plan(4);

select has_function('public', 'set_updated_at', 'existe el trigger set_updated_at');
select has_function('public', 'business_date', array['timestamp with time zone'], 'existe business_date');

-- 02:30 UTC del 2 de enero = 23:30 del 1 de enero en Buenos Aires (UTC-3)
select is(
  public.business_date('2026-01-02 02:30:00+00'::timestamptz),
  '2026-01-01'::date,
  'business_date usa la zona horaria de Buenos Aires'
);

-- set_updated_at actualiza la columna
create temp table t_updated (id int, updated_at timestamptz default '2000-01-01');
create trigger t_updated_trg before update on t_updated
  for each row execute function public.set_updated_at();
insert into t_updated (id) values (1);
update t_updated set id = 1;
select cmp_ok(
  (select updated_at from t_updated), '>', '2000-01-01'::timestamptz,
  'set_updated_at actualiza updated_at'
);

select * from finish();
rollback;
