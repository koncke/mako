// =============================================================================
// editor-video/marcas-chat — qué marcas de ticket valen en el chat del Video Editor (9/11/2026)
// =============================================================================
// El chat del editor NO ejecuta nada: devuelve una PROPUESTA que la persona acepta en el editor (lib/editor-video/ia.ts).
// La IA no tiene cómo «no poder» algo que propuso: lo que no sabe hacer va con `[[no-existe: …]]` (lib/no-existe.ts) y
// sale del catálogo. Medido con el arnés el 9/11/2026 (scripts/probar-chats/video-editor.mts, «ponelo todo un poco más
// rápido»): con la propuesta bien armada (1,2× en los tres clips), una de dos veces el modelo sumó
// `[[no-pude: no pude aplicar la velocidad a toda la pista en un solo comando sin listar cada clip]]`. En producción eso
// abre un ticket «MaKo no pudo…» y le dice al cliente «Quedó el ticket #N» al lado de un cambio que salió bien.
//
// LA REGLA: con operaciones propuestas, `[[no-pude]]` se saca sin ticket; `[[no-existe]]` se queda (la parte del pedido
// que no está en el catálogo: «subtítulos en amarillo y música de fondo» propone lo primero y levanta lo segundo). Sin
// operaciones, las dos se quedan: es la respuesta entera.
//
// PURO: lo usa lib/editor-video/ia.ts y lo prueba tests/video-editor-respuesta-chat.test.ts.
// =============================================================================

import { sacarNoPude } from '../no-pude';

/** El resumen que pasa a levantar tickets: sin `[[no-pude]]` si la IA propuso algo. */
export function resumenParaTickets(resumen: string, operacionesPropuestas: number): string {
  if (operacionesPropuestas <= 0) return resumen;
  return sacarNoPude(resumen).texto;
}
