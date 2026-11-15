// =============================================================================
// asesores/candado — hablar con los referentes es SÓLO de MaKo Pro (14/11/2026)
// =============================================================================
// Martín, sobre /planes: «el de 47 debería estar bien limitado y restrictivo… La idea es que compren el de 97, no el de 47»
// (el relevo que aprobó: docs/relevo/planes-que-incluye-cada-columna.md §4.3). El chat con los referentes es la fila 2 de la
// portada y hasta hoy no tenía NINGÚN tope: estaba igual en los tres planes. Ahora es `FUNCIONES_SOLO_PRO`, 'chat-referentes'
// (lib/topes-plan.ts), con el molde de lib/editor-landing/replicar-candado.ts.
//
// ⛔ CIERRA EL REFERENTE, NO EL SECOND BRAIN. El chat de MaKo, el grafo del negocio, el Ops Center, el Plan y los tableros
//    siguen enteros en los dos planes, a propósito: son el motor que hace que alguien se quede (lib/topes-plan.ts, la nota de
//    la prueba gratis). Lo que lleva candado es la conversación CON UN GURÚ y su Second Brain.
//
// LO QUE LO HACE GURÚ ES LA CLAVE DE LA CONVERSACIÓN, NO LA PANTALLA (lib/chat-mako-reglas.ts, `referenteDeTab`:
// `…:referente-<id>`). Por eso el candado se pregunta con la clave y no con la ruta: una conversación retomada desde la lista
// sigue siendo con él, y así queda cerrada igual. Lo frena cada puerta de /api/mako/chat: abrir la conversación (`?deTab=`),
// crearla (`action: 'new'` con su tab), mandarle un mensaje (`action: 'send'`) y su grafo (`?cerebroDe=`).
// ⚠️ ANTE LA DUDA, SE DEJA PASAR (lib/plan-esencial.ts): si no se puede leer el plan, no hay candado. Y es sólo para quien MaKo
//    le COBRA el Esencial por la pasarela: el ws1, los acuerdos a mano y la plataforma no lo ven.
// =============================================================================

import 'server-only';
import { esEsencialDe } from '../plan-esencial';
import { referenteDeTab } from '../chat-mako-reglas';
import { textoSoloPro } from '../topes-plan';

/**
 * El texto del candado si ese negocio paga MaKo Esencial, o null (pasa). `clave` es la tab o la clave de la conversación: si no
 * es de un gurú, no hay nada que cerrar. Nunca tira: si no se puede leer el plan, null.
 */
export async function candadoDeReferente(ws: number | null | undefined, clave: string | null | undefined): Promise<string | null> {
  try {
    if (!referenteDeTab(clave)) return null;
    return ws != null && (await esEsencialDe(ws)) ? textoSoloPro('chat-referentes') : null;
  } catch {
    return null;
  }
}

/** Lo mismo cuando ya se sabe que es un gurú (su grafo, `?cerebroDe=`): no hay clave que mirar, sólo el plan. */
export async function candadoDeReferentesDe(ws: number | null | undefined): Promise<string | null> {
  try {
    return ws != null && (await esEsencialDe(ws)) ? textoSoloPro('chat-referentes') : null;
  } catch {
    return null;
  }
}
