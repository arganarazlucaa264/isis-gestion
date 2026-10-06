-- Etapa 8 · Compras, pagos a proveedores y cuenta corriente
-- Cuenta corriente = ledger inmutable con signo (+ aumenta la deuda, - la reduce).
-- Una compra se recibe una sola vez: ahí entra el stock, se actualiza el costo y se asienta la deuda.

create type public.supplier_ledger_type as enum (
  'purchase', 'payment', 'payment_void', 'credit_note', 'adjustment', 'opening_balance'
);

create table public.purchases (
  id              uuid primary key default gen_random_uuid(),
  number          bigint generated always as identity unique,
  supplier_id     uuid not null references public.suppliers (id) on delete restrict,
  invoice_number  text,
  purchase_date   date not null default public.business_date(),
  due_date        date,
  status          text not null default 'draft' check (status in ('draft', 'received', 'cancelled')),
  subtotal        numeric(14, 2) not null default 0 check (subtotal >= 0),
  discount_amount numeric(14, 2) not null default 0 check (discount_amount >= 0),
  tax_amount      numeric(14, 2) not null default 0 check (tax_amount >= 0),
  total           numeric(14, 2) not null default 0 check (total >= 0),
  paid_amount     numeric(14, 2) not null default 0 check (paid_amount >= 0),
  payment_status  text not null default 'pending' check (payment_status in ('pending', 'partial', 'paid')),
  notes           text,
  supplier_name   text,                                     -- snapshot
  received_at     timestamptz,
  received_by     uuid references public.profiles (id),
  cancelled_at    timestamptz,
  cancelled_by    uuid references public.profiles (id),
  cancel_reason   text,
  created_by      uuid not null default auth.uid() references public.profiles (id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint purchases_total_chk check (total = subtotal - discount_amount + tax_amount)
);
create index purchases_supplier_idx on public.purchases (supplier_id, purchase_date desc);
create index purchases_date_idx on public.purchases (purchase_date desc);
create index purchases_open_idx on public.purchases (supplier_id, purchase_date)
  where status = 'received' and payment_status <> 'paid';

create table public.purchase_items (
  id          uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases (id) on delete restrict,
  variant_id  uuid not null references public.product_variants (id) on delete restrict,
  quantity    integer not null check (quantity > 0),
  unit_cost   numeric(14, 4) not null check (unit_cost >= 0),
  line_total  numeric(14, 2) not null check (line_total >= 0),
  -- snapshot
  product_name text not null,
  sku          text not null,
  color_name   text not null,
  size_name    text not null,
  unique (purchase_id, variant_id)
);
create index purchase_items_purchase_idx on public.purchase_items (purchase_id);
create index purchase_items_variant_idx on public.purchase_items (variant_id);

create table public.supplier_payments (
  id                uuid primary key default gen_random_uuid(),
  number            bigint generated always as identity unique,
  supplier_id       uuid not null references public.suppliers (id) on delete restrict,
  payment_method_id uuid not null references public.payment_methods (id) on delete restrict,
  amount            numeric(14, 2) not null check (amount > 0),
  paid_at           timestamptz not null default now(),
  cash_session_id   uuid references public.cash_sessions (id) on delete restrict,  -- si salió de la caja
  reference         text,
  notes             text,
  created_by        uuid not null default auth.uid() references public.profiles (id),
  created_at        timestamptz not null default now(),
  voided_at         timestamptz,
  voided_by         uuid references public.profiles (id),
  void_reason       text
);
create index supplier_payments_supplier_idx on public.supplier_payments (supplier_id, paid_at desc);

create table public.supplier_payment_allocations (
  payment_id  uuid not null references public.supplier_payments (id) on delete restrict,
  purchase_id uuid not null references public.purchases (id) on delete restrict,
  amount      numeric(14, 2) not null check (amount > 0),
  primary key (payment_id, purchase_id)
);
create index supplier_payment_alloc_purchase_idx on public.supplier_payment_allocations (purchase_id);

create table public.supplier_ledger (
  id             bigint generated always as identity primary key,
  supplier_id    uuid not null references public.suppliers (id) on delete restrict,
  entry_type     public.supplier_ledger_type not null,
  amount         numeric(14, 2) not null check (amount <> 0),   -- + debemos más, - debemos menos
  reference_type text,
  reference_id   uuid,
  entry_date     date not null default public.business_date(),
  notes          text,
  created_by     uuid default auth.uid(),
  created_at     timestamptz not null default now()
);
create index supplier_ledger_supplier_idx on public.supplier_ledger (supplier_id, id);

create function public.supplier_ledger_block_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'supplier_ledger es inmutable (% no permitido): corregí con un asiento inverso', tg_op
    using errcode = '42501';
end;
$$;
create trigger supplier_ledger_no_update_delete before update or delete on public.supplier_ledger
  for each row execute function public.supplier_ledger_block_changes();
create trigger supplier_ledger_no_truncate before truncate on public.supplier_ledger
  for each statement execute function public.supplier_ledger_block_changes();

create trigger purchases_set_updated_at before update on public.purchases
  for each row execute function public.set_updated_at();
create trigger purchases_audit after insert or update on public.purchases
  for each row execute function public.audit_trigger('id');
create trigger supplier_payments_audit after insert or update on public.supplier_payments
  for each row execute function public.audit_trigger('id');

-- Una compra recibida es inmutable (salvo estado de pago y anulación, que hace el RPC).
create function public.purchases_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status in ('received', 'cancelled')
     and (new.supplier_id, new.subtotal, new.discount_amount, new.tax_amount, new.total,
          new.purchase_date, new.invoice_number)
         is distinct from
         (old.supplier_id, old.subtotal, old.discount_amount, old.tax_amount, old.total,
          old.purchase_date, old.invoice_number) then
    raise exception 'Una compra recibida o anulada no se puede modificar' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger purchases_guard_update_trg before update on public.purchases
  for each row execute function public.purchases_guard_update();

create function public.purchase_items_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
begin
  select status into v_status from public.purchases
  where id = case when tg_op = 'DELETE' then old.purchase_id else new.purchase_id end;
  if v_status <> 'draft' then
    raise exception 'Solo se pueden modificar los ítems de una compra en borrador' using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
create trigger purchase_items_guard_trg before insert or update or delete on public.purchase_items
  for each row execute function public.purchase_items_guard();

-- ---------------------------------------------------------------------------
-- RLS (lectura: dueño, encargado, depósito y solo lectura; escritura solo por RPC)
-- ---------------------------------------------------------------------------
select public.secure_table('public.purchases',
  array['owner', 'manager', 'stock_clerk', 'viewer']::public.app_role[]);
select public.secure_table('public.purchase_items',
  array['owner', 'manager', 'stock_clerk', 'viewer']::public.app_role[]);
select public.secure_table('public.supplier_payments',
  array['owner', 'manager', 'viewer']::public.app_role[]);
select public.secure_table('public.supplier_payment_allocations',
  array['owner', 'manager', 'viewer']::public.app_role[]);
select public.secure_table('public.supplier_ledger',
  array['owner', 'manager', 'viewer']::public.app_role[]);

-- ---------------------------------------------------------------------------
-- Vistas
-- ---------------------------------------------------------------------------
create view public.v_supplier_balances with (security_invoker = true) as
select
  s.id as supplier_id,
  s.name,
  s.active,
  s.payment_terms_days,
  coalesce(sum(l.amount), 0)::numeric(14, 2) as balance,
  (select coalesce(sum(p.total - p.paid_amount), 0)
     from public.purchases p
    where p.supplier_id = s.id and p.status = 'received' and p.payment_status <> 'paid'
      and p.due_date is not null and p.due_date < public.business_date())::numeric(14, 2) as overdue_amount,
  (select min(p.due_date)
     from public.purchases p
    where p.supplier_id = s.id and p.status = 'received' and p.payment_status <> 'paid') as next_due_date
from public.suppliers s
left join public.supplier_ledger l on l.supplier_id = s.id
group by s.id;

-- Estado de cuenta con saldo acumulado
create view public.v_supplier_statement with (security_invoker = true) as
select
  l.id, l.supplier_id, l.entry_date, l.entry_type, l.amount, l.reference_type, l.reference_id,
  l.notes, l.created_at, l.created_by,
  sum(l.amount) over (partition by l.supplier_id order by l.id)::numeric(14, 2) as running_balance
from public.supplier_ledger l;

-- ---------------------------------------------------------------------------
-- Funciones internas
-- ---------------------------------------------------------------------------
create function public.internal_post_supplier_ledger(
  p_supplier_id uuid,
  p_type        public.supplier_ledger_type,
  p_amount      numeric,
  p_ref_type    text default null,
  p_ref_id      uuid default null,
  p_notes       text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  insert into public.supplier_ledger (supplier_id, entry_type, amount, reference_type, reference_id, notes)
  values (p_supplier_id, p_type, p_amount, p_ref_type, p_ref_id, p_notes)
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.internal_post_supplier_ledger(uuid, public.supplier_ledger_type, numeric, text, uuid, text)
  from public, anon, authenticated;

-- Recalcula paid_amount y payment_status de una compra desde las asignaciones vigentes.
create function public.internal_refresh_purchase_payment(p_purchase_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paid  numeric(14, 2);
  v_total numeric(14, 2);
begin
  select coalesce(sum(a.amount), 0) into v_paid
  from public.supplier_payment_allocations a
  join public.supplier_payments sp on sp.id = a.payment_id and sp.voided_at is null
  where a.purchase_id = p_purchase_id;

  select total into v_total from public.purchases where id = p_purchase_id;

  update public.purchases
  set paid_amount = v_paid,
      payment_status = case when v_paid >= v_total and v_total > 0 then 'paid'
                            when v_paid > 0 then 'partial'
                            else 'pending' end
  where id = p_purchase_id;
end;
$$;
revoke execute on function public.internal_refresh_purchase_payment(uuid) from public, anon, authenticated;

-- Registra un pago, lo asigna (a compras indicadas o FIFO) y asienta en el ledger y la caja.
create function public.internal_register_supplier_payment(
  p_supplier_id       uuid,
  p_payment_method_id uuid,
  p_amount            numeric,
  p_paid_at           timestamptz,
  p_reference         text,
  p_notes             text,
  p_allocations       jsonb,
  p_from_register     boolean,
  p_session_id        uuid
)
returns public.supplier_payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment   public.supplier_payments;
  v_session   uuid;
  v_remaining numeric(14, 2) := round(p_amount, 2);
  v_alloc     record;
  v_purchase  public.purchases;
  v_open      numeric(14, 2);
  v_apply     numeric(14, 2);
  v_active    boolean;
begin
  if p_amount is null or round(p_amount, 2) <= 0 then
    raise exception 'El monto del pago debe ser mayor a 0' using errcode = '22023';
  end if;
  if not exists (select 1 from public.suppliers where id = p_supplier_id) then
    raise exception 'Proveedor inexistente' using errcode = 'P0002';
  end if;
  select active into v_active from public.payment_methods where id = p_payment_method_id;
  if v_active is distinct from true then
    raise exception 'Medio de pago inexistente o inactivo' using errcode = 'P0002';
  end if;

  if coalesce(p_from_register, false) then
    v_session := public.internal_find_open_session(p_session_id);
    if v_session is null then
      raise exception 'Para pagar desde la caja necesitás una caja abierta' using errcode = '23514';
    end if;
    perform 1 from public.cash_sessions where id = v_session for share;
  end if;

  insert into public.supplier_payments
    (supplier_id, payment_method_id, amount, paid_at, cash_session_id, reference, notes)
  values
    (p_supplier_id, p_payment_method_id, round(p_amount, 2), coalesce(p_paid_at, now()), v_session,
     nullif(btrim(coalesce(p_reference, '')), ''), p_notes)
  returning * into v_payment;

  if p_allocations is not null and jsonb_typeof(p_allocations) = 'array'
     and jsonb_array_length(p_allocations) > 0 then
    -- Asignación explícita
    for v_alloc in
      select x.purchase_id, round(sum(x.amount), 2) as amount
      from jsonb_to_recordset(p_allocations) as x(purchase_id uuid, amount numeric)
      group by x.purchase_id order by x.purchase_id
    loop
      select * into v_purchase from public.purchases
      where id = v_alloc.purchase_id and supplier_id = p_supplier_id and status = 'received' for update;
      if not found then
        raise exception 'La compra a asignar no existe, no es del proveedor o no está recibida'
          using errcode = 'P0002';
      end if;
      if v_alloc.amount is null or v_alloc.amount <= 0 then
        raise exception 'Monto de asignación inválido' using errcode = '22023';
      end if;
      v_open := v_purchase.total - v_purchase.paid_amount;
      if v_alloc.amount > v_open then
        raise exception 'La asignación supera lo adeudado de la compra #%', v_purchase.number
          using errcode = '22023';
      end if;
      if v_alloc.amount > v_remaining then
        raise exception 'Las asignaciones superan el monto del pago' using errcode = '22023';
      end if;
      insert into public.supplier_payment_allocations (payment_id, purchase_id, amount)
      values (v_payment.id, v_purchase.id, v_alloc.amount);
      v_remaining := v_remaining - v_alloc.amount;
      perform public.internal_refresh_purchase_payment(v_purchase.id);
    end loop;
  else
    -- FIFO: compras recibidas con saldo, de la más antigua a la más nueva
    for v_purchase in
      select * from public.purchases
      where supplier_id = p_supplier_id and status = 'received' and payment_status <> 'paid'
      order by purchase_date, number
      for update
    loop
      exit when v_remaining <= 0;
      v_open := v_purchase.total - v_purchase.paid_amount;
      continue when v_open <= 0;
      v_apply := least(v_open, v_remaining);
      insert into public.supplier_payment_allocations (payment_id, purchase_id, amount)
      values (v_payment.id, v_purchase.id, v_apply);
      v_remaining := v_remaining - v_apply;
      perform public.internal_refresh_purchase_payment(v_purchase.id);
    end loop;
  end if;
  -- Lo no asignado queda como saldo a favor (anticipo) en la cuenta corriente.

  perform public.internal_post_supplier_ledger(
    p_supplier_id, 'payment', -v_payment.amount, 'supplier_payment', v_payment.id,
    'Pago #' || v_payment.number
  );

  if v_session is not null then
    perform public.internal_post_cash_movement(
      v_session, p_payment_method_id, 'supplier_payment', 'out', v_payment.amount,
      'Pago a proveedor #' || v_payment.number, 'supplier_payment', v_payment.id
    );
  end if;
  return v_payment;
end;
$$;
revoke execute on function public.internal_register_supplier_payment(uuid, uuid, numeric, timestamptz, text, text, jsonb, boolean, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC: compras
-- ---------------------------------------------------------------------------
-- p_items: [{"variant_id": uuid, "quantity": int, "unit_cost": numeric}]
-- Crea (p_purchase_id NULL) o reemplaza el contenido de una compra en borrador.
create function public.save_purchase(
  p_purchase_id     uuid,
  p_supplier_id     uuid,
  p_invoice_number  text,
  p_purchase_date   date,
  p_due_date        date,
  p_discount_amount numeric,
  p_tax_amount      numeric,
  p_notes           text,
  p_items           jsonb
)
returns public.purchases
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_purchase public.purchases;
  v_supplier public.suppliers;
  v_subtotal numeric(14, 2);
  v_discount numeric(14, 2) := coalesce(round(p_discount_amount, 2), 0);
  v_tax      numeric(14, 2) := coalesce(round(p_tax_amount, 2), 0);
  v_date     date := coalesce(p_purchase_date, public.business_date());
begin
  perform public.require_role('owner', 'manager');

  select * into v_supplier from public.suppliers where id = p_supplier_id and active;
  if not found then
    raise exception 'Proveedor inexistente o inactivo' using errcode = 'P0002';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La compra no tiene productos' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_items) as x(variant_id uuid, quantity integer, unit_cost numeric)
    where x.variant_id is null or x.quantity is null or x.quantity <= 0
       or x.unit_cost is null or x.unit_cost < 0
  ) then
    raise exception 'Hay ítems con cantidad o costo inválido' using errcode = '22023';
  end if;
  if v_discount < 0 or v_tax < 0 then
    raise exception 'Descuento e impuestos no pueden ser negativos' using errcode = '22023';
  end if;

  select coalesce(sum(round(x.quantity * x.unit_cost, 2)), 0) into v_subtotal
  from jsonb_to_recordset(p_items) as x(variant_id uuid, quantity integer, unit_cost numeric);
  if v_discount > v_subtotal then
    raise exception 'El descuento supera el subtotal' using errcode = '22023';
  end if;

  if p_purchase_id is null then
    insert into public.purchases
      (supplier_id, invoice_number, purchase_date, due_date, discount_amount, tax_amount,
       subtotal, total, notes, supplier_name)
    values
      (p_supplier_id, nullif(btrim(coalesce(p_invoice_number, '')), ''), v_date,
       coalesce(p_due_date, v_date + v_supplier.payment_terms_days),
       v_discount, v_tax, v_subtotal, v_subtotal - v_discount + v_tax, p_notes, v_supplier.name)
    returning * into v_purchase;
  else
    select * into v_purchase from public.purchases where id = p_purchase_id for update;
    if not found then
      raise exception 'Compra inexistente' using errcode = 'P0002';
    end if;
    if v_purchase.status <> 'draft' then
      raise exception 'Solo se puede editar una compra en borrador' using errcode = '23514';
    end if;
    update public.purchases
    set supplier_id = p_supplier_id,
        invoice_number = nullif(btrim(coalesce(p_invoice_number, '')), ''),
        purchase_date = v_date,
        due_date = coalesce(p_due_date, v_date + v_supplier.payment_terms_days),
        discount_amount = v_discount, tax_amount = v_tax, subtotal = v_subtotal,
        total = v_subtotal - v_discount + v_tax, notes = p_notes, supplier_name = v_supplier.name
    where id = p_purchase_id
    returning * into v_purchase;
    delete from public.purchase_items where purchase_id = p_purchase_id;
  end if;

  insert into public.purchase_items
    (purchase_id, variant_id, quantity, unit_cost, line_total, product_name, sku, color_name, size_name)
  select v_purchase.id, g.variant_id, g.quantity, g.unit_cost, round(g.quantity * g.unit_cost, 2),
         p.name, v.sku, c.name, s.name
  from (
    select x.variant_id, sum(x.quantity)::integer as quantity,
           -- mismo variante repetida: costo promedio ponderado de las líneas
           (sum(x.quantity * x.unit_cost) / sum(x.quantity))::numeric(14, 4) as unit_cost
    from jsonb_to_recordset(p_items) as x(variant_id uuid, quantity integer, unit_cost numeric)
    group by x.variant_id
  ) g
  join public.product_variants v on v.id = g.variant_id
  join public.products p on p.id = v.product_id
  join public.colors c on c.id = v.color_id
  join public.sizes s on s.id = v.size_id;

  if (select count(*) from public.purchase_items where purchase_id = v_purchase.id) <>
     (select count(distinct x.variant_id) from jsonb_to_recordset(p_items) as x(variant_id uuid)) then
    raise exception 'Hay variantes inexistentes en la compra' using errcode = 'P0002';
  end if;

  -- El subtotal se recalcula desde los ítems efectivamente guardados.
  update public.purchases p
  set subtotal = t.sub, total = t.sub - p.discount_amount + p.tax_amount
  from (select coalesce(sum(line_total), 0) as sub from public.purchase_items where purchase_id = v_purchase.id) t
  where p.id = v_purchase.id
  returning p.* into v_purchase;
  if v_purchase.discount_amount > v_purchase.subtotal then
    raise exception 'El descuento supera el subtotal' using errcode = '22023';
  end if;
  return v_purchase;
end;
$$;

-- Recepción: stock + costo promedio ponderado + deuda en la cuenta corriente.
-- p_payment (opcional): {"payment_method_id": uuid, "amount": numeric, "reference": text, "from_register": bool}
create function public.receive_purchase(p_purchase_id uuid, p_payment jsonb default null)
returns public.purchases
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_purchase  public.purchases;
  v_item      record;
  v_factor    numeric;
  v_eff_cost  numeric(14, 4);
  v_stock     integer;
  v_avg       numeric(14, 4);
  v_new_avg   numeric(14, 4);
  v_pay_amount numeric(14, 2);
begin
  perform public.require_role('owner', 'manager', 'stock_clerk');

  select * into v_purchase from public.purchases where id = p_purchase_id for update;
  if not found then
    raise exception 'Compra inexistente' using errcode = 'P0002';
  end if;
  if v_purchase.status <> 'draft' then
    raise exception 'La compra ya fue recibida o anulada' using errcode = '23514';
  end if;
  if v_purchase.total <= 0 then
    raise exception 'El total de la compra debe ser mayor a 0' using errcode = '22023';
  end if;
  if p_payment is not null then
    -- Pagar requiere permisos de pago (el depósito solo recibe mercadería).
    perform public.require_role('owner', 'manager');
    v_pay_amount := round((p_payment ->> 'amount')::numeric, 2);
    if v_pay_amount is null or v_pay_amount <= 0 or v_pay_amount > v_purchase.total then
      raise exception 'Monto de pago inválido' using errcode = '22023';
    end if;
  end if;

  -- El descuento general se prorratea en el costo; los impuestos NO integran el costo (crédito fiscal).
  v_factor := case when v_purchase.subtotal > 0
                   then (v_purchase.subtotal - v_purchase.discount_amount) / v_purchase.subtotal
                   else 1 end;

  for v_item in
    select * from public.purchase_items where purchase_id = p_purchase_id order by variant_id
  loop
    v_eff_cost := round(v_item.unit_cost * v_factor, 4);

    select quantity into v_stock from public.stock_levels where variant_id = v_item.variant_id for update;
    select avg_cost into v_avg from public.variant_costs where variant_id = v_item.variant_id for update;

    v_new_avg := case when greatest(v_stock, 0) + v_item.quantity > 0
                      then round((greatest(v_stock, 0) * v_avg + v_item.quantity * v_eff_cost)
                                 / (greatest(v_stock, 0) + v_item.quantity), 4)
                      else v_eff_cost end;

    perform public.internal_post_stock_movement(
      v_item.variant_id, 'purchase_in', v_item.quantity, v_eff_cost,
      'Compra #' || v_purchase.number, 'purchase', p_purchase_id, null
    );

    update public.variant_costs
    set last_cost = v_eff_cost, avg_cost = v_new_avg
    where variant_id = v_item.variant_id;
  end loop;

  update public.purchases
  set status = 'received', received_at = now(), received_by = auth.uid()
  where id = p_purchase_id
  returning * into v_purchase;

  perform public.internal_post_supplier_ledger(
    v_purchase.supplier_id, 'purchase', v_purchase.total, 'purchase', v_purchase.id,
    'Compra #' || v_purchase.number || coalesce(' · Fact. ' || v_purchase.invoice_number, '')
  );

  if p_payment is not null then
    perform public.internal_register_supplier_payment(
      v_purchase.supplier_id, (p_payment ->> 'payment_method_id')::uuid, v_pay_amount, now(),
      p_payment ->> 'reference', null,
      jsonb_build_array(jsonb_build_object('purchase_id', v_purchase.id, 'amount', v_pay_amount)),
      coalesce((p_payment ->> 'from_register')::boolean, false), null
    );
    select * into v_purchase from public.purchases where id = p_purchase_id;
  end if;

  return v_purchase;
end;
$$;

-- Anulación: borrador => se cancela sin efectos. Recibida => se revierte stock y deuda con asientos inversos.
create function public.cancel_purchase(p_purchase_id uuid, p_reason text)
returns public.purchases
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_purchase public.purchases;
  v_item     record;
begin
  perform public.require_role('owner', 'manager');
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'El motivo es obligatorio' using errcode = '22023';
  end if;

  select * into v_purchase from public.purchases where id = p_purchase_id for update;
  if not found then
    raise exception 'Compra inexistente' using errcode = 'P0002';
  end if;
  if v_purchase.status = 'cancelled' then
    raise exception 'La compra ya está anulada' using errcode = '23514';
  end if;

  if v_purchase.status = 'received' then
    for v_item in
      select * from public.purchase_items where purchase_id = p_purchase_id order by variant_id
    loop
      perform public.internal_post_stock_movement(
        v_item.variant_id, 'purchase_return_out', -v_item.quantity, v_item.unit_cost,
        'Anulación compra #' || v_purchase.number, 'purchase', p_purchase_id, null
      );
    end loop;
    perform public.internal_post_supplier_ledger(
      v_purchase.supplier_id, 'credit_note', -v_purchase.total, 'purchase', p_purchase_id,
      'Anulación compra #' || v_purchase.number
    );
  end if;

  update public.purchases
  set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = btrim(p_reason)
  where id = p_purchase_id
  returning * into v_purchase;
  return v_purchase;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: pagos y ajustes de cuenta corriente
-- ---------------------------------------------------------------------------
create function public.register_supplier_payment(
  p_supplier_id       uuid,
  p_payment_method_id uuid,
  p_amount            numeric,
  p_paid_at           timestamptz default null,
  p_reference         text default null,
  p_notes             text default null,
  p_allocations       jsonb default null,
  p_from_register     boolean default false,
  p_session_id        uuid default null
)
returns public.supplier_payments
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_role('owner', 'manager');
  return public.internal_register_supplier_payment(
    p_supplier_id, p_payment_method_id, p_amount, p_paid_at, p_reference, p_notes,
    p_allocations, p_from_register, p_session_id
  );
end;
$$;

create function public.void_supplier_payment(p_payment_id uuid, p_reason text)
returns public.supplier_payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.supplier_payments;
  v_alloc   record;
  v_session uuid;
begin
  perform public.require_role('owner', 'manager');
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'El motivo es obligatorio' using errcode = '22023';
  end if;

  select * into v_payment from public.supplier_payments where id = p_payment_id for update;
  if not found then
    raise exception 'Pago inexistente' using errcode = 'P0002';
  end if;
  if v_payment.voided_at is not null then
    raise exception 'El pago ya está anulado' using errcode = '23514';
  end if;

  if v_payment.cash_session_id is not null then
    v_session := public.internal_find_open_session(null);
    if v_session is null then
      raise exception 'Abrí una caja para registrar el reintegro de la anulación' using errcode = '23514';
    end if;
    perform public.internal_post_cash_movement(
      v_session, v_payment.payment_method_id, 'supplier_payment_void', 'in', v_payment.amount,
      'Anulación pago a proveedor #' || v_payment.number, 'supplier_payment', v_payment.id
    );
  end if;

  update public.supplier_payments
  set voided_at = now(), voided_by = auth.uid(), void_reason = btrim(p_reason)
  where id = p_payment_id
  returning * into v_payment;

  for v_alloc in
    select purchase_id from public.supplier_payment_allocations where payment_id = p_payment_id
  loop
    perform public.internal_refresh_purchase_payment(v_alloc.purchase_id);
  end loop;

  perform public.internal_post_supplier_ledger(
    v_payment.supplier_id, 'payment_void', v_payment.amount, 'supplier_payment', v_payment.id,
    'Anulación pago #' || v_payment.number
  );
  return v_payment;
end;
$$;

-- Saldo inicial / ajuste manual (con motivo). amount > 0 aumenta la deuda; < 0 la reduce.
create function public.add_supplier_ledger_entry(
  p_supplier_id uuid,
  p_type        public.supplier_ledger_type,
  p_amount      numeric,
  p_notes       text
)
returns public.supplier_ledger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id     bigint;
  v_result public.supplier_ledger;
begin
  perform public.require_role('owner');
  if p_type not in ('opening_balance', 'adjustment') then
    raise exception 'Tipo de asiento no permitido' using errcode = '22023';
  end if;
  if p_amount is null or round(p_amount, 2) = 0 then
    raise exception 'El importe no puede ser 0' using errcode = '22023';
  end if;
  if p_notes is null or btrim(p_notes) = '' then
    raise exception 'El motivo es obligatorio' using errcode = '22023';
  end if;
  if not exists (select 1 from public.suppliers where id = p_supplier_id) then
    raise exception 'Proveedor inexistente' using errcode = 'P0002';
  end if;
  v_id := public.internal_post_supplier_ledger(p_supplier_id, p_type, round(p_amount, 2), 'manual', null, btrim(p_notes));
  select * into v_result from public.supplier_ledger where id = v_id;
  return v_result;
end;
$$;
