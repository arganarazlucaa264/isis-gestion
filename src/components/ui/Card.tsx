import type { ReactNode } from 'react'
import { Icon } from '@/components/ui/Icon'
import { cx } from '@/lib/cx'

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cx('rounded-xl border border-sand-200 bg-cream-50 shadow-sm', className)}>
      {children}
    </section>
  )
}

export function CardHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-sand-200 px-4 py-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      {actions}
    </header>
  )
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl leading-tight font-semibold text-ink-900">{title}</h1>
          {description && <p className="mt-1 text-sm text-bronze-600">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className="print-strip mt-3 rounded-full" />
    </div>
  )
}

type Tone = 'neutral' | 'gold' | 'green' | 'red' | 'amber' | 'dark'
const TONES: Record<Tone, string> = {
  neutral: 'bg-sand-200 text-ink-800',
  gold: 'bg-gold-300/50 text-bronze-700',
  green: 'bg-emerald-100 text-emerald-900',
  red: 'bg-red-100 text-red-900',
  amber: 'bg-amber-100 text-amber-900',
  dark: 'bg-ink-900 text-cream-50',
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        TONES[tone],
      )}
    >
      {children}
    </span>
  )
}

export function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: 'neutral' | 'gold' | 'dark' | 'danger'
}) {
  const styles = {
    neutral: 'bg-cream-50 text-ink-900 border-sand-200',
    gold: 'bg-gold-500 text-ink-950 border-gold-600',
    dark: 'bg-ink-900 text-cream-50 border-ink-700',
    danger: 'bg-red-50 text-red-900 border-red-200',
  }[tone]
  return (
    <div className={cx('rounded-xl border p-4 shadow-sm', styles)}>
      <p className="text-xs font-semibold tracking-wide uppercase opacity-70">{label}</p>
      <p className="mt-1 text-[clamp(1.25rem,1.9vw,1.875rem)] leading-tight font-semibold tabular-nums">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs opacity-70">{hint}</p>}
    </div>
  )
}

export function Spinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 p-8 text-bronze-600" role="status">
      <span className="size-5 animate-spin rounded-full border-2 border-gold-500 border-t-transparent" />
      <span className="text-sm">{label}</span>
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 p-10 text-center">
      <p className="text-2xl font-semibold text-bronze-700">{title}</p>
      {description && <p className="max-w-md text-sm text-bronze-500">{description}</p>}
      {action}
    </div>
  )
}

export function ErrorState({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : 'Ocurrió un error inesperado'
  return (
    <div
      role="alert"
      className="m-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900"
    >
      <Icon name="alert" size={18} />
      <span>{message}</span>
    </div>
  )
}

/** Resuelve el estado de una consulta: cargando / error / vacío / contenido. */
export function QueryBoundary<T>({
  query,
  empty,
  children,
}: {
  query: { isPending: boolean; isError: boolean; error: unknown; data: T | undefined }
  empty?: { check: (data: T) => boolean; node: ReactNode }
  children: (data: T) => ReactNode
}) {
  if (query.isPending) return <Spinner />
  if (query.isError) return <ErrorState error={query.error} />
  if (query.data === undefined) return null
  if (empty?.check(query.data)) return <>{empty.node}</>
  return <>{children(query.data)}</>
}
