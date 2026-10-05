import { formatMoney } from '@/lib/money'

export interface BarDatum {
  label: string
  value: number
}

/** Gráfico de barras en SVG (sin dependencias). Los valores se muestran como pesos por defecto. */
export function BarChart({
  data,
  height = 180,
  format = formatMoney,
  ariaLabel,
}: {
  data: BarDatum[]
  height?: number
  format?: (n: number) => string
  ariaLabel: string
}) {
  const max = Math.max(1, ...data.map((d) => d.value))
  const W = 100
  const gap = 1.2
  const barW = (W - gap * (data.length - 1)) / Math.max(1, data.length)
  const plotH = height - 24
  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={ariaLabel}
        className="h-auto w-full"
        style={{ height }}
      >
        {[0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={0}
            x2={W}
            y1={plotH * (1 - t)}
            y2={plotH * (1 - t)}
            stroke="#dccfb4"
            strokeWidth={0.2}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {data.map((d, i) => {
          const h = (d.value / max) * plotH
          return (
            <g key={`${d.label}-${i}`}>
              <rect
                x={i * (barW + gap)}
                y={plotH - h}
                width={barW}
                height={Math.max(h, d.value > 0 ? 0.6 : 0)}
                rx={0.6}
                fill={i === data.length - 1 ? '#b98f3e' : '#6b4a2f'}
              >
                <title>{`${d.label}: ${format(d.value)}`}</title>
              </rect>
            </g>
          )
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-bronze-500">
        <span>{data[0]?.label}</span>
        <span>{data.at(-1)?.label}</span>
      </div>
    </figure>
  )
}

export function HBarList({
  data,
  format = formatMoney,
  tone = 'gold',
}: {
  data: BarDatum[]
  format?: (n: number) => string
  tone?: 'gold' | 'bronze' | 'ink'
}) {
  const max = Math.max(1, ...data.map((d) => Math.abs(d.value)))
  const color = { gold: 'bg-gold-500', bronze: 'bg-bronze-500', ink: 'bg-ink-800' }[tone]
  return (
    <ul className="space-y-2">
      {data.map((d) => (
        <li key={d.label}>
          <div className="mb-0.5 flex justify-between gap-2 text-sm">
            <span className="truncate">{d.label}</span>
            <span className="font-medium tabular-nums">{format(d.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-sand-200">
            <div
              className={`h-2 rounded-full ${color}`}
              style={{ width: `${(Math.abs(d.value) / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
