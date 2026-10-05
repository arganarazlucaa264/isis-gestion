-- Etapa 3 · Stock
-- Ledger inmutable de movimientos + saldo derivado por variante. Todo cambio de stock es un
-- INSERT en stock_movements hecho por funciones internas; no existe otro camino.

create type public.stock_movement_type as enum (
  'purchase_in', 'sale_out', 'sale_return_in', 'sale_void_in', 'purchase_return_out',
  'adjustment_in', 'adjustment_out', 'inventory_adjustment', 'import_adjustment', 'initial_load',
  'damage_out', 'theft_out', 'internal_use_out'
);

create table public.stock_levels (
  variant_id uuid primary key references public.product_variants (id) on delete restrict,
  quantity   integer not null default 0,
  updated_at timestamptz not null default now()
);

create table public.stock_movements (
  id             bigint generated always as identity primary key,
  variant_id     uuid not null references public.product_variants (id) on delete restrict,
  movement_type  public.stock_movement_type not null,
  quantity       integer not null check (quantity <> 0),  -- con signo: + entra, - sale
  stock_before   integer not null,
  stock_after    integer not null,
  unit_cost      numeric(14, 4),
  reason         text,
  reference_type text,
  reference_id   uuid,
  notes          text,
  created_by     uuid default auth.uid(),
  created_at     timestamptz not null default now(),
  -- El signo debe corresponder al tipo de movimiento.
  constraint stock_movements_sign_chk check (
    case
      when movement_type in ('purchase_in', 'sale_return_in', 'sale_void_in', 'adjustment_in', 'initial_load')
        then quantity > 0
      when movement_type in ('sale_out', 'purchase_return_out', 'adjustment_out', 'damage_out',
                             'theft_out', 'internal_use_out')
        then quantity < 0
      else true  -- inventory_adjustment / import_adjustment pueden ser + o -
    end
  )
);
create index stock_movements_variant_idx on public.stock_movements (variant_id, id desc);
create index stock_movements_created_idx on public.stock_movements (created_at desc);
create index stock_movements_ref_idx on public.stock_movements (reference_type, reference_id);

-- Cada variante nueva (y las existentes) tiene su fila de saldo.
insert into public.stock_levels (variant_id) select id from public.product_variants;

create function public.product_variants_create_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.stock_levels (variant_id) values (new.id);
  return null;
end;
$$;
create trigger product_variants_create_stock_trg after insert on public.product_variants
  for each row execute function public.product_variants_create_stock();

-- ---------------------------------------------------------------------------
-- Aplicación del movimiento: bloquea el saldo, valida stock negativo y completa before/after.
-- ---------------------------------------------------------------------------
create function public.stock_movements_apply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before   integer;
  v_after    integer;
  v_negative boolean;
begin
  select quantity into v_before
  from public.stock_levels where variant_id = new.variant_id for update;
  if not found then
    raise exception 'La variante % no tiene saldo de stock', new.variant_id using errcode = 'P0002';
  end if;

  v_after := v_before + new.quantity;

  if v_after < 0 then
    select coalesce((select value = 'true'::jsonb from public.app_settings
                     where key = 'allow_negative_stock'), false)
    into v_negative;
    if not v_negative then
      raise exception 'Stock insuficiente (disponible %, movimiento %)', v_before, new.quantity
        using errcode = '23514', detail = new.variant_id::text;
    end if;
  end if;

  update public.stock_levels set quantity = v_after, updated_at = now()
  where variant_id = new.variant_id;

  new.stock_before := v_before;
  new.stock_after := v_after;
  return new;
end;
$$;
create trigger stock_movements_apply_trg before insert on public.stock_movements
  for each row execute function public.stock_movements_apply();

-- Ledger inmutable
create function public.stock_movements_block_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'stock_movements es inmutable (% no permitido): corregí con un movimiento inverso', tg_op
    using errcode = '42501';
end;
$$;
create trigger stock_movements_no_update_delete before update or delete on public.stock_movements
  for each row execute function public.stock_movements_block_changes();
create trigger stock_movements_no_truncate before truncate on public.stock_movements
  for each statement execute function public.stock_movements_block_changes();

-- stock_levels no se escribe desde la API: solo el trigger de arriba.
select public.secure_table('public.stock_levels');
select public.secure_table('public.stock_movements',
  array['owner', 'manager', 'stock_clerk', 'viewer']::public.app_role[]);

-- ---------------------------------------------------------------------------
-- Función interna única para mover stock (no ejecutable por la API)
-- ---------------------------------------------------------------------------
create function public.internal_post_stock_movement(
  p_variant_id uuid,
  p_type       public.stock_movement_type,
  p_quantity   integer,
  p_unit_cost  numeric default null,
  p_reason     text default null,
  p_ref_type   text default null,
  p_ref_id     uuid default null,
  p_notes      text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  insert into public.stock_movements
    (variant_id, movement_type, quantity, unit_cost, reason, reference_type, reference_id, notes)
  values
    (p_variant_id, p_type, p_quantity, p_unit_cost, p_reason, p_ref_type, p_ref_id, p_notes)
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.internal_post_stock_movement(uuid, public.stock_movement_type, integer, numeric, text, text, uuid, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Vistas de lectura (respetan RLS del usuario que consulta)
-- ---------------------------------------------------------------------------
create view public.v_variants with (security_invoker = true) as
select
  v.id            as variant_id,
  v.sku,
  v.ean,
  v.price,
  v.min_stock,
  v.active,
  v.product_id,
  p.code          as product_code,
  p.name          as product_name,
  p.active        as product_active,
  p.category_id,
  cat.name        as category_name,
  p.brand_id,
  b.name          as brand_name,
  p.supplier_id,
  v.color_id,
  col.name        as color_name,
  col.hex         as color_hex,
  v.size_id,
  sz.name         as size_name,
  sz.sort_order   as size_order,
  coalesce(sl.quantity, 0) as stock
from public.product_variants v
join public.products p on p.id = v.product_id
join public.colors col on col.id = v.color_id
join public.sizes sz on sz.id = v.size_id
left join public.categories cat on cat.id = p.category_id
left join public.brands b on b.id = p.brand_id
left join public.stock_levels sl on sl.variant_id = v.id;

-- Control de integridad: el saldo debe ser igual a la suma del ledger. Debe estar siempre vacía.
create view public.v_stock_audit with (security_invoker = true) as
select
  sl.variant_id,
  sl.quantity as level_quantity,
  coalesce(sum(m.quantity), 0)::integer as ledger_quantity,
  sl.quantity - coalesce(sum(m.quantity), 0)::integer as difference
from public.stock_levels sl
left join public.stock_movements m on m.variant_id = sl.variant_id
group by sl.variant_id, sl.quantity
having sl.quantity <> coalesce(sum(m.quantity), 0);

-- Búsqueda por código (EAN / SKU). Pensada para lector USB (teclado + Enter) y cámara del celular:
-- el POS, el inventario y el Excel usan esta misma función. Ignora ceros a la izquierda en EAN.
create function public.find_variant_by_code(p_code text)
returns setof public.v_variants
language sql
stable
set search_path = ''
as $$
  select *
  from public.v_variants v
  where p_code is not null
    and btrim(p_code) <> ''
    and (
      (v.ean is not null and ltrim(v.ean, '0') = ltrim(regexp_replace(p_code, '\s', '', 'g'), '0')
         and regexp_replace(p_code, '\s', '', 'g') ~ '^[0-9]+$')
      or upper(v.sku) = upper(btrim(p_code))
    )
  order by (v.ean is not null and ltrim(v.ean, '0') = ltrim(regexp_replace(p_code, '\s', '', 'g'), '0')) desc
  limit 1;
$$;

-- Búsqueda de texto libre para el POS: nombre, modelo, SKU o EAN.
create function public.search_variants(p_query text, p_limit integer default 30)
returns setof public.v_variants
language sql
stable
set search_path = ''
as $$
  select *
  from public.v_variants v
  where v.active and v.product_active
    and p_query is not null and btrim(p_query) <> ''
    and (
      v.product_name ilike '%' || btrim(p_query) || '%'
      or v.product_code ilike '%' || btrim(p_query) || '%'
      or v.sku ilike '%' || btrim(p_query) || '%'
      or v.color_name ilike '%' || btrim(p_query) || '%'
      or (v.ean is not null and ltrim(v.ean, '0') = ltrim(btrim(p_query), '0')
          and btrim(p_query) ~ '^[0-9]+$')
    )
  order by v.product_name, v.color_name, v.size_order
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

-- ---------------------------------------------------------------------------
-- RPC: ajustes manuales de stock
-- ---------------------------------------------------------------------------
create function public.adjust_stock(
  p_variant_id uuid,
  p_type       public.stock_movement_type,
  p_quantity   integer,
  p_reason     text,
  p_notes      text default null
)
returns public.stock_movements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sign   integer;
  v_id     bigint;
  v_result public.stock_movements;
begin
  perform public.require_role('owner', 'manager', 'stock_clerk');

  if p_type not in ('adjustment_in', 'adjustment_out', 'damage_out', 'theft_out',
                    'internal_use_out', 'initial_load') then
    raise exception 'Tipo de movimiento no permitido para ajuste manual: %', p_type
      using errcode = '22023';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La cantidad debe ser un entero positivo' using errcode = '22023';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'El motivo es obligatorio' using errcode = '22023';
  end if;
  if not exists (select 1 from public.product_variants where id = p_variant_id) then
    raise exception 'Variante inexistente' using errcode = 'P0002';
  end if;

  if p_type = 'initial_load' and exists (
    select 1 from public.stock_movements where variant_id = p_variant_id
  ) then
    raise exception 'La carga inicial solo se permite en variantes sin movimientos' using errcode = '23514';
  end if;

  v_sign := case when p_type in ('adjustment_in', 'initial_load') then 1 else -1 end;

  v_id := public.internal_post_stock_movement(
    p_variant_id, p_type, v_sign * p_quantity,
    (select avg_cost from public.variant_costs where variant_id = p_variant_id),
    btrim(p_reason), 'manual', null, p_notes
  );
  select * into v_result from public.stock_movements where id = v_id;
  return v_result;
end;
$$;

-- Alta completa de variante: valida, crea costo/saldo por trigger, costo inicial y stock inicial.
create function public.create_variant(
  p_product_id    uuid,
  p_color_id      uuid,
  p_size_id       uuid,
  p_sku           text,
  p_ean           text default null,
  p_price         numeric default 0,
  p_cost          numeric default 0,
  p_min_stock     integer default 0,
  p_initial_stock integer default 0
)
returns public.product_variants
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_variant public.product_variants;
begin
  perform public.require_role('owner', 'manager');
  if coalesce(p_initial_stock, 0) < 0 then
    raise exception 'El stock inicial no puede ser negativo' using errcode = '22023';
  end if;

  insert into public.product_variants (product_id, color_id, size_id, sku, ean, price, min_stock)
  values (p_product_id, p_color_id, p_size_id, p_sku, p_ean, coalesce(p_price, 0), coalesce(p_min_stock, 0))
  returning * into v_variant;

  if coalesce(p_cost, 0) > 0 then
    update public.variant_costs
    set last_cost = round(p_cost, 4), avg_cost = round(p_cost, 4)
    where variant_id = v_variant.id;
  end if;

  if coalesce(p_initial_stock, 0) > 0 then
    perform public.internal_post_stock_movement(
      v_variant.id, 'initial_load', p_initial_stock, nullif(p_cost, 0),
      'Stock inicial', 'manual', null, null
    );
  end if;

  return v_variant;
end;
$$;
