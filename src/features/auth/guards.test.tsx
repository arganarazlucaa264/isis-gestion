// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { AuthContext, type AuthState } from '@/features/auth/auth-context'
import { PublicOnly, RequireAuth, RequireRole } from '@/features/auth/guards'
import type { Profile } from '@/features/auth/roles'

afterEach(cleanup)

function profile(role: Profile['role'], active = true): Profile {
  return {
    id: 'u1',
    email: 'u@x.com',
    full_name: 'U',
    role,
    active,
    created_at: '',
    updated_at: '',
  }
}

function renderAt(path: string, state: Partial<AuthState>) {
  const value: AuthState = {
    status: 'ready',
    session: null,
    profile: null,
    signOut: () => Promise.resolve(),
    ...state,
  }
  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<PublicOnly />}>
            <Route index element={<div>login</div>} />
          </Route>
          <Route element={<RequireAuth />}>
            <Route path="/" element={<div>inicio</div>} />
            <Route element={<RequireRole roles={['owner']} />}>
              <Route path="/usuarios" element={<div>usuarios</div>} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('guards de rutas', () => {
  it('sin sesión redirige a /login', () => {
    renderAt('/', { status: 'signed_out' })
    expect(screen.getByText('login')).toBeTruthy()
  })

  it('mientras carga no muestra contenido protegido', () => {
    renderAt('/', { status: 'loading' })
    expect(screen.queryByText('inicio')).toBeNull()
    expect(screen.getByText('Cargando…')).toBeTruthy()
  })

  it('usuario desactivado ve el aviso de sin acceso', () => {
    renderAt('/', { status: 'no_access', profile: profile('owner', false) })
    expect(screen.getByText('Tu cuenta no tiene acceso')).toBeTruthy()
    expect(screen.queryByText('inicio')).toBeNull()
  })

  it('usuario autenticado accede a rutas generales', () => {
    renderAt('/', { profile: profile('cashier') })
    expect(screen.getByText('inicio')).toBeTruthy()
  })

  it('un cajero no accede a una ruta de dueño', () => {
    renderAt('/usuarios', { profile: profile('cashier') })
    expect(screen.queryByText('usuarios')).toBeNull()
    expect(screen.getByText('Sin permiso')).toBeTruthy()
  })

  it('el dueño accede a la ruta de dueño', () => {
    renderAt('/usuarios', { profile: profile('owner') })
    expect(screen.getByText('usuarios')).toBeTruthy()
  })

  it('con sesión válida /login redirige al inicio', () => {
    renderAt('/login', { profile: profile('owner') })
    expect(screen.getByText('inicio')).toBeTruthy()
  })
})
