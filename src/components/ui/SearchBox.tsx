import { Icon } from '@/components/ui/Icon'
import { cx } from '@/lib/cx'

export function SearchBox({
  value,
  onChange,
  placeholder = 'Buscar…',
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div className={cx('relative', className)}>
      <Icon
        name="search"
        size={16}
        className="absolute top-1/2 left-3 -translate-y-1/2 text-bronze-400"
      />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value)
        }}
        className="h-10 w-full rounded-lg border border-sand-300 bg-white pr-3 pl-9 text-sm focus:border-gold-500 focus:ring-2 focus:ring-gold-400/40 focus:outline-none"
      />
    </div>
  )
}
