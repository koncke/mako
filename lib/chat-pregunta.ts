// =============================================================================
// MaKo pregunta con opciones, y hasta tener la respuesta no propone nada (20/10/2026, ola 1, pieza 1.9)
// =============================================================================
// docs/ops-center-principal.md §5, la 1.9: «el bloque G1 más una herramienta `preguntar_al_usuario`; la respuesta la
// impone el código». Con «todos los martes a las 3 a todo el funnel», MaKo pregunta (¿qué etapa?, ¿qué mensaje?) y no
// propone nada hasta tener la respuesta.
//
// Cómo se impone:
//   · la herramienta viaja en el chat de la app (lib/mako-turno-app.ts) y lo que pasa el modelo se sanea como un G1
//     (lib/chat-bloques.ts): 2 a 4 opciones, distintas, la recomendada dentro de rango. Una pregunta que no calza vuelve
//     como error al modelo, y no se muestra;
//   · desde que preguntó, el turno RECHAZA toda acción (`bloquea`): una lectura sí corre (para armar las opciones);
//   · lo que se propuso en el turno ANTES de preguntar se retira (`retirar`): la persona ve la pregunta, no una tarjeta
//     que depende de la respuesta;
//   · la pregunta se guarda con el mensaje de MaKo (`chart_chats.bloques`): al recargar vuelve, y si ya hubo una
//     respuesta, se ve contestada (app/m/mako/chat-ui.ts, `itemsDeSesion`).
// La persona contesta tocando una opción (o «Elige tú», o «Saltear»), o escribiendo: es su siguiente mensaje.
//
// Puro: lo prueba tests/chat-pregunta.test.ts sin red ni base.

import type { ToolDef } from './anthropic';
import { sanearBloque, type Bloque } from './chat-bloques';

export const PREGUNTAR = 'preguntar_al_usuario';

export const TOOL_PREGUNTAR: ToolDef = {
  name: PREGUNTAR,
  description:
    'Pregúntale a la persona, con 2 a 4 opciones para tocar, cuando el pedido admite caminos distintos y elegir mal sería '
    + 'hacer otra cosa: qué etapa o qué lista, qué producto, qué mensaje, cada cuánto, a quién. Las opciones salen de lo que '
    + 'ya leíste (los nombres reales de las etapas, de los productos), no inventadas; marca la recomendada si hay una. '
    + 'Una pregunta por vez. Después de preguntar NO propongas ni hagas nada en este turno: la persona contesta tocando una '
    + 'opción, y recién con su respuesta sigues. Si el pedido ya dice todo, no preguntes: hazlo.',
  input_schema: {
    type: 'object',
    properties: {
      pregunta: { type: 'string', description: 'La pregunta, corta y en segunda persona.' },
      opciones: {
        type: 'array', minItems: 2, maxItems: 4,
        items: {
          type: 'object',
          properties: {
            titulo: { type: 'string', description: 'Lo que se toca: 1 a 5 palabras.' },
            detalle: { type: 'string', description: 'Opcional: una línea con el dato que ayuda a elegir («12 leads»).' },
          },
          required: ['titulo'],
        },
      },
      recomendada: { type: 'integer', description: 'Opcional: el índice (desde 0) de la opción recomendada.' },
      varias: { type: 'boolean', description: 'Opcional: true si puede elegir más de una.' },
    },
    required: ['pregunta', 'opciones'],
  },
};

/** Lo que le contesta la herramienta al modelo cuando la pregunta quedó. */
export const INSTRUCCION_TRAS_PREGUNTAR = 'La pregunta quedó en el chat con sus opciones. Termina el turno ya, sin proponer ni hacer nada más: la persona contesta tocando una opción.';
/** Lo que recibe el modelo si quiere proponer algo después de preguntar. */
export const ERROR_TRAS_PREGUNTAR = 'Ya le preguntaste a la persona: espera su respuesta. En este turno no se propone ni se hace nada más.';

/**
 * La regla de un turno: guarda LA pregunta (una sola: la primera que calza) y dice qué herramientas se rechazan desde
 * entonces. `esAccion`: cómo sabe el turno si una herramienta escribe (el registro y las de siempre).
 */
export function crearGuardiaDePregunta(esAccion: (nombre: string) => boolean) {
  let pregunta: Extract<Bloque, { t: 'pregunta' }> | null = null;
  return {
    get pregunta() { return pregunta; },
    /** Lo que pasó el modelo, saneado como un G1. El texto es lo que se le contesta. */
    preguntar(input: Record<string, unknown>): { ok: true; texto: string } | { ok: false; texto: string } {
      if (pregunta) return { ok: false, texto: 'Ya hiciste una pregunta en este turno: una por vez.' };
      const b = sanearBloque({ ...input, t: 'pregunta' });
      if (!b || b.t !== 'pregunta') {
        return { ok: false, texto: 'Esa pregunta no se puede mostrar: hacen falta la pregunta y de 2 a 4 opciones distintas, cada una con su título.' };
      }
      pregunta = b;
      return { ok: true, texto: INSTRUCCION_TRAS_PREGUNTAR };
    },
    /** ¿Se rechaza esta herramienta? Sí, si ya se preguntó y escribe algo. */
    bloquea(nombre: string): boolean {
      return pregunta != null && nombre !== PREGUNTAR && esAccion(nombre);
    },
  };
}

/** Lo que el turno muestra al final: con una pregunta, ni las tarjetas ni las propuestas de pantalla del turno. */
export function retirar<T, U>(pregunta: unknown, propuestas: readonly T[], pantallas: readonly U[]): { propuestas: T[]; pantallas: U[] } {
  return pregunta ? { propuestas: [], pantallas: [] } : { propuestas: [...propuestas], pantallas: [...pantallas] };
}
