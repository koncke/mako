// =============================================================================
// mes-del-periodo-server — «El mes» de General con el período de la hoja, leído de la base
// =============================================================================
// Las lecturas de verdad de ./mes-del-periodo.ts (las mismas de `getResumenComparativo` y de los desgloses del mes a la
// fecha), con el «hoy» del NEGOCIO. Lo llaman `armarDatosGeneral` (./datos.ts, para la hoja con que se abre la página) y la
// acción `mes-general` de /api/graficos (cuando la hoja o la vista eligen otro período).
//
// ⚠️ NO PASA POR `leerVistaGeneral` (lib/vista-general.ts), a propósito: esa lectura ESCRIBE (migra settings, adjunta
//    grabaciones) y no se llama desde un pedido que se repite cada vez que alguien cambia el período. Lo de «El mes» no
//    necesita nada de ella.
// ⚠️ NO TIENE GUARD DE ROL: es de quien la llama (la página de Focus y la ruta piden el admin con General en su capa). Sin
//    sesión, `getTenantDb()` cae al ws1 —un cliente—: nunca desde una ruta pública.
// =============================================================================

import 'server-only';
import { getAgendasBreakdown, getMarketingWindow, getRevenuePeriod, getSenalesRecon } from '@/lib/queries';
import { getRevenueBreakdowns } from '@/lib/pagos';
import { hoyEnWorkspace } from '@/lib/timezone';
import { armarMesDelPeriodo, type LecturasDelMes, type MesDeGeneral } from './mes-del-periodo';
import type { Leido } from './datos-tipos';

const LECTURAS: LecturasDelMes = {
  marketing: (d, h) => getMarketingWindow(d, h),
  revenue: (d, h) => getRevenuePeriod(d, h),
  desglose: (d, h) => getRevenueBreakdowns(d, h),
  agendas: (d, h) => getAgendasBreakdown(d, h),
  senales: (d, h) => getSenalesRecon(d, h),
};

/** «El mes» del período pedido. Nunca tira: lo que no se pudo leer viaja como `ok: false` o con el resumen en null. */
export async function leerMesDelPeriodo(pedido: { desde: string; hasta: string }): Promise<Leido<MesDeGeneral>> {
  try {
    const hoy = await hoyEnWorkspace();
    return { ok: true, d: await armarMesDelPeriodo(LECTURAS, pedido, hoy) };
  } catch (e) {
    console.error('[general] mes del período:', e instanceof Error ? e.message : e);
    return { ok: false, error: 'No pude leer el resumen del período.' };
  }
}
