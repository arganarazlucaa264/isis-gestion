-- Etapa 9 y 10 · Reportes y dashboard
-- Funciones SECURITY DEFINER con verificación de rol (owner / manager / viewer). Usan costos,
-- por eso no se exponen a vendedores. Las fechas son fechas de negocio (America/Argentina/Buenos_Aires)
-- e inclusivas. Criterio de ventas netas:
--   * Las ventas cuentan en el día de la venta; las devoluciones, en el día de la devolución.
--   * Las ventas anuladas no cuentan (desaparecen de su día original).
--   * Costo de lo vendido = costo promedio vigente al vender; una devolución con reposición lo revierte.

create function public.internal_report_guard()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  perform public.require_role('owner', 'manager', 'viewer');
end;
$$;

create function public.internal_sales_facts(p_from date, p_to date)
returns table (
  day        date,
  kind       text,
  sale_id    uuid,
  variant_id uuid,
  qty        integer,
  revenue    numeric,
  cogs       numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select public.business_date(s.created_at), 'sale'::text, s.id, si.variant_id,
         si.quantity, si.line_total, (si.quantity * coalesce(c.unit_cost, 0))::numeric
  from public.sales s
  join public.sale_items si on si.sale_id = s.id
  left join public.sale_item_costs c on c.sale_item_id = si.id
  where s.status = 'completed'
    and public.business_date(s.created_at) between p_from and p_to
  union all
  select public.business_date(rt.created_at), 'return'::text, rt.sale_id, ri.variant_id,
         -ri.quantity, -ri.refund_amount,
         -(case when rt.restock then ri.quantity * coalesce(c.unit_cost, 0) else 0 end)::numeric
  from public.sale_returns rt
  join public.sales s on s.id = rt.sale_id and s.status = 'completed'
  join public.sale_return_items ri on ri.return_id = rt.id
  left join public.sale_item_costs c on c.sale_item_id = ri.sale_item_id
  where public.business_date(rt.created_at) between p_from and p_to;
$$;
revoke execute on function public.internal_sales_facts(date, date) from public, anon, authenticated;

create function public.report_sales_by_day(p_from date, p_to date)
returns table (
  day date, tickets bigint, units bigint,
  sales_amount numeric, returns_amount numeric, net_amount numeric, cogs numeric, margin numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.internal_report_guard();
  return query
  with days as (select generate_series(p_from, p_to, interval '1 day')::date as d),
  f as (select * from public.internal_sales_facts(p_from, p_to))
  select d.d,
         count(distinct f.sale_id) filter (where f.kind = 'sale'),
         coalesce(sum(f.qty), 0)::bigint,
         coalesce(sum(f.revenue) filter (where f.kind = 'sale'), 0),
         coalesce(-sum(f.revenue) filter (where f.kind = 'return'), 0),
         coalesce(sum(f.revenue), 0),
         coalesce(sum(f.cogs), 0),
         coalesce(sum(f.revenue), 0) - coalesce(sum(f.cogs), 0)
  from days d
  left join f on f.day = d.d
  group by d.d
  order by d.d;
end;
$$;

create function public.report_sales_by_product(p_from date, p_to date)
returns table (
  variant_id uuid, sku text, product_code text, product_name text, category_name text,
  color_name text, size_name text, units bigint, net_amount numeric, cogs numeric, margin numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.internal_report_guard();
  return query
  select v.variant_id, v.sku, v.product_code, v.product_name, v.category_name,
         v.color_name, v.size_name,
         sum(f.qty)::bigint, sum(f.revenue), sum(f.cogs), sum(f.revenue) - sum(f.cogs)
  from public.internal_sales_facts(p_from, p_to) f
  join public.v_variants_all v on v.variant_id = f.variant_id
  group by v.variant_id, v.sku, v.product_code, v.product_name, v.category_name, v.color_name, v.size_name
  order by sum(f.qty) desc, v.product_name, v.variant_id;
end;
$$;

create function public.report_sales_by_category(p_from date, p_to date)
returns table (category_name text, units bigint, net_amount numeric, cogs numeric, margin numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.internal_report_guard();
  return query
  select coalesce(v.category_name, 'Sin categoría'),
         sum(f.qty)::bigint, sum(f.revenue), sum(f.cogs), sum(f.revenue) - sum(f.cogs)
  from public.internal_sales_facts(p_from, p_to) f
  join public.v_variants_all v on v.variant_id = f.variant_id
  group by coalesce(v.category_name, 'Sin categoría')
  order by sum(f.revenue) desc, 1;
end;
$$;

-- Cobros y reintegros por medio de pago (en el día de la venta / de la devolución)
create function public.report_sales_by_payment_method(p_from date, p_to date)
returns table (
  payment_method_id uuid, code text, name text, is_cash boolean,
  collected numeric, refunded numeric, net numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.internal_report_guard();
  return query
  select pm.id, pm.code, pm.name, pm.is_cash,
         coalesce(c.amount, 0), coalesce(r.amount, 0), coalesce(c.amount, 0) - coalesce(r.amount, 0)
  from public.payment_methods pm
  left join (
    select sp.payment_method_id, sum(sp.amount) as amount
    from public.sale_payments sp join public.sales s on s.id = sp.sale_id
    where s.status = 'completed' and public.business_date(s.created_at) between p_from and p_to
    group by sp.payment_method_id
  ) c on c.payment_method_id = pm.id
  left join (
    select rt.refund_method_id as payment_method_id, sum(rt.refund_amount) as amount
    from public.sale_returns rt join public.sales s on s.id = rt.sale_id and s.status = 'completed'
    where public.business_date(rt.created_at) between p_from and p_to
    group by rt.refund_method_id
  ) r on r.payment_method_id = pm.id
  where pm.active or c.amount is not null or r.amount is not null
  order by pm.sort_order, pm.id;
end;
$$;

-- Vista interna con todas las variantes (incluye inactivas), sin RLS: solo la usan reportes definer.
create view public.v_variants_all as
select v.id as variant_id, v.sku, v.ean, v.price, v.min_stock, v.active,
       p.code as product_code, p.name as product_name, p.active as product_active,
       cat.name as category_name, b.name as brand_name,
       col.name as color_name, s.name as size_name, s.sort_order as size_order,
       coalesce(sl.quantity, 0) as stock,
       coalesce(vc.avg_cost, 0) as avg_cost, coalesce(vc.last_cost, 0) as last_cost
from public.product_variants v
join public.products p on p.id = v.product_id
join public.colors col on col.id = v.color_id
join public.sizes s on s.id = v.size_id
left join public.categories cat on cat.id = p.category_id
left join public.brands b on b.id = p.brand_id
left join public.stock_levels sl on sl.variant_id = v.id
left join public.variant_costs vc on vc.variant_id = v.id;

create function public.report_stock()
returns table (
  variant_id uuid, sku text, ean text, product_code text, product_name text, category_name text,
  color_name text, size_name text, stock integer, min_stock integer, avg_cost numeric, price numeric,
  value_cost numeric, value_price numeric, stock_status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.internal_report_guard();
  return query
  select v.variant_id, v.sku, v.ean, v.product_code, v.product_name, v.category_name,
         v.color_name, v.size_name, v.stock, v.min_stock, v.avg_cost, v.price,
         greatest(v.stock, 0) * v.avg_cost, greatest(v.stock, 0) * v.price,
         case when v.stock <= 0 then 'out'
              when v.min_stock > 0 and v.stock <= v.min_stock then 'low'
              else 'ok' end
  from public.v_variants_all v
  where v.active and v.product_active
  order by v.product_name, v.color_name, v.size_order, v.variant_id;
end;
$$;

create function public.report_purchases_by_supplier(p_from date, p_to date)
returns table (
  supplier_id uuid, name text, purchases_count bigint, total numeric, paid numeric, pending numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.internal_report_guard();
  return query
  select s.id, s.name, count(p.id), coalesce(sum(p.total), 0), coalesce(sum(p.paid_amount), 0),
         coalesce(sum(p.total - p.paid_amount), 0)
  from public.suppliers s
  join public.purchases p on p.supplier_id = s.id and p.status = 'received'
       and p.purchase_date between p_from and p_to
  group by s.id, s.name
  order by sum(p.total) desc, s.id;
end;
$$;

create function public.report_supplier_debts()
returns table (
  supplier_id uuid, name text, balance numeric,
  not_due numeric, overdue_1_30 numeric, overdue_31_60 numeric, overdue_61_plus numeric,
  next_due_date date
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.internal_report_guard();
  return query
  select s.id, s.name,
         coalesce((select sum(l.amount) from public.supplier_ledger l where l.supplier_id = s.id), 0),
         coalesce(sum(p.total - p.paid_amount) filter (where p.due_date is null or p.due_date >= public.business_date()), 0),
         coalesce(sum(p.total - p.paid_amount) filter (where p.due_date < public.business_date() and public.business_date() - p.due_date <= 30), 0),
         coalesce(sum(p.total - p.paid_amount) filter (where public.business_date() - p.due_date between 31 and 60), 0),
         coalesce(sum(p.total - p.paid_amount) filter (where public.business_date() - p.due_date > 60), 0),
         min(p.due_date)
  from public.suppliers s
  left join public.purchases p on p.supplier_id = s.id and p.status = 'received' and p.payment_status <> 'paid'
  group by s.id, s.name
  having coalesce((select sum(l.amount) from public.supplier_ledger l where l.supplier_id = s.id), 0) <> 0
      or count(p.id) > 0
  order by 3 desc, s.id;
end;
$$;

create function public.report_expenses_by_category(p_from date, p_to date)
returns table (category_name text, expenses_count bigint, total numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.internal_report_guard();
  return query
  select c.name, count(e.id), coalesce(sum(e.amount), 0)
  from public.expenses e
  join public.expense_categories c on c.id = e.category_id
  where e.voided_at is null and e.expense_date between p_from and p_to
  group by c.name
  order by sum(e.amount) desc, c.name;
end;
$$;

-- Resultado estimado = margen bruto (ventas netas - costo de lo vendido) - gastos del período.
create function public.report_profit(p_from date, p_to date)
returns table (
  net_sales numeric, cogs numeric, gross_margin numeric, margin_pct numeric,
  expenses numeric, estimated_result numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sales numeric;
  v_cogs  numeric;
  v_exp   numeric;
begin
  perform public.internal_report_guard();
  select coalesce(sum(revenue), 0), coalesce(sum(f.cogs), 0) into v_sales, v_cogs
  from public.internal_sales_facts(p_from, p_to) f;
  select coalesce(sum(amount), 0) into v_exp
  from public.expenses where voided_at is null and expense_date between p_from and p_to;
  return query select v_sales, v_cogs, v_sales - v_cogs,
                      case when v_sales > 0 then round((v_sales - v_cogs) * 100 / v_sales, 2) else 0 end,
                      v_exp, v_sales - v_cogs - v_exp;
end;
$$;

-- ---------------------------------------------------------------------------
-- Dashboard: un solo llamado con todo lo necesario
-- ---------------------------------------------------------------------------
create function public.dashboard_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today  date := public.business_date();
  v_month  date := date_trunc('month', public.business_date())::date;
  v_result jsonb;
begin
  perform public.internal_report_guard();

  with
  td as (select coalesce(sum(revenue), 0) as sales, coalesce(sum(qty), 0) as units,
                coalesce(sum(cogs), 0) as cogs,
                count(distinct sale_id) filter (where kind = 'sale') as tickets
         from public.internal_sales_facts(v_today, v_today)),
  mo as (select coalesce(sum(revenue), 0) as sales, coalesce(sum(qty), 0) as units,
                coalesce(sum(cogs), 0) as cogs,
                count(distinct sale_id) filter (where kind = 'sale') as tickets
         from public.internal_sales_facts(v_month, v_today)),
  pay as (
    select pm.code, pm.name, pm.is_cash,
           coalesce((select sum(sp.amount) from public.sale_payments sp join public.sales s on s.id = sp.sale_id
                     where sp.payment_method_id = pm.id and s.status = 'completed'
                       and public.business_date(s.created_at) = v_today), 0)
         - coalesce((select sum(rt.refund_amount) from public.sale_returns rt join public.sales s on s.id = rt.sale_id
                     where rt.refund_method_id = pm.id and s.status = 'completed'
                       and public.business_date(rt.created_at) = v_today), 0) as net,
           pm.sort_order
    from public.payment_methods pm
  ),
  ex as (select coalesce(sum(amount) filter (where expense_date = v_today), 0) as today,
                coalesce(sum(amount), 0) as month
         from public.expenses where voided_at is null and expense_date between v_month and v_today),
  st as (select count(*) filter (where v.stock <= 0) as out_count,
                count(*) filter (where v.stock > 0 and v.min_stock > 0 and v.stock <= v.min_stock) as low_count,
                coalesce(sum(greatest(v.stock, 0) * v.avg_cost), 0) as value_cost
         from public.v_variants_all v where v.active and v.product_active),
  debt as (select coalesce(sum(balance), 0) as total from (
             select sum(amount) as balance from public.supplier_ledger group by supplier_id
           ) b where balance > 0),
  series as (
    select d::date as day, coalesce(sum(f.revenue), 0) as net
    from generate_series(v_today - 13, v_today, interval '1 day') d
    left join public.internal_sales_facts(v_today - 13, v_today) f on f.day = d::date
    group by d order by d
  ),
  top as (
    select v.product_name, v.color_name, v.size_name, sum(f.qty) as units, sum(f.revenue) as amount
    from public.internal_sales_facts(v_today - 29, v_today) f
    join public.v_variants_all v on v.variant_id = f.variant_id
    group by v.product_name, v.color_name, v.size_name
    having sum(f.qty) > 0
    order by sum(f.qty) desc limit 5
  ),
  mv as (
    select m.id, m.created_at, m.movement_type, m.quantity, v.sku, v.product_name, v.color_name, v.size_name
    from public.stock_movements m join public.v_variants_all v on v.variant_id = m.variant_id
    order by m.id desc limit 10
  )
  select jsonb_build_object(
    'today', (select jsonb_build_object('sales', td.sales, 'units', td.units, 'tickets', td.tickets,
                                        'margin', td.sales - td.cogs) from td),
    'month', (select jsonb_build_object('sales', mo.sales, 'units', mo.units, 'tickets', mo.tickets,
                                        'margin', mo.sales - mo.cogs,
                                        'expenses', ex.month,
                                        'estimated_result', mo.sales - mo.cogs - ex.month)
              from mo, ex),
    'today_expenses', (select today from ex),
    'payments_today', (select coalesce(jsonb_agg(jsonb_build_object('code', code, 'name', name,
                                       'is_cash', is_cash, 'net', net) order by sort_order), '[]'::jsonb) from pay),
    'stock', (select jsonb_build_object('out_of_stock', out_count, 'low_stock', low_count,
                                        'value_cost', value_cost) from st),
    'supplier_debt', (select total from debt),
    'series', (select coalesce(jsonb_agg(jsonb_build_object('day', day, 'net', net) order by day), '[]'::jsonb) from series),
    'top_products', (select coalesce(jsonb_agg(jsonb_build_object('name', product_name, 'color', color_name,
                                       'size', size_name, 'units', units, 'amount', amount)), '[]'::jsonb) from top),
    'recent_movements', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'at', created_at,
                                       'type', movement_type, 'quantity', quantity, 'sku', sku,
                                       'name', product_name, 'color', color_name, 'size', size_name)
                                       order by id desc), '[]'::jsonb) from mv),
    'open_sessions', (select count(*) from public.cash_sessions where status = 'open')
  ) into v_result;

  return v_result;
end;
$$;
