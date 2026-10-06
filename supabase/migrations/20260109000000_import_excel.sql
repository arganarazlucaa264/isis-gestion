-- Etapa 4 · Importación de Excel (staging -> validación -> vista previa -> confirmación)
-- El navegador lee el archivo y sube las filas CRUDAS (texto) a import_batch_rows.
-- Toda la validación y la aplicación ocurren en la base, de forma atómica.
-- Columnas reconocidas (todas opcionales salvo lo que exija el modo):
--   variant_id, sku, ean, product_code, product_name, category, brand, color, size,
--   price, cost, stock, min_stock, active
-- Modos: 'catalog' (productos/variantes), 'stock' (solo stock de variantes existentes),
--        'catalog_stock' (ambos).

create table public.import_batches (
  id           uuid primary key default gen_random_uuid(),
  number       bigint generated always as identity unique,
  mode         text not null check (mode in ('catalog', 'stock', 'catalog_stock')),
  file_name    text,
  options      jsonb not null default '{}'::jsonb,   -- {"create_missing": true}
  status       text not null default 'uploaded'
               check (status in ('uploaded', 'validated', 'applied', 'discarded')),
  total_rows   integer not null default 0,
  ok_rows      integer not null default 0,
  warning_rows integer not null default 0,
  error_rows   integer not null default 0,
  summary      jsonb,
  created_by   uuid not null default auth.uid() references public.profiles (id),
  created_at   timestamptz not null default now(),
  validated_at timestamptz,
  applied_at   timestamptz,
  applied_by   uuid references public.profiles (id)
);

create table public.import_batch_rows (
  id         bigint generated always as identity primary key,
  batch_id   uuid not null references public.import_batches (id) on delete cascade,
  row_number integer not null,
  raw        jsonb not null,
  parsed     jsonb,
  status     text not null default 'pending' check (status in ('pending', 'ok', 'warning', 'error')),
  action     text check (action in ('create', 'update', 'skip')),
  errors     jsonb not null default '[]'::jsonb,
  warnings   jsonb not null default '[]'::jsonb,
  variant_id uuid references public.product_variants (id) on delete restrict,
  unique (batch_id, row_number)
);
create index import_batch_rows_batch_idx on public.import_batch_rows (batch_id, row_number);

create trigger import_batches_audit after insert or update on public.import_batches
  for each row execute function public.audit_trigger('id');

select public.secure_table('public.import_batches',
  array['owner', 'manager', 'stock_clerk']::public.app_role[]);
select public.secure_table('public.import_batch_rows',
  array['owner', 'manager', 'stock_clerk']::public.app_role[]);
-- Cada usuario ve solo sus propios lotes (el dueño/encargado ven todos)
drop policy import_batches_select on public.import_batches;
create policy import_batches_select on public.import_batches for select to authenticated
  using (public.has_role('owner', 'manager') or (public.has_role('stock_clerk') and created_by = (select auth.uid())));
drop policy import_batch_rows_select on public.import_batch_rows;
create policy import_batch_rows_select on public.import_batch_rows for select to authenticated
  using (exists (select 1 from public.import_batches b where b.id = batch_id));

-- ---------------------------------------------------------------------------
-- Helpers de parseo
-- ---------------------------------------------------------------------------
-- Acepta "1234.56", "1234,56", "1.234,56", "1,234.56" y "$ 1.234,56". NULL si no es un número.
create function public.parse_import_number(p_text text)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := btrim(regexp_replace(coalesce(p_text, ''), '[\s$]', '', 'g'));
begin
  if v = '' then
    return null;
  end if;
  if v like '%,%' and v like '%.%' then
    if position(',' in v) > position('.' in v) then
      v := replace(replace(v, '.', ''), ',', '.');   -- 1.234,56
    else
      v := replace(v, ',', '');                      -- 1,234.56
    end if;
  elsif v like '%,%' then
    v := replace(v, ',', '.');
  end if;
  if v !~ '^-?[0-9]+(\.[0-9]+)?$' then
    return null;
  end if;
  return v::numeric;
end;
$$;

create function public.parse_import_bool(p_text text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case lower(btrim(coalesce(p_text, '')))
    when 'si' then true when 'sí' then true when 's' then true when '1' then true
    when 'true' then true when 'x' then true when 'activo' then true when 'yes' then true
    when 'no' then false when 'n' then false when '0' then false
    when 'false' then false when 'inactivo' then false
    else null end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: lotes y filas
-- ---------------------------------------------------------------------------
create function public.create_import_batch(
  p_mode      text,
  p_file_name text default null,
  p_options   jsonb default '{}'::jsonb
)
returns public.import_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.import_batches;
begin
  perform public.require_role('owner', 'manager', 'stock_clerk');
  if p_mode not in ('catalog', 'stock', 'catalog_stock') then
    raise exception 'Modo de importación inválido' using errcode = '22023';
  end if;
  -- El depósito solo puede importar stock; el catálogo es de dueño/encargado.
  if p_mode <> 'stock' and not public.has_role('owner', 'manager') then
    raise exception 'Solo dueño o encargado pueden importar el catálogo' using errcode = '42501';
  end if;
  insert into public.import_batches (mode, file_name, options)
  values (p_mode, p_file_name, coalesce(p_options, '{}'::jsonb))
  returning * into v_batch;
  return v_batch;
end;
$$;

-- p_rows: [{"row_number": int, "raw": {...}}]. Se puede llamar varias veces (por tandas).
create function public.add_import_rows(p_batch_id uuid, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.import_batches;
  v_n     integer;
begin
  perform public.require_role('owner', 'manager', 'stock_clerk');
  select * into v_batch from public.import_batches where id = p_batch_id for update;
  if not found or v_batch.created_by <> auth.uid() and not public.has_role('owner', 'manager') then
    raise exception 'Lote inexistente' using errcode = 'P0002';
  end if;
  if v_batch.status not in ('uploaded', 'validated') then
    raise exception 'El lote ya no admite filas' using errcode = '23514';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Se esperaba una lista de filas' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) > 2000 then
    raise exception 'Máximo 2000 filas por tanda' using errcode = '22023';
  end if;

  insert into public.import_batch_rows (batch_id, row_number, raw)
  select p_batch_id, x.row_number, x.raw
  from jsonb_to_recordset(p_rows) as x(row_number integer, raw jsonb);
  get diagnostics v_n = row_count;

  update public.import_batches
  set status = 'uploaded', total_rows = (select count(*) from public.import_batch_rows where batch_id = p_batch_id)
  where id = p_batch_id;
  return v_n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Validación (también se ejecuta de nuevo al aplicar, con los datos vigentes)
-- ---------------------------------------------------------------------------
create function public.internal_validate_import(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch      public.import_batches;
  v_create_missing boolean;
  v_row        record;
  v_errors     jsonb;
  v_warnings   jsonb;
  v_parsed     jsonb;
  v_action     text;
  v_status     text;
  r            jsonb;
  -- campos
  f_vid_txt    text;  f_sku text;  f_ean_raw text;  f_ean text;
  f_code       text;  f_name text; f_cat text;  f_brand text; f_color text; f_size text;
  f_price      numeric; f_cost numeric; f_stock numeric; f_min numeric; f_active boolean;
  v_vid        uuid;  v_by_ean uuid;  v_by_sku uuid;
  v_variant    public.product_variants;
  v_product    public.products;
  v_cur_stock  integer;
  v_color_id   uuid;  v_size_id uuid;
  v_has_price  boolean; v_has_cost boolean; v_has_stock boolean; v_has_min boolean;
begin
  select * into v_batch from public.import_batches where id = p_batch_id;
  v_create_missing := coalesce((v_batch.options ->> 'create_missing')::boolean, false);

  for v_row in select * from public.import_batch_rows where batch_id = p_batch_id order by row_number
  loop
    v_errors := '[]'::jsonb;
    v_warnings := '[]'::jsonb;
    v_action := 'skip';
    v_variant := null;
    v_product := null;
    v_vid := null;
    r := v_row.raw;

    f_vid_txt := nullif(btrim(coalesce(r ->> 'variant_id', '')), '');
    f_sku     := nullif(upper(btrim(coalesce(r ->> 'sku', ''))), '');
    f_ean_raw := nullif(regexp_replace(coalesce(r ->> 'ean', ''), '\s', '', 'g'), '');
    f_code    := nullif(upper(btrim(coalesce(r ->> 'product_code', ''))), '');
    f_name    := nullif(btrim(coalesce(r ->> 'product_name', '')), '');
    f_cat     := nullif(btrim(coalesce(r ->> 'category', '')), '');
    f_brand   := nullif(btrim(coalesce(r ->> 'brand', '')), '');
    f_color   := nullif(btrim(coalesce(r ->> 'color', '')), '');
    f_size    := nullif(btrim(coalesce(r ->> 'size', '')), '');
    v_has_price := nullif(btrim(coalesce(r ->> 'price', '')), '') is not null;
    v_has_cost  := nullif(btrim(coalesce(r ->> 'cost', '')), '') is not null;
    v_has_stock := nullif(btrim(coalesce(r ->> 'stock', '')), '') is not null;
    v_has_min   := nullif(btrim(coalesce(r ->> 'min_stock', '')), '') is not null;
    f_price := public.parse_import_number(r ->> 'price');
    f_cost  := public.parse_import_number(r ->> 'cost');
    f_stock := public.parse_import_number(r ->> 'stock');
    f_min   := public.parse_import_number(r ->> 'min_stock');
    f_active := public.parse_import_bool(r ->> 'active');

    -- fila vacía
    if f_vid_txt is null and f_sku is null and f_ean_raw is null and f_code is null and f_name is null then
      update public.import_batch_rows
      set status = 'ok', action = 'skip', parsed = null, errors = '[]', warnings = '["Fila vacía: se ignora"]', variant_id = null
      where id = v_row.id;
      continue;
    end if;

    -- EAN
    f_ean := null;
    if f_ean_raw is not null then
      f_ean := public.normalize_ean(f_ean_raw);
      if f_ean is null then
        v_errors := v_errors || to_jsonb('EAN inválido: ' || f_ean_raw || ' (debe ser EAN-8/12/13/14 con dígito verificador correcto)');
      elsif f_ean <> f_ean_raw then
        v_warnings := v_warnings || to_jsonb('EAN completado con ceros a la izquierda: ' || f_ean);
      end if;
    end if;

    -- Números
    if v_has_price and (f_price is null or f_price < 0) then
      v_errors := v_errors || to_jsonb('Precio inválido: ' || (r ->> 'price'));
    end if;
    if v_has_cost and (f_cost is null or f_cost < 0) then
      v_errors := v_errors || to_jsonb('Costo inválido: ' || (r ->> 'cost'));
    end if;
    if v_has_stock and (f_stock is null or f_stock < 0 or f_stock <> trunc(f_stock)) then
      v_errors := v_errors || to_jsonb('Stock inválido (entero >= 0): ' || (r ->> 'stock'));
    end if;
    if v_has_min and (f_min is null or f_min < 0 or f_min <> trunc(f_min)) then
      v_errors := v_errors || to_jsonb('Stock mínimo inválido (entero >= 0): ' || (r ->> 'min_stock'));
    end if;
    if nullif(btrim(coalesce(r ->> 'active', '')), '') is not null and f_active is null then
      v_errors := v_errors || to_jsonb('Valor de "activo" inválido: ' || (r ->> 'active'));
    end if;

    -- Resolver variante existente: variant_id > EAN > SKU
    if f_vid_txt is not null then
      begin
        v_vid := f_vid_txt::uuid;
      exception when invalid_text_representation then
        v_errors := v_errors || to_jsonb('variant_id inválido'::text);
      end;
      if v_vid is not null then
        select * into v_variant from public.product_variants where id = v_vid;
        if not found then
          v_errors := v_errors || to_jsonb('variant_id inexistente'::text);
          v_variant := null;
        end if;
      end if;
    end if;
    if v_variant.id is null then
      if f_ean is not null then
        select id into v_by_ean from public.product_variants
        where ean is not null and ltrim(ean, '0') = ltrim(f_ean, '0');
      else
        v_by_ean := null;
      end if;
      if f_sku is not null then
        select id into v_by_sku from public.product_variants where upper(sku) = f_sku;
      else
        v_by_sku := null;
      end if;
      if v_by_ean is not null and v_by_sku is not null and v_by_ean <> v_by_sku then
        v_errors := v_errors || to_jsonb('El EAN y el SKU pertenecen a variantes distintas'::text);
      elsif coalesce(v_by_ean, v_by_sku) is not null then
        select * into v_variant from public.product_variants where id = coalesce(v_by_ean, v_by_sku);
      end if;
    end if;

    if v_batch.mode = 'stock' and v_variant.id is null and jsonb_array_length(v_errors) = 0 then
      v_errors := v_errors || to_jsonb('Variante no encontrada: en modo stock debe existir (importá el catálogo primero)'::text);
    end if;
    if v_batch.mode in ('stock') and not v_has_stock then
      v_errors := v_errors || to_jsonb('Falta la columna/valor de stock'::text);
    end if;

    -- Catálogo
    v_color_id := null; v_size_id := null;
    if v_batch.mode in ('catalog', 'catalog_stock') then
      if v_variant.id is not null then
        v_action := 'update';
        -- EAN nuevo no debe pertenecer a otra variante
        if f_ean is not null and (v_variant.ean is null or ltrim(v_variant.ean, '0') <> ltrim(f_ean, '0')) then
          if exists (select 1 from public.product_variants
                     where ean is not null and ltrim(ean, '0') = ltrim(f_ean, '0') and id <> v_variant.id) then
            v_errors := v_errors || to_jsonb('El EAN ya pertenece a otra variante'::text);
          end if;
        end if;
        if f_sku is not null and f_sku <> upper(v_variant.sku) then
          if exists (select 1 from public.product_variants where upper(sku) = f_sku and id <> v_variant.id) then
            v_errors := v_errors || to_jsonb('El SKU ya pertenece a otra variante'::text);
          else
            v_warnings := v_warnings || to_jsonb('Se actualizará el SKU de ' || v_variant.sku || ' a ' || f_sku);
          end if;
        end if;
        if f_color is not null or f_size is not null then
          v_warnings := v_warnings || to_jsonb('Color/talle de una variante existente no se modifican'::text);
        end if;
      else
        v_action := 'create';
        if f_code is null and f_name is null then
          v_errors := v_errors || to_jsonb('Para crear una variante hace falta código de modelo o nombre de producto'::text);
        end if;
        if f_color is null then v_errors := v_errors || to_jsonb('Falta el color'::text); end if;
        if f_size is null then v_errors := v_errors || to_jsonb('Falta el talle'::text); end if;
        if not v_has_price then v_errors := v_errors || to_jsonb('Falta el precio'::text); end if;
        if f_sku is null and (f_code is null or f_color is null or f_size is null) then
          v_errors := v_errors || to_jsonb('Falta el SKU'::text);
        elsif f_sku is null then
          f_sku := upper(regexp_replace(f_code || '-' || f_color || '-' || f_size, '\s+', '', 'g'));
          v_warnings := v_warnings || to_jsonb('SKU generado automáticamente: ' || f_sku);
          if exists (select 1 from public.product_variants where upper(sku) = f_sku) then
            v_errors := v_errors || to_jsonb('El SKU generado ya existe: ' || f_sku);
          end if;
        end if;

        -- producto (modelo)
        if f_code is not null then
          select * into v_product from public.products where upper(code) = f_code;
        end if;
        if v_product.id is null then
          if f_name is null then
            v_errors := v_errors || to_jsonb('Producto nuevo: falta el nombre'::text);
          elsif f_code is null then
            -- sin código: se busca por nombre exacto
            select * into v_product from public.products where lower(name) = lower(f_name) limit 1;
          end if;
        end if;

        -- color / talle: deben existir salvo create_missing
        if f_color is not null then
          select id into v_color_id from public.colors where lower(btrim(name)) = lower(f_color);
          if v_color_id is null then
            if v_create_missing then
              v_warnings := v_warnings || to_jsonb('Se creará el color: ' || f_color);
            else
              v_errors := v_errors || to_jsonb('Color inexistente: ' || f_color);
            end if;
          end if;
        end if;
        if f_size is not null then
          select id into v_size_id from public.sizes where lower(btrim(name)) = lower(f_size);
          if v_size_id is null then
            if v_create_missing then
              v_warnings := v_warnings || to_jsonb('Se creará el talle: ' || f_size);
            else
              v_errors := v_errors || to_jsonb('Talle inexistente: ' || f_size);
            end if;
          end if;
        end if;

        -- SKU / EAN no pueden existir ya (si existieran habríamos encontrado la variante)
        -- combinación producto+color+talle repetida
        if v_product.id is not null and v_color_id is not null and v_size_id is not null and exists (
          select 1 from public.product_variants
          where product_id = v_product.id and color_id = v_color_id and size_id = v_size_id
        ) then
          v_errors := v_errors || to_jsonb('Ya existe una variante de ese modelo con ese color y talle'::text);
        end if;
      end if;

      -- categoría / marca (opcionales)
      if f_cat is not null and not exists (select 1 from public.categories where lower(btrim(name)) = lower(f_cat)) then
        if v_create_missing then
          v_warnings := v_warnings || to_jsonb('Se creará la categoría: ' || f_cat);
        else
          v_errors := v_errors || to_jsonb('Categoría inexistente: ' || f_cat);
        end if;
      end if;
      if f_brand is not null and not exists (select 1 from public.brands where lower(btrim(name)) = lower(f_brand)) then
        if v_create_missing then
          v_warnings := v_warnings || to_jsonb('Se creará la marca: ' || f_brand);
        else
          v_errors := v_errors || to_jsonb('Marca inexistente: ' || f_brand);
        end if;
      end if;
    elsif v_variant.id is not null then
      v_action := 'update';
    end if;

    -- Stock (diferencia contra el stock actual; se recalcula al aplicar)
    if v_batch.mode in ('stock', 'catalog_stock') and v_has_stock and f_stock is not null then
      if v_variant.id is not null then
        select quantity into v_cur_stock from public.stock_levels where variant_id = v_variant.id;
        if f_stock::integer = coalesce(v_cur_stock, 0) then
          v_warnings := v_warnings || to_jsonb('Stock sin cambios (' || f_stock::integer || ')');
        else
          v_warnings := v_warnings || to_jsonb('Stock: ' || coalesce(v_cur_stock, 0) || ' -> ' || f_stock::integer);
        end if;
        if v_action = 'skip' then v_action := 'update'; end if;
      end if;
    end if;

    v_parsed := jsonb_strip_nulls(jsonb_build_object(
      'variant_id', v_variant.id, 'sku', f_sku, 'ean', f_ean,
      'product_code', f_code, 'product_name', f_name, 'category', f_cat, 'brand', f_brand,
      'color', f_color, 'size', f_size,
      'price', case when v_has_price then f_price end,
      'cost', case when v_has_cost then f_cost end,
      'stock', case when v_has_stock and f_stock is not null then f_stock::integer end,
      'min_stock', case when v_has_min and f_min is not null then f_min::integer end,
      'active', f_active,
      'product_id', v_product.id
    ));

    v_status := case when jsonb_array_length(v_errors) > 0 then 'error'
                     when jsonb_array_length(v_warnings) > 0 then 'warning'
                     else 'ok' end;
    update public.import_batch_rows
    set parsed = v_parsed, status = v_status, action = v_action,
        errors = v_errors, warnings = v_warnings, variant_id = v_variant.id
    where id = v_row.id;
  end loop;

  -- Duplicados dentro del archivo (SKU / EAN / combinación) -> error en TODAS las filas involucradas
  update public.import_batch_rows t
  set status = 'error',
      errors = t.errors || to_jsonb('SKU repetido en el archivo (filas ' || d.rows || ')')
  from (
    select upper(parsed ->> 'sku') as k, string_agg(row_number::text, ', ' order by row_number) as rows
    from public.import_batch_rows
    where batch_id = p_batch_id and parsed ->> 'sku' is not null and variant_id is null
    group by upper(parsed ->> 'sku') having count(*) > 1
  ) d
  where t.batch_id = p_batch_id and t.variant_id is null and upper(t.parsed ->> 'sku') = d.k;

  update public.import_batch_rows t
  set status = 'error',
      errors = t.errors || to_jsonb('EAN repetido en el archivo (filas ' || d.rows || ')')
  from (
    select ltrim(parsed ->> 'ean', '0') as k, string_agg(row_number::text, ', ' order by row_number) as rows
    from public.import_batch_rows
    where batch_id = p_batch_id and parsed ->> 'ean' is not null
    group by ltrim(parsed ->> 'ean', '0') having count(distinct coalesce(variant_id::text, row_number::text)) > 1
  ) d
  where t.batch_id = p_batch_id and ltrim(t.parsed ->> 'ean', '0') = d.k;

  update public.import_batch_rows t
  set status = 'error',
      errors = t.errors || to_jsonb('La misma variante aparece más de una vez (filas ' || d.rows || ')')
  from (
    select variant_id as k, string_agg(row_number::text, ', ' order by row_number) as rows
    from public.import_batch_rows
    where batch_id = p_batch_id and variant_id is not null
    group by variant_id having count(*) > 1
  ) d
  where t.batch_id = p_batch_id and t.variant_id = d.k;

  update public.import_batch_rows t
  set status = 'error',
      errors = t.errors || to_jsonb('Modelo + color + talle repetido en el archivo (filas ' || d.rows || ')')
  from (
    select coalesce(upper(parsed ->> 'product_code'), lower(parsed ->> 'product_name')) || '|' ||
           lower(parsed ->> 'color') || '|' || lower(parsed ->> 'size') as k,
           string_agg(row_number::text, ', ' order by row_number) as rows
    from public.import_batch_rows
    where batch_id = p_batch_id and action = 'create'
    group by 1 having count(*) > 1
  ) d
  where t.batch_id = p_batch_id and t.action = 'create'
    and coalesce(upper(t.parsed ->> 'product_code'), lower(t.parsed ->> 'product_name')) || '|' ||
        lower(t.parsed ->> 'color') || '|' || lower(t.parsed ->> 'size') = d.k;

  update public.import_batches b
  set status = 'validated', validated_at = now(),
      total_rows = (select count(*) from public.import_batch_rows where batch_id = p_batch_id),
      ok_rows = (select count(*) from public.import_batch_rows where batch_id = p_batch_id and status = 'ok'),
      warning_rows = (select count(*) from public.import_batch_rows where batch_id = p_batch_id and status = 'warning'),
      error_rows = (select count(*) from public.import_batch_rows where batch_id = p_batch_id and status = 'error'),
      summary = jsonb_build_object(
        'create', (select count(*) from public.import_batch_rows where batch_id = p_batch_id and action = 'create' and status <> 'error'),
        'update', (select count(*) from public.import_batch_rows where batch_id = p_batch_id and action = 'update' and status <> 'error'),
        'skip', (select count(*) from public.import_batch_rows where batch_id = p_batch_id and action = 'skip' and status <> 'error'))
  where b.id = p_batch_id;
end;
$$;
revoke execute on function public.internal_validate_import(uuid) from public, anon, authenticated;

create function public.validate_import_batch(p_batch_id uuid)
returns public.import_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.import_batches;
begin
  perform public.require_role('owner', 'manager', 'stock_clerk');
  select * into v_batch from public.import_batches where id = p_batch_id for update;
  if not found or (v_batch.created_by <> auth.uid() and not public.has_role('owner', 'manager')) then
    raise exception 'Lote inexistente' using errcode = 'P0002';
  end if;
  if v_batch.status not in ('uploaded', 'validated') then
    raise exception 'El lote ya fue aplicado o descartado' using errcode = '23514';
  end if;
  perform public.internal_validate_import(p_batch_id);
  select * into v_batch from public.import_batches where id = p_batch_id;
  return v_batch;
end;
$$;

create function public.discard_import_batch(p_batch_id uuid)
returns public.import_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.import_batches;
begin
  perform public.require_role('owner', 'manager', 'stock_clerk');
  update public.import_batches set status = 'discarded'
  where id = p_batch_id and status in ('uploaded', 'validated')
    and (created_by = auth.uid() or public.has_role('owner', 'manager'))
  returning * into v_batch;
  if not found then
    raise exception 'Lote inexistente o ya cerrado' using errcode = 'P0002';
  end if;
  return v_batch;
end;
$$;

-- ---------------------------------------------------------------------------
-- Aplicación: re-valida con los datos vigentes y escribe todo en una transacción.
-- p_only_valid = true  -> ignora las filas con error y aplica el resto
-- p_only_valid = false -> si hay algún error, no aplica nada
-- ---------------------------------------------------------------------------
create function public.apply_import_batch(p_batch_id uuid, p_only_valid boolean default false)
returns public.import_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch      public.import_batches;
  v_row        record;
  p            jsonb;
  v_create_missing boolean;
  v_variant_id uuid;
  v_product_id uuid;
  v_category   uuid;
  v_brand      uuid;
  v_color      uuid;
  v_size       uuid;
  v_current    integer;
  v_delta      integer;
  v_cost       numeric;
  v_applied    integer := 0;
  v_moves      integer := 0;
begin
  perform public.require_role('owner', 'manager', 'stock_clerk');

  select * into v_batch from public.import_batches where id = p_batch_id for update;
  if not found or (v_batch.created_by <> auth.uid() and not public.has_role('owner', 'manager')) then
    raise exception 'Lote inexistente' using errcode = 'P0002';
  end if;
  if v_batch.status not in ('uploaded', 'validated') then
    raise exception 'El lote ya fue aplicado o descartado' using errcode = '23514';
  end if;
  if v_batch.mode <> 'stock' and not public.has_role('owner', 'manager') then
    raise exception 'Solo dueño o encargado pueden importar el catálogo' using errcode = '42501';
  end if;
  v_create_missing := coalesce((v_batch.options ->> 'create_missing')::boolean, false);

  perform public.internal_validate_import(p_batch_id);
  select * into v_batch from public.import_batches where id = p_batch_id;

  if v_batch.error_rows > 0 and not p_only_valid then
    raise exception 'El lote tiene % fila(s) con errores: corregilas o aplicá solo las válidas', v_batch.error_rows
      using errcode = '23514';
  end if;

  for v_row in
    select * from public.import_batch_rows
    where batch_id = p_batch_id and status in ('ok', 'warning') and action <> 'skip'
    order by row_number
  loop
    p := v_row.parsed;
    v_variant_id := nullif(p ->> 'variant_id', '')::uuid;

    if v_row.action = 'create' then
      -- categoría / marca / color / talle (crear si corresponde)
      v_category := null; v_brand := null;
      if p ->> 'category' is not null then
        select id into v_category from public.categories where lower(btrim(name)) = lower(p ->> 'category');
        if v_category is null then
          insert into public.categories (name) values (p ->> 'category') returning id into v_category;
        end if;
      end if;
      if p ->> 'brand' is not null then
        select id into v_brand from public.brands where lower(btrim(name)) = lower(p ->> 'brand');
        if v_brand is null then
          insert into public.brands (name) values (p ->> 'brand') returning id into v_brand;
        end if;
      end if;
      select id into v_color from public.colors where lower(btrim(name)) = lower(p ->> 'color');
      if v_color is null then
        insert into public.colors (name) values (p ->> 'color') returning id into v_color;
      end if;
      select id into v_size from public.sizes where lower(btrim(name)) = lower(p ->> 'size');
      if v_size is null then
        insert into public.sizes (name) values (p ->> 'size') returning id into v_size;
      end if;

      -- producto (modelo)
      v_product_id := nullif(p ->> 'product_id', '')::uuid;
      if v_product_id is null and p ->> 'product_code' is not null then
        select id into v_product_id from public.products where upper(code) = upper(p ->> 'product_code');
      end if;
      if v_product_id is null and p ->> 'product_code' is null and p ->> 'product_name' is not null then
        select id into v_product_id from public.products where lower(name) = lower(p ->> 'product_name') limit 1;
      end if;
      if v_product_id is null then
        insert into public.products (code, name, category_id, brand_id)
        values (
          coalesce(p ->> 'product_code', upper(regexp_replace(p ->> 'product_name', '\s+', '-', 'g'))),
          coalesce(p ->> 'product_name', p ->> 'product_code'), v_category, v_brand
        )
        returning id into v_product_id;
      end if;

      insert into public.product_variants (product_id, color_id, size_id, sku, ean, price, min_stock, active)
      values (v_product_id, v_color, v_size, p ->> 'sku', p ->> 'ean',
              coalesce((p ->> 'price')::numeric, 0), coalesce((p ->> 'min_stock')::integer, 0),
              coalesce((p ->> 'active')::boolean, true))
      returning id into v_variant_id;

      if (p ->> 'cost') is not null then
        update public.variant_costs
        set last_cost = (p ->> 'cost')::numeric, avg_cost = (p ->> 'cost')::numeric
        where variant_id = v_variant_id;
      end if;
    elsif v_batch.mode <> 'stock' then
      -- actualización de variante existente
      update public.product_variants
      set price = coalesce((p ->> 'price')::numeric, price),
          min_stock = coalesce((p ->> 'min_stock')::integer, min_stock),
          active = coalesce((p ->> 'active')::boolean, active),
          ean = coalesce(p ->> 'ean', ean),
          sku = coalesce(p ->> 'sku', sku)
      where id = v_variant_id;

      if (p ->> 'cost') is not null then
        update public.variant_costs
        set last_cost = (p ->> 'cost')::numeric, avg_cost = (p ->> 'cost')::numeric
        where variant_id = v_variant_id;
      end if;

      if p ->> 'product_name' is not null or p ->> 'category' is not null or p ->> 'brand' is not null then
        select product_id into v_product_id from public.product_variants where id = v_variant_id;
        if p ->> 'category' is not null then
          select id into v_category from public.categories where lower(btrim(name)) = lower(p ->> 'category');
          if v_category is null then
            insert into public.categories (name) values (p ->> 'category') returning id into v_category;
          end if;
          update public.products set category_id = v_category where id = v_product_id;
        end if;
        if p ->> 'brand' is not null then
          select id into v_brand from public.brands where lower(btrim(name)) = lower(p ->> 'brand');
          if v_brand is null then
            insert into public.brands (name) values (p ->> 'brand') returning id into v_brand;
          end if;
          update public.products set brand_id = v_brand where id = v_product_id;
        end if;
        if p ->> 'product_name' is not null then
          update public.products set name = p ->> 'product_name' where id = v_product_id;
        end if;
      end if;
    end if;

    -- Stock: movimiento por la DIFERENCIA contra el stock vigente al momento de aplicar
    if (p ->> 'stock') is not null and v_batch.mode in ('stock', 'catalog_stock') then
      select quantity into v_current from public.stock_levels where variant_id = v_variant_id;
      v_delta := (p ->> 'stock')::integer - coalesce(v_current, 0);
      if v_delta <> 0 then
        select avg_cost into v_cost from public.variant_costs where variant_id = v_variant_id;
        perform public.internal_post_stock_movement(
          v_variant_id,
          case when v_row.action = 'create' or not exists (
                 select 1 from public.stock_movements where variant_id = v_variant_id)
               then 'initial_load'::public.stock_movement_type
               else 'import_adjustment'::public.stock_movement_type end,
          v_delta, v_cost, 'Importación Excel #' || v_batch.number, 'import_batch', p_batch_id, null
        );
        v_moves := v_moves + 1;
      end if;
    end if;

    v_applied := v_applied + 1;
    update public.import_batch_rows set variant_id = v_variant_id where id = v_row.id;
  end loop;

  update public.import_batches
  set status = 'applied', applied_at = now(), applied_by = auth.uid(),
      summary = coalesce(summary, '{}'::jsonb)
                || jsonb_build_object('applied_rows', v_applied, 'stock_movements', v_moves,
                                      'skipped_errors', v_batch.error_rows)
  where id = p_batch_id
  returning * into v_batch;
  return v_batch;
end;
$$;
