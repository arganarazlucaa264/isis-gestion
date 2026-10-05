import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AppLayout } from '@/app/AppLayout'
import { HomePage } from '@/app/HomePage'
import { NotFoundPage } from '@/app/NotFoundPage'
import { PublicOnly, RequireAuth, RequireRole } from '@/features/auth/guards'
import { LoginPage } from '@/features/auth/LoginPage'
import { UsersPage } from '@/features/users/UsersPage'

// Las rutas de cada feature se registran acá a medida que se implementan.
const router = createBrowserRouter([
  { path: '/login', element: <PublicOnly />, children: [{ index: true, element: <LoginPage /> }] },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <HomePage /> },
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
