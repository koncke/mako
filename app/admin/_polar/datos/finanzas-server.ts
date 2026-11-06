// =============================================================================
// Admin › Finance › Income — la lectura (lo que entró a MaKo)
// =============================================================================
// Las cuentas viven en finanzas.ts (puro, testeado). Cruza negocios: lo llama un page.tsx de /admin DESPUÉS de
// `exigirSuperAdmin()`. La fuente es `vistaDeIngresos()` (lib/admin-ingresos.ts), la misma de Overview y de Analytics:
// los pagos de la PLATAFORMA (`wsSuperAdmin()`, nunca OWNER_WS) y sus cobros que ningún pago nombra.

import 'server-only'
import { vistaDeIngresos } from '@/lib/admin-ingresos'
import { filasDeIngresos, type DatosIngresos } from './finanzas'

export type { DatosIngresos }

export async function leerIngresos(): Promise<DatosIngresos> {
  try {
    const v = await vistaDeIngresos()
    return { ok: true, filas: filasDeIngresos(v.entradas), hoy: v.hoy, avisos: v.avisos }
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message ? e.message : 'No pude leer lo que entró.' }
  }
}
