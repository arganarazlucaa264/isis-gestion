import { lazy } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AppLayout } from '@/app/AppLayout'
import { HomePage } from '@/app/HomePage'
import { NotFoundPage } from '@/app/NotFoundPage'
import { PublicOnly, RequireAuth, RequireRole } from '@/features/auth/guards'
import { LoginPage } from '@/features/auth/LoginPage'
import type { AppRole } from '@/features/auth/roles'

// Cada pantalla se carga bajo demanda para que el arranque sea liviano.
const ProductsPage = lazy(() =>
  import('@/features/catalog/ProductsPage').then((m) => ({ default: m.ProductsPage })),
)
const ProductDetailPage = lazy(() =>
  import('@/features/catalog/ProductDetailPage').then((m) => ({ default: m.ProductDetailPage })),
)
const StockPage = lazy(() =>
  import('@/features/stock/StockPage').then((m) => ({ default: m.StockPage })),
)
const InventoriesPage = lazy(() =>
  import('@/features/inventory/InventoriesPage').then((m) => ({ default: m.InventoriesPage })),
)
const InventoryDetailPage = lazy(() =>
  import('@/features/inventory/InventoryDetailPage').then((m) => ({
    default: m.InventoryDetailPage,
  })),
)
const ExcelPage = lazy(() =>
  import('@/features/excel/ExcelPage').then((m) => ({ default: m.ExcelPage })),
)
const CashPage = lazy(() =>
  import('@/features/cash/CashPage').then((m) => ({ default: m.CashPage })),
)
const PosPage = lazy(() => import('@/features/pos/PosPage').then((m) => ({ default: m.PosPage })))
const SalesPage = lazy(() =>
  import('@/features/pos/SalesPage').then((m) => ({ default: m.SalesPage })),
)
const ExpensesPage = lazy(() =>
  import('@/features/expenses/ExpensesPage').then((m) => ({ default: m.ExpensesPage })),
)
const SuppliersPage = lazy(() =>
  import('@/features/suppliers/SuppliersPage').then((m) => ({ default: m.SuppliersPage })),
)
const SupplierDetailPage = lazy(() =>
  import('@/features/suppliers/SupplierDetailPage').then((m) => ({
    default: m.SupplierDetailPage,
  })),
)
const PurchasesPage = lazy(() =>
  import('@/features/purchases/PurchasesPage').then((m) => ({ default: m.PurchasesPage })),
)
const PurchaseEditorPage = lazy(() =>
  import('@/features/purchases/PurchaseEditorPage').then((m) => ({
    default: m.PurchaseEditorPage,
  })),
)
const ReportsPage = lazy(() =>
  import('@/features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })),
)
const SettingsPage = lazy(() =>
  import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)
const UsersPage = lazy(() =>
  import('@/features/users/UsersPage').then((m) => ({ default: m.UsersPage })),
)

const SELL: AppRole[] = ['owner', 'manager', 'cashier']
const MONEY: AppRole[] = ['owner', 'manager', 'cashier', 'viewer']
const BACK: AppRole[] = ['owner', 'manager', 'stock_clerk', 'viewer']
const REPORT: AppRole[] = ['owner', 'manager', 'viewer']

// La protección de rutas es solo UX: los datos están protegidos por RLS y las RPC verifican el rol.
const router = createBrowserRouter([
  { path: '/login', element: <PublicOnly />, children: [{ index: true, element: <LoginPage /> }] },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <HomePage /> },
          { path: '/productos', element: <ProductsPage /> },
          { path: '/productos/:id', element: <ProductDetailPage /> },
          { path: '/stock', element: <StockPage /> },
          {
            element: <RequireRole roles={SELL} />,
            children: [{ path: '/vender', element: <PosPage /> }],
          },
          {
            element: <RequireRole roles={MONEY} />,
            children: [
              { path: '/ventas', element: <SalesPage /> },
              { path: '/caja', element: <CashPage /> },
              { path: '/gastos', element: <ExpensesPage /> },
            ],
          },
          {
            element: <RequireRole roles={BACK} />,
            children: [
              { path: '/inventarios', element: <InventoriesPage /> },
              { path: '/inventarios/:id', element: <InventoryDetailPage /> },
              { path: '/compras', element: <PurchasesPage /> },
              { path: '/compras/nueva', element: <PurchaseEditorPage /> },
              { path: '/compras/:id', element: <PurchaseEditorPage /> },
              { path: '/proveedores', element: <SuppliersPage /> },
              { path: '/proveedores/:id', element: <SupplierDetailPage /> },
              { path: '/excel', element: <ExcelPage /> },
            ],
          },
          {
            element: <RequireRole roles={REPORT} />,
            children: [{ path: '/reportes', element: <ReportsPage /> }],
          },
          {
            element: <RequireRole roles={['owner', 'manager']} />,
            children: [{ path: '/configuracion', element: <SettingsPage /> }],
          },
          {
            element: <RequireRole roles={['owner']} />,
            children: [{ path: '/usuarios', element: <UsersPage /> }],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
