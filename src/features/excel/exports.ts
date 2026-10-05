import { listVariants } from '@/features/catalog/api'
import { listMovementsRange, listSessions } from '@/features/cash/api'
import { listItems } from '@/features/inventory/api'
import { listPurchases } from '@/features/purchases/api'
import { listBalances } from '@/features/suppliers/api'
import { listAllMovements } from '@/features/stock/api'
import { fetchAll, unwrap } from '@/lib/api'
import { instructionsSheet, productColumns } from '@/lib/excel/products'
import { downloadWorkbook, type SheetDef } from '@/lib/excel/workbook'
import { supabase } from '@/lib/supabase'
import { MOVEMENT_LABELS, CASH_KIND_LABELS, type Row } from '@/types/db'
import { todayISO } from '@/lib/format'

const stamp = () => todayISO()

async function loadCosts(): Promise<Map<string, number>> {
  const rows = await fetchAll<{ variant_id: string; avg_cost: number }>((a, b) =>
    supabase.from('variant_costs').select('variant_id,avg_cost').range(a, b),
  )
  return new Map(rows.map((r) => [r.variant_id, r.avg_cost]))
}

/** Formato de importación/exportación de variantes. Las columnas SKU y EAN son texto. */
async function variantRows(withCost: boolean) {
  const [variants, costs] = await Promise.all([
    listVariants({ includeInactive: true }),
    withCost ? loadCosts() : Promise.resolve(new Map<string, number>()),
  ])
  return variants.map((v) => ({
    variant_id: v.variant_id,
    sku: v.sku,
    ean: v.ean ?? '',
    product_code: v.product_code,
    product_name: v.product_name,
    category: v.category_name ?? '',
    brand: v.brand_name ?? '',
    color: v.color_name,
    size: v.size_name,
    price: v.price,
    cost: costs.get(v.variant_id) ?? 0,
    stock: v.stock,
    min_stock: v.min_stock,
    active: v.active && v.product_active ? 'Sí' : 'No',
  }))
}

export async function exportStock(withCost: boolean) {
  const rows = await variantRows(withCost)
  await downloadWorkbook(`stock-${stamp()}`, [
    { name: 'Stock', columns: productColumns({ withCost, withId: true }), rows },
    instructionsSheet(),
  ])
}

export async function exportProducts(withCost: boolean) {
  const products = await fetchAll<
    Row<'products'> & {
      categories: { name: string } | null
      brands: { name: string } | null
      suppliers: { name: string } | null
    }
  >((a, b) =>
    supabase
      .from('products')
      .select('*, categories(name), brands(name), suppliers(name)')
      .order('name')
      .range(a, b),
  )
  const rows = await variantRows(withCost)
  await downloadWorkbook(`productos-${stamp()}`, [
    {
      name: 'Productos',
      columns: [
        { header: 'Modelo', key: 'code', type: 'text', width: 14 },
        { header: 'Producto', key: 'name', type: 'text', width: 32 },
        { header: 'Categoría', key: 'category', type: 'text', width: 18 },
        { header: 'Marca', key: 'brand', type: 'text', width: 16 },
        { header: 'Proveedor', key: 'supplier', type: 'text', width: 22 },
        { header: 'Activo', key: 'active', type: 'text', width: 10 },
        { header: 'Descripción', key: 'description', type: 'text', width: 40 },
      ],
      rows: products.map((p) => ({
        code: p.code,
        name: p.name,
        category: p.categories?.name ?? '',
        brand: p.brands?.name ?? '',
        supplier: p.suppliers?.name ?? '',
        active: p.active ? 'Sí' : 'No',
        description: p.description ?? '',
      })),
    },
    { name: 'Variantes', columns: productColumns({ withCost, withId: true }), rows },
    instructionsSheet(),
  ])
}

/** Plantilla vacía de importación (con una fila de ejemplo). */
export async function downloadTemplate() {
  await downloadWorkbook('plantilla-importacion', [
    {
      name: 'Productos',
      columns: productColumns({ withCost: true, withId: false }),
      rows: [
        {
          sku: 'REM-001-NEG-M',
          ean: '4006381333931',
          product_code: 'REM-001',
          product_name: 'Remera básica',
          category: 'Remeras',
          brand: '',
          color: 'Negro',
          size: 'M',
          price: 18000,
          cost: 7000,
          stock: 10,
          min_stock: 2,
          active: 'Sí',
        },
      ],
    },
    instructionsSheet(),
  ])
}

interface SaleExport extends Row<'sales'> {
  customers: { name: string } | null
  sale_items: Row<'sale_items'>[]
  sale_payments: Row<'sale_payments'>[]
}

export async function exportSales(from: string, to: string) {
  const sales = await fetchAll<SaleExport>((a, b) =>
    supabase
      .from('sales')
      .select('*, customers(name), sale_items(*), sale_payments(*)')
      .gte('created_at', `${from}T00:00:00-03:00`)
      .lte('created_at', `${to}T23:59:59-03:00`)
      .order('number')
      .range(a, b),
  )
  const money = (key: string, header: string) => ({
    header,
    key,
    type: 'money' as const,
    width: 14,
  })
  await downloadWorkbook(`ventas-${from}-a-${to}`, [
    {
      name: 'Ventas',
      columns: [
        { header: 'N° venta', key: 'number', type: 'int', width: 10 },
        { header: 'Fecha', key: 'at', type: 'datetime', width: 18 },
        { header: 'Vendedor', key: 'seller', type: 'text', width: 20 },
        { header: 'Cliente', key: 'customer', type: 'text', width: 20 },
        { header: 'Estado', key: 'status', type: 'text', width: 12 },
        money('subtotal', 'Subtotal'),
        money('discount', 'Descuento'),
        money('total', 'Total'),
        { header: 'Medios de pago', key: 'payments', type: 'text', width: 40 },
        { header: 'Motivo anulación', key: 'void', type: 'text', width: 30 },
      ],
      rows: sales.map((s) => ({
        number: s.number,
        at: s.created_at,
        seller: s.seller_name ?? '',
        customer: s.customers?.name ?? 'Consumidor final',
        status: s.status === 'voided' ? 'Anulada' : 'Completada',
        subtotal: s.subtotal,
        discount: s.discount_amount,
        total: s.total,
        payments: s.sale_payments.map((p) => `${p.method_name} ${p.amount}`).join(' + '),
        void: s.void_reason ?? '',
      })),
    },
    {
      name: 'Detalle',
      columns: [
        { header: 'N° venta', key: 'number', type: 'int', width: 10 },
        { header: 'Producto', key: 'name', type: 'text', width: 30 },
        { header: 'Color', key: 'color', type: 'text', width: 14 },
        { header: 'Talle', key: 'size', type: 'text', width: 10 },
        { header: 'SKU', key: 'sku', type: 'text', width: 20 },
        { header: 'EAN', key: 'ean', type: 'text', width: 18 },
        { header: 'Cantidad', key: 'qty', type: 'int', width: 10 },
        money('price', 'Precio unit.'),
        money('discount', 'Descuento'),
        money('total', 'Total línea'),
      ],
      rows: sales.flatMap((s) =>
        s.sale_items.map((i) => ({
          number: s.number,
          name: i.product_name,
          color: i.color_name,
          size: i.size_name,
          sku: i.sku,
          ean: i.ean ?? '',
          qty: i.quantity,
          price: i.unit_price,
          discount: i.discount_amount,
          total: i.line_total,
        })),
      ),
    },
  ])
}

export async function exportPurchases(from: string, to: string) {
  const list = await listPurchases(from, to, '', '')
  type PurchaseExport = Row<'purchases'> & {
    suppliers: { name: string } | null
    purchase_items: Row<'purchase_items'>[]
  }
  const ids = list.map((p) => p.id)
  const full: PurchaseExport[] = []
  for (let i = 0; i < ids.length; i += 100) {
    const part = unwrap(
      await supabase
        .from('purchases')
        .select('*, suppliers(name), purchase_items(*)')
        .in('id', ids.slice(i, i + 100))
        .order('number'),
    ) as unknown as PurchaseExport[]
    full.push(...part)
  }
  const money = (key: string, header: string) => ({
    header,
    key,
    type: 'money' as const,
    width: 14,
  })
  const estado = (s: string) =>
    s === 'received' ? 'Recibida' : s === 'draft' ? 'Borrador' : 'Anulada'
  await downloadWorkbook(`compras-${from}-a-${to}`, [
    {
      name: 'Compras',
      columns: [
        { header: 'N° compra', key: 'number', type: 'int', width: 10 },
        { header: 'Fecha', key: 'date', type: 'date', width: 12 },
        { header: 'Proveedor', key: 'supplier', type: 'text', width: 26 },
        { header: 'Factura', key: 'invoice', type: 'text', width: 16 },
        { header: 'Vencimiento', key: 'due', type: 'date', width: 12 },
        { header: 'Estado', key: 'status', type: 'text', width: 12 },
        { header: 'Pago', key: 'pay', type: 'text', width: 12 },
        money('subtotal', 'Subtotal'),
        money('discount', 'Descuento'),
        money('tax', 'Impuestos'),
        money('total', 'Total'),
        money('paid', 'Pagado'),
      ],
      rows: full.map((p) => ({
        number: p.number,
        date: p.purchase_date,
        supplier: p.suppliers?.name ?? '',
        invoice: p.invoice_number ?? '',
        due: p.due_date,
        status: estado(p.status),
        pay:
          p.status === 'received'
            ? p.payment_status === 'paid'
              ? 'Pagada'
              : p.payment_status === 'partial'
                ? 'Parcial'
                : 'Pendiente'
            : '',
        subtotal: p.subtotal,
        discount: p.discount_amount,
        tax: p.tax_amount,
        total: p.total,
        paid: p.paid_amount,
      })),
    },
    {
      name: 'Detalle',
      columns: [
        { header: 'N° compra', key: 'number', type: 'int', width: 10 },
        { header: 'Producto', key: 'name', type: 'text', width: 30 },
        { header: 'Color', key: 'color', type: 'text', width: 14 },
        { header: 'Talle', key: 'size', type: 'text', width: 10 },
        { header: 'SKU', key: 'sku', type: 'text', width: 20 },
        { header: 'Cantidad', key: 'qty', type: 'int', width: 10 },
        money('cost', 'Costo unit.'),
        money('total', 'Total línea'),
      ],
      rows: full.flatMap((p) =>
        p.purchase_items.map((i) => ({
          number: p.number,
          name: i.product_name,
          color: i.color_name,
          size: i.size_name,
          sku: i.sku,
          qty: i.quantity,
          cost: i.unit_cost,
          total: i.line_total,
        })),
      ),
    },
  ])
}

export async function exportMovements(from: string, to: string) {
  const rows = await listAllMovements(from, to)
  await downloadWorkbook(`movimientos-stock-${from}-a-${to}`, [
    {
      name: 'Movimientos',
      columns: [
        { header: 'Fecha', key: 'at', type: 'datetime', width: 18 },
        { header: 'SKU', key: 'sku', type: 'text', width: 20 },
        { header: 'Producto', key: 'name', type: 'text', width: 30 },
        { header: 'Color', key: 'color', type: 'text', width: 14 },
        { header: 'Talle', key: 'size', type: 'text', width: 10 },
        { header: 'Tipo', key: 'type', type: 'text', width: 24 },
        { header: 'Cantidad', key: 'qty', type: 'int', width: 10 },
        { header: 'Stock antes', key: 'before', type: 'int', width: 12 },
        { header: 'Stock después', key: 'after', type: 'int', width: 14 },
        { header: 'Motivo', key: 'reason', type: 'text', width: 36 },
      ],
      rows: rows.map((m) => ({
        at: m.created_at,
        sku: m.product_variants?.sku ?? '',
        name: m.product_variants?.products?.name ?? '',
        color: m.product_variants?.colors?.name ?? '',
        size: m.product_variants?.sizes?.name ?? '',
        type: MOVEMENT_LABELS[m.movement_type],
        qty: m.quantity,
        before: m.stock_before,
        after: m.stock_after,
        reason: m.reason ?? '',
      })),
    },
  ])
}

export async function exportCash(from: string, to: string) {
  const [sessions, movements] = await Promise.all([
    listSessions(from, to),
    listMovementsRange(from, to),
  ])
  const money = (key: string, header: string) => ({
    header,
    key,
    type: 'money' as const,
    width: 14,
  })
  await downloadWorkbook(`caja-${from}-a-${to}`, [
    {
      name: 'Cierres',
      columns: [
        { header: 'N° caja', key: 'number', type: 'int', width: 10 },
        { header: 'Apertura', key: 'opened', type: 'datetime', width: 18 },
        { header: 'Cierre', key: 'closed', type: 'datetime', width: 18 },
        { header: 'Estado', key: 'status', type: 'text', width: 10 },
        money('opening', 'Dinero inicial'),
        money('expected', 'Efectivo esperado'),
        money('counted', 'Efectivo contado'),
        money('diff', 'Diferencia'),
        { header: 'Observaciones', key: 'notes', type: 'text', width: 36 },
      ],
      rows: sessions.map((s) => ({
        number: s.number,
        opened: s.opened_at,
        closed: s.closed_at,
        status: s.status === 'open' ? 'Abierta' : 'Cerrada',
        opening: s.opening_amount,
        expected: s.status === 'closed' ? s.expected_cash : s.expected_cash_live,
        counted: s.counted_cash,
        diff: s.cash_difference,
        notes: s.closing_notes ?? '',
      })),
    },
    {
      name: 'Movimientos',
      columns: [
        { header: 'N° caja', key: 'session', type: 'int', width: 10 },
        { header: 'Fecha', key: 'at', type: 'datetime', width: 18 },
        { header: 'Tipo', key: 'kind', type: 'text', width: 24 },
        { header: 'Medio', key: 'method', type: 'text', width: 16 },
        { header: 'Efectivo físico', key: 'physical', type: 'text', width: 14 },
        { header: 'Sentido', key: 'dir', type: 'text', width: 10 },
        money('amount', 'Monto'),
        { header: 'Detalle', key: 'desc', type: 'text', width: 40 },
      ],
      rows: movements.map((m) => ({
        session: m.cash_sessions?.number ?? '',
        at: m.created_at,
        kind: CASH_KIND_LABELS[m.kind],
        method: m.payment_methods?.name ?? '',
        physical: m.affects_physical_cash ? 'Sí' : 'No',
        dir: m.direction === 'in' ? 'Ingreso' : 'Egreso',
        amount: m.amount,
        desc: m.description ?? '',
      })),
    },
  ])
}

export async function exportSuppliers() {
  const [suppliers, balances] = await Promise.all([
    fetchAll<Row<'suppliers'>>((a, b) =>
      supabase.from('suppliers').select('*').order('name').range(a, b),
    ),
    listBalances().catch(() => []),
  ])
  const bal = new Map(balances.map((b) => [b.supplier_id, b]))
  await downloadWorkbook(`proveedores-${stamp()}`, [
    {
      name: 'Proveedores',
      columns: [
        { header: 'Proveedor', key: 'name', type: 'text', width: 28 },
        { header: 'CUIT', key: 'tax', type: 'text', width: 16 },
        { header: 'Contacto', key: 'contact', type: 'text', width: 20 },
        { header: 'Teléfono', key: 'phone', type: 'text', width: 16 },
        { header: 'Email', key: 'email', type: 'text', width: 26 },
        { header: 'Plazo (días)', key: 'terms', type: 'int', width: 12 },
        { header: 'Saldo', key: 'balance', type: 'money', width: 14 },
        { header: 'Vencido', key: 'overdue', type: 'money', width: 14 },
        { header: 'Activo', key: 'active', type: 'text', width: 8 },
      ],
      rows: suppliers.map((s) => ({
        name: s.name,
        tax: s.tax_id ?? '',
        contact: s.contact ?? '',
        phone: s.phone ?? '',
        email: s.email ?? '',
        terms: s.payment_terms_days,
        balance: bal.get(s.id)?.balance ?? 0,
        overdue: bal.get(s.id)?.overdue_amount ?? 0,
        active: s.active ? 'Sí' : 'No',
      })),
    },
  ])
}

export async function exportInventory(countId: string, number: number) {
  const items = await listItems(countId)
  await downloadWorkbook(`inventario-I-${String(number).padStart(6, '0')}`, [
    {
      name: 'Inventario',
      columns: [
        { header: 'SKU', key: 'sku', type: 'text', width: 20 },
        { header: 'EAN', key: 'ean', type: 'text', width: 18 },
        { header: 'Producto', key: 'name', type: 'text', width: 30 },
        { header: 'Color', key: 'color', type: 'text', width: 14 },
        { header: 'Talle', key: 'size', type: 'text', width: 10 },
        { header: 'Sistema (foto)', key: 'expected', type: 'int', width: 14 },
        { header: 'Contado', key: 'counted', type: 'int', width: 10 },
        { header: 'Stock del sistema al contar', key: 'atCount', type: 'int', width: 18 },
        { header: 'Diferencia aplicada', key: 'diff', type: 'int', width: 16 },
      ],
      rows: items.map((i) => ({
        sku: i.product_variants?.sku ?? '',
        ean: i.product_variants?.ean ?? '',
        name: i.product_variants?.products?.name ?? '',
        color: i.product_variants?.colors?.name ?? '',
        size: i.product_variants?.sizes?.name ?? '',
        expected: i.expected_qty,
        counted: i.counted_qty,
        atCount: i.system_qty_at_count,
        diff: i.difference,
      })),
    },
  ])
}

export async function listInventoriesForExport() {
  return unwrap(
    await supabase
      .from('inventory_counts')
      .select('id,number,name,status')
      .order('number', { ascending: false }),
  )
}

export type { SheetDef }
