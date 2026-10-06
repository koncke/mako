import 'server-only';
// =============================================================================
// Landing Analyst analiza SOLO las páginas que se declaran en el Pixel
// =============================================================================
// Pedido de Martín (06/10/2026): «si yo pongo una nueva landing en el pixel,
// automáticamente la tiene que analizar la funcion de Landing Analyst. Que eso
// corra por detrás claro».
//
// Medido ese día: de 7 páginas declaradas en 4 negocios, 4 nunca se habían
// analizado. Nada conectaba el Pixel con Landing Analyst: una página entraba sólo
// si alguien la pegaba a mano.
//
// CÓMO:
//   · La decisión es un CÁLCULO (`faltanAnalizar`, lib/landing-url.ts): las
//     declaradas sin fila. No se mira «qué cambió en este guardado»: así ningún
//     camino que agregue una página se tiene que acordar de avisar.
//   · Se dispara después de guardar (`after()`, por detrás: la persona no espera)
//     y un cron cada hora hace de red para lo que se cortó o lo que entró por otro
//     lado.
//   · ⚠️ RECLAMO ATÓMICO contra el índice único (workspace_id, url): se inserta la
//     fila `pendiente` con `ignoreDuplicates`, y sólo quien la insertó analiza. Dos
//     guardados seguidos, o el guardado y el cron a la vez, no analizan dos veces
//     ni gastan dos veces la cuota de IA del cliente.
//   · ⚠️ SÓLO LAS DECLARADAS, NUNCA las que vio el Pixel: `landing_visits` lo escribe
//     un endpoint público con un token visible en el HTML, así que cualquiera podría
//     elegir a qué URL sale nuestro server y cuánta IA se gasta.
//   · El análisis corre con la cascada GRATIS del negocio (`landing-analyst`:
//     Gemini y los gratis; Claude está vetado).
// =============================================================================
import { after } from 'next/server';
import { getTenantDb, getWorkspaceActual, runWithWorkspace } from './workspace';
import { landingsDelWorkspace } from './landing-config-leer';
import { esPreviewDeEditor } from './landing-paginas';
import { analizarLanding, marcarAnalisisCortado } from './landing-analyst';
import { analisisCortado, faltanAnalizar } from './landing-url';

/** Lo que se reserva para UN análisis: no se arranca uno que no llega a terminar. */
const RESERVA_MS = 120_000;

export type ResultadoAuto = { declaradas: number; analizadas: string[]; fallidas: string[]; sinTiempo: string[]; cortadas: number };

/**
 * Analiza las declaradas que no tienen fila, hasta `deadline` (ms absolutos).
 * Corre en el workspace del contexto.
 */
export async function asegurarAnalisisDeDeclaradas(opts: { deadline?: number } = {}): Promise<ResultadoAuto> {
  const r: ResultadoAuto = { declaradas: 0, analizadas: [], fallidas: [], sinTiempo: [], cortadas: 0 };
  const declaradas = (await landingsDelWorkspace()).map((l) => l.url).filter((u) => !esPreviewDeEditor(u));
  r.declaradas = declaradas.length;

  const db = await getTenantDb();
  const { data, error } = await db.from('landing_analyses').select('url, status, updated_at');
  if (error) throw new Error(`No se pudo leer Landing Analyst: ${error.message}`);
  const filas = (data ?? []) as Array<{ url: string; status: string | null; updated_at: string | null }>;

  // Un `pendiente` viejo es un trabajo de fondo que murió (el corte de la
  // plataforma, un deploy en el medio). Pasa a error con su motivo, que la pantalla
  // ofrece reintentar con un clic. No se reintenta solo: gastaría cuota en bucle.
  const ahora = Date.now();
  for (const f of filas) {
    if (analisisCortado(f.status, f.updated_at, ahora)) {
      await marcarAnalisisCortado(f.url).catch(() => {});
      r.cortadas++;
    }
  }

  for (const url of faltanAnalizar(declaradas, filas.map((f) => f.url))) {
    if (opts.deadline && Date.now() + RESERVA_MS > opts.deadline) { r.sinTiempo.push(url); continue; }
    // El reclamo: sólo quien inserta la fila pendiente sigue.
    const { data: tomada, error: eReclamo } = await db
      .from('landing_analyses')
      .upsert({ url, status: 'pendiente', updated_at: new Date().toISOString() }, { onConflict: 'workspace_id,url', ignoreDuplicates: true })
      .select('url');
    if (eReclamo || !tomada?.length) continue;
    try {
      const res = await analizarLanding(url, undefined, { origen: 'auto' });
      (res.ok ? r.analizadas : r.fallidas).push(url);
    } catch (err) {
      // Un throw inesperado no puede dejar la fila en `pendiente` para siempre.
      await marcarAnalisisCortado(url, err instanceof Error ? err.message : String(err)).catch(() => {});
      r.fallidas.push(url);
    }
  }
  return r;
}

/**
 * Después de guardar las páginas del Pixel: analiza las nuevas POR DETRÁS.
 *
 * `after()` corre fuera del contexto del workspace, así que se captura `ws` acá y
 * se vuelve a entrar (sin eso, getTenantDb caería a otro inquilino sin avisar). Su
 * techo es el `maxDuration` de la página que llamó (app/integraciones/page.tsx lo
 * declara en 300). Fuera de un request —un script— `after()` tira y se corre en
 * línea. Nunca rompe el guardado: es lo que vino a hacer la persona.
 */
export async function programarAnalisisDeclaradas(): Promise<void> {
  let ws: number | null = null;
  try { ws = await getWorkspaceActual(); } catch { return; }
  if (ws == null) return;
  const quien = ws;
  const trabajo = () => runWithWorkspace(quien, async () => {
    try {
      const r = await asegurarAnalisisDeDeclaradas({ deadline: Date.now() + 270_000 });
      if (r.analizadas.length || r.fallidas.length) {
        console.log(`[landing-analyst:auto] ws ${quien}: analizadas=${r.analizadas.length} fallidas=${r.fallidas.length} sinTiempo=${r.sinTiempo.length}`);
      }
    } catch (err) {
      console.error(`[landing-analyst:auto] ws ${quien} falló: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  try { after(trabajo); } catch { void trabajo(); }
}
