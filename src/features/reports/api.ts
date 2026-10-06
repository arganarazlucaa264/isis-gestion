import { rpc, rpcAll } from '@/lib/rpc'

export const salesByDay = (from: string, to: string) =>
  rpcAll('report_sales_by_day', { p_from: from, p_to: to })
export const salesByProduct = (from: string, to: string) =>
  rpcAll('report_sales_by_product', { p_from: from, p_to: to })
export const salesByCategory = (from: string, to: string) =>
  rpcAll('report_sales_by_category', { p_from: from, p_to: to })
export const salesByPaymentMethod = (from: string, to: string) =>
  rpcAll('report_sales_by_payment_method', { p_from: from, p_to: to })
export const stockReport = () => rpcAll('report_stock')
export const purchasesBySupplier = (from: string, to: string) =>
  rpcAll('report_purchases_by_supplier', { p_from: from, p_to: to })
export const supplierDebts = () => rpcAll('report_supplier_debts')
export const expensesByCategory = (from: string, to: string) =>
  rpcAll('report_expenses_by_category', { p_from: from, p_to: to })
export const profit = async (from: string, to: string) => {
  const rows = await rpc('report_profit', { p_from: from, p_to: to })
  return rows[0]
}
