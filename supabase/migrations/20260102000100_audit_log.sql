-- Etapa 1 · Auditoría
-- audit_log es append-only y solo lo escribe el trigger genérico audit_trigger().
-- Se adjunta a los maestros editables; los ledgers de negocio (stock, caja, cuenta corriente)
-- son su propia traza y no lo necesitan.

create table public.audit_log (
  id         bigint generated always as identity primary key,
  table_name text not null,
  record_id  text,
  action     text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data   jsonb,
  new_data   jsonb,
  user_id    uuid,
  at         timestamptz not null default now()
);

create index audit_log_table_record_idx on public.audit_log (table_name, record_id, at desc);
create index audit_log_at_idx on public.audit_log (at desc);
create index audit_log_user_idx on public.audit_log (user_id, at desc);

comment on table public.audit_log is 'Registro inmutable de cambios en tablas maestras. Solo lectura para el dueño.';

alter table public.audit_log enable row level security;

revoke all on table public.audit_log from anon, authenticated;
grant select on table public.audit_log to authenticated;

create policy audit_log_select
  on public.audit_log for select to authenticated
  using (public.has_role('owner'));

-- Inmutabilidad: ni UPDATE, ni DELETE, ni TRUNCATE (tampoco para roles privilegiados).
create function public.audit_log_block_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_log es inmutable (% no permitido)', tg_op using errcode = '42501';
end;
$$;

create trigger audit_log_no_update_delete
  before update or delete on public.audit_log
  for each row execute function public.audit_log_block_changes();

create trigger audit_log_no_truncate
  before truncate on public.audit_log
  for each statement execute function public.audit_log_block_changes();

-- Trigger genérico. Argumento opcional: nombre de la columna clave (por defecto 'id').
create function public.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pk  text := coalesce(tg_argv[0], 'id');
  v_row jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
begin
  if tg_op = 'UPDATE' and to_jsonb(old) = to_jsonb(new) then
    return null;
  end if;

  insert into public.audit_log (table_name, record_id, action, old_data, new_data, user_id)
  values (
    tg_table_name,
    v_row ->> v_pk,
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
    (select auth.uid())
  );
  return null;
end;
$$;

revoke execute on function public.audit_trigger() from public, anon, authenticated;

create trigger profiles_audit
  after insert or update or delete on public.profiles
  for each row execute function public.audit_trigger('id');
