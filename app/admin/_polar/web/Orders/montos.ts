// La plata de Admin › Sales: dólares con el formato de Polar (`formatCurrency`, recibe centavos) y cualquier otra moneda (un recibo
// en USDT, en pesos) con el de los cobros de MaKo (lib/pasarela-moneda.ts): Intl no conoce «USDT» y tira.

import { formatCurrency } from '@/app/admin/_polar/lib/currency'
import { formatoMonto } from '@/lib/pasarela-moneda'

type Modo = 'compact' | 'standard' | 'accounting' | 'statistics'

/** Dólares de verdad → «US$ 1.234,56». null → «—» (sin su valor en dólares: no se convierte). */
export const usdEnTexto = (usd: number | null | undefined, modo: Modo = 'accounting'): string =>
  usd == null || !Number.isFinite(usd) ? '—' : formatCurrency(modo)(Math.round(usd * 100), 'usd')

/** Un monto en su moneda. */
export const montoEnTexto = (monto: number, moneda: string, modo: Modo = 'accounting'): string =>
  moneda.toUpperCase() === 'USD' ? usdEnTexto(monto, modo) : formatoMonto(monto, moneda)
