-- Etapa 6 · Caja y gastos
-- Regla de oro: solo los medios de pago con is_cash = true afectan el efectivo físico.
-- Transferencia, débito, crédito, Mercado Pago y otros se registran pero NUNCA suman al efectivo.

create table public.payment_methods (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique check (code ~ '^[a-z][a-z0-9_]*$'),
  name       text not null check (btrim(name) <> ''),
  is_cash    boolean not null,
  active     boolean not null default true,
  sort_order integer not null default 0,
  is_system  boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);

create trigger payment_methods_set_updated_at before update on public.payment_methods
  for each row execute function public.set_updated_at();
create trigger payment_methods_audit after insert or update on public.payment_methods
  for each row execute function public.audit_trigger('id');

-- is_cash y code no se pueden cambiar después de creados: reescribirían la historia de la caja.
create function public.payment_methods_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_cash is distinct from old.is_cash then
    raise exception 'No se puede cambiar si un medio de pago es efectivo' using errcode = '23514';
  end if;
  if new.code is distinct from old.code then
    raise exception 'No se puede cambiar el código de un medio de pago' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger payment_methods_guard_trg before update on public.payment_methods
  for each row execute function public.payment_methods_guard();

insert into public.payment_methods (code, name, is_cash, sort_order, is_system) values
  ('cash', 'Efectivo', true, 1, true),
  ('transfer', 'Transferencia', false, 2, true),
  ('debit', 'Débito', false, 3, true),
  ('credit', 'Crédito', false, 4, true),
  ('mercadopago', 'Mercado Pago', false, 5, true),
  ('other', 'Otros', false, 6, true);

create table public.cash_registers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (btrim(name) <> ''),
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);
create unique index cash_registers_name_uidx on public.cash_registers (lower(btrim(name)));
create trigger cash_registers_set_updated_at before update on public.cash_registers
  for each row execute function public.set_updated_at();
create trigger cash_registers_audit after insert or update on public.cash_registers
  for each row execute function public.audit_trigger('id');

insert into public.cash_registers (name) values ('Caja principal');

create table public.cash_sessions (
  id             uuid primary key default gen_random_uuid(),
  number         bigint generated always as identity unique,
  register_id    uuid not null references public.cash_registers (id) on delete restrict,
  status         text not null default 'open' check (status in ('open', 'closed')),
  opened_by      uuid not null default auth.uid() references public.profiles (id),
  opened_at      timestamptz not null default now(),
  opening_amount numeric(14, 2) not null check (opening_amount >= 0),
  opening_notes  text,
  closed_by      uuid references public.profiles (id),
  closed_at      timestamptz,
  expected_cash  numeric(14, 2),
  counted_cash   numeric(14, 2) check (counted_cash is null or counted_cash >= 0),
  cash_difference numeric(14, 2),
  closing_notes  text,
  reopened_count integer not null default 0,
  updated_at     timestamptz not null default now()
);
create unique index cash_sessions_one_open_per_register
  on public.cash_sessions (register_id) where status = 'open';
create index cash_sessions_opened_idx on public.cash_sessions (opened_at desc);
create index cash_sessions_user_idx on public.cash_sessions (opened_by, status);

create trigger cash_sessions_set_updated_at before update on public.cash_sessions
  for each row execute function public.set_updated_at();
create trigger cash_sessions_audit after insert or update on public.cash_sessions
  for each row execute function public.audit_trigger('id');

create type public.cash_movement_kind as enum (
  'opening_float', 'sale', 'sale_void', 'sale_refund', 'income', 'expense', 'expense_void',
  'withdrawal', 'supplier_payment', 'supplier_payment_void', 'adjustment'
);

create table public.cash_movements (
  id                    bigint generated always as identity primary key,
  cash_session_id       uuid not null references public.cash_sessions (id) on delete restrict,
  payment_method_id     uuid not null references public.payment_methods (id) on delete restrict,
  kind                  public.cash_movement_kind not null,
  direction             text not null check (direction in ('in', 'out')),
  amount                numeric(14, 2) not null check (amount > 0),
  affects_physical_cash boolean not null,   -- lo completa el trigger según payment_methods.is_cash
  description           text,
  reference_type        text,
  reference_id          uuid,
  created_by            uuid default auth.uid(),
  created_at            timestamptz not null default now()
);
create index cash_movements_session_idx on public.cash_movements (cash_session_id, id);
create index cash_movements_ref_idx on public.cash_movements (reference_type, reference_id);

create function public.cash_movements_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status  text;
  v_is_cash boolean;
begin
  select status into v_status from public.cash_sessions where id = new.cash_session_id;
  if v_status is distinct from 'open' then
    raise exception 'La caja está cerrada: no admite movimientos' using errcode = '23514';
  end if;

  select is_cash into v_is_cash from public.payment_methods where id = new.payment_method_id;

  if new.kind in ('opening_float', 'withdrawal') and not v_is_cash then
    raise exception 'El dinero inicial y los retiros solo pueden ser en efectivo' using errcode = '23514';
  end if;

  -- Única fuente de verdad: el efectivo físico lo define el medio de pago, no quien llama.
  new.affects_physical_cash := v_is_cash;
  return new;
end;
$$;
create trigger cash_movements_before_insert_trg before insert on public.cash_movements
  for each row execute function public.cash_movements_before_insert();

create function public.cash_movements_block_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'cash_movements es inmutable (% no permitido): corregí con un movimiento inverso', tg_op
    using errcode = '42501';
end;
$$;
create trigger cash_movements_no_update_delete before update or delete on public.cash_movements
  for each row execute function public.cash_movements_block_changes();
create trigger cash_movements_no_truncate before truncate on public.cash_movements
  for each statement execute function public.cash_movements_block_changes();

create table public.cash_session_totals (
  session_id        uuid not null references public.cash_sessions (id) on delete restrict,
  payment_method_id uuid not null references public.payment_methods (id) on delete restrict,
  total_in          numeric(14, 2) not null,
  total_out         numeric(14, 2) not null,
  expected          numeric(14, 2) not null,       -- in - out
  reported          numeric(14, 2),                -- lo informado por la terminal/banco (opcional)
  primary key (session_id, payment_method_id)
);

create table public.expense_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (btrim(name) <> ''),
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);
create unique index expense_categories_name_uidx on public.expense_categories (lower(btrim(name)));
create trigger expense_categories_set_updated_at before update on public.expense_categories
  for each row execute function public.set_updated_at();
create trigger expense_categories_audit after insert or update on public.expense_categories
  for each row execute function public.audit_trigger('id');

insert into public.expense_categories (name) values
  ('Alquiler'), ('Servicios'), ('Sueldos'), ('Limpieza'), ('Mantenimiento'),
  ('Publicidad'), ('Impuestos y tasas'), ('Packaging'), ('Otros');

create table public.expenses (
  id                 uuid primary key default gen_random_uuid(),
  number             bigint generated always as identity unique,
  expense_date       date not null default public.business_date(),
  category_id        uuid not null references public.expense_categories (id) on delete restrict,
  description        text not null check (btrim(description) <> ''),
  amount             numeric(14, 2) not null check (amount > 0),
  payment_method_id  uuid not null references public.payment_methods (id) on delete restrict,
  paid_from_register boolean not null default false,
  cash_session_id    uuid references public.cash_sessions (id) on delete restrict,
  supplier_id        uuid references public.suppliers (id) on delete restrict,
  receipt_ref        text,
  notes              text,
  created_by         uuid not null default auth.uid() references public.profiles (id),
  created_at         timestamptz not null default now(),
  voided_at          timestamptz,
  voided_by          uuid references public.profiles (id),
  void_reason        text,
  constraint expenses_register_session_chk check (not paid_from_register or cash_session_id is not null)
);
create index expenses_date_idx on public.expenses (expense_date desc);
create index expenses_category_idx on public.expenses (category_id);
create trigger expenses_audit after insert or update on public.expenses
  for each row execute function public.audit_trigger('id');

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
select public.secure_table('public.payment_methods', null, array['owner']::public.app_role[]);
select public.secure_table('public.cash_registers', null, array['owner']::public.app_role[]);
select public.secure_table('public.expense_categories', null,
  array['owner', 'manager']::public.app_role[]);

select public.secure_table('public.cash_sessions');
drop policy cash_sessions_select on public.cash_sessions;
create policy cash_sessions_select on public.cash_sessions for select to authenticated
  using (
    public.has_role('owner', 'manager', 'viewer')
    or (public.has_role('cashier') and opened_by = (select auth.uid()))
  );

select public.secure_table('public.cash_movements');
drop policy cash_movements_select on public.cash_movements;
create policy cash_movements_select on public.cash_movements for select to authenticated
  using (
    public.has_role('owner', 'manager', 'viewer')
    or (public.has_role('cashier') and exists (
      select 1 from public.cash_sessions s
      where s.id = cash_session_id and s.opened_by = (select auth.uid())
    ))
  );

select public.secure_table('public.cash_session_totals');
drop policy cash_session_totals_select on public.cash_session_totals;
create policy cash_session_totals_select on public.cash_session_totals for select to authenticated
  using (
    public.has_role('owner', 'manager', 'viewer')
    or (public.has_role('cashier') and exists (
      select 1 from public.cash_sessions s
      where s.id = session_id and s.opened_by = (select auth.uid())
    ))
  );

select public.secure_table('public.expenses');
drop policy expenses_select on public.expenses;
create policy expenses_select on public.expenses for select to authenticated
  using (
    public.has_role('owner', 'manager', 'viewer')
    or (public.has_role('cashier') and created_by = (select auth.uid()))
  );

-- Vista con el efectivo esperado en vivo
create view public.v_cash_sessions with (security_invoker = true) as
select
  s.*,
  coalesce((
    select sum(case m.direction when 'in' then m.amount else -m.amount end)
    from public.cash_movements m
    where m.cash_session_id = s.id and m.affects_physical_cash
  ), 0)::numeric(14, 2) as expected_cash_live
from public.cash_sessions s;

-- Totales por medio de pago de una sesión (en vivo)
create view public.v_cash_method_totals with (security_invoker = true) as
select
  m.cash_session_id as session_id,
  m.payment_method_id,
  pm.code, pm.name, pm.is_cash, pm.sort_order,
  coalesce(sum(m.amount) filter (where m.direction = 'in'), 0)::numeric(14, 2)  as total_in,
  coalesce(sum(m.amount) filter (where m.direction = 'out'), 0)::numeric(14, 2) as total_out,
  coalesce(sum(case m.direction when 'in' then m.amount else -m.amount end), 0)::numeric(14, 2) as net
from public.cash_movements m
join public.payment_methods pm on pm.id = m.payment_method_id
group by m.cash_session_id, m.payment_method_id, pm.code, pm.name, pm.is_cash, pm.sort_order;

-- ---------------------------------------------------------------------------
-- Funciones internas
-- ---------------------------------------------------------------------------

-- Caja abierta sobre la que opera el usuario. Con p_session_id valida esa sesión; sin él usa la caja
-- abierta del propio usuario o, para dueño/encargado, la única caja abierta del local.
create function public.internal_find_open_session(p_session_id uuid default null)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id    uuid;
  v_count integer;
begin
  if p_session_id is not null then
    select id into v_id from public.cash_sessions
    where id = p_session_id and status = 'open'
      and (opened_by = auth.uid() or public.has_role('owner', 'manager'));
    return v_id;
  end if;

  select id into v_id from public.cash_sessions
  where status = 'open' and opened_by = auth.uid()
  order by opened_at desc limit 1;
  if v_id is not null then
    return v_id;
  end if;

  if public.has_role('owner', 'manager') then
    select count(*), min(id::text)::uuid into v_count, v_id
    from public.cash_sessions where status = 'open';
    if v_count = 1 then
      return v_id;
    end if;
  end if;
  return null;
end;
$$;

create function public.internal_post_cash_movement(
  p_session_id uuid,
  p_method_id  uuid,
  p_kind       public.cash_movement_kind,
  p_direction  text,
  p_amount     numeric,
  p_description text default null,
  p_ref_type   text default null,
  p_ref_id     uuid default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  insert into public.cash_movements
    (cash_session_id, payment_method_id, kind, direction, amount, description, reference_type, reference_id)
  values
    (p_session_id, p_method_id, p_kind, p_direction, p_amount, p_description, p_ref_type, p_ref_id)
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.internal_find_open_session(uuid) from public, anon, authenticated;
revoke execute on function public.internal_post_cash_movement(uuid, uuid, public.cash_movement_kind, text, numeric, text, text, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC de caja
-- ---------------------------------------------------------------------------
create function public.open_cash_session(
  p_register_id    uuid,
  p_opening_amount numeric,
  p_notes          text default null
)
returns public.cash_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.cash_sessions;
  v_cash_id uuid;
begin
  perform public.require_role('owner', 'manager', 'cashier');
  if p_opening_amount is null or p_opening_amount < 0 then
    raise exception 'El dinero inicial no puede ser negativo' using errcode = '22023';
  end if;
  if not exists (select 1 from public.cash_registers where id = p_register_id and active) then
    raise exception 'Caja inexistente o inactiva' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.cash_sessions where register_id = p_register_id and status = 'open') then
    raise exception 'Esa caja ya está abierta' using errcode = '23505';
  end if;
  if exists (select 1 from public.cash_sessions where opened_by = auth.uid() and status = 'open') then
    raise exception 'Ya tenés una caja abierta' using errcode = '23505';
  end if;

  insert into public.cash_sessions (register_id, opening_amount, opening_notes)
  values (p_register_id, round(p_opening_amount, 2), p_notes)
  returning * into v_session;

  if v_session.opening_amount > 0 then
    select id into v_cash_id from public.payment_methods where code = 'cash';
    perform public.internal_post_cash_movement(
      v_session.id, v_cash_id, 'opening_float', 'in', v_session.opening_amount,
      'Dinero inicial', 'cash_session', v_session.id
    );
  end if;
  return v_session;
end;
$$;

-- Ingresos manuales y retiros de efectivo.
create function public.register_cash_movement(
  p_kind              public.cash_movement_kind,
  p_payment_method_id uuid,
  p_amount            numeric,
  p_description       text,
  p_session_id        uuid default null
)
returns public.cash_movements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session uuid;
  v_id      bigint;
  v_result  public.cash_movements;
  v_active  boolean;
begin
  perform public.require_role('owner', 'manager', 'cashier');
  if p_kind not in ('income', 'withdrawal') then
    raise exception 'Solo se permiten ingresos y retiros manuales' using errcode = '22023';
  end if;
  if p_kind = 'withdrawal' then
    perform public.require_role('owner', 'manager');
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto debe ser mayor a 0' using errcode = '22023';
  end if;
  if p_description is null or btrim(p_description) = '' then
    raise exception 'La descripción es obligatoria' using errcode = '22023';
  end if;

  select active into v_active from public.payment_methods where id = p_payment_method_id;
  if v_active is distinct from true then
    raise exception 'Medio de pago inexistente o inactivo' using errcode = 'P0002';
  end if;

  v_session := public.internal_find_open_session(p_session_id);
  if v_session is null then
    raise exception 'No hay una caja abierta' using errcode = '23514';
  end if;
  perform 1 from public.cash_sessions where id = v_session for share;

  v_id := public.internal_post_cash_movement(
    v_session, p_payment_method_id, p_kind,
    case p_kind when 'income' then 'in' else 'out' end,
    round(p_amount, 2), btrim(p_description), 'manual', null
  );
  select * into v_result from public.cash_movements where id = v_id;
  return v_result;
end;
$$;

-- Cierre: calcula el efectivo esperado desde el ledger, guarda lo contado y la diferencia,
-- y deja una foto de los totales por medio de pago. p_reported = {"<code>": monto} (opcional).
create function public.close_cash_session(
  p_session_id   uuid,
  p_counted_cash numeric,
  p_notes        text default null,
  p_reported     jsonb default '{}'::jsonb
)
returns public.cash_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session  public.cash_sessions;
  v_expected numeric(14, 2);
begin
  perform public.require_role('owner', 'manager', 'cashier');
  if p_counted_cash is null or p_counted_cash < 0 then
    raise exception 'El efectivo contado no puede ser negativo' using errcode = '22023';
  end if;

  select * into v_session from public.cash_sessions where id = p_session_id for update;
  if not found then
    raise exception 'Caja inexistente' using errcode = 'P0002';
  end if;
  if v_session.status <> 'open' then
    raise exception 'La caja ya está cerrada' using errcode = '23514';
  end if;
  if v_session.opened_by <> auth.uid() and not public.has_role('owner', 'manager') then
    raise exception 'Solo quien abrió la caja puede cerrarla' using errcode = '42501';
  end if;

  select coalesce(sum(case direction when 'in' then amount else -amount end), 0)
  into v_expected
  from public.cash_movements
  where cash_session_id = p_session_id and affects_physical_cash;

  delete from public.cash_session_totals where session_id = p_session_id;  -- reapertura previa
  insert into public.cash_session_totals (session_id, payment_method_id, total_in, total_out, expected, reported)
  select p_session_id, pm.id,
         coalesce(sum(m.amount) filter (where m.direction = 'in'), 0),
         coalesce(sum(m.amount) filter (where m.direction = 'out'), 0),
         coalesce(sum(case m.direction when 'in' then m.amount else -m.amount end), 0),
         case when p_reported ? pm.code then (p_reported ->> pm.code)::numeric end
  from public.payment_methods pm
  left join public.cash_movements m
         on m.payment_method_id = pm.id and m.cash_session_id = p_session_id
  group by pm.id, pm.code
  having count(m.id) > 0 or (p_reported ? pm.code);

  update public.cash_sessions
  set status = 'closed', closed_by = auth.uid(), closed_at = now(),
      expected_cash = v_expected, counted_cash = round(p_counted_cash, 2),
      cash_difference = round(p_counted_cash, 2) - v_expected,
      closing_notes = p_notes
  where id = p_session_id
  returning * into v_session;

  return v_session;
end;
$$;

create function public.reopen_cash_session(p_session_id uuid, p_reason text)
returns public.cash_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.cash_sessions;
begin
  perform public.require_role('owner');
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'El motivo es obligatorio' using errcode = '22023';
  end if;
  select * into v_session from public.cash_sessions where id = p_session_id for update;
  if not found or v_session.status <> 'closed' then
    raise exception 'La caja no existe o no está cerrada' using errcode = '23514';
  end if;
  if exists (select 1 from public.cash_sessions where register_id = v_session.register_id and status = 'open') then
    raise exception 'Esa caja ya tiene otra sesión abierta' using errcode = '23505';
  end if;

  update public.cash_sessions
  set status = 'open', closed_by = null, closed_at = null, expected_cash = null,
      counted_cash = null, cash_difference = null,
      closing_notes = coalesce(closing_notes, '') || ' [Reabierta: ' || btrim(p_reason) || ']',
      reopened_count = reopened_count + 1
  where id = p_session_id
  returning * into v_session;
  return v_session;
end;
$$;

-- ---------------------------------------------------------------------------
-- Gastos
-- ---------------------------------------------------------------------------
create function public.register_expense(
  p_expense_date       date,
  p_category_id        uuid,
  p_description        text,
  p_amount             numeric,
  p_payment_method_id  uuid,
  p_paid_from_register boolean,
  p_supplier_id        uuid default null,
  p_receipt_ref        text default null,
  p_notes              text default null,
  p_session_id         uuid default null
)
returns public.expenses
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session uuid;
  v_expense public.expenses;
  v_active  boolean;
begin
  perform public.require_role('owner', 'manager', 'cashier');
  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto debe ser mayor a 0' using errcode = '22023';
  end if;
  if p_description is null or btrim(p_description) = '' then
    raise exception 'La descripción es obligatoria' using errcode = '22023';
  end if;
  if not exists (select 1 from public.expense_categories where id = p_category_id and active) then
    raise exception 'Categoría de gasto inexistente' using errcode = 'P0002';
  end if;
  select active into v_active from public.payment_methods where id = p_payment_method_id;
  if v_active is distinct from true then
    raise exception 'Medio de pago inexistente o inactivo' using errcode = 'P0002';
  end if;

  if coalesce(p_paid_from_register, false) then
    v_session := public.internal_find_open_session(p_session_id);
    if v_session is null then
      raise exception 'Para pagar desde la caja necesitás una caja abierta' using errcode = '23514';
    end if;
    perform 1 from public.cash_sessions where id = v_session for share;
  end if;

  insert into public.expenses
    (expense_date, category_id, description, amount, payment_method_id, paid_from_register,
     cash_session_id, supplier_id, receipt_ref, notes)
  values
    (coalesce(p_expense_date, public.business_date()), p_category_id, btrim(p_description),
     round(p_amount, 2), p_payment_method_id, coalesce(p_paid_from_register, false), v_session,
     p_supplier_id, nullif(btrim(coalesce(p_receipt_ref, '')), ''), p_notes)
  returning * into v_expense;

  if v_session is not null then
    perform public.internal_post_cash_movement(
      v_session, p_payment_method_id, 'expense', 'out', v_expense.amount,
      'Gasto #' || v_expense.number || ': ' || v_expense.description, 'expense', v_expense.id
    );
  end if;
  return v_expense;
end;
$$;

-- Anula un gasto. Si salió de la caja, el movimiento inverso entra en la caja abierta actual.
create function public.void_expense(p_expense_id uuid, p_reason text)
returns public.expenses
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expense public.expenses;
  v_session uuid;
begin
  perform public.require_role('owner', 'manager');
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'El motivo es obligatorio' using errcode = '22023';
  end if;

  select * into v_expense from public.expenses where id = p_expense_id for update;
  if not found then
    raise exception 'Gasto inexistente' using errcode = 'P0002';
  end if;
  if v_expense.voided_at is not null then
    raise exception 'El gasto ya está anulado' using errcode = '23514';
  end if;

  if v_expense.cash_session_id is not null then
    v_session := public.internal_find_open_session(null);
    if v_session is null then
      raise exception 'Abrí una caja para registrar el reintegro de la anulación' using errcode = '23514';
    end if;
    perform public.internal_post_cash_movement(
      v_session, v_expense.payment_method_id, 'expense_void', 'in', v_expense.amount,
      'Anulación gasto #' || v_expense.number, 'expense', v_expense.id
    );
  end if;

  update public.expenses
  set voided_at = now(), voided_by = auth.uid(), void_reason = btrim(p_reason)
  where id = p_expense_id
  returning * into v_expense;
  return v_expense;
end;
$$;
