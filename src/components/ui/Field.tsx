import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { cx } from '@/lib/cx'

const CONTROL =
  'w-full rounded-lg border border-sand-300 bg-white px-3 text-sm text-ink-900 placeholder:text-sand-400 ' +
  'focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-400/40 disabled:bg-sand-100 disabled:text-ink-600'

interface FieldProps {
  label?: string
  hint?: string
  error?: string | null | undefined
  className?: string
  children: (id: string) => ReactNode
}

export function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId()
  return (
    <div className={cx('flex flex-col gap-1', className)}>
      {label && (
        <label
          htmlFor={id}
          className="text-xs font-semibold tracking-wide text-bronze-600 uppercase"
        >
          {label}
        </label>
      )}
      {children(id)}
      {error ? (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-bronze-500">{hint}</p>
      )}
    </div>
  )
}

type FieldWrap = {
  label?: string
  hint?: string
  error?: string | null | undefined
  wrapperClassName?: string
}

export function Input({
  label,
  hint,
  error,
  wrapperClassName,
  className,
  ...rest
}: FieldWrap & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} hint={hint} error={error} className={wrapperClassName}>
      {(id) => (
        <input
          id={id}
          className={cx(CONTROL, 'h-10', error && 'border-red-600', className)}
          {...rest}
        />
      )}
    </Field>
  )
}

export function Select({
  label,
  hint,
  error,
  wrapperClassName,
  className,
  children,
  ...rest
}: FieldWrap & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Field label={label} hint={hint} error={error} className={wrapperClassName}>
      {(id) => (
        <select
          id={id}
          className={cx(CONTROL, 'h-10 pr-8', error && 'border-red-600', className)}
          {...rest}
        >
          {children}
        </select>
      )}
    </Field>
  )
}

export function Textarea({
  label,
  hint,
  error,
  wrapperClassName,
  className,
  ...rest
}: FieldWrap & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Field label={label} hint={hint} error={error} className={wrapperClassName}>
      {(id) => (
        <textarea
          id={id}
          rows={3}
          className={cx(CONTROL, 'py-2', error && 'border-red-600', className)}
          {...rest}
        />
      )}
    </Field>
  )
}

export function Checkbox({
  label,
  className,
  ...rest
}: { label: string } & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return (
    <label className={cx('inline-flex cursor-pointer items-center gap-2 text-sm', className)}>
      <input type="checkbox" className="size-4 rounded border-sand-400 accent-gold-500" {...rest} />
      {label}
    </label>
  )
}
