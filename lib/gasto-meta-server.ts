// =============================================================================
// gasto-meta-server — lee el gasto de Meta del mes y el estado de la cuenta, para contestar sin la IA (lib/gasto-meta.ts)
// =============================================================================
// Corre adentro del workspace del grupo (`runWithWorkspace` del doer): `getTenantDb` y `getMetaAccountHealth` leen las del
// negocio. Nada de esto escribe. Si algo no se puede leer, el texto lo dice («no lo tengo»): nunca un cero inventado.
// =============================================================================

import 'server-only';
import { getMarketingWindow } from './queries';
import { getTenantDb } from './workspace';
import { getMetaAccountHealth } from './meta-health';
import { hoyEnWorkspace } from './timezone';
import { mesDelPedido, textoGastoMeta, type CuentaMeta } from './gasto-meta';

export async function respuestaDeGastoMeta(texto: string): Promise<string> {
  const hoy = await hoyEnWorkspace();
  const mes = mesDelPedido(texto, hoy);
  const db = await getTenantDb();
  const [ventana, filas, ultimo, cuenta] = await Promise.all([
    getMarketingWindow(mes.desde, mes.hasta).catch(() => null),
    db.from('marketing_metrics_daily').select('fecha', { count: 'exact', head: true }).eq('plataforma', 'meta').gte('fecha', mes.desde).lte('fecha', mes.hasta)
      .then((r) => (r.error ? null : r.count ?? 0), () => null),
    // `spend` está en la moneda de la cuenta (lib/queries.ts): para «desde cuándo no gasta» alcanza con que sea > 0.
    db.from('marketing_metrics_daily').select('fecha').eq('plataforma', 'meta').gt('spend', 0).order('fecha', { ascending: false }).limit(1)
      .then((r) => (r.error ? null : ((r.data ?? [])[0] as { fecha?: string } | undefined)?.fecha ?? null), () => null),
    getMetaAccountHealth().then((h): CuentaMeta => ({ status: h.status, statusLabel: h.statusLabel, disableReasonLabel: h.disableReasonLabel, nombre: h.nombre }), () => null),
  ]);
  return textoGastoMeta({ mes, gastoUsd: ventana ? Number(ventana.spend_usd ?? 0) : null, filasMeta: filas, ultimoDiaConGasto: ultimo, cuenta });
}
