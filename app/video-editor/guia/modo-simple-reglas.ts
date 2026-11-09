// =============================================================================
// El modo simple del editor: QUÉ queda a la vista (PURO; 9/11/2026)
// =============================================================================
// Las listas viven acá, sin el motor (./modo-simple.ts lee el proyecto abierto con `useEditor`, que trae el WASM y no carga en
// node): las leen la barra de la línea de tiempo, la fila de pestañas de la biblioteca y los tests. docs/relevo/nube-tab-video.md §5.
//
// ⚠️ EN POSITIVO: lo que QUEDA, nunca «todo menos esto». Una herramienta o una pestaña nueva del editor nace escondida en el modo
// simple —el de quien no conoce el editor— hasta que alguien decida que la plantilla la pide. Lo que MaKo le pide tocar a la
// persona nunca se esconde: si un paso nombra una herramienta, va en esta lista.
// =============================================================================

/** Las pestañas de la biblioteca que quedan: lo que una plantilla guiada usa (clips, la canción, los carteles, los subtítulos). */
export const CATEGORIAS_SIMPLES: ReadonlySet<string> = new Set(['multimedia', 'audio', 'texto', 'subtitulos']);

/** Las herramientas de la línea de tiempo que quedan: elegir, deshacer, cortar, borrar, el zoom y los subtítulos. */
export const HERRAMIENTAS_SIMPLES: ReadonlySet<string> = new Set([
  'linea-seleccionar', 'linea-deshacer', 'linea-rehacer', 'linea-dividir', 'linea-eliminar',
  'linea-zoom', 'linea-acercar', 'linea-alejar', 'linea-zoom-ajustar', 'linea-generar-subtitulos',
]);

export const categoriaEnSimple = (c: string): boolean => CATEGORIAS_SIMPLES.has(c);
export const herramientaEnSimple = (id: string): boolean => HERRAMIENTAS_SIMPLES.has(id);

/**
 * Las pestañas que dibuja la fila: en simple, las de la lista MÁS la que está abierta. Otro panel puede abrir una que no está en la
 * lista («Agregar efecto» abre Efectos), o la persona venía de ahí al prender el modo simple: escondida, el panel mostraba una
 * pestaña que la fila no tenía, y no había cómo volver a ella (la revisión del 9/11/2026). Forzarla a «Multimedia» rompería la
 * acción que la abrió.
 */
export function pestanasVisibles<T extends string>(todas: readonly T[], simple: boolean, activa: string): T[] {
  return simple ? todas.filter((c) => categoriaEnSimple(c) || c === activa) : [...todas];
}
