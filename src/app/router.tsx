import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { HomePage } from '@/app/HomePage'

// Las rutas de cada feature se registran acá a medida que se implementan (Etapa 1 en adelante).
const router = createBrowserRouter([{ path: '/', element: <HomePage /> }])

export function AppRouter() {
  return <RouterProvider router={router} />
}
