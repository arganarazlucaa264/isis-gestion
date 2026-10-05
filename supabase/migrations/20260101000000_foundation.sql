-- Etapa 0 · Fundación
-- Helpers genéricos reutilizados por las migraciones de las etapas siguientes.
-- No define tablas de negocio.

-- Trigger genérico: mantiene updated_at en las tablas editables.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger BEFORE UPDATE: actualiza updated_at. Se adjunta a cada tabla editable.';

-- Fecha de negocio (zona horaria del local). Todos los reportes diarios y los cortes
-- por día deben usar esta función en lugar de current_date (que depende del servidor).
create or replace function public.business_date(ts timestamptz default now())
returns date
language sql
immutable
set search_path = ''
as $$
  select (ts at time zone 'America/Argentina/Buenos_Aires')::date;
$$;

comment on function public.business_date(timestamptz) is
  'Fecha calendario del local (America/Argentina/Buenos_Aires) para un instante dado.';
