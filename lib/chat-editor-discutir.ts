// =============================================================================
// chat-editor-discutir — «Discutir» en los chats que editan lo abierto (Image y Video Editor) (PURO; 5/11/2026)
// =============================================================================
// El par «Discutir | Editar» (app/_chat/SelectorIntencion.tsx) ya estaba en Automations, el Web Generator y el Copywriter.
// En Image y Video el modelo devuelve el MISMO JSON de siempre (`resumen` + `operaciones`): en Discutir se le pide que
// conteste en `resumen` y deje `operaciones` vacío, y el CÓDIGO tira cualquier operación que traiga igual (una regla en un
// prompt no es una regla). Así no hace falta otro prompt editable ni otra ruta.
// =============================================================================

import type { IntencionChat } from './flujo-ia-intencion';

/** Lo que llega del navegador: sólo «discutir» cambia algo; lo demás es Editar (lo de siempre). */
export const esDiscutir = (raw: unknown): boolean => raw === 'discutir';

/** Lo que se suma al system en Discutir. `que`: lo que está abierto («el diseño», «el video»). */
export function reglaDiscutir(que: string): string {
  return [
    'MODO DISCUTIR: la persona quiere pensar contigo, no cambiar nada.',
    '- "operaciones" va SIEMPRE vacío: no cambies nada.',
    `- En "resumen" contesta lo que pregunta sobre ${que}, o qué cambiarías y por qué, en hasta 5 frases cortas y concretas. Si sugieres un cambio, dile que lo pida en «Editar».`,
  ].join('\n');
}

/** El largo de una respuesta de Discutir (en Editar el resumen es una línea). */
export const TOPE_RESPUESTA_DISCUTIR = 1_500;

/** La respuesta de Discutir: el texto entero (sin cortar a una línea), recortado sin partir un emoji. */
export function respuestaDeDiscutir(t: string): string {
  return Array.from(String(t ?? '').trim()).slice(0, TOPE_RESPUESTA_DISCUTIR).join('');
}

export type { IntencionChat };
