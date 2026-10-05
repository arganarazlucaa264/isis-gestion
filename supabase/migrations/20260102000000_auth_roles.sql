-- Etapa 1 · Autenticación, roles y RLS base
-- profiles vinculada a auth.users, enum app_role, auth_role()/has_role() y RPC de administración.
-- Principio: el cliente solo LEE (con RLS); toda escritura pasa por funciones RPC.

create type public.app_role as enum (
  'owner',        -- dueño
  'manager',      -- encargado
  'cashier',      -- vendedor / cajero
  'stock_clerk',  -- depósito
  'viewer'        -- solo lectura
);

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete restrict,
  email      text,
  full_name  text not null default '' check (char_length(full_name) <= 120),
  role       public.app_role not null default 'viewer',
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Un perfil por usuario de auth.users: rol y estado. Se crea por trigger.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Alta automática del perfil. El rol SOLO se toma de raw_app_meta_data, que únicamente
-- puede escribir el service_role (Edge Function / script de administración); nunca de
-- user_metadata, que el propio usuario puede modificar. Sin rol válido => 'viewer'.
-- ---------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.app_role := 'viewer';
begin
  begin
    v_role := coalesce((new.raw_app_meta_data ->> 'role')::public.app_role, 'viewer');
  exception when invalid_text_representation then
    v_role := 'viewer';
  end;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    v_role
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.sync_profile_email();

-- ---------------------------------------------------------------------------
-- Helpers de rol. SECURITY DEFINER para leer profiles sin recursión de RLS.
-- Un usuario desactivado o sin perfil devuelve NULL => no tiene ningún permiso.
-- ---------------------------------------------------------------------------
create function public.auth_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid()) and p.active;
$$;

comment on function public.auth_role() is
  'Rol del usuario autenticado, o NULL si no hay sesión, no tiene perfil o está desactivado.';

create function public.has_role(variadic roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.auth_role() = any (roles), false);
$$;

comment on function public.has_role(public.app_role[]) is
  'true si el usuario autenticado y activo tiene alguno de los roles indicados.';

-- ---------------------------------------------------------------------------
-- RLS: lectura propia; dueño y encargado leen todos. Sin políticas de escritura:
-- los cambios se hacen solo por las RPC de abajo.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;

create policy profiles_select
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.has_role('owner', 'manager'));

-- ---------------------------------------------------------------------------
-- RPC de administración de usuarios
-- ---------------------------------------------------------------------------
create function public.admin_update_profile(
  p_user_id   uuid,
  p_full_name text,
  p_role      public.app_role,
  p_active    boolean
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target       public.profiles;
  v_other_owners integer;
  v_result       public.profiles;
begin
  if not public.has_role('owner') then
    raise exception 'Solo el dueño puede modificar usuarios' using errcode = '42501';
  end if;

  if p_full_name is null or btrim(p_full_name) = '' or char_length(p_full_name) > 120 then
    raise exception 'Nombre inválido' using errcode = '22023';
  end if;
  if p_role is null or p_active is null then
    raise exception 'Rol y estado son obligatorios' using errcode = '22023';
  end if;

  select * into v_target from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'Usuario inexistente' using errcode = 'P0002';
  end if;

  -- Nunca puede quedar el sistema sin un dueño activo.
  if v_target.role = 'owner' and v_target.active and (p_role <> 'owner' or not p_active) then
    perform 1 from public.profiles where role = 'owner' and active for update;
    select count(*) into v_other_owners
    from public.profiles
    where role = 'owner' and active and id <> p_user_id;
    if v_other_owners = 0 then
      raise exception 'Debe quedar al menos un dueño activo' using errcode = '23514';
    end if;
  end if;

  update public.profiles
  set full_name = btrim(p_full_name), role = p_role, active = p_active
  where id = p_user_id
  returning * into v_result;

  return v_result;
end;
$$;

create function public.update_own_profile(p_full_name text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result public.profiles;
begin
  if public.auth_role() is null then
    raise exception 'Sesión inválida o usuario desactivado' using errcode = '42501';
  end if;
  if p_full_name is null or btrim(p_full_name) = '' or char_length(p_full_name) > 120 then
    raise exception 'Nombre inválido' using errcode = '22023';
  end if;

  update public.profiles set full_name = btrim(p_full_name)
  where id = (select auth.uid())
  returning * into v_result;

  return v_result;
end;
$$;

-- Permisos de ejecución: solo usuarios autenticados (y service_role, que no se toca).
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.sync_profile_email() from public, anon, authenticated;
revoke execute on function public.auth_role() from public, anon;
revoke execute on function public.has_role(public.app_role[]) from public, anon;
revoke execute on function public.admin_update_profile(uuid, text, public.app_role, boolean) from public, anon;
revoke execute on function public.update_own_profile(text) from public, anon;
grant execute on function public.auth_role() to authenticated;
grant execute on function public.has_role(public.app_role[]) to authenticated;
grant execute on function public.admin_update_profile(uuid, text, public.app_role, boolean) to authenticated;
grant execute on function public.update_own_profile(text) to authenticated;
