// =============================================================================
// respuesta-en-curso — el grupo donde una persona acaba de escribir, mientras MaKo le contesta (11/11/2026)
// =============================================================================
// Martín, 10/11/2026, desde su teléfono: «Mako en WhatsApp no responde... SIEMPRE debe responder, haz un relevo de eso para que no
// ocurra más». El freno de la línea (lib/linea-freno.ts) callaba TODO lo que escribe la línea de MaKo, también la respuesta en el
// grupo donde alguien acaba de escribir. Este contexto le dice a la puerta de Evolution (`ev`, lib/mako-grupo.ts) que lo que sale a
// ESE grupo, durante ESE turno, es la respuesta: la regla que lo deja pasar es `esRespuestaEnCurso` (lib/mako-salida-reglas.ts).
//
// Lo abren sólo las entradas del turno del grupo (lib/mako-doer-in.ts: el webhook y el cron que levanta lo que quedó sin contestar).
// Un aviso, un flujo, una alta o un mensaje a OTRO grupo no lo tienen, y siguen frenados.
//
// Sin `server-only`: lo prueba un test puro (tests/mako-responde-siempre.test.ts).
// =============================================================================

import { AsyncLocalStorage } from 'node:async_hooks';

const store = new AsyncLocalStorage<string>();

/** Corre `fn` sabiendo que lo que salga a `jid` es la respuesta a quien acaba de escribir ahí. Sólo un grupo. */
export function conRespuestaA<T>(jid: string, fn: () => T): T {
  if (!jid.endsWith('@g.us')) return fn();
  return store.run(jid, fn);
}

/** El grupo al que se le está contestando en este turno, o null. */
export const respondiendoA = (): string | null => store.getStore() ?? null;
