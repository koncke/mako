// =============================================================================
// «No pongas emoji, siempre iconos» — la regla, en UN lugar
// =============================================================================
// Martín, 06/10/2026: «No pongas emoji, siempre iconos para que sea mas profesional».
// Es una regla sobre TODA la interfaz, así que la van a querer más guards: el del Ads
// Manager y el de la ficha del lead nacieron el mismo día, con horas de diferencia, y
// **ya habían divergido** — tres rangos distintos en dos archivos, y el más angosto
// dejaba pasar el ⚠️. Es «una cosa, un lugar» aplicada a un guard: si la regla se
// copia, el segundo se queda viejo y nadie se entera, porque un guard flojo se ve
// igual que uno que pasa.
//
// Se importa; no se vuelve a escribir el rango.
// =============================================================================

/**
 * Los planos pictográficos: lo que un sistema dibuja a COLOR y con su propia forma.
 *
 * ⚠️ `2700–27BF` queda AFUERA a propósito y no es un olvido: ahí viven `✓` (2713),
 * `✕` (2715) y `✦` (2726), que son tipografía monocroma, heredan el color del texto y
 * las usa todo el repo —los siete cierres de modal del Ads Manager, entre otros—.
 * Meterlo haría fallar el guard sobre pantallas sanas, que es peor que no tenerlo:
 * manda a «arreglar» algo que está bien.
 *
 * `2600–26FF` sí entra, y es lo que caza `⚠` (26A0) y `⛔` (26D4) — medido el 06/10
 * sobre la ficha del lead.
 */
export const PICTOGRAFICOS = /[\u{1F300}-\u{1FAFF}\u{2460}-\u{24FF}\u{2600}-\u{26FF}\u{2B00}-\u{2BFF}]/gu;

/**
 * El fuente sin comentarios.
 *
 * ⚠️ Obligatorio antes de cualquier `doesNotMatch`, y acá más que en ningún lado: la
 * convención de la casa es CITAR en el comentario lo que se sacó, así que un guard de
 * emoji que lea el archivo entero se acusa a sí mismo con la línea que explica qué
 * emoji se eliminó.
 *
 * Las de LÍNEA antes que las de BLOQUE: un `/*` adentro de un `//` abre un bloque que
 * se cierra páginas abajo y se come el código del medio (AGENTS.md).
 */
export const sinComentarios = (s: string) => s
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/** Los emoji de un fuente, ya sin comentarios. `null` cuando no hay ninguno. */
export function emojiDe(src: string): string[] | null {
  const hits = sinComentarios(src).match(PICTOGRAFICOS);
  return hits && hits.length ? [...new Set(hits)] : null;
}
