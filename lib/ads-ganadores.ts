// =============================================================================
// Los ganadores de Ads Analyst del negocio, como bloque para el prompt de quien escribe un guion (18/11/2026, O22)
// =============================================================================
// Las reglas (el piso, qué se dice de cada uno) en ./ads-ganadores-reglas.ts. Lo leen `generarGuion` (lib/razones.ts, el Ads
// Writer) y el Copywriter (lib/copywriter/ia.ts, en las piezas que se graban o se pautan).
//
// TENANT-SAFETY: `guionesConSenal` lee con `getTenantDb()` (script_analyses y marketing_metrics_daily del negocio en curso): los
// anuncios de otro negocio no entran. Nunca tira: es un AGREGADO al prompt, y sin él el guion se escribe igual (lo de antes).
// Con un tope de tiempo: leer las métricas de todo el histórico puede tardar, y no puede demorar la escritura.
// =============================================================================

import 'server-only';
import { guionesConSenal } from './ads-analyst';
import { getAngles, type Angle } from './script-angles';
import { contenidoNoConfiable } from './prompt-render-pure';
import { encabezadoDeGanadores, ganadoresConPiso, lineasDeGanadores, PISO_GANADOR } from './ads-ganadores-reglas';

const TOPE_MS = 5_000;

/** El bloque de lo que ya le funcionó al negocio, o '' si nada pasa el piso, no hay datos o no se pudo leer a tiempo. */
export async function ganadoresParaEscribir(): Promise<string> {
  let tope: ReturnType<typeof setTimeout> | undefined;
  try {
    const trabajo = (async () => {
      const ganadores = ganadoresConPiso(await guionesConSenal(), PISO_GANADOR);
      if (!ganadores.length) return '';
      const angulos = await getAngles().catch((): Angle[] => []);
      const nombre = (clave: string) => angulos.find((a) => a.key === clave)?.label ?? clave;
      return `${encabezadoDeGanadores(PISO_GANADOR)}\n${contenidoNoConfiable(lineasDeGanadores(ganadores, nombre).join('\n'), 'anuncios_del_negocio')}`;
    })();
    const vencio = new Promise<string>((resolve) => { tope = setTimeout(() => { console.warn('[ganadores] no llegué a leer los anuncios del negocio a tiempo: el guion sale sin ellos'); resolve(''); }, TOPE_MS); });
    return await Promise.race([trabajo, vencio]);
  } catch (e) {
    console.warn('[ganadores] no pude leer los anuncios del negocio (el guion sale sin ellos):', e instanceof Error ? e.message : e);
    return '';
  } finally {
    if (tope) clearTimeout(tope);
  }
}
