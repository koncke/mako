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
// sigue siendo con él, y así queda cerrada igual. Lo frenan las CINCO puertas de /api/mako/chat: abrir la conversación
// (`?deTab=`), crearla (`action: 'new'` con su tab), mandarle un mensaje (`action: 'send'`), su grafo (`?cerebroDe=`) y —desde
// la verificación adversarial del 14/11/2026— LEER EL HILO de una conversación de antes (`?sessionId=N&antes=1`, la quinta:
// devolvía todas las respuestas del gurú sin pasar por ninguna de las otras cuatro).
//
// ── Y LAS TRES PANTALLAS QUE ACONSEJAN CON SU FICHA SIN SER SU CHAT (14/11/2026, la misma verificación) ─────────────────────
// El Funnel Coach, cada conversación de Offer y el Marketing CoPilot corrían con el MISMO `contextoDeReferente(id)` que el chat
// del gurú (su ficha entera en cada mensaje) y con los tramos de su curso. Era la misma venta por otra pantalla. Ahí el candado
// NO devuelve 403: esas tres se venden en los tres planes (lib/planes-comparacion.ts, `enTodos`), así que lo que se cae es el
// REFERENTE y la pantalla queda entera. Se cierra DONDE SE ARMA EL CONTEXTO, que es lo único que lo cubre entero:
//   · app/api/mako/chat/route.ts → `contextoDelChat`: el coach corre con `contextoDelFunnelCoach(referente, sinReferentes)` y el
//     CoPilot con un perfil sin `referente` (le queda el MATERIAL DE APOYO, que no nombra a nadie);
//   · app/api/offer/route.ts → `referenteDelOfferCoach`: devuelve vacío, y MaKo aconseja con su criterio.
//   En las tres, `referente` viaja vacío: sin eso el Second Brain del turno cuelga igual el curso del gurú (lib/cerebro-para-chat.ts).
// ⚠️ EN EL COACH NO ALCANZA CON SOLTAR AL ELEGIDO, y el diagnóstico obvio era el equivocado: sin referente el coach cae en «TUS
//    FUENTES», que son TRES fichas atribuidas (17.272 caracteres contra 7.863 con uno al frente, medido el 14/11/2026). Soltarlo le
//    daba MÁS método de referentes que antes. Por eso `contextoDelFunnelCoach` tiene un tercer estado, `sinReferentes`, que no es lo
//    mismo que elegir «MaKo»: quien elige MaKo paga Pro igual y conserva los marcos.
//
// ⚠️ LAS DOS FORMAS DE FALLAR, y las dos son graves:
//   (a) una puerta abierta → el Esencial se lleva gratis lo que se vende en Pro;
//   (b) cerrarle la puerta a quien SÍ tiene derecho → MaKo Pro y el Acelerador (capa `agencia`, lib/planes-mako.ts), el super
//       admin (el ws de la plataforma) y los acuerdos a mano (el ws1) tienen que pasar. Los cubre `esEsencialPorPasarela`
//       (lib/plan-esencial-reglas.ts): pide `alta_capa = 'completo'` Y capa `completo`, y saca al ws1 y a la plataforma. La
//       prueba gratis de 7 días corre con los topes DEL PLAN QUE ELIGIÓ (decidido el 25/10/2026, lib/topes-plan.ts): la de Pro
//       pasa; la de Esencial ve el candado, como el resto de su plan.
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
