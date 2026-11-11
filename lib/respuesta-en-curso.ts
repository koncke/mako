// =============================================================================
// respuesta-en-curso — el grupo donde una persona acaba de escribir, mientras MaKo le contesta (11/11/2026)
// =============================================================================
// Martín, 10/11/2026, desde su teléfono: «Mako en WhatsApp no responde... SIEMPRE debe responder, haz un relevo de eso para que no
// ocurra más». El freno de la línea (lib/linea-freno.ts) callaba TODO lo que escribe la línea de MaKo, también la respuesta en el
// grupo donde alguien acaba de escribir. Este contexto le dice a la puerta de Evolution (`ev`, lib/mako-grupo.ts) que lo que sale es
// la respuesta: la regla que lo deja pasar es `esRespuestaEnCurso` (lib/mako-salida-reglas.ts).
//
// ⚠️ SON DOS MARCAS, Y HACEN FALTA LAS DOS (la revisión del 11/11/2026):
//   · `conRespuestaA(jid)` la abren las entradas del turno (lib/mako-doer-in.ts: el webhook, el cron que levanta lo que quedó sin
//     contestar y el turno de la app): dice A QUÉ GRUPO se le contesta;
//   · `comoRespuesta(fn)` la abren SÓLO las puertas por donde MaKo dice su respuesta (el texto, el 👍, el «escribiendo…» del turno).
// Con la primera sola, todo lo que el turno dispara hacia ese grupo pasaba el freno: un aviso de la tarjeta «MaKo en WhatsApp» de un
// flujo que corre porque la persona movió un lead, o un `after()` registrado en el turno. Eso NO es la respuesta y sigue frenado.
//
// Sin `server-only`: lo prueba un test puro (tests/mako-responde-siempre.test.ts).
// =============================================================================

import { AsyncLocalStorage } from 'node:async_hooks';

type Turno = { grupo: string; respondiendo: boolean };
const store = new AsyncLocalStorage<Turno>();

/** Corre el turno sabiendo a qué grupo le contesta. Sólo un grupo: un chat 1 a 1 no abre nada. */
export function conRespuestaA<T>(jid: string, fn: () => T): T {
  if (!jid.endsWith('@g.us')) return fn();
  return store.run({ grupo: jid, respondiendo: false }, fn);
}

/** La puerta de la respuesta: lo que se manda adentro ES lo que MaKo le contesta a la persona. Fuera de un turno, no hace nada. */
export function comoRespuesta<T>(fn: () => T): T {
  const t = store.getStore();
  return t ? store.run({ grupo: t.grupo, respondiendo: true }, fn) : fn();
}

/** El grupo al que MaKo le está contestando en ESTE envío, o null (fuera de un turno, o algo que no es la respuesta). */
export const respondiendoA = (): string | null => {
  const t = store.getStore();
  return t?.respondiendo ? t.grupo : null;
};
