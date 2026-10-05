import type { IconName } from '@/components/ui/Icon'
import { ALL_ROLES, type AppRole } from '@/features/auth/roles'

export interface NavItem {
  to: string
  label: string
  icon: IconName
  roles: readonly AppRole[]
}

export interface NavGroup {
  title: string | null
  items: readonly NavItem[]
}

const STAFF: readonly AppRole[] = ['owner', 'manager']
const SELL: readonly AppRole[] = ['owner', 'manager', 'cashier']
const MONEY: readonly AppRole[] = ['owner', 'manager', 'cashier', 'viewer']
const BACK: readonly AppRole[] = ['owner', 'manager', 'stock_clerk', 'viewer']
const REPORT: readonly AppRole[] = ['owner', 'manager', 'viewer']

// Ocultar un ítem es solo UI: el acceso real lo define RLS y los permisos de cada RPC.
export const NAV_GROUPS: readonly NavGroup[] = [
  { title: null, items: [{ to: '/', label: 'Inicio', icon: 'home', roles: ALL_ROLES }] },
  {
    title: 'Operación',
    items: [
      { to: '/vender', label: 'Vender', icon: 'cart', roles: SELL },
      { to: '/ventas', label: 'Ventas', icon: 'receipt', roles: MONEY },
      { to: '/caja', label: 'Caja', icon: 'wallet', roles: MONEY },
      { to: '/gastos', label: 'Gastos', icon: 'dollar', roles: MONEY },
    ],
  },
  {
    title: 'Catálogo',
    items: [
      { to: '/productos', label: 'Productos', icon: 'package', roles: ALL_ROLES },
      { to: '/stock', label: 'Stock', icon: 'layers', roles: ALL_ROLES },
      { to: '/inventarios', label: 'Inventario físico', icon: 'clipboard', roles: BACK },
    ],
  },
  {
    title: 'Abastecimiento',
    items: [
      { to: '/compras', label: 'Compras', icon: 'truck', roles: BACK },
      { to: '/proveedores', label: 'Proveedores', icon: 'users', roles: BACK },
    ],
  },
  {
    title: 'Análisis',
    items: [
      { to: '/reportes', label: 'Reportes', icon: 'chart', roles: REPORT },
      { to: '/excel', label: 'Excel', icon: 'sheet', roles: BACK },
    ],
  },
  {
    title: 'Administración',
    items: [
      { to: '/configuracion', label: 'Configuración', icon: 'sliders', roles: STAFF },
      { to: '/usuarios', label: 'Usuarios', icon: 'user', roles: ['owner'] },
    ],
  },
]
