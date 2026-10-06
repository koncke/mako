// =============================================================================
// El aviso FIJO de «tu Pixel quedó viejo»: cuándo sale, a dónde lleva y qué dice
// =============================================================================
// Pedido de Martín (06/10/2026): «dentro de MaKo que siempre aparezca una
// notificación que no se pueda cerrar, pero que sea sutil, como lo tenemos en el
// CRM de "Revisar" que aparece abajo a la derecha». El motivo: los clientes tienen
// que volver a pegar el código para que se graben sus visitas y para el mapa de
// calor, y un WhatsApp solo se lee una vez.
//
// SIN `server-only`, a propósito: la decisión es lo único de esta pieza que se
// puede equivocar, y adentro de un módulo de servidor ningún test la podría
// importar. La comparten la ruta que contesta y el componente que dibuja.
// =============================================================================

/**
 * Desde qué versión del Pixel el aviso se apaga.
 *
 * ⚠️ NO SE DERIVA DE `SNIPPET_VERSION`. Esa sube con cualquier mejora del código, y
 * un aviso que NO SE PUEDE CERRAR que se prende con cada subida le pediría a todos
 * los negocios que repeguen por cosas que no les cambian nada — que es como se
 * aprende a no leerlo. Se sube A MANO, sólo cuando una versión justifica pedirle a
 * todo el mundo que vuelva a pegar el código.
 *
 * Hoy es 22: el código que graba las visitas, ancla el mapa de calor y ya no trae el
 * tag de Clarity. Medido el 06/10/2026: los ws 11 y 13 están en la 18, el 14 en la 15,
 * y la página principal del ws1 se repegó con una 21 que todavía traía Clarity.
 */
export const PIXEL_MINIMO_AVISO = 22;

/** El lugar exacto donde se resuelve: abre el modal del Pixel (IntegracionesBoard). */
export const RUTA_PIXEL = '/integraciones?abrir=landing';

/** Lo que dice el aviso. Es el mismo rótulo del chip del modal del Pixel. */
export const ROTULO_PIXEL_VIEJO = 'Actualiza el Pixel';

/**
 * ¿Hay que mostrar el aviso, mirando la versión que anotó el beacon?
 *
 * ⚠️ SIN FILA NO HAY AVISO. La versión la escribe el beacon con el PRIMER evento que
 * llega de la página, así que su ausencia quiere decir «este negocio nunca pegó el
 * Pixel»: medido el 06/10/2026, los ws 9, 10, 15 y 17 tienen el token acuñado (se
 * acuña con sólo abrir Integraciones), ninguna fila de versión y cero visitas en toda
 * su historia. `snippetDesactualizado()` los cuenta como v1 y les diría «actualiza»
 * sobre algo que nunca instalaron.
 */
export function pixelParaActualizar(guardada: string | null | undefined): { viejo: boolean; instalada: number | null } {
  if (guardada == null || String(guardada).trim() === '') return { viejo: false, instalada: null };
  const n = Number(guardada);
  if (!Number.isFinite(n) || n <= 0) return { viejo: false, instalada: null };
  const instalada = Math.floor(n);
  return { viejo: instalada < PIXEL_MINIMO_AVISO, instalada };
}
