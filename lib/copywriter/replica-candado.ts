// =============================================================================
// copywriter/replica-candado — replicar el guion de otro es SÓLO de MaKo Pro (14/11/2026)
// =============================================================================
// Martín, sobre /planes: «el de 47 debería estar bien limitado y restrictivo. En cambio el de 97 ya podés generar avatares de
// IA, podés editar videos, podés replicar landing… La idea es que compren el de 97, no el de 47» (el relevo que aprobó:
// docs/relevo/planes-que-incluye-cada-columna.md §4.3). Escribir un guion desde cero sigue en los dos planes: lo que es de Pro
// es REPLICAR el de otro (lib/topes-plan.ts, `FUNCIONES_SOLO_PRO`, 'replicar-guion').
//
// ⚠️ ES LA MISMA PALANCA QUE 'replicar-landing', y por eso es el mismo molde (lib/editor-landing/replicar-candado.ts): copiar
//    lo que al otro ya le funciona es de Pro en los TRES lugares donde MaKo lo hace. El tercero, replicar un CARRUSEL, ya
//    estaba cerrado por 'ia-editores' (pasa por la IA del editor de imagen).
//
// Lo frena CADA puerta que crea la réplica, no la pantalla:
//   · `replicarOutlier()` (./outliers-servidor.ts): el botón «Replicar» de un outlier de copy, el de Competitors Spy y la
//     operación `replicar_outlier_copywriter` de la API de MaKo;
//   · `replicarPegado()` (./pegado-servidor.ts): lo que TRAE la persona (un link, un texto, un archivo) y la operación
//     `replicar_link_o_texto_copywriter`;
//   · `prepararReplica()` (./replica-servidor.ts): las preguntas de antes de escribir (lee las ofertas del negocio).
//   · las rutas de la pantalla (/api/copywriter y /api/copywriter/pegado): 403 con `pasarAPro`, como el scraper
//     (app/crm/grupo-wa-actions.ts, `candadoDePro`), para que el primer rechazo prenda el candado en todas las entradas.
// La pantalla (los outliers de Copywriting, el original abierto, «Replicar» de Competitors Spy) muestra el candado con
// `useSoloPro('replicar-guion')`, pero no es la defensa.
// ⚠️ ANTE LA DUDA, SE DEJA PASAR (lib/plan-esencial.ts): si no se puede leer el plan, no hay candado. Y es sólo para quien MaKo
//    le COBRA el Essential por la pasarela: el ws1, los acuerdos a mano y la plataforma no lo ven.
// =============================================================================

import 'server-only';
import { getWorkspaceActual, rutaConWs } from '../workspace';
import { esEsencialDe, esEsencialDeLaSesion } from '../plan-esencial';
import { RUTA_CAMBIAR_PLAN, textoSoloPro } from '../topes-plan';

/**
 * El texto del candado si el negocio paga MaKo Essential, o null. `ws`: el negocio (la API de MaKo corre dentro de su
 * `runWithWorkspace`); sin él, el del pedido. Nunca tira: si no se puede leer, null.
 */
export async function candadoDeReplicarGuion(ws?: number | null): Promise<string | null> {
  try {
    const w = ws === undefined ? await getWorkspaceActual() : ws;
    return w != null && (await esEsencialDe(w)) ? textoSoloPro('replicar-guion') : null;
  } catch {
    return null;
  }
}

/** El de las rutas de la pantalla: el texto y a dónde lleva «Pasar a Pro» (la forma de `candadoDePro` del scraper). */
export async function candadoDeReplicarGuionEnPantalla(): Promise<{ error: string; pasarAPro: string } | null> {
  if (!(await esEsencialDeLaSesion())) return null;
  return { error: textoSoloPro('replicar-guion'), pasarAPro: await rutaConWs(RUTA_CAMBIAR_PLAN) };
}
