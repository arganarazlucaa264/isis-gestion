import { cx } from '@/lib/cx'

export interface TabItem<T extends string> {
  value: T
  label: string
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: readonly TabItem<T>[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto border-b border-sand-300">
      {items.map((item) => (
        <button
          key={item.value}
          role="tab"
          type="button"
          aria-selected={item.value === value}
          onClick={() => {
            onChange(item.value)
          }}
          className={cx(
            '-mb-px border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors',
            item.value === value
              ? 'border-gold-500 text-ink-900'
              : 'border-transparent text-bronze-500 hover:text-ink-900',
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
