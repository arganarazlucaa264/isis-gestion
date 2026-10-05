import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Icon, type IconName } from '@/components/ui/Icon'
import { cx } from '@/lib/cx'

type Variant = 'primary' | 'gold' | 'outline' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink-900 text-cream-50 hover:bg-ink-700 focus-visible:outline-gold-500',
  gold: 'bg-gold-500 text-ink-950 hover:bg-gold-400 focus-visible:outline-ink-900',
  outline:
    'border border-sand-400 bg-cream-50 text-ink-900 hover:bg-sand-100 focus-visible:outline-gold-500',
  ghost: 'text-ink-800 hover:bg-sand-200 focus-visible:outline-gold-500',
  danger: 'bg-red-700 text-white hover:bg-red-600 focus-visible:outline-red-700',
}
const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: IconName
  loading?: boolean
  children?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: Props) {
  return (
    <button
      type={type}
      disabled={disabled === true || loading}
      className={cx(
        'inline-flex items-center justify-center rounded-lg font-medium whitespace-nowrap transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />
      )}
      {children}
    </button>
  )
}
