// =============================================================================
// ventas-crm — las VENTAS de los CRMs agregados (una renovación): lo que suma a «Firmado» además de la casa
// =============================================================================
// CO2 del plan del Cerebro (22/10/2026). Desde la 0324 un CRM agregado tiene su propia venta (monto, fecha de cierre y tipo,
// en su fila de `lead_funnel`), pero «Firmado» (Sold Revenue) sólo sumaba `leads.monto_cierre_usd` de los ganados: una
// renovación vendida no contaba en ningún número. Desde acá la leen todos los que suman lo firmado: el Revenue del
// período y su desglose, la serie por mes, el objetivo, los OKR y KPIs (lib/objectives-fuentes.ts) y los conjuntos
// «Negocio» y «Revenue» del Dashboard. La regla de qué cuenta es pura (`ventasDeFilas`, lib/pagos-crm.ts) y tiene test.
//
// Sin la 0324 (las columnas no están) no hay ventas de CRMs: devuelve vacío y lo dice el log, nunca tira el Revenue.
// =============================================================================

import 'server-only';
import { getTenantDb } from './workspace';
import { leerTodo } from './supabase-paginado';
import { ventasDeFilas, type VentaDeCrm } from './pagos-crm';

export type { VentaDeCrm } from './pagos-crm';

/** Las ventas de los CRMs agregados con su fecha de cierre en [desde, hasta] (null = sin borde). */
export async function ventasDeCrms(desde: string | null, hasta: string | null): Promise<VentaDeCrm[]> {
  const db = await getTenantDb();
  try {
    const [filas, def] = await Promise.all([
      leerTodo<Record<string, unknown>>(db, 'lead_funnel', '*, leads(nombre, funnel_id)', {
        orden: 'id',
        filtros: (q) => {
          let x = q.eq('etapa', 'ganado').not('monto_cierre_usd', 'is', null).not('fecha_cierre', 'is', null);
          if (desde) x = x.gte('fecha_cierre', desde);
          if (hasta) x = x.lte('fecha_cierre', hasta);
          return x;
        },
      }),
      db.from('funnels').select('id').eq('es_default', true).limit(1).maybeSingle(),
    ]);
    const casaDelNegocio = def.data ? Number((def.data as { id: number }).id) : null;
    return ventasDeFilas(filas, casaDelNegocio);
  } catch (e) {
    console.error('[ventas-crm] sin las ventas de los CRMs agregados:', e instanceof Error ? e.message : String(e));
    return [];
  }
}

/** Lo firmado en los CRMs agregados en el período: la suma (para los totales que no listan). */
export async function firmadoEnCrms(desde: string | null, hasta: string | null): Promise<{ usd: number; cierres: number }> {
  const v = await ventasDeCrms(desde, hasta);
  return { usd: v.reduce((s, x) => s + x.monto, 0), cierres: v.length };
}
