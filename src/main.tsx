import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigError } from '@/app/ConfigError'
import { parseEnv } from '@/lib/env'
import '@/index.css'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('No se encontró el elemento #root')
const root = createRoot(rootElement)

async function start() {
  try {
    parseEnv(import.meta.env)
  } catch (error) {
    root.render(<ConfigError message={error instanceof Error ? error.message : String(error)} />)
    return
  }
  // La app se importa recién acá: el cliente de Supabase valida el entorno al cargarse.
  const { App } = await import('@/app/App')
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void start()
