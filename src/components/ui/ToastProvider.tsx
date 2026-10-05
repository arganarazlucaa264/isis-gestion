import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { ToastContext, type ToastApi } from '@/components/ui/toast-context'
import { cx } from '@/lib/cx'

interface Item {
  id: number
  kind: 'success' | 'error'
  message: string
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([])

  const push = useCallback((kind: Item['kind'], message: string) => {
    const id = Date.now() + Math.random()
    setItems((prev) => [...prev, { id, kind, message }])
    window.setTimeout(
      () => {
        setItems((prev) => prev.filter((i) => i.id !== id))
      },
      kind === 'error' ? 7000 : 3500,
    )
  }, [])

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => {
        push('success', m)
      },
      error: (m) => {
        push('error', m)
      },
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed right-3 bottom-3 left-3 z-[60] flex flex-col items-end gap-2 sm:left-auto">
        {items.map((i) => (
          <div
            key={i.id}
            role={i.kind === 'error' ? 'alert' : 'status'}
            className={cx(
              'pointer-events-auto max-w-md rounded-lg px-4 py-3 text-sm shadow-lg',
              i.kind === 'error' ? 'bg-red-700 text-white' : 'bg-ink-900 text-cream-50',
            )}
          >
            {i.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
