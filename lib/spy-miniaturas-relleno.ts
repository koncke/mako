import 'server-only';

// =============================================================================
// spy-miniaturas-relleno — las miniaturas que la traída larga no alcanzó a bajar (4/11/2026)
// =============================================================================
// Aparte de lib/spy-miniaturas.ts a propósito: aquel lo importan tests sin base, y éste lee la tabla del negocio.
// =============================================================================

import { BUCKET_MINIATURAS, esNuestra, guardarMiniaturas } from './spy-miniaturas';
import { urlVencida } from './spy-vista';
import { getTenantDb } from './workspace';

/** Cuántas miniaturas sin bajar se toman por vuelta: entran en el presupuesto de `guardarMiniaturas`. */
export const RELLENO_POR_VUELTA = 60;

/**
 * Baja las miniaturas que quedaron apuntando al CDN de la red (4/11/2026, el Cerebro con Den Borg: «casi todas las tarjetitas del
 * gráfico son el degradado rosa de Instagram»). `guardarMiniaturas` corta a los 9 s: la traída larga guarda cientos de piezas de una
 * vez y sólo las primeras ~50-80 bajaban su foto; las demás quedaban con la URL del CDN, que vence en días y da 403 desde otro
 * dominio, y nadie las volvía a bajar. Esto lo hace de a `RELLENO_POR_VUELTA`, las más nuevas primero, mientras la URL sirve.
 * Nunca tira.
 */
export async function rellenarMiniaturas(competidorId: number, ahora = Date.now()): Promise<{ bajadas: number; vencidas: number }> {
  try {
    const db = await getTenantDb();
    const { data, error } = await db.from('spy_piezas').select('id, canal, ref, miniatura')
      .eq('competidor_id', competidorId).like('miniatura', 'https://%').not('miniatura', 'like', `%/${BUCKET_MINIATURAS}/%`)
      .order('publicada_en', { ascending: false, nullsFirst: false }).limit(RELLENO_POR_VUELTA * 3);
    if (error || !data?.length) return { bajadas: 0, vencidas: 0 };
    const filas = data as Array<{ id: number; canal: string; ref: string; miniatura: string }>;
    const vigentes = filas.filter((f) => !urlVencida(f.miniatura, ahora)).slice(0, RELLENO_POR_VUELTA);
    const vencidas = filas.length - filas.filter((f) => !urlVencida(f.miniatura, ahora)).length;
    if (!vigentes.length) return { bajadas: 0, vencidas };
    const bajadas = (await guardarMiniaturas(vigentes)).filter((f, i) => esNuestra(f.miniatura) && f.miniatura !== vigentes[i].miniatura);
    for (let i = 0; i < bajadas.length; i += 6) {
      await Promise.all(bajadas.slice(i, i + 6).map((f) => db.from('spy_piezas').update({ miniatura: f.miniatura }).eq('id', f.id).eq('competidor_id', competidorId)));
    }
    return { bajadas: bajadas.length, vencidas };
  } catch {
    return { bajadas: 0, vencidas: 0 };
  }
}
