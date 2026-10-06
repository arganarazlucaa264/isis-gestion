import { Link } from 'react-router-dom'
import { Badge, Card, PageHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/auth-context'
import { ROLE_LABELS } from '@/features/auth/roles'
import { useOpenSession } from '@/features/cash/useOpenSession'
import { docNumber, formatDateTime } from '@/lib/format'

/** Inicio para roles sin acceso a reportes (vendedor/cajero, depósito). */
export function QuickHome() {
  const { profile } = useAuth()
  const { session } = useOpenSession()
  const role = profile?.role
  return (
    <>
      <PageHeader
        title={`Hola, ${profile?.full_name ?? ''}`}
        description={role ? ROLE_LABELS[role] : ''}
      />
      <div className="grid gap-4 md:grid-cols-2">
        {(role === 'cashier' || role === 'manager' || role === 'owner') && (
          <Card className="p-5">
            <h2 className="text-2xl font-semibold">Caja</h2>
            {session ? (
              <p className="mt-1 text-sm text-bronze-600">
                <Badge tone="green">Abierta</Badge> {docNumber('C', session.number)} desde{' '}
                {formatDateTime(session.opened_at)}
              </p>
            ) : (
              <p className="mt-1 text-sm text-bronze-600">No hay una caja abierta.</p>
            )}
            <div className="mt-4 flex gap-2">
              <Link to="/caja">
                <Button variant="outline">{session ? 'Ver caja' : 'Abrir caja'}</Button>
              </Link>
              <Link to="/vender">
                <Button variant="gold" icon="cart">
                  Vender
                </Button>
              </Link>
            </div>
          </Card>
        )}
        {role === 'stock_clerk' && (
          <Card className="p-5">
            <h2 className="text-2xl font-semibold">Depósito</h2>
            <p className="mt-1 text-sm text-bronze-600">
              Stock, inventarios y recepción de mercadería.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/stock">
                <Button variant="outline">Stock</Button>
              </Link>
              <Link to="/inventarios">
                <Button variant="outline">Inventarios</Button>
              </Link>
              <Link to="/compras">
                <Button variant="gold">Recibir compras</Button>
              </Link>
            </div>
          </Card>
        )}
      </div>
    </>
  )
}
