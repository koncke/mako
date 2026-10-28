// =============================================================================
// gasto-meta-server — lee el gasto de Meta del mes y el estado de la cuenta, para contestar sin la IA (lib/gasto-meta.ts)
// =============================================================================
// Corre adentro del workspace del grupo (`runWithWorkspace` del doer): `getTenantDb` y `getMetaAccountHealth` leen las del
// negocio. Nada de esto escribe. Si algo no se puede leer, el texto lo dice («no lo tengo»): nunca un cero inventado.
//
// ⚠️ EL GASTO VA EN LA MONEDA DE LA CUENTA, y a dólares sólo con tasa (`aUsd`, que da null si no la hay). No `spend_usd` de
// `getMarketingWindow`: sale de `aUsdNum`, que devuelve el monto crudo de una moneda sin tasa (pesos argentinos como dólares)
// y divide por 17,3 si la moneda no se sabe (la revisión adversarial de 92d23e11d).
// =============================================================================

import 'server-only';
import { getTenantDb } from './workspace';
import { getMetaAccountHealth } from './meta-health';
import { conversorGastoMeta } from './moneda-meta';
import { leerTodo } from './supabase-paginado';
import { hoyEnWorkspace } from './timezone';
import { mesDelPedido, textoGastoMeta, type CuentaMeta, type GastoDelMes } from './gasto-meta';

export async function respuestaDeGastoMeta(texto: string): Promise<string> {
  const hoy = await hoyEnWorkspace();
  const mes = mesDelPedido(texto, hoy);
  const db = await getTenantDb();
  const [filas, ultimo, cuenta, conv] = await Promise.all([
    // Una fila por anuncio por día: paginado, con un orden único (el de lib/queries.ts, `ORDEN_METRICAS`).
    leerTodo<{ spend: number | null }>(db, 'marketing_metrics_daily', 'id, fecha, ad_id, spend', {
      orden: [{ col: 'fecha' }, { col: 'ad_id' }, { col: 'id' }], eq: { plataforma: 'meta' },
      filtros: (q) => q.gte('fecha', mes.desde).lte('fecha', mes.hasta),
    }).catch(() => null),
    // Para «desde cuándo no gasta» alcanza con que `spend` sea > 0, en la moneda que sea.
    db.from('marketing_metrics_daily').select('fecha').eq('plataforma', 'meta').gt('spend', 0).order('fecha', { ascending: false }).limit(1)
      .then((r) => (r.error ? null : ((r.data ?? [])[0] as { fecha?: string } | undefined)?.fecha ?? null), () => null),
    getMetaAccountHealth().then((h): CuentaMeta => ({ status: h.status, statusLabel: h.statusLabel, disableReasonLabel: h.disableReasonLabel, nombre: h.nombre }), () => null),
    conversorGastoMeta().catch(() => null),
  ]);
  const enLaCuenta = filas ? filas.reduce((s, f) => s + (Number(f.spend) || 0), 0) : null;
  const gasto: GastoDelMes | null = enLaCuenta == null ? null
    : { cuenta: enLaCuenta, moneda: conv?.moneda ?? null, usd: conv ? conv.aUsd(enLaCuenta) : null };
  return textoGastoMeta({ mes, gasto, filasMeta: filas ? filas.length : null, ultimoDiaConGasto: ultimo, cuenta });
}
