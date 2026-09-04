/**
 * Cómo se suma una variante nueva de la imagen de un escenario.
 *
 * ── Por qué vive en su propio módulo ────────────────────────────────────────
 * `video-action.ts` es `'use server'`, y ahí todo export tiene que ser una
 * función async: una regla pura no se puede exportar, y lo que no se exporta no
 * lo puede importar ningún test. Mismo criterio que `tomas-invalidar.ts`.
 */

/** Una variante: lo que se pinta y lo que se usa para filmar. */
export type Variante = { url: string; mediaId?: string };

/**
 * Junta lo que ya había con lo que acaba de llegar.
 *
 * ⚠️ ANTES ESTO NO EXISTÍA: cada generación REEMPLAZABA la lista, así que
 * regenerar borraba la imagen que la persona tenía. Lo reportó el dueño el
 * 31/08/2026 —«ya lo había regenerado y había salido bien la imagen… ahora me
 * obligaste a regenerar y esta segunda no me gustó»— y la anterior sólo se pudo
 * recuperar yendo a `flow_trabajos` a mano. Su regla estaba escrita desde antes:
 * «un render nuevo NUNCA sobrescribe al anterior; van los dos con nombre que los
 * distinga».
 *
 * Dos decisiones que parecen detalles y no lo son:
 *
 * · **Se deduplica por `mediaId`.** El sondeo puede correr dos veces sobre el
 *   mismo trabajo —dos pestañas abiertas, un reintento, un `visibilitychange`— y
 *   sin esto la misma imagen entraría dos veces. Una tira con la misma variante
 *   repetida convierte la comparación en una trampa: se elige entre dos cosas
 *   creyendo que son distintas.
 *
 * · **Queda mirándose la RECIÉN LLEGADA, no la primera de la lista.** Es la que
 *   la persona acaba de pedir; dejarle a la vista una vieja haría que el botón
 *   pareciera no haber hecho nada. Las anteriores quedan a un click.
 *
 * El `mediaId` es lo que importa conservar a largo plazo: la URL viene firmada y
 * vence (~6 h), el id no. Cuando la dirección de una variante vieja caduque, el
 * id sigue sirviendo para filmar.
 */
export function sumarVariantes(
  previas: Variante[],
  llegadas: Variante[],
): { todas: Variante[]; elegida: Variante | undefined } {
  const idsPrevios = new Set(previas.map((v) => v.mediaId).filter(Boolean));
  const urlsPrevias = new Set(previas.map((v) => v.url));

  const nuevas: Variante[] = [];
  for (const v of llegadas) {
    // Sin id se compara por url: es peor clave —una url firmada cambia sola cada
    // vez— pero es la única que queda, y de las dos es mejor que nada.
    const repetida = v.mediaId ? idsPrevios.has(v.mediaId) : urlsPrevias.has(v.url);
    if (repetida) continue;
    if (v.mediaId) idsPrevios.add(v.mediaId);
    urlsPrevias.add(v.url);
    nuevas.push(v);
  }

  return {
    todas: [...previas, ...nuevas],
    // Si todo lo que llegó ya estaba —un sondeo repetido— no hay nada nuevo que
    // mirar y quien llama conserva lo que la persona tenía elegido. Devolver
    // `llegadas[0]` acá movería la selección por debajo de una repetición.
    elegida: nuevas[0],
  };
}

/**
 * ¿La imagen que se pidió TODAVÍA no llegó?
 *
 * ⚠️ ESTA REGLA VIVE EN UN SOLO LUGAR PORQUE YA SE PARTIÓ EN DOS, y la mitad que
 * quedó vieja rompió el paso entero.
 *
 * Cuando las variantes pasaron a acumularse, la señal de «ya llegó» se mudó de
 * `opciones.length` a `trabajoListo`. Actualicé la del RENDER y me olvidé de la
 * del SONDEO, que siguió preguntando `!opciones.length` — y desde la segunda
 * generación esa condición es falsa siempre, porque la lista ya no se vacía. O
 * sea que el sondeo dejaba de correr justo cuando había algo que esperar:
 * regenerar una imagen no podía terminar nunca, para nadie.
 *
 * Medido en vivo sobre el workspace de una clienta: su trabajo estaba `listo`
 * hacía tres minutos, con la imagen adentro, y la pantalla seguía en el loader
 * porque nadie salía a buscarla.
 *
 * La segunda mitad —`trabajoListo` ausente— es la compatibilidad con los planes
 * escritos antes de que ese campo existiera.
 */
export function imagenEnCurso(m: {
  trabajoId?: number;
  trabajoListo?: number;
  opciones?: string[];
  error?: string;
  errorCausa?: string;
} | undefined): boolean {
  if (!m?.trabajoId) return false;
  // ⚠️ UN ERROR DE PUENTE NO APAGA EL SONDEO — EL MISMO DEFECTO QUE YA SE CURÓ
  // EN LAS TOMAS, VIVO ACÁ.
  //
  // Esto era `|| m.error` a secas: cualquier error dejaba la imagen fuera del
  // sondeo para siempre. Y el sondeo es quien llama a `estadoImagenAction`, que
  // es donde vive la cura —borrar un error de puente cuando el puente volvió—,
  // así que el arreglo quedaba otra vez detrás de la puerta que él mismo tenía
  // que abrir.
  //
  // «El puente no estaba» es la única causa que se arregla sola: el trabajo
  // sigue encolado del lado del server y lo levanta el próximo latido. El resto
  // de los errores son de Google y sí terminan la espera.
  if (m.error) return m.errorCausa === 'puente' && m.trabajoId !== m.trabajoListo;
  return m.trabajoListo ? m.trabajoId !== m.trabajoListo : !m.opciones?.length;
}
