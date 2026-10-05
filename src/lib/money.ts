const ars = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Formatea un monto en pesos argentinos. */
export function formatMoney(amount: number): string {
  return ars.format(amount)
}

/** Redondea a 2 decimales sin errores de punto flotante típicos (1.005 → 1.01). */
export function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100
}
