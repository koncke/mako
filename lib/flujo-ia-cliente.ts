// =============================================================================
// flujo-ia-cliente — lo que la PANTALLA de «Crear con IA» decide con el resultado
// =============================================================================
// Módulo PURO, sin imports y sin `server-only`, a propósito: lo importan un `'use client'`
// (app/automations/SecuenciaPerfil.tsx) y la ruta (app/api/chat-agent/secuencias/ia/route.ts). No vive en
// lib/flujo-ia.ts porque ése lleva los dos prompts enteros, y un `'use client'` que importa un VALOR
// de ahí se los lleva al navegador (AGENTS.md: `'use client'` es una frontera de DATOS).
//
// Revisión de la segunda tanda (09/10/2026): dos hallazgos del frente IA viven acá.
//
// Duodécima tanda (12/10/2026, docs/diseno-duodecima-tanda.md §2.5 y §3.4): las reglas PURAS del chat de MaKo
// (app/automations/ChatMako.tsx) — qué ronda de preguntas quedó abierta en un hilo guardado y qué respuesta arma cada
// botón. Sólo `import type` (se borra al compilar): el módulo sigue sin dependencias de valor.
// =============================================================================

import type { MensajeChatMako, PreguntaMako, RespuestaMako } from './automatizacion-chat';

/**
 * QUÉ AVISO VA PRIMERO. La pantalla muestra UNO (texto corto, AGENTS.md) y mostraba `avisos[0]`, que
 * es el primero que salió al procesar las tarjetas; la ruta agrega al FINAL los que más importan
 * («Elige qué la dispara en el CRON»: sin disparador no inscribe a nadie). Con cualquier aviso antes,
 * ésos no se veían nunca, y tampoco «No tengo guardado el link «agenda»: el mensaje va sin link» si
 * antes hubo un «Borré un link…».
 *
 *   0 — lo que cambia lo que sale y pide algo a la persona: el disparador, un link o un audio que no
 *       va, un monto que hay que poner, un tramo que no se agregó;
 *   1 — lo que se sacó (y, desde la tercera tanda, la flecha de una tarjeta colgada de dos lugares:
 *       sin «Ir a», la segunda salida queda vacía);
 *   2 — lo cosmético.
 * Estable: dentro de la misma prioridad queda el orden de llegada.
 */
const PRIORIDAD: ReadonlyArray<RegExp> = [
  /dispara|sin link|va como texto|monto|no la pis[ée]|no lo agregu[ée]|no agregu[ée]/i,
  /^(Saqu[ée]|Cort[ée]|Borr[ée])|dej[ée] en el primero/,
];

function prioridad(a: string): number {
  const i = PRIORIDAD.findIndex((re) => re.test(a));
  return i < 0 ? PRIORIDAD.length : i;
}

export function ordenarAvisos(avisos: readonly string[]): string[] {
  return avisos.map((a, i) => ({ a, i, p: prioridad(a) })).sort((x, y) => x.p - y.p || x.i - y.i).map((x) => x.a);
}

/**
 * Lo que se DIBUJA: el aviso que más importa y cuántos más hay («… (+2)»). `todos` va en el `title`:
 * no ocupa lugar y se lee al pasar el cursor. null = no hay nada que decir.
 */
export function resumenAvisos(avisos: readonly string[]): { texto: string; todos: string[] } | null {
  if (!avisos.length) return null;
  const todos = ordenarAvisos(avisos);
  return { texto: todos.length > 1 ? `${todos[0]} (+${todos.length - 1})` : todos[0], todos };
}

/**
 * ¿EL BORRADOR SIGUE SIENDO EL QUE SE LE MANDÓ A LA IA? Editar arma el resultado sobre la foto que
 * la caja mandó al hacer clic (`base`), y mientras la IA trabaja el lienzo sigue editable: aplicar el
 * resultado sobre un lienzo que cambió borra de la pantalla la corrección hecha en el medio (y el
 * siguiente Publicar la revierte). Si cambió, el resultado NO se aplica y se pide de nuevo.
 */
export function edicionVigente(base: readonly unknown[] | undefined, actuales: readonly unknown[]): boolean {
  if (!base) return true;
  return JSON.stringify(base) === JSON.stringify(actuales);
}

/**
 * ¿EL RESULTADO DE EDITAR TOCA LAS TARJETAS? No, sólo cuando es la respuesta a «¿Cambio qué la dispara?» (duodécima
 * tanda, §3.4): vuelve con los pasos tal cual (`cambiadas: []`, nada agregado ni quitado), y aplicarlo dejaba una foto
 * de deshacer de más (y con el lienzo tocado en el medio, frenaba el CRON con «Cambiaste el flujo»). Un `listo` de antes
 * (sin `cambiadas`) siempre agrega algo.
 */
export function edicionTocaPasos(r: { orden: readonly string[]; cambiadas?: readonly string[]; quitadas?: readonly string[] }): boolean {
  return r.cambiadas === undefined || r.orden.length > 0 || r.cambiadas.length > 0 || (r.quitadas?.length ?? 0) > 0;
}

// ── El chat de MaKo (duodécima tanda) ───────────────────────────────────────────────

/** La ronda que espera una respuesta: el pedido ORIGINAL, lo ya contestado y la pregunta de ahora. */
export type RondaMako = { pedido: string; respuestas: RespuestaMako[]; pregunta: PreguntaMako };

/**
 * ¿EL HILO TERMINA EN UNA PREGUNTA SIN CONTESTAR? Cada turno vuelve a mandar el pedido ORIGINAL con las respuestas
 * acumuladas (§3.4), así que al abrir un chat guardado hay que reconstruirlos: el último mensaje es de MaKo con una
 * pregunta; para atrás, las respuestas de la persona son de esta ronda, y el primer mensaje suyo SIN respuesta es el
 * pedido. Un mensaje de MaKo sin pregunta en el medio (un resumen: la ronda anterior terminó), o una pregunta que trae
 * `cambios` (la de «¿Cambio qué la dispara?», que sale con el resumen), deja las respuestas en cero: son de antes.
 * null = no hay nada abierto (o no se encuentra el pedido).
 */
export function rondaAbierta(mensajes: readonly MensajeChatMako[]): RondaMako | null {
  const ultimo = mensajes[mensajes.length - 1];
  if (!ultimo || ultimo.de !== 'mako' || !ultimo.pregunta) return null;
  const respuestas: RespuestaMako[] = [];
  let cerrada = !!ultimo.cambios;
  for (let i = mensajes.length - 2; i >= 0; i--) {
    const m = mensajes[i];
    if (m.de === 'mako') { if (!m.pregunta) cerrada = true; continue; }
    if (m.respuesta) { if (!cerrada) respuestas.unshift(m.respuesta); continue; }
    return { pedido: m.texto, respuestas: cerrada ? [] : respuestas, pregunta: ultimo.pregunta };
  }
  return null;
}

/** Lo que tocó la persona en la tarjeta de una pregunta: una opción, «Elige tú» o «Otra cosa» con su texto. */
export type EleccionMako = { valor: string } | { eligeTu: true } | { texto: string };

/** El rótulo del botón «Elige tú» (y lo que queda escrito en el hilo). */
export const ELIGE_TU = 'Elige tú';
/** El rótulo del botón que abre el texto. */
export const OTRA_COSA = 'Otra cosa';

/**
 * LA RESPUESTA QUE VIAJA (§3.3): una opción manda su `valor` TAL CUAL (el del catálogo: lo impone el código, nunca el
 * modelo); «Elige tú» manda `valor: null` y nada más; «Otra cosa» manda `valor: null` con el texto. Y lo que queda
 * escrito en el hilo: el rótulo de la opción, «Elige tú» o el texto.
 */
export function respuestaMako(p: PreguntaMako, e: EleccionMako): { respuesta: RespuestaMako; texto: string } {
  const base = { preguntaId: p.id, sobre: p.sobre };
  if ('valor' in e) return { respuesta: { ...base, valor: e.valor }, texto: p.opciones.find((o) => o.valor === e.valor)?.label ?? e.valor };
  if ('texto' in e) return { respuesta: { ...base, valor: null, texto: e.texto }, texto: e.texto };
  return { respuesta: { ...base, valor: null }, texto: ELIGE_TU };
}
