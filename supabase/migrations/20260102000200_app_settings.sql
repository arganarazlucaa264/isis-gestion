-- Etapa 1 · Configuración del sistema (clave/valor). Lectura para cualquier usuario activo;
-- escritura solo del dueño y solo de claves existentes (las claves se crean por migración).

create table public.app_settings (
  key         text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  value       jsonb not null,
  description text not null default '',
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

create trigger app_settings_audit
  after insert or update or delete on public.app_settings
  for each row execute function public.audit_trigger('key');

alter table public.app_settings enable row level security;

revoke all on table public.app_settings from anon, authenticated;
grant select on table public.app_settings to authenticated;

create policy app_settings_select
  on public.app_settings for select to authenticated
  using (public.auth_role() is not null);

insert into public.app_settings (key, value, description) values
  ('store_name', '"Isis"', 'Nombre del local'),
  ('currency', '"ARS"', 'Moneda única del sistema'),
  ('timezone', '"America/Argentina/Buenos_Aires"', 'Zona horaria del negocio'),
  ('allow_negative_stock', 'false', 'Permitir vender con stock insuficiente (queda negativo)');

create function public.set_app_setting(p_key text, p_value jsonb)
returns public.app_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result public.app_settings;
begin
  if not public.has_role('owner') then
    raise exception 'Solo el dueño puede modificar la configuración' using errcode = '42501';
  end if;
  if p_value is null then
    raise exception 'Valor inválido' using errcode = '22023';
  end if;

  update public.app_settings
  set value = p_value, updated_by = (select auth.uid())
  where key = p_key
  returning * into v_result;

  if not found then
    raise exception 'Configuración inexistente: %', p_key using errcode = 'P0002';
  end if;
  return v_result;
end;
$$;

revoke execute on function public.set_app_setting(text, jsonb) from public, anon;
grant execute on function public.set_app_setting(text, jsonb) to authenticated;
