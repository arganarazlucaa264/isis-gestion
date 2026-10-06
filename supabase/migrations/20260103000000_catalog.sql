-- Etapa 2 · Catálogo
-- categorías, marcas, colores, talles, proveedores, productos (modelo), variantes
-- (modelo + color + talle), costos y historiales de precio/costo.

-- ---------------------------------------------------------------------------
-- Helpers de migración y de seguridad
-- ---------------------------------------------------------------------------

-- Lanza 42501 si el usuario autenticado no tiene alguno de los roles. Las RPC la usan al inicio.
create function public.require_role(variadic roles public.app_role[])
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not public.has_role(variadic roles) then
    raise exception 'Permiso insuficiente' using errcode = '42501';
  end if;
end;
$$;

-- Helper de migración: activa RLS, deja la tabla de solo lectura para la API y crea políticas
-- de SELECT (p_read NULL = cualquier usuario activo) e INSERT/UPDATE (p_write) por rol.
-- Nunca se concede DELETE: los datos históricos no se borran (se desactivan/anulan).
create function public.secure_table(
  p_table regclass,
  p_read  public.app_role[] default null,
  p_write public.app_role[] default null
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_name text := (select relname from pg_class where oid = p_table);
  v_read text;
  v_write text;
begin
  execute format('alter table %s enable row level security', p_table);
  execute format('revoke all on table %s from anon, authenticated', p_table);
  execute format('grant select on table %s to authenticated', p_table);

  v_read := case when p_read is null then 'public.auth_role() is not null'
                 else format('public.has_role(variadic %L::public.app_role[])', p_read) end;
  execute format('drop policy if exists %I on %s', v_name || '_select', p_table);
  execute format('create policy %I on %s for select to authenticated using (%s)',
                 v_name || '_select', p_table, v_read);

  if p_write is not null then
    v_write := format('public.has_role(variadic %L::public.app_role[])', p_write);
    execute format('grant insert, update on table %s to authenticated', p_table);
    execute format('drop policy if exists %I on %s', v_name || '_insert', p_table);
    execute format('create policy %I on %s for insert to authenticated with check (%s)',
                   v_name || '_insert', p_table, v_write);
    execute format('drop policy if exists %I on %s', v_name || '_update', p_table);
    execute format('create policy %I on %s for update to authenticated using (%s) with check (%s)',
                   v_name || '_update', p_table, v_write, v_write);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Códigos: validación de EAN-8 / UPC-A (12) / EAN-13 / EAN-14 (GTIN)
-- ---------------------------------------------------------------------------
create function public.is_valid_gtin(p_code text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_len   integer;
  v_sum   integer := 0;
  v_digit integer;
  v_pos   integer;
begin
  if p_code is null or p_code !~ '^[0-9]+$' then
    return false;
  end if;
  v_len := char_length(p_code);
  if v_len not in (8, 12, 13, 14) then
    return false;
  end if;
  -- Dígitos de datos (sin el verificador) contados desde la derecha: pesos 3, 1, 3, 1...
  for v_pos in 1 .. v_len - 1 loop
    v_digit := substr(p_code, v_len - v_pos, 1)::integer;
    v_sum := v_sum + v_digit * case when v_pos % 2 = 1 then 3 else 1 end;
  end loop;
  return (10 - v_sum % 10) % 10 = substr(p_code, v_len, 1)::integer;
end;
$$;

comment on function public.is_valid_gtin(text) is
  'true si es un EAN-8, UPC-A, EAN-13 o EAN-14 con dígito verificador correcto.';

-- Intenta recuperar un código válido: quita espacios y, si Excel perdió ceros a la izquierda,
-- completa hasta 8/12/13/14 dígitos. Devuelve NULL si no hay forma de obtener un GTIN válido.
create function public.normalize_ean(p_code text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_code text := regexp_replace(coalesce(p_code, ''), '\s', '', 'g');
  v_len  integer;
  v_try  integer;
begin
  if v_code = '' or v_code !~ '^[0-9]+$' then
    return null;
  end if;
  if public.is_valid_gtin(v_code) then
    return v_code;
  end if;
  v_len := char_length(v_code);
  foreach v_try in array array[8, 12, 13, 14] loop
    if v_try > v_len and public.is_valid_gtin(lpad(v_code, v_try, '0')) then
      return lpad(v_code, v_try, '0');
    end if;
  end loop;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Maestros simples
-- ---------------------------------------------------------------------------
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (btrim(name) <> '' and char_length(name) <= 80),
  parent_id  uuid references public.categories (id) on delete restrict,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);
create unique index categories_name_uidx on public.categories (lower(btrim(name)));

create table public.brands (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (btrim(name) <> '' and char_length(name) <= 80),
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);
create unique index brands_name_uidx on public.brands (lower(btrim(name)));

create table public.colors (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (btrim(name) <> '' and char_length(name) <= 40),
  hex        text check (hex is null or hex ~ '^#[0-9A-Fa-f]{6}$'),
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);
create unique index colors_name_uidx on public.colors (lower(btrim(name)));

create table public.sizes (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (btrim(name) <> '' and char_length(name) <= 20),
  size_group text not null default 'ropa',
  sort_order integer not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);
create unique index sizes_name_uidx on public.sizes (lower(btrim(name)));

create table public.suppliers (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null check (btrim(name) <> '' and char_length(name) <= 120),
  tax_id             text,
  contact            text,
  phone              text,
  email              text,
  address            text,
  payment_terms_days integer not null default 0 check (payment_terms_days >= 0),
  notes              text,
  active             boolean not null default true,
  created_at         timestamptz not null default now(),
  created_by         uuid default auth.uid(),
  updated_at         timestamptz not null default now()
);
create unique index suppliers_name_uidx on public.suppliers (lower(btrim(name)));

-- ---------------------------------------------------------------------------
-- Productos (modelo) y variantes (modelo + color + talle)
-- ---------------------------------------------------------------------------
create table public.products (
  id          uuid primary key default gen_random_uuid(),
  code        text not null check (btrim(code) <> '' and char_length(code) <= 40),
  name        text not null check (btrim(name) <> '' and char_length(name) <= 160),
  description text,
  category_id uuid references public.categories (id) on delete restrict,
  brand_id    uuid references public.brands (id) on delete restrict,
  supplier_id uuid references public.suppliers (id) on delete restrict,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  updated_at  timestamptz not null default now()
);
create unique index products_code_uidx on public.products (upper(btrim(code)));
create index products_category_idx on public.products (category_id);
create index products_supplier_idx on public.products (supplier_id);
create index products_name_idx on public.products (lower(name));

create table public.product_variants (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete restrict,
  color_id   uuid not null references public.colors (id) on delete restrict,
  size_id    uuid not null references public.sizes (id) on delete restrict,
  sku        text not null check (btrim(sku) <> '' and char_length(sku) <= 60),
  ean        text check (ean is null or public.is_valid_gtin(ean)),
  price      numeric(14, 2) not null default 0 check (price >= 0),
  min_stock  integer not null default 0 check (min_stock >= 0),
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  constraint product_variants_unique_combo unique (product_id, color_id, size_id)
);
create unique index product_variants_sku_uidx on public.product_variants (upper(btrim(sku)));
-- El EAN es único ignorando ceros a la izquierda (un UPC-A y su EAN-13 con 0 son el mismo código).
create unique index product_variants_ean_uidx
  on public.product_variants (ltrim(ean, '0')) where ean is not null;
create index product_variants_product_idx on public.product_variants (product_id);

-- Costos en tabla aparte: RLS filtra filas, no columnas (ver ADR 0003).
create table public.variant_costs (
  variant_id uuid primary key references public.product_variants (id) on delete restrict,
  last_cost  numeric(14, 4) not null default 0 check (last_cost >= 0),
  avg_cost   numeric(14, 4) not null default 0 check (avg_cost >= 0),
  updated_at timestamptz not null default now()
);

create table public.price_history (
  id         bigint generated always as identity primary key,
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  old_price  numeric(14, 2),
  new_price  numeric(14, 2) not null,
  changed_by uuid default auth.uid(),
  changed_at timestamptz not null default now()
);
create index price_history_variant_idx on public.price_history (variant_id, changed_at desc);

create table public.cost_history (
  id            bigint generated always as identity primary key,
  variant_id    uuid not null references public.product_variants (id) on delete restrict,
  old_last_cost numeric(14, 4),
  new_last_cost numeric(14, 4) not null,
  old_avg_cost  numeric(14, 4),
  new_avg_cost  numeric(14, 4) not null,
  changed_by    uuid default auth.uid(),
  changed_at    timestamptz not null default now()
);
create index cost_history_variant_idx on public.cost_history (variant_id, changed_at desc);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create trigger categories_set_updated_at before update on public.categories
  for each row execute function public.set_updated_at();
create trigger brands_set_updated_at before update on public.brands
  for each row execute function public.set_updated_at();
create trigger colors_set_updated_at before update on public.colors
  for each row execute function public.set_updated_at();
create trigger sizes_set_updated_at before update on public.sizes
  for each row execute function public.set_updated_at();
create trigger suppliers_set_updated_at before update on public.suppliers
  for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products
  for each row execute function public.set_updated_at();
create trigger product_variants_set_updated_at before update on public.product_variants
  for each row execute function public.set_updated_at();
create trigger variant_costs_set_updated_at before update on public.variant_costs
  for each row execute function public.set_updated_at();

-- Normaliza códigos: el SKU siempre en mayúsculas y sin espacios en los extremos.
create function public.product_variants_normalize()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.sku := upper(btrim(new.sku));
  new.ean := nullif(btrim(coalesce(new.ean, '')), '');
  return new;
end;
$$;
create trigger product_variants_normalize_trg before insert or update on public.product_variants
  for each row execute function public.product_variants_normalize();

create function public.products_normalize()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.code := upper(btrim(new.code));
  return new;
end;
$$;
create trigger products_normalize_trg before insert or update on public.products
  for each row execute function public.products_normalize();

-- Cada variante nace con su fila de costos en cero.
create function public.product_variants_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.variant_costs (variant_id) values (new.id);
  insert into public.price_history (variant_id, old_price, new_price) values (new.id, null, new.price);
  return null;
end;
$$;
create trigger product_variants_after_insert_trg after insert on public.product_variants
  for each row execute function public.product_variants_after_insert();

create function public.product_variants_price_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.price is distinct from old.price then
    insert into public.price_history (variant_id, old_price, new_price)
    values (new.id, old.price, new.price);
  end if;
  return null;
end;
$$;
create trigger product_variants_price_history_trg after update of price on public.product_variants
  for each row execute function public.product_variants_price_history();

create function public.variant_costs_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.last_cost is distinct from old.last_cost or new.avg_cost is distinct from old.avg_cost then
    insert into public.cost_history (variant_id, old_last_cost, new_last_cost, old_avg_cost, new_avg_cost)
    values (new.variant_id, old.last_cost, new.last_cost, old.avg_cost, new.avg_cost);
  end if;
  return null;
end;
$$;
create trigger variant_costs_history_trg after update on public.variant_costs
  for each row execute function public.variant_costs_history();

-- Los historiales son append-only.
create function public.block_history_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% es un registro histórico inmutable (% no permitido)', tg_table_name, tg_op
    using errcode = '42501';
end;
$$;
create trigger price_history_immutable before update or delete on public.price_history
  for each row execute function public.block_history_changes();
create trigger cost_history_immutable before update or delete on public.cost_history
  for each row execute function public.block_history_changes();

-- Auditoría de maestros
create trigger categories_audit after insert or update or delete on public.categories
  for each row execute function public.audit_trigger('id');
create trigger brands_audit after insert or update or delete on public.brands
  for each row execute function public.audit_trigger('id');
create trigger colors_audit after insert or update or delete on public.colors
  for each row execute function public.audit_trigger('id');
create trigger sizes_audit after insert or update or delete on public.sizes
  for each row execute function public.audit_trigger('id');
create trigger suppliers_audit after insert or update or delete on public.suppliers
  for each row execute function public.audit_trigger('id');
create trigger products_audit after insert or update or delete on public.products
  for each row execute function public.audit_trigger('id');
create trigger product_variants_audit after insert or update or delete on public.product_variants
  for each row execute function public.audit_trigger('id');

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
select public.secure_table('public.categories', null, array['owner', 'manager']::public.app_role[]);
select public.secure_table('public.brands', null, array['owner', 'manager']::public.app_role[]);
select public.secure_table('public.colors', null, array['owner', 'manager']::public.app_role[]);
select public.secure_table('public.sizes', null, array['owner', 'manager']::public.app_role[]);
select public.secure_table('public.products', null, array['owner', 'manager']::public.app_role[]);
select public.secure_table('public.product_variants', null, array['owner', 'manager']::public.app_role[]);
select public.secure_table('public.price_history');
select public.secure_table('public.suppliers',
  array['owner', 'manager', 'stock_clerk', 'viewer']::public.app_role[],
  array['owner', 'manager']::public.app_role[]);
-- Costos: solo roles que pueden verlos; se escriben únicamente por RPC.
select public.secure_table('public.variant_costs',
  array['owner', 'manager', 'stock_clerk', 'viewer']::public.app_role[]);
select public.secure_table('public.cost_history',
  array['owner', 'manager', 'stock_clerk', 'viewer']::public.app_role[]);

-- ---------------------------------------------------------------------------
-- RPC: costo manual y alta de variante completa
-- ---------------------------------------------------------------------------
create function public.set_variant_cost(p_variant_id uuid, p_cost numeric)
returns public.variant_costs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result public.variant_costs;
begin
  perform public.require_role('owner', 'manager');
  if p_cost is null or p_cost < 0 then
    raise exception 'Costo inválido' using errcode = '22023';
  end if;
  update public.variant_costs
  set last_cost = round(p_cost, 4), avg_cost = round(p_cost, 4)
  where variant_id = p_variant_id
  returning * into v_result;
  if not found then
    raise exception 'Variante inexistente' using errcode = 'P0002';
  end if;
  return v_result;
end;
$$;

comment on function public.set_variant_cost(uuid, numeric) is
  'Fija el costo manualmente (costo último y promedio). Las compras lo actualizan por promedio ponderado.';

-- Siembra de datos base (editables luego desde la aplicación)
insert into public.sizes (name, size_group, sort_order) values
  ('Único', 'general', 0),
  ('XS', 'ropa', 10), ('S', 'ropa', 20), ('M', 'ropa', 30), ('L', 'ropa', 40),
  ('XL', 'ropa', 50), ('XXL', 'ropa', 60),
  ('34', 'numerico', 134), ('36', 'numerico', 136), ('38', 'numerico', 138),
  ('40', 'numerico', 140), ('42', 'numerico', 142), ('44', 'numerico', 144),
  ('46', 'numerico', 146);

insert into public.colors (name, hex) values
  ('Único', null), ('Negro', '#111111'), ('Blanco', '#FFFFFF'), ('Beige', '#D9C7A3'),
  ('Marrón', '#6B4A2F'), ('Dorado', '#B8913F'), ('Rojo', '#B3261E'), ('Azul', '#1F3A93'),
  ('Verde', '#2E6B3F'), ('Gris', '#808080'), ('Rosa', '#E7A1B0'), ('Animal print', null);

insert into public.categories (name) values
  ('Remeras'), ('Camisas'), ('Pantalones'), ('Jeans'), ('Polleras'), ('Vestidos'),
  ('Buzos y camperas'), ('Calzado'), ('Accesorios');
