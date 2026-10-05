import type { Database } from '@/types/database'

type Schema = Database['public']

export type Row<T extends keyof Schema['Tables']> = Schema['Tables'][T]['Row']
export type Enum<T extends keyof Schema['Enums']> = Schema['Enums'][T]

export type StockMovementType = Enum<'stock_movement_type'>
export type CashMovementKind = Enum<'cash_movement_kind'>
export type SupplierLedgerType = Enum<'supplier_ledger_type'>

// Las vistas se generan con columnas anulables; acá se declaran con su forma real.
export interface Variant {
  variant_id: string
  sku: string
  ean: string | null
  price: number
  min_stock: number
  active: boolean
  product_id: string
  product_code: string
  product_name: string
  product_active: boolean
  category_id: string | null
  category_name: string | null
  brand_id: string | null
  brand_name: string | null
  supplier_id: string | null
  color_id: string
  color_name: string
  color_hex: string | null
  size_id: string
  size_name: string
  size_order: number
  stock: number
}

export interface CashSessionView extends Row<'cash_sessions'> {
  expected_cash_live: number
}

export interface CashMethodTotal {
  session_id: string
  payment_method_id: string
  code: string
  name: string
  is_cash: boolean
  sort_order: number
  total_in: number
  total_out: number
  net: number
}

export interface SupplierBalance {
  supplier_id: string
  name: string
  active: boolean
  payment_terms_days: number
  balance: number
  overdue_amount: number
  next_due_date: string | null
}

export interface StatementRow {
  id: number
  supplier_id: string
  entry_date: string
  entry_type: SupplierLedgerType
  amount: number
  reference_type: string | null
  reference_id: string | null
  notes: string | null
  created_at: string
  running_balance: number
}

export const MOVEMENT_LABELS: Record<StockMovementType, string> = {
  purchase_in: 'Compra',
  sale_out: 'Venta',
  sale_return_in: 'Devolución de cliente',
  sale_void_in: 'Anulación de venta',
  purchase_return_out: 'Devolución a proveedor',
  adjustment_in: 'Ajuste (entrada)',
  adjustment_out: 'Ajuste (salida)',
  inventory_adjustment: 'Inventario físico',
  import_adjustment: 'Importación Excel',
  initial_load: 'Stock inicial',
  damage_out: 'Rotura',
  theft_out: 'Pérdida / robo',
  internal_use_out: 'Uso interno',
}

export const CASH_KIND_LABELS: Record<CashMovementKind, string> = {
  opening_float: 'Dinero inicial',
  sale: 'Venta',
  sale_void: 'Anulación de venta',
  sale_refund: 'Devolución',
  income: 'Ingreso',
  expense: 'Gasto',
  expense_void: 'Anulación de gasto',
  withdrawal: 'Retiro',
  supplier_payment: 'Pago a proveedor',
  supplier_payment_void: 'Anulación de pago',
  adjustment: 'Ajuste',
}
