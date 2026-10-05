import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { QuickHome } from '@/features/dashboard/QuickHome'
import { useCan } from '@/features/auth/useCan'

export function HomePage() {
  const canSeeDashboard = useCan('owner', 'manager', 'viewer')
  return canSeeDashboard ? <DashboardPage /> : <QuickHome />
}
