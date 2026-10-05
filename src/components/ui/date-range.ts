import { startOfMonthISO, todayISO } from '@/lib/format'

export interface Range {
  from: string
  to: string
}

export function defaultRange(): Range {
  const today = todayISO()
  return { from: startOfMonthISO(today), to: today }
}
