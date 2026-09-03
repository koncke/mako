// =============================================================================
// copygen-puente — el cliente que YA hizo la fábrica de creativos no la rehace
// =============================================================================
// Los cinco pasos del Copy Generator (`cg_entregable` … `cg_angulos`) vivían hasta el
// 03/09/2026 en el onboarding GLOBAL, con otras claves (`entregable`, `avatares`,
// `persona`, `personalidad`, `angulos`). Al mudarlos, el estado nuevo nace vacío: y
// `getEstadoTab` arranca del esqueleto, así que la tab figura **pendiente en el 100% de
// los workspaces**, incluidos los que la completaron hace meses.
//
// ⚠️ LO QUE ESO PROVOCA NO ES UNA MOLESTIA, ES UNA EXPULSIÓN. Con el `requiere` nuevo,
// un cliente que ayer filmaba anuncios abre /video-generator, `onboardingRequeridoPara`
// lo manda a /ads-writer, y ahí lo recibe un wizard de cinco pasos QUE NO TIENE SALIDA
// —a propósito, porque sin matriz la tab no tiene nada que mostrar— pidiéndole que
// vuelva a cargar lo que ya cargó. Es el modo de falla más caro de una migración: el
// que le pasa justo a los clientes que más avanzados estaban.
//
// Este puente lo evita leyendo lo que YA está contestado. No inventa nada y no pisa
// nada: solo marca `cg_X` cuando el paso viejo `X` figura hecho.
//
// ── POR QUÉ EL FLAG VIEJO Y NO EL DATO VIVO ────────────────────────────────
//
// La regla de la casa es «estado vivo, no recordado», y acá la excepción es deliberada:
// la pregunta que hay que contestar NO es «¿este workspace tiene avatares cargados?»
// sino «¿ESTE CLIENTE ya recorrió este paso?». Son distintas — un avatar sembrado por
// `clonar-dueno` no significa que la persona haya pasado por la pantalla — y la segunda
// es exactamente lo que el flag del onboarding global registra. Es el mismo dato,
// escrito por la misma persona, mudado de nombre.
//
// Corre una sola vez por workspace y es idempotente: `marcarPasoTab` relee el estado
// antes de escribir, y este módulo sale temprano si no hay nada que puentear.

import 'server-only';
import { getEstadoOnboarding } from './onboarding-state';
import { getEstadoTab, marcarPasoTab } from './tab-onboarding-state';
import type { PasoOnboarding } from './capas';

const TAB = 'ads-writer';

/**
 * Qué paso viejo cierra cuál nuevo, EN ORDEN.
 *
 * ⚠️ El orden importa y no es decorativo: `marcarPasoTab` valida contra el catálogo y
 * se niega a cerrar un paso si falta uno anterior. Recorrer este mapa al revés haría
 * fallar el primer `marcar` y dejaría el puente a medias — que es peor que no tenerlo,
 * porque deja la tab en un estado que nadie previó.
 */
const EQUIVALENCIAS: ReadonlyArray<readonly [PasoOnboarding, string]> = [
  ['entregable', 'cg_entregable'],
  ['avatares', 'cg_avatares'],
  ['persona', 'cg_persona'],
  ['personalidad', 'cg_personalidad'],
  ['angulos', 'cg_angulos'],
];

/**
 * Marca en el Copy Generator los pasos que el cliente ya cerró en el onboarding global.
 * Devuelve cuántos puenteó (0 = no había nada, que es el caso de todo cliente nuevo).
 *
 * No tira nunca: si algo falla, el cliente ve el wizard — molesto, pero no roto. Lo que
 * NO puede pasar es que una excepción acá tumbe la tab entera.
 */
export async function puentearPasosCopyGen(): Promise<number> {
  try {
    const tab = await getEstadoTab(TAB);
    // Ya está cerrada: no hay nada que puentear y no se toca nada.
    if (tab.status === 'done') return 0;

    const global = await getEstadoOnboarding();
    let n = 0;
    for (const [viejo, nuevo] of EQUIVALENCIAS) {
      // Solo lo que el cliente cerró DE VERDAD. Un paso `postergado` no cuenta: no lo
      // hizo, lo salteó — y ninguno de estos cinco es postergable, así que si aparece
      // así es que algo lo escribió mal y no hay que creerle.
      if (!global.steps?.[viejo]?.done) break;
      if (tab.steps[nuevo]?.done) { n++; continue; }
      await marcarPasoTab(TAB, nuevo);
      n++;
    }
    return n;
  } catch {
    return 0;
  }
}
