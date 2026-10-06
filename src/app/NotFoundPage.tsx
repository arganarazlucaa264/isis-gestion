import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center gap-3 p-10 text-center">
      <h1 className="text-4xl font-semibold">Página no encontrada</h1>
      <p className="text-sm text-bronze-600">La dirección no existe o no tenés acceso.</p>
      <Link to="/">
        <Button variant="gold">Volver al inicio</Button>
      </Link>
    </div>
  )
}
