import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import type { Range } from '@/components/ui/date-range'
import { addDaysISO, startOfMonthISO, todayISO } from '@/lib/format'

export function DateRange({ value, onChange }: { value: Range; onChange: (range: Range) => void }) {
  const today = todayISO()
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Input
        label="Desde"
        type="date"
        value={value.from}
        max={value.to}
        onChange={(e) => {
          onChange({ ...value, from: e.target.value })
        }}
      />
      <Input
        label="Hasta"
        type="date"
        value={value.to}
        min={value.from}
        onChange={(e) => {
          onChange({ ...value, to: e.target.value })
        }}
      />
      <div className="flex gap-1">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            onChange({ from: today, to: today })
          }}
        >
          Hoy
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            onChange({ from: addDaysISO(today, -6), to: today })
          }}
        >
          7 días
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            onChange({ from: startOfMonthISO(today), to: today })
          }}
        >
          Este mes
        </Button>
      </div>
    </div>
  )
}
