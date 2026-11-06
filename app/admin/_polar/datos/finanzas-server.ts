// =============================================================================
// Admin › Finance › Income — la lectura (el libro de la plata de MaKo)
// =============================================================================
// Las cuentas viven en finanzas.ts (puro, testeado). Cruza negocios: lo llama un page.tsx de /admin DESPUÉS de
// `exigirSuperAdmin()`. La fuente son los pedidos de Admin › Sales › Orders (`vistaOrders`, ./ventas-server.ts): los mismos
// pagos, el mismo estado (devuelto, anulado) y los mismos totales que Orders (revisión del Cerebro del 6/11/2026, punto 26).

import 'server-only'
import { vistaOrders } from './ventas-server'
import { datosDelLibro, type DatosIngresos } from './finanzas'

export type { DatosIngresos }

export async function leerIngresos(): Promise<DatosIngresos> {
  try {
    const v = await vistaOrders()
    // Sin lo cobrado no hay libro: lo que queda (los recibos sueltos) no es lo que entró.
    if (!v.ingresosLeidos) return { ok: false, error: v.avisos.find((a) => a.startsWith('lo cobrado:'))?.replace(/^lo cobrado:\s*/, '') || 'No pude leer lo que entró.' }
    return datosDelLibro(v.pedidos, v.hoy, v.avisos)
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message ? e.message : 'No pude leer lo que entró.' }
  }
}
