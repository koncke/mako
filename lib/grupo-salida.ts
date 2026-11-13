// =============================================================================
// grupo-salida — por dónde sale lo que dice MaKo en un turno del grupo (3/11/2026)
// =============================================================================
// MaKo contesta con el MISMO despachante en WhatsApp y en la app (lib/mako-doer-in.ts): 14 sitios llaman a `enviarAGrupoJid` y
// ninguno sabe de dónde vino el mensaje. El contexto dice qué hacer, y lo leen las dos puertas de abajo (`enviarAGrupoJid` y
// `reaccionarMensaje`, lib/mako-grupo.ts): el turno no cambia.
//
//   · `soloApp`: el lote entero se escribió en la app. Lo que MaKo dice va al hilo y NO toca Evolution (requisito 5: lo que se
//     escribe en la app no sale por WhatsApp). Un lote con alguno de WhatsApp contesta en los dos.
//   · `hayInvitado`: en el lote hay alguien que no administra este negocio. El turno corre sin datos del negocio (lib/mako-doer-in.ts).
//
// Es mutable a propósito: se abre al entrar y se ajusta UNA vez, cuando se tiene la cola (`soloApp` y `hayInvitado` salen de la
// cola, no del mensaje que ganó el candado). El turno del bot 1 a 1 no abre contexto: no se copia.
//
// Sin imports del doer y sin `server-only`: lo prueba un test puro.
// =============================================================================

import { AsyncLocalStorage } from 'node:async_hooks';

export type SalidaDelGrupo = {
  ws: number;
  /** La clave de conversación: el jid del grupo, o `app<ws>@g.us` (`claveDeLaApp`). */
  clave: string;
  soloApp: boolean;
  hayInvitado: boolean;
  /** Hay una sola persona en el grupo: lo que escribe es para MaKo aunque no lo nombre. */
  unaPersona?: boolean;
  /** El lote es de UN miembro del equipo (closer, setter: 13/11/2026), con su email. El turno corre con lo que su rol ve (lib/mako-doer-in.ts). */
  miembroDelEquipo?: { rol: 'closer' | 'setter'; email: string } | null;
};

/**
 * LA CLAVE DE LO SUYO, para un miembro del EQUIPO en el grupo (13/11/2026): su memoria con MaKo, sus propuestas pendientes y lo último que le mostró. Así su «sí»
 * no confirma lo que MaKo le propuso al dueño, y lo que se habló con el dueño no viaja en su turno. La cola, el candado y la salida siguen siendo del grupo (`clave`).
 */
export const claveDelMiembro = (clave: string, email: string): string => `${clave}#equipo:${email.trim().toLowerCase()}`;

const store = new AsyncLocalStorage<SalidaDelGrupo>();
export const salidaDelGrupo = (): SalidaDelGrupo | null => store.getStore() ?? null;
export function conSalidaDelGrupo<T>(s: SalidaDelGrupo, fn: () => T): T { return store.run(s, fn); }
/** El contexto de ESTE grupo, o null (un mensaje a otro jid dentro del mismo turno no se copia al hilo). */
export const salidaPara = (jid: string): SalidaDelGrupo | null => {
  const s = salidaDelGrupo();
  return s && s.clave === jid ? s : null;
};

/**
 * LA CLAVE DE UN NEGOCIO SIN GRUPO DE WHATSAPP. ⚠️ Termina en `@g.us` A PROPÓSITO: `enElGrupo` (lib/mako-doer-in.ts), `SOLO_GRUPOS` del
 * vigía y los `jid.endsWith('@g.us')` lo tratan como grupo. Con otra forma, la regla del «sí» de plata se apaga callada. No empieza
 * con `app:`, así que `canalDeClave` da 'whatsapp' y las confirmaciones son las mismas. Nunca llega a Evolution (`esClaveDeLaApp`).
 */
export const claveDeLaApp = (ws: number): string => `app${ws}@g.us`;
export const esClaveDeLaApp = (jid: string | null | undefined): boolean => /^app\d+@g\.us$/.test(jid ?? '');
export const wsDeClaveDeLaApp = (jid: string): number | null => {
  const m = /^app(\d+)@g\.us$/.exec(jid);
  return m ? Number(m[1]) : null;
};

/** El id de un mensaje de la app en la cola y en el `key.id`: `app:<fila>`. */
export const idDeLaApp = (fila: number): string => `app:${fila}`;
export const esIdDeLaApp = (id: string | null | undefined): boolean => /^app:\d+$/.test(id ?? '');
export const filaDelId = (id: string): number | null => {
  const m = /^app:(\d+)$/.exec(id);
  return m ? Number(m[1]) : null;
};

/**
 * LOS CARTELES QUE LE HABLAN DE WHATSAPP A QUIEN ESCRIBE EN LA APP. Una tabla explícita: los carteles son nuestros y se conocen; el
 * texto del modelo puede nombrar WhatsApp con razón («le mando un WhatsApp al lead»), así que un reemplazo a ciegas estaría mal.
 * tests/grupos-ops-doer: cada cartel, renderizado con `soloApp`, no dice «WhatsApp».
 */
const CARTELES: ReadonlyArray<readonly [RegExp, string]> = [
  [/Me llegó tu audio pero WhatsApp no me deja bajarlo\. ¿Me lo reenvías( o me lo escribes)?\?/u, 'Me llegó tu audio pero no lo pude abrir. ¿Me lo mandas de nuevo o me lo escribes?'],
  [/La nota de voz que citaste no la puedo bajar de WhatsApp\. ¿Me la reenvías o me la escribes\?/u, 'La nota de voz que citaste no la pude abrir. ¿Me la mandas de nuevo o me la escribes?'],
  [/Me llegó tu archivo pero WhatsApp no me deja bajarlo\. ¿Me lo reenvías\?/u, 'Me llegó tu archivo pero no lo pude abrir. ¿Me lo mandas de nuevo?'],
  // La clave ya quedó tapada en la fila: no hay nada que borrar, y nadie la vio (lib/doer-claves.ts, `avisoClaveTapadaEnElGrupo`).
  [/🔒 Tapé tu clave: la IA no la vio\. Bórrala del grupo y pégala aquí:/u, '🔒 Tapé tu clave: nadie la vio. Pégala aquí:'],
  // lib/fallo-ia-texto.ts, `conPc`.
  [/y en WhatsApp contesta sólo a quien la conectó, desde su número\./u, 'y aquí contesta sólo a quien la conectó.'],
  [/Si la conectaste tú, revisa que tu número de WhatsApp esté en tu perfil de MaKo 👇/u, 'Si la conectaste tú, revisa que esa computadora esté prendida y con MaKo abierto 👇'],
];
export const cartelParaLaApp = (texto: string): string => CARTELES.reduce((t, [re, por]) => t.replace(re, por), texto);

/** La voz del prompt en un turno de la app: «grupo de MaKo», sin tocar `MAKO_NUCLEO`. */
export const vozDeLaApp = (system: string): string => system.replace(/grupo de WhatsApp/g, 'grupo de MaKo');
