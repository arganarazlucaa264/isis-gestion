import { useEffect, type ReactNode } from 'react'
import { Icon } from '@/components/ui/Icon'
import { cx } from '@/lib/cx'

interface Props {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const WIDTH = { sm: 'sm:max-w-md', md: 'sm:max-w-xl', lg: 'sm:max-w-3xl', xl: 'sm:max-w-5xl' }

/** Diálogo accesible: en el celular sube como hoja inferior, en pantallas grandes se centra. */
export function Modal({ open, title, onClose, children, footer, size = 'md' }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink-950/60" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          'relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-cream-50 shadow-2xl sm:rounded-2xl',
          WIDTH[size],
        )}
      >
        <header className="flex items-center justify-between border-b border-sand-200 px-5 py-3">
          <h2 className="text-2xl font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-bronze-600 hover:bg-sand-200"
            aria-label="Cerrar"
          >
            <Icon name="x" />
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="flex flex-wrap justify-end gap-2 border-t border-sand-200 px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}
