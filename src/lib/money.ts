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

const numberFmt = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 })

/** Número con separadores argentinos (sin símbolo de moneda). */
export function formatNumber(n: number): string {
  return numberFmt.format(n)
}

const arsInt = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

/** Monto en pesos sin centavos (para tarjetas de resumen). */
export function formatMoneyInt(amount: number): string {
  return arsInt.format(amount)
}
