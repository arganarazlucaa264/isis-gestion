import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-3 p-10 text-center">
      <h1 className="text-xl font-semibold">Página no encontrada</h1>
      <Link to="/" className="text-slate-700 underline">
        Volver al inicio
      </Link>
    </main>
  )
}
