-- Etapa 7 · Ventas / POS
-- Una venta es una operación atómica: venta + ítems (con snapshot) + stock + caja + pagos.
-- Las ventas no se editan ni se borran: se anulan (void_sale) o se devuelven (register_return).

create table public.customers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (btrim(name) <> ''),
  phone      text,
  email      text,
  document   text,
  notes      text,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);
create trigger customers_set_updated_at before update on public.customers
  for each row execute function public.set_updated_at();
create trigger customers_audit after insert or update on public.customers
  for each row execute function public.audit_trigger('id');

create sequence public.sales_number_seq;

create table public.sales (
  id                uuid primary key default gen_random_uuid(),
  number            bigint not null unique default nextval('public.sales_number_seq'),
  cash_session_id   uuid not null references public.cash_sessions (id) on delete restrict,
  customer_id       uuid references public.customers (id) on delete restrict,
  status            text not null default 'completed' check (status in ('completed', 'voided')),
  subtotal          numeric(14, 2) not null check (subtotal >= 0),   -- suma de precio x cantidad
  discount_amount   numeric(14, 2) not null default 0 check (discount_amount >= 0),
  total             numeric(14, 2) not null check (total >= 0),      -- subtotal - descuentos
  notes             text,
  client_request_id uuid not null unique,                            -- idempotencia (doble clic)
  seller_name       text,                                            -- snapshot
  created_by        uuid not null default auth.uid() references public.profiles (id),
  created_at        timestamptz not null default now(),
  voided_by         uuid references public.profiles (id),
  voided_at         timestamptz,
  void_reason       text,
  constraint sales_total_chk check (total = subtotal - discount_amount)
);
create index sales_created_idx on public.sales (created_at desc);
create index sales_user_idx on public.sales (created_by, created_at desc);
create index sales_session_idx on public.sales (cash_session_id);

create table public.sale_items (
  id              uuid primary key default gen_random_uuid(),
  sale_id         uuid not null references public.sales (id) on delete restrict,
  variant_id      uuid not null references public.product_variants (id) on delete restrict,
  quantity        integer not null check (quantity > 0),
  unit_price      numeric(14, 2) not null check (unit_price >= 0),
  discount_amount numeric(14, 2) not null default 0 check (discount_amount >= 0),  -- incluye prorrateo del descuento general
  line_total      numeric(14, 2) not null check (line_total >= 0),                  -- precio x cant - descuento
  -- snapshot de lo vendido
  product_code    text not null,
  product_name    text not null,
  sku             text not null,
  ean             text,
  color_name      text not null,
  size_name       text not null,
  constraint sale_items_line_chk check (line_total = unit_price * quantity - discount_amount)
);
create index sale_items_sale_idx on public.sale_items (sale_id);
create index sale_items_variant_idx on public.sale_items (variant_id);

-- Costo del momento (restringido por RLS: los vendedores no ven costos ni márgenes).
create table public.sale_item_costs (
  sale_item_id uuid primary key references public.sale_items (id) on delete restrict,
  unit_cost    numeric(14, 4) not null check (unit_cost >= 0)
);

create table public.sale_payments (
  id                uuid primary key default gen_random_uuid(),
  sale_id           uuid not null references public.sales (id) on delete restrict,
  payment_method_id uuid not null references public.payment_methods (id) on delete restrict,
  amount            numeric(14, 2) not null check (amount > 0),     -- monto aplicado a la venta (neto de vuelto)
  amount_tendered   numeric(14, 2),                                  -- efectivo recibido
  change_given      numeric(14, 2) not null default 0 check (change_given >= 0),
  installments      integer check (installments is null or installments >= 1),
  reference         text,
  method_name       text not null,                                   -- snapshot
  is_cash           boolean not null                                 -- snapshot
);
create index sale_payments_sale_idx on public.sale_payments (sale_id);

create table public.sale_returns (
  id               uuid primary key default gen_random_uuid(),
  number           bigint generated always as identity unique,
  sale_id          uuid not null references public.sales (id) on delete restrict,
  cash_session_id  uuid not null references public.cash_sessions (id) on delete restrict,
  refund_method_id uuid not null references public.payment_methods (id) on delete restrict,
  refund_amount    numeric(14, 2) not null check (refund_amount >= 0),
  restock          boolean not null default true,
  reason           text not null check (btrim(reason) <> ''),
  created_by       uuid not null default auth.uid() references public.profiles (id),
  created_at       timestamptz not null default now()
);
create index sale_returns_sale_idx on public.sale_returns (sale_id);
create index sale_returns_created_idx on public.sale_returns (created_at desc);

create table public.sale_return_items (
  id             uuid primary key default gen_random_uuid(),
  return_id      uuid not null references public.sale_returns (id) on delete restrict,
  sale_item_id   uuid not null references public.sale_items (id) on delete restrict,
  variant_id     uuid not null references public.product_variants (id) on delete restrict,
  quantity       integer not null check (quantity > 0),
  refund_amount  numeric(14, 2) not null check (refund_amount >= 0)
);
create index sale_return_items_return_idx on public.sale_return_items (return_id);
create index sale_return_items_item_idx on public.sale_return_items (sale_item_id);

-- Las ventas y sus hijos solo cambian por RPC; esta función bloquea cualquier otro UPDATE sobre
-- campos de la venta (solo se permite anular).
create function public.sales_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'voided' then
    raise exception 'Una venta anulada no se puede modificar' using errcode = '23514';
  end if;
  if (new.subtotal, new.discount_amount, new.total, new.cash_session_id, new.created_by, new.created_at, new.number)
     is distinct from
     (old.subtotal, old.discount_amount, old.total, old.cash_session_id, old.created_by, old.created_at, old.number) then
    raise exception 'Los importes de una venta no se pueden modificar' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger sales_guard_update_trg before update on public.sales
  for each row execute function public.sales_guard_update();

create function public.sale_children_block_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% es inmutable (% no permitido)', tg_table_name, tg_op using errcode = '42501';
end;
$$;
create trigger sale_items_immutable before update or delete on public.sale_items
  for each row execute function public.sale_children_block_changes();
create trigger sale_item_costs_immutable before update or delete on public.sale_item_costs
  for each row execute function public.sale_children_block_changes();
create trigger sale_payments_immutable before update or delete on public.sale_payments
  for each row execute function public.sale_children_block_changes();
create trigger sale_returns_immutable before update or delete on public.sale_returns
  for each row execute function public.sale_children_block_changes();
create trigger sale_return_items_immutable before update or delete on public.sale_return_items
  for each row execute function public.sale_children_block_changes();
create trigger sales_no_delete before delete on public.sales
  for each row execute function public.sale_children_block_changes();

create trigger sales_audit after insert or update on public.sales
  for each row execute function public.audit_trigger('id');

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
select public.secure_table('public.customers', null,
  array['owner', 'manager', 'cashier']::public.app_role[]);

select public.secure_table('public.sales');
drop policy sales_select on public.sales;
create policy sales_select on public.sales for select to authenticated
  using (
    public.has_role('owner', 'manager', 'viewer')
    or (public.has_role('cashier') and created_by = (select auth.uid()))
  );

select public.secure_table('public.sale_items');
drop policy sale_items_select on public.sale_items;
create policy sale_items_select on public.sale_items for select to authenticated
  using (exists (select 1 from public.sales s where s.id = sale_id));  -- hereda la RLS de sales

select public.secure_table('public.sale_payments');
drop policy sale_payments_select on public.sale_payments;
create policy sale_payments_select on public.sale_payments for select to authenticated
  using (exists (select 1 from public.sales s where s.id = sale_id));

select public.secure_table('public.sale_returns');
drop policy sale_returns_select on public.sale_returns;
create policy sale_returns_select on public.sale_returns for select to authenticated
  using (exists (select 1 from public.sales s where s.id = sale_id));

select public.secure_table('public.sale_return_items');
drop policy sale_return_items_select on public.sale_return_items;
create policy sale_return_items_select on public.sale_return_items for select to authenticated
  using (exists (select 1 from public.sale_returns r where r.id = return_id));

select public.secure_table('public.sale_item_costs',
  array['owner', 'manager', 'viewer']::public.app_role[]);

insert into public.app_settings (key, value, description) values
  ('cashier_max_discount_pct', '10', 'Descuento máximo (% del subtotal) que puede aplicar un vendedor/cajero');

-- ---------------------------------------------------------------------------
-- Registrar una venta
-- ---------------------------------------------------------------------------
-- p_items:    [{"variant_id": uuid, "quantity": int, "discount_amount": numeric}]
-- p_payments: [{"payment_method_id": uuid, "amount": numeric, "amount_tendered": numeric,
--               "installments": int, "reference": text}]
-- El precio SIEMPRE lo toma el servidor (precio vigente de la variante).
create function public.register_sale(
  p_items             jsonb,
  p_payments          jsonb,
  p_client_request_id uuid,
  p_customer_id       uuid default null,
  p_discount_amount   numeric default 0,
  p_notes             text default null,
  p_session_id        uuid default null
)
returns public.sales
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale        public.sales;
  v_session     uuid;
  v_line        record;
  v_pay         record;
  v_item_id     uuid;
  v_subtotal    numeric(14, 2) := 0;
  v_line_disc   numeric(14, 2) := 0;
  v_general     numeric(14, 2) := coalesce(p_discount_amount, 0);
  v_remaining   numeric(14, 2);
  v_share       numeric(14, 2);
  v_gross       numeric(14, 2);
  v_disc        numeric(14, 2);
  v_total       numeric(14, 2);
  v_pay_total   numeric(14, 2) := 0;
  v_negative    boolean;
  v_available   integer;
  v_cost        numeric(14, 4);
  v_max_pct     numeric;
  v_tendered    numeric(14, 2);
  v_change      numeric(14, 2);
  v_method      public.payment_methods;
  v_seller      text;
  v_n_lines     integer;
  v_idx         integer := 0;
  v_lines       jsonb := '[]'::jsonb;
begin
  perform public.require_role('owner', 'manager', 'cashier');

  if p_client_request_id is null then
    raise exception 'Falta el identificador de la operación' using errcode = '22023';
  end if;
  -- Idempotencia: el mismo request devuelve la venta ya creada.
  select * into v_sale from public.sales where client_request_id = p_client_request_id;
  if found then
    if v_sale.created_by <> auth.uid() then
      raise exception 'Identificador de operación en uso' using errcode = '23505';
    end if;
    return v_sale;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene productos' using errcode = '22023';
  end if;
  if p_payments is null or jsonb_typeof(p_payments) <> 'array' or jsonb_array_length(p_payments) = 0 then
    raise exception 'La venta no tiene pagos' using errcode = '22023';
  end if;
  if v_general < 0 then
    raise exception 'El descuento no puede ser negativo' using errcode = '22023';
  end if;

  v_session := public.internal_find_open_session(p_session_id);
  if v_session is null then
    raise exception 'No hay una caja abierta: abrila antes de vender' using errcode = '23514';
  end if;
  perform 1 from public.cash_sessions where id = v_session for share;

  select coalesce((select value = 'true'::jsonb from public.app_settings
                   where key = 'allow_negative_stock'), false) into v_negative;

  -- 1) Validaciones básicas de ítems
  if exists (
    select 1 from jsonb_to_recordset(p_items) as x(variant_id uuid, quantity integer, discount_amount numeric)
    where x.variant_id is null or x.quantity is null or x.quantity <= 0 or coalesce(x.discount_amount, 0) < 0
  ) then
    raise exception 'Hay ítems con cantidad o descuento inválido' using errcode = '22023';
  end if;

  -- 2) Líneas agrupadas por variante con los datos vigentes (precio del servidor), en orden estable
  --    (evita deadlocks entre ventas simultáneas)
  select coalesce(jsonb_agg(l order by l.variant_id), '[]'::jsonb) into v_lines
  from (
    select v.id as variant_id, g.quantity, g.discount_amount,
           v.price, v.sku, v.ean, (v.active and p.active) as sellable,
           p.code as product_code, p.name as product_name,
           c.name as color_name, s.name as size_name
    from (
      select x.variant_id, sum(x.quantity)::integer as quantity,
             coalesce(sum(x.discount_amount), 0) as discount_amount
      from jsonb_to_recordset(p_items) as x(variant_id uuid, quantity integer, discount_amount numeric)
      group by x.variant_id
    ) g
    join public.product_variants v on v.id = g.variant_id
    join public.products p on p.id = v.product_id
    join public.colors c on c.id = v.color_id
    join public.sizes s on s.id = v.size_id
  ) l;

  if jsonb_array_length(v_lines) <> (
    select count(distinct x.variant_id) from jsonb_to_recordset(p_items) as x(variant_id uuid)
  ) then
    raise exception 'Hay variantes inexistentes en la venta' using errcode = 'P0002';
  end if;

  -- subtotal y descuentos por línea
  for v_line in
    select * from jsonb_to_recordset(v_lines)
      as x(variant_id uuid, quantity integer, discount_amount numeric, price numeric, sku text,
           ean text, sellable boolean, product_code text, product_name text,
           color_name text, size_name text)
  loop
    if not v_line.sellable then
      raise exception 'La variante % está inactiva', v_line.sku using errcode = '23514';
    end if;
    v_gross := round(v_line.price * v_line.quantity, 2);
    if v_line.discount_amount > v_gross then
      raise exception 'El descuento del ítem % supera su importe', v_line.sku using errcode = '22023';
    end if;
    v_subtotal := v_subtotal + v_gross;
    v_line_disc := v_line_disc + v_line.discount_amount;
  end loop;

  if v_general > v_subtotal - v_line_disc then
    raise exception 'El descuento general supera el total de la venta' using errcode = '22023';
  end if;

  v_total := v_subtotal - v_line_disc - v_general;
  if v_total <= 0 then
    raise exception 'El total de la venta debe ser mayor a 0' using errcode = '22023';
  end if;

  -- Tope de descuento para vendedores/cajeros
  if public.auth_role() = 'cashier' and v_subtotal > 0 then
    select coalesce((select (value #>> '{}')::numeric from public.app_settings
                     where key = 'cashier_max_discount_pct'), 10) into v_max_pct;
    if (v_subtotal - v_total) * 100 > v_max_pct * v_subtotal then
      raise exception 'El descuento supera el máximo permitido para tu rol (% %%)', v_max_pct
        using errcode = '42501';
    end if;
  end if;

  -- 3) Pagos: deben sumar exactamente el total
  select coalesce(sum(round(x.amount, 2)), 0) into v_pay_total
  from jsonb_to_recordset(p_payments) as x(amount numeric);
  if v_pay_total <> v_total then
    raise exception 'Los pagos (%) no coinciden con el total (%)', v_pay_total, v_total
      using errcode = '22023';
  end if;

  select full_name into v_seller from public.profiles where id = auth.uid();

  insert into public.sales
    (cash_session_id, customer_id, subtotal, discount_amount, total, notes, client_request_id, seller_name)
  values
    (v_session, p_customer_id, v_subtotal, v_line_disc + v_general, v_total, p_notes,
     p_client_request_id, v_seller)
  returning * into v_sale;

  -- 4) Ítems + costo + stock. El descuento general se prorratea por línea (el resto va a la última).
  v_remaining := v_general;
  v_n_lines := jsonb_array_length(v_lines);
  for v_line in
    select * from jsonb_to_recordset(v_lines)
      as x(variant_id uuid, quantity integer, discount_amount numeric, price numeric, sku text,
           ean text, sellable boolean, product_code text, product_name text,
           color_name text, size_name text)
    order by x.variant_id
  loop
    v_idx := v_idx + 1;
    v_gross := round(v_line.price * v_line.quantity, 2);
    if v_idx = v_n_lines then
      v_share := v_remaining;
    else
      v_share := round(v_general * (v_gross - v_line.discount_amount) / (v_subtotal - v_line_disc), 2);
      v_share := least(v_share, v_remaining);
    end if;
    v_remaining := v_remaining - v_share;
    v_disc := v_line.discount_amount + v_share;

    -- Stock disponible (bloquea el saldo hasta el fin de la transacción)
    select quantity into v_available from public.stock_levels where variant_id = v_line.variant_id for update;
    if v_available < v_line.quantity and not v_negative then
      raise exception 'Stock insuficiente para % (disponible %, pedido %)',
        v_line.sku, v_available, v_line.quantity using errcode = '23514';
    end if;

    insert into public.sale_items
      (sale_id, variant_id, quantity, unit_price, discount_amount, line_total,
       product_code, product_name, sku, ean, color_name, size_name)
    values
      (v_sale.id, v_line.variant_id, v_line.quantity, v_line.price, v_disc, v_gross - v_disc,
       v_line.product_code, v_line.product_name, v_line.sku, v_line.ean, v_line.color_name, v_line.size_name)
    returning id into v_item_id;

    select avg_cost into v_cost from public.variant_costs where variant_id = v_line.variant_id;
    insert into public.sale_item_costs (sale_item_id, unit_cost) values (v_item_id, coalesce(v_cost, 0));

    perform public.internal_post_stock_movement(
      v_line.variant_id, 'sale_out', -v_line.quantity, v_cost,
      'Venta #' || v_sale.number, 'sale', v_sale.id, null
    );
  end loop;

  -- 5) Pagos + movimientos de caja
  for v_pay in
    select * from jsonb_to_recordset(p_payments)
      as x(payment_method_id uuid, amount numeric, amount_tendered numeric,
           installments integer, reference text)
  loop
    select * into v_method from public.payment_methods
    where id = v_pay.payment_method_id and active;
    if not found then
      raise exception 'Medio de pago inexistente o inactivo' using errcode = 'P0002';
    end if;
    if v_pay.amount is null or round(v_pay.amount, 2) <= 0 then
      raise exception 'Cada pago debe ser mayor a 0' using errcode = '22023';
    end if;

    v_tendered := null;
    v_change := 0;
    if v_method.is_cash then
      v_tendered := coalesce(round(v_pay.amount_tendered, 2), round(v_pay.amount, 2));
      if v_tendered < round(v_pay.amount, 2) then
        raise exception 'El efectivo recibido es menor al monto a cobrar' using errcode = '22023';
      end if;
      v_change := v_tendered - round(v_pay.amount, 2);
    end if;

    insert into public.sale_payments
      (sale_id, payment_method_id, amount, amount_tendered, change_given, installments,
       reference, method_name, is_cash)
    values
      (v_sale.id, v_method.id, round(v_pay.amount, 2), v_tendered, v_change,
       case when v_method.code = 'credit' then v_pay.installments end,
       nullif(btrim(coalesce(v_pay.reference, '')), ''), v_method.name, v_method.is_cash);

    -- Entra a caja solo el neto cobrado (el vuelto no).
    perform public.internal_post_cash_movement(
      v_session, v_method.id, 'sale', 'in', round(v_pay.amount, 2),
      'Venta #' || v_sale.number, 'sale', v_sale.id
    );
  end loop;

  return v_sale;
end;
$$;

-- ---------------------------------------------------------------------------
-- Anular una venta: repone stock y revierte los cobros en la caja abierta actual
-- ---------------------------------------------------------------------------
create function public.void_sale(p_sale_id uuid, p_reason text)
returns public.sales
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale    public.sales;
  v_session uuid;
  v_item    record;
  v_pay     record;
begin
  perform public.require_role('owner', 'manager');
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'El motivo es obligatorio' using errcode = '22023';
  end if;

  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'Venta inexistente' using errcode = 'P0002';
  end if;
  if v_sale.status = 'voided' then
    raise exception 'La venta ya está anulada' using errcode = '23514';
  end if;
  if exists (select 1 from public.sale_returns where sale_id = p_sale_id) then
    raise exception 'La venta tiene devoluciones: no se puede anular' using errcode = '23514';
  end if;

  v_session := public.internal_find_open_session(null);
  if v_session is null then
    raise exception 'Abrí una caja para registrar el reintegro de la anulación' using errcode = '23514';
  end if;
  perform 1 from public.cash_sessions where id = v_session for share;

  for v_item in
    select i.variant_id, i.quantity from public.sale_items i
    where i.sale_id = p_sale_id order by i.variant_id
  loop
    perform public.internal_post_stock_movement(
      v_item.variant_id, 'sale_void_in', v_item.quantity,
      (select avg_cost from public.variant_costs where variant_id = v_item.variant_id),
      'Anulación venta #' || v_sale.number, 'sale', p_sale_id, null
    );
  end loop;

  for v_pay in select * from public.sale_payments where sale_id = p_sale_id
  loop
    perform public.internal_post_cash_movement(
      v_session, v_pay.payment_method_id, 'sale_void', 'out', v_pay.amount,
      'Anulación venta #' || v_sale.number, 'sale', p_sale_id
    );
  end loop;

  update public.sales
  set status = 'voided', voided_by = auth.uid(), voided_at = now(), void_reason = btrim(p_reason)
  where id = p_sale_id
  returning * into v_sale;
  return v_sale;
end;
$$;

-- ---------------------------------------------------------------------------
-- Devolución (total o parcial). El reembolso sale de la caja abierta actual.
-- p_items: [{"sale_item_id": uuid, "quantity": int}]
-- ---------------------------------------------------------------------------
create function public.register_return(
  p_sale_id          uuid,
  p_items            jsonb,
  p_refund_method_id uuid,
  p_reason           text,
  p_restock          boolean default true,
  p_session_id       uuid default null
)
returns public.sale_returns
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale      public.sales;
  v_return    public.sale_returns;
  v_session   uuid;
  v_line      record;
  v_item      public.sale_items;
  v_already   integer;
  v_refunded  numeric(14, 2);
  v_refund    numeric(14, 2);
  v_total     numeric(14, 2) := 0;
  v_calc      jsonb := '[]'::jsonb;
  v_restock   boolean := coalesce(p_restock, true);
begin
  perform public.require_role('owner', 'manager', 'cashier');
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'El motivo es obligatorio' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'No hay ítems para devolver' using errcode = '22023';
  end if;

  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'Venta inexistente' using errcode = 'P0002';
  end if;
  if v_sale.status <> 'completed' then
    raise exception 'La venta está anulada' using errcode = '23514';
  end if;
  if v_sale.created_by <> auth.uid() and not public.has_role('owner', 'manager') then
    raise exception 'Solo podés devolver tus propias ventas' using errcode = '42501';
  end if;

  if not exists (select 1 from public.payment_methods where id = p_refund_method_id and active) then
    raise exception 'Medio de reintegro inexistente o inactivo' using errcode = 'P0002';
  end if;

  v_session := public.internal_find_open_session(p_session_id);
  if v_session is null then
    raise exception 'Abrí una caja para registrar el reintegro' using errcode = '23514';
  end if;
  perform 1 from public.cash_sessions where id = v_session for share;

  -- 1) Calcular el reembolso de cada ítem
  for v_line in
    select x.sale_item_id, sum(x.quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as x(sale_item_id uuid, quantity integer)
    group by x.sale_item_id
    order by x.sale_item_id
  loop
    if v_line.quantity is null or v_line.quantity <= 0 then
      raise exception 'Cantidad inválida' using errcode = '22023';
    end if;
    select * into v_item from public.sale_items
    where id = v_line.sale_item_id and sale_id = p_sale_id;
    if not found then
      raise exception 'El ítem no pertenece a la venta' using errcode = 'P0002';
    end if;

    select coalesce(sum(quantity), 0), coalesce(sum(refund_amount), 0)
    into v_already, v_refunded
    from public.sale_return_items where sale_item_id = v_item.id;

    if v_line.quantity > v_item.quantity - v_already then
      raise exception 'Se devuelve más de lo vendido para %', v_item.sku using errcode = '23514';
    end if;

    -- Reembolso proporcional al precio efectivamente pagado; la última unidad toma el resto exacto.
    if v_line.quantity = v_item.quantity - v_already then
      v_refund := v_item.line_total - v_refunded;
    else
      v_refund := round(v_item.line_total * v_line.quantity / v_item.quantity, 2);
    end if;

    v_total := v_total + v_refund;
    v_calc := v_calc || jsonb_build_object(
      'sale_item_id', v_item.id, 'variant_id', v_item.variant_id,
      'quantity', v_line.quantity, 'refund_amount', v_refund);
  end loop;

  -- 2) Cabecera, ítems, stock y caja
  insert into public.sale_returns (sale_id, cash_session_id, refund_method_id, refund_amount, restock, reason)
  values (p_sale_id, v_session, p_refund_method_id, v_total, v_restock, btrim(p_reason))
  returning * into v_return;

  for v_line in
    select * from jsonb_to_recordset(v_calc)
      as x(sale_item_id uuid, variant_id uuid, quantity integer, refund_amount numeric)
  loop
    insert into public.sale_return_items (return_id, sale_item_id, variant_id, quantity, refund_amount)
    values (v_return.id, v_line.sale_item_id, v_line.variant_id, v_line.quantity, v_line.refund_amount);

    if v_restock then
      perform public.internal_post_stock_movement(
        v_line.variant_id, 'sale_return_in', v_line.quantity,
        (select unit_cost from public.sale_item_costs where sale_item_id = v_line.sale_item_id),
        'Devolución venta #' || v_sale.number, 'sale_return', v_return.id, null
      );
    end if;
  end loop;

  if v_total > 0 then
    perform public.internal_post_cash_movement(
      v_session, p_refund_method_id, 'sale_refund', 'out', v_total,
      'Devolución venta #' || v_sale.number, 'sale_return', v_return.id
    );
  end if;
  return v_return;
end;
$$;
