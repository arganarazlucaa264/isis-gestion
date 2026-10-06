-- Etapa 5 · Inventario físico
-- Flujo: contando -> revisión -> aplicado (o cancelado). Aplicar genera movimientos
-- inventory_adjustment; nunca se pisa el saldo directamente.

create table public.inventory_counts (
  id          uuid primary key default gen_random_uuid(),
  number      bigint generated always as identity unique,
  name        text not null check (btrim(name) <> ''),
  status      text not null default 'counting'
              check (status in ('counting', 'review', 'applied', 'cancelled')),
  scope       text not null check (scope in ('all', 'category', 'selection')),
  category_id uuid references public.categories (id) on delete restrict,
  notes       text,
  started_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  submitted_at timestamptz,
  applied_at  timestamptz,
  applied_by  uuid,
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancel_reason text,
  updated_at  timestamptz not null default now()
);
create index inventory_counts_status_idx on public.inventory_counts (status, started_at desc);

create table public.inventory_count_items (
  id                  uuid primary key default gen_random_uuid(),
  count_id            uuid not null references public.inventory_counts (id) on delete restrict,
  variant_id          uuid not null references public.product_variants (id) on delete restrict,
  expected_qty        integer not null,           -- foto del sistema al crear el conteo
  counted_qty         integer check (counted_qty is null or counted_qty >= 0),
  counted_at          timestamptz,
  counted_by          uuid,
  system_qty_at_count integer,                    -- se completa al aplicar (stock del ledger al contar)
  difference          integer,                    -- counted - system_qty_at_count (al aplicar)
  applied_movement_id bigint,
  notes               text,
  unique (count_id, variant_id)
);
create index inventory_count_items_variant_idx on public.inventory_count_items (variant_id);

create trigger inventory_counts_set_updated_at before update on public.inventory_counts
  for each row execute function public.set_updated_at();
create trigger inventory_counts_audit after insert or update on public.inventory_counts
  for each row execute function public.audit_trigger('id');

select public.secure_table('public.inventory_counts',
  array['owner', 'manager', 'stock_clerk', 'viewer']::public.app_role[]);
select public.secure_table('public.inventory_count_items',
  array['owner', 'manager', 'stock_clerk', 'viewer']::public.app_role[]);

-- Resuelve una variante por id, EAN o SKU (ignora ceros a la izquierda en EAN).
create function public.internal_resolve_variant(
  p_variant_id uuid default null,
  p_ean        text default null,
  p_sku        text default null
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id    uuid;
  v_ean   text := nullif(regexp_replace(coalesce(p_ean, ''), '\s', '', 'g'), '');
  v_by_ean uuid;
  v_by_sku uuid;
begin
  if p_variant_id is not null then
    select id into v_id from public.product_variants where id = p_variant_id;
    return v_id;
  end if;
  if v_ean is not null and v_ean ~ '^[0-9]+$' then
    select id into v_by_ean from public.product_variants
    where ean is not null and ltrim(ean, '0') = ltrim(v_ean, '0');
  end if;
  if nullif(btrim(coalesce(p_sku, '')), '') is not null then
    select id into v_by_sku from public.product_variants where upper(sku) = upper(btrim(p_sku));
  end if;
  return coalesce(v_by_ean, v_by_sku);
end;
$$;
revoke execute on function public.internal_resolve_variant(uuid, text, text) from public, anon, authenticated;

create function public.create_inventory_count(
  p_name         text,
  p_scope        text,
  p_category_id  uuid default null,
  p_variant_ids  uuid[] default null,
  p_notes        text default null
)
returns public.inventory_counts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count public.inventory_counts;
begin
  perform public.require_role('owner', 'manager', 'stock_clerk');
  if p_scope not in ('all', 'category', 'selection') then
    raise exception 'Alcance inválido' using errcode = '22023';
  end if;
  if p_scope = 'category' and p_category_id is null then
    raise exception 'Elegí una categoría' using errcode = '22023';
  end if;
  if p_scope = 'selection' and coalesce(cardinality(p_variant_ids), 0) = 0 then
    raise exception 'Elegí al menos una variante' using errcode = '22023';
  end if;

  insert into public.inventory_counts (name, scope, category_id, notes)
  values (btrim(p_name), p_scope, case when p_scope = 'category' then p_category_id end, p_notes)
  returning * into v_count;

  insert into public.inventory_count_items (count_id, variant_id, expected_qty)
  select v_count.id, v.id, coalesce(sl.quantity, 0)
  from public.product_variants v
  join public.products p on p.id = v.product_id
  left join public.stock_levels sl on sl.variant_id = v.id
  where v.active
    and (
      p_scope = 'all'
      or (p_scope = 'category' and p.category_id = p_category_id)
      or (p_scope = 'selection' and v.id = any (p_variant_ids))
    );

  return v_count;
end;
$$;

-- Carga un conteo. p_mode = 'set' reemplaza; 'add' suma (útil para contar escaneando: +1 por lectura).
create function public.record_inventory_count(
  p_count_id   uuid,
  p_variant_id uuid,
  p_counted_qty integer,
  p_mode       text default 'set',
  p_notes      text default null
)
returns public.inventory_count_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count public.inventory_counts;
  v_item  public.inventory_count_items;
begin
  perform public.require_role('owner', 'manager', 'stock_clerk');
  if p_mode not in ('set', 'add') then
    raise exception 'Modo inválido' using errcode = '22023';
  end if;
  if p_counted_qty is null or p_counted_qty < 0 then
    raise exception 'La cantidad contada debe ser un entero mayor o igual a 0' using errcode = '22023';
  end if;

  select * into v_count from public.inventory_counts where id = p_count_id for update;
  if not found then
    raise exception 'Inventario inexistente' using errcode = 'P0002';
  end if;
  if v_count.status <> 'counting' then
    raise exception 'El inventario no está en etapa de conteo' using errcode = '23514';
  end if;
  if not exists (select 1 from public.product_variants where id = p_variant_id) then
    raise exception 'Variante inexistente' using errcode = 'P0002';
  end if;

  insert into public.inventory_count_items
    (count_id, variant_id, expected_qty, counted_qty, counted_at, counted_by, notes)
  values (
    p_count_id, p_variant_id,
    coalesce((select quantity from public.stock_levels where variant_id = p_variant_id), 0),
    p_counted_qty, now(), auth.uid(), p_notes
  )
  on conflict (count_id, variant_id) do update
  set counted_qty = case when p_mode = 'add'
                         then coalesce(public.inventory_count_items.counted_qty, 0) + excluded.counted_qty
                         else excluded.counted_qty end,
      counted_at = now(),
      counted_by = auth.uid(),
      notes = coalesce(excluded.notes, public.inventory_count_items.notes)
  returning * into v_item;

  return v_item;
end;
$$;

-- Carga masiva (planilla o escáner): filas con variant_id | ean | sku y counted_qty.
create function public.record_inventory_counts_bulk(
  p_count_id uuid,
  p_rows     jsonb,
  p_mode     text default 'set'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row       record;
  v_variant   uuid;
  v_updated   integer := 0;
  v_not_found jsonb := '[]'::jsonb;
  v_invalid   jsonb := '[]'::jsonb;
  v_n         integer := 0;
begin
  perform public.require_role('owner', 'manager', 'stock_clerk');
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Se esperaba una lista de filas' using errcode = '22023';
  end if;

  for v_row in
    select * from jsonb_to_recordset(p_rows)
      as x(variant_id uuid, ean text, sku text, counted_qty text)
  loop
    v_n := v_n + 1;
    v_variant := public.internal_resolve_variant(v_row.variant_id, v_row.ean, v_row.sku);
    if v_variant is null then
      v_not_found := v_not_found || to_jsonb(coalesce(v_row.ean, v_row.sku, v_row.variant_id::text, '#' || v_n));
      continue;
    end if;
    if v_row.counted_qty is null or v_row.counted_qty !~ '^\s*[0-9]+\s*$' then
      v_invalid := v_invalid || to_jsonb(coalesce(v_row.ean, v_row.sku, v_row.variant_id::text, '#' || v_n));
      continue;
    end if;
    perform public.record_inventory_count(p_count_id, v_variant, btrim(v_row.counted_qty)::integer, p_mode, null);
    v_updated := v_updated + 1;
  end loop;

  return jsonb_build_object('updated', v_updated, 'not_found', v_not_found, 'invalid', v_invalid);
end;
$$;

create function public.submit_inventory_review(p_count_id uuid)
returns public.inventory_counts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count public.inventory_counts;
begin
  perform public.require_role('owner', 'manager', 'stock_clerk');
  update public.inventory_counts set status = 'review', submitted_at = now()
  where id = p_count_id and status = 'counting'
  returning * into v_count;
  if not found then
    raise exception 'El inventario no existe o no está en conteo' using errcode = '23514';
  end if;
  return v_count;
end;
$$;

create function public.reopen_inventory_count(p_count_id uuid)
returns public.inventory_counts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count public.inventory_counts;
begin
  perform public.require_role('owner', 'manager', 'stock_clerk');
  update public.inventory_counts set status = 'counting', submitted_at = null
  where id = p_count_id and status = 'review'
  returning * into v_count;
  if not found then
    raise exception 'El inventario no existe o no está en revisión' using errcode = '23514';
  end if;
  return v_count;
end;
$$;

-- Aplica las diferencias. ajuste = contado - stock del sistema AL MOMENTO de contar
-- (tomado del ledger), así las ventas hechas durante el conteo no se cuentan como faltante.
create function public.apply_inventory_count(p_count_id uuid)
returns public.inventory_counts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count   public.inventory_counts;
  v_item    record;
  v_at      integer;
  v_delta   integer;
  v_mov     bigint;
begin
  perform public.require_role('owner', 'manager', 'stock_clerk');

  select * into v_count from public.inventory_counts where id = p_count_id for update;
  if not found then
    raise exception 'Inventario inexistente' using errcode = 'P0002';
  end if;
  if v_count.status <> 'review' then
    raise exception 'Solo se puede aplicar un inventario en revisión' using errcode = '23514';
  end if;

  for v_item in
    select i.* from public.inventory_count_items i
    where i.count_id = p_count_id and i.counted_qty is not null
    order by i.variant_id
  loop
    select coalesce((
      select m.stock_after from public.stock_movements m
      where m.variant_id = v_item.variant_id and m.created_at <= v_item.counted_at
      order by m.id desc limit 1
    ), 0) into v_at;

    v_delta := v_item.counted_qty - v_at;
    v_mov := null;

    if v_delta <> 0 then
      v_mov := public.internal_post_stock_movement(
        v_item.variant_id, 'inventory_adjustment', v_delta,
        (select avg_cost from public.variant_costs where variant_id = v_item.variant_id),
        'Inventario físico #' || v_count.number, 'inventory_count', p_count_id, null
      );
    end if;

    update public.inventory_count_items
    set system_qty_at_count = v_at, difference = v_delta, applied_movement_id = v_mov
    where id = v_item.id;
  end loop;

  update public.inventory_counts
  set status = 'applied', applied_at = now(), applied_by = auth.uid()
  where id = p_count_id
  returning * into v_count;
  return v_count;
end;
$$;

create function public.cancel_inventory_count(p_count_id uuid, p_reason text)
returns public.inventory_counts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count public.inventory_counts;
begin
  perform public.require_role('owner', 'manager', 'stock_clerk');
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'El motivo es obligatorio' using errcode = '22023';
  end if;
  update public.inventory_counts
  set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = btrim(p_reason)
  where id = p_count_id and status in ('counting', 'review')
  returning * into v_count;
  if not found then
    raise exception 'El inventario no existe o ya fue cerrado' using errcode = '23514';
  end if;
  return v_count;
end;
$$;
