// =============================================================================
// Admin › Finance › Income — la lectura (los movimientos de plata de MaKo)
// =============================================================================
// Las cuentas viven en finanzas.ts (puro, testeado). Cruza negocios: lo llama un page.tsx de /admin DESPUÉS de
// `exigirSuperAdmin()`. La fuente son los pedidos de Sales › Orders (`vistaOrders`, ./ventas-server.ts: lo que entró según
// `vistaDeIngresos()` con su recibo, y los recibos de «Cargar pago»), de los que el libro toma sólo lo que movió plata. Así un
// pago devuelto entra y sale en el libro, y en Orders es UN pedido con su estado (cada dato en un lugar).

import 'server-only'
import { vistaOrders } from './ventas-server'
import { movimientosDe, type DatosIngresos } from './finanzas'

export type { DatosIngresos }

export async function leerIngresos(): Promise<DatosIngresos> {
  try {
    const o = await vistaOrders()
    const filas = movimientosDe(o.pedidos)
    // Sin un solo movimiento y con algo que no se pudo leer, no es «todavía no entró nada»: es que no se pudo leer.
    if (filas.length === 0 && o.avisos.length > 0) return { ok: false, error: `No pude leer ${o.avisos.join('; ')}.` }
    return { ok: true, filas, hoy: o.hoy, avisos: o.avisos }
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message ? e.message : 'No pude leer lo que entró.' }
  }
}
