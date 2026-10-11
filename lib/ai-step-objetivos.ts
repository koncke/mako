// =============================================================================
// ai-step-objetivos — el OBJETIVO de cada caso de lo que ya existía (AI Step v2, décima tanda)
// =============================================================================
// Martín (11/10/2026, FEEDBACK AI STEP 4): «lo primero es siempre definir el OBJETIVO». Lo nuevo lo escribe la
// persona (o «✦ Armar el resto» lo propone); lo que YA existía —la galería y los AI Step guardados— no tenía
// uno. Esta es la tabla de docs/diseno-ai-step-v2.md §8.4, POR NOMBRE DEL CASO, y la usan las dos puntas: la
// galería (lib/plantillas-automatizaciones.ts) y la migración (scripts/ai-step-v2.mts). Una sola copia: con
// dos, la galería y lo migrado dirían cosas distintas del mismo caso.
//
//   · El objetivo NO frena Publicar (§10-A): un nombre que no está acá queda sin objetivo y se LISTA (el script
//     lo dice), nunca se inventa uno.
//   · «Pregunta el precio» depende de si el lead YA agendó (post-agenda): antes, que agende sin hablar de cifras;
//     después, que llegue a la reunión sin hablar de cifras.
//   · «Puede no calificar» (sólo avisa) va sin objetivo a propósito: no contesta, no tiene nada que lograr.
//
// ⚠️ PURO Y SIN `server-only`: lo importan la galería (cliente y server), el script y el test.
// =============================================================================

/** Sin acentos, sin mayúsculas, sin espacios de más: «Quiere cambiar el día» = «quiere cambiar el dia». */
const clave = (t: string): string => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** La tabla de §8.4: el nombre del caso → su objetivo. `null` = a propósito sin objetivo. */
const TABLA: ReadonlyArray<[string, string | null]> = [
  ['confirma', 'Que confirme que viene a la reunión'],
  ['confirma o ya vio el video', 'Que confirme que viene a la reunión'],
  ['pregunta por la reunion', 'Que sepa cuándo y cómo es su reunión'],
  ['quiere cambiar el dia', 'Que proponga otro día y horario'],
  ['quiere reagendar', 'Que proponga otro día y horario'],
  ['quiere agendar', 'Que agende una llamada'],
  ['quiere retomarlo', 'Que vuelva a agendar'],
  ['no le interesa', 'Que se vaya bien, con la puerta abierta'],
  ['puede no calificar', null],
];

/** El objetivo de «Pregunta el precio», según si el lead ya agendó. */
export const OBJETIVO_PRECIO = { antes: 'Que agende sin hablar de cifras', despues: 'Que llegue a la reunión sin hablar de cifras' } as const;

/**
 * EL OBJETIVO DE UN CASO POR SU NOMBRE (§8.4). `{ objetivo }` si está en la tabla (o `objetivo: null` si va sin
 * uno a propósito), o `null` si el nombre no está (quien migra lo lista). `postAgenda`: el lead ya agendó (la
 * automatización arranca por una etapa de reunión o la condición mira la reunión).
 */
export function objetivoDeCaso(titulo: string, o: { postAgenda: boolean }): { objetivo: string | null } | null {
  const k = clave(titulo);
  if (k === 'pregunta el precio') return { objetivo: o.postAgenda ? OBJETIVO_PRECIO.despues : OBJETIVO_PRECIO.antes };
  const fila = TABLA.find(([n]) => n === k);
  return fila ? { objetivo: fila[1] } : null;
}
