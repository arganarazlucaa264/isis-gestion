const TZ = 'America/Argentina/Buenos_Aires'

const dateFmt = new Intl.DateTimeFormat('es-AR', {
  timeZone: TZ,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})
const dateTimeFmt = new Intl.DateTimeFormat('es-AR', {
  timeZone: TZ,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
const isoDayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ })

/** Fecha corta (dd/mm/aaaa) en la zona horaria del local. Acepta ISO con o sin hora. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d =
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T12:00:00`)
      : new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : dateFmt.format(d)
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : dateTimeFmt.format(d)
}

/** Hoy (fecha de negocio) como AAAA-MM-DD. */
export function todayISO(now: Date = new Date()): string {
  return isoDayFmt.format(now)
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function startOfMonthISO(iso: string = todayISO()): string {
  return `${iso.slice(0, 7)}-01`
}

/** Número de documento legible: V-000123 */
export function docNumber(prefix: string, n: number | string): string {
  return `${prefix}-${String(n).padStart(6, '0')}`
}

/** Interpreta un número escrito por una persona: "1.234,50", "1234,5" o "1234.50". NaN si no es válido. */
export function parseDecimal(input: string): number {
  const s = input.trim().replace(/\s|\$/g, '')
  if (s === '') return Number.NaN
  if (s.includes(',') && s.includes('.')) {
    return s.lastIndexOf(',') > s.lastIndexOf('.')
      ? Number(s.replace(/\./g, '').replace(',', '.'))
      : Number(s.replace(/,/g, ''))
  }
  return Number(s.replace(',', '.'))
}
