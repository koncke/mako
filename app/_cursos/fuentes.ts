/**
 * LA FUENTE DEL CURSO: el catálogo cerrado de tipografías que se eligen en el menú de la marca, al
 * lado del color (item 3 del 08/10/2026: «Las tipografías se deberían editar en el mismo lugar que se
 * editan los colores, y que cambie todo cuando se elige esa tipografía»).
 *
 * Es PURO (sin React, sin `'use client'`, sin DOM): lo importan el saneo del server
 * (lib/curso-estilo.ts, que sólo guarda un id de esta lista), el dibujo (./CursoUgc.tsx, que pinta las
 * variables) y los tests. Lo que toca el DOM —meter la hoja de Google— vive en ./SelectorFuente.tsx.
 *
 * CÓMO CAMBIA TODO EL CURSO. La hoja del origen (public/cono-doc/ugc.css) escribe la letra de todo
 * `.ugc` como `var(--font-archivo)`: la base de `.ugc` (de ahí heredan los títulos, las tarjetas, la
 * barra y el papel), los renglones de la barra y los párrafos del papel. Con la fuente elegida, el
 * `style` de `.ugc` redefine `--font-archivo` y además declara `--ugc-fuente`, que es la variable con
 * la que las piezas de la APP adentro del curso (los campos de una tarea, el editor rico) piden la
 * misma letra (app/_cursos/estilos.ts, «La fuente del curso»). Sin fuente elegida no se pinta nada:
 * el curso queda exactamente como estaba.
 *
 * ⚠️ LO QUE NO CAMBIA, a propósito: los rótulos y botones en letra de máquina (`--font-jetbrains`, el
 *    acento del diseño: «EMPEZAR», los chips, el buscador) y las LÁMINAS de las portadas, que llevan su
 *    letra escrita en el SVG (app/_cursos/laminas/comun.tsx, `LETRA`) porque sus topes de caracteres se
 *    midieron con ella: con otra más ancha, el texto se saldría de la lámina.
 *
 * ⚠️ CÓMO SE CARGAN (medido el 08/10/2026, no supuesto): el repo NO usa `next/font` en ningún lado
 *    (grep de `next/font` sobre app/ y lib/: cero); las fuentes entran como hoja de Google
 *    (`<link>` en app/layout.tsx y el `@import` de ugc.css). Acá igual: una hoja por familia, que se
 *    pide SÓLO cuando hace falta —la del curso, si eligió una; todas, al abrir el menú para mostrar las
 *    muestras—. Y el navegador baja sólo el `.woff2` que la página usa: el latino normal pesa, medido
 *    con curl, Inter 92 KB, Nunito 39 KB, Lora 21 KB, Plex Mono 15 KB, Atkinson 10 KB, Poppins 6 KB.
 * ⚠️ NINGUNA de las elegibles es una familia que la hoja del origen ya declara (Hanken, Bricolage,
 *    JetBrains): esas traen `@font-face` propios que apuntan a `/_next/static/media/*.woff2` del sitio
 *    de origen, que acá dan 404 (hallazgos-conocimiento, «el dibujo de Conocimientos montado en OTRAS
 *    pantallas»). Elegir una de ésas podía terminar dibujando la de respaldo sin que nada lo dijera.
 */

export type FuenteCurso = {
  /** Lo que se guarda en `curso_estilo` (clave `fuente`). Una CLAVE: no se renombra. */
  id: string;
  /** El nombre de la familia, que es además la muestra del menú (se dibuja con ella misma). */
  nombre: string;
  /** Una palabra que la distingue en el menú. */
  tipo: string;
  /** La pila CSS entera, con respaldos parecidos (una serif cae a una serif). */
  pila: string;
  /** La hoja de Google que la trae. `null` = ya está cargada (la del curso de siempre). */
  hoja: string | null;
};

const GOOGLE = 'https://fonts.googleapis.com/css2?display=swap&family=';

/** La fuente de siempre: la que pinta la hoja del origen. Elegirla BORRA la fila (como todo default). */
export const FUENTE_DEFAULT = 'archivo';

/**
 * EL CATÁLOGO, CERRADO. Siete, con buena lectura en párrafos largos (una descripción, una tarea): la
 * neutra de siempre, una clara, una geométrica, una redondeada, una serif, una pensada para baja
 * visión y una de máquina. Una display o una manuscrita se ven bien en un título y cansan en el
 * tercer párrafo; por eso no están.
 *
 * ⚠️ El orden es el del menú. El id es lo que está guardado en la base: cambiar uno deja a los cursos
 *    que lo eligieron con la de siempre (el saneo de la lectura lo descarta), sin error.
 */
export const FUENTES: readonly FuenteCurso[] = [
  { id: 'archivo', nombre: 'Archivo', tipo: 'Neutra', pila: '"Archivo", "Archivo Fallback", system-ui, sans-serif', hoja: null },
  { id: 'inter', nombre: 'Inter', tipo: 'Clara', pila: '"Inter", system-ui, "Segoe UI", sans-serif', hoja: `${GOOGLE}Inter:ital,wght@0,400..800;1,400..800` },
  { id: 'poppins', nombre: 'Poppins', tipo: 'Geométrica', pila: '"Poppins", system-ui, "Segoe UI", sans-serif', hoja: `${GOOGLE}Poppins:ital,wght@0,400;0,600;0,700;0,800;1,400;1,600` },
  { id: 'nunito', nombre: 'Nunito', tipo: 'Redondeada', pila: '"Nunito", system-ui, "Segoe UI", sans-serif', hoja: `${GOOGLE}Nunito:ital,wght@0,400..900;1,400..900` },
  { id: 'lora', nombre: 'Lora', tipo: 'Serif', pila: '"Lora", Georgia, "Times New Roman", serif', hoja: `${GOOGLE}Lora:ital,wght@0,400..700;1,400..700` },
  { id: 'atkinson', nombre: 'Atkinson', tipo: 'Muy legible', pila: '"Atkinson Hyperlegible", system-ui, "Segoe UI", sans-serif', hoja: `${GOOGLE}Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400;1,700` },
  { id: 'maquina', nombre: 'Plex Mono', tipo: 'De máquina', pila: '"IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace', hoja: `${GOOGLE}IBM+Plex+Mono:ital,wght@0,400;0,600;0,700;1,400` },
];

/**
 * El id guardable, o `null`. EN POSITIVO: sólo un id del catálogo, escrito tal cual. Lo de siempre
 * también da `null` (se BORRA la fila, mig 0214: «nadie lo eligió» y «eligió lo de siempre» no se
 * mezclan en un valor), y cualquier otra cosa —un nombre de familia, una pila CSS, un `url(…)`— se
 * descarta: el valor termina adentro de un `style`, y una lista cerrada es lo único que no se puede
 * convertir en CSS ajeno.
 */
export function fuenteGuardable(v: unknown): string | null {
  if (typeof v !== 'string' || v === FUENTE_DEFAULT) return null;
  return FUENTES.some((f) => f.id === v) ? v : null;
}

/** La fuente que se dibuja: la elegida, o la de siempre (un id viejo o roto cae acá). */
export function fuenteDe(id: string | null | undefined): FuenteCurso {
  return FUENTES.find((f) => f.id === id) ?? FUENTES[0];
}

/**
 * Las variables que pinta la fuente, para el `style` de `.ugc` (como `varsDeAcento`). `undefined` = la
 * de siempre: no se toca nada.
 *
 * ⚠️ VAN EN `.ugc`, NO EN `.ahdoc`: la hoja declara `--font-archivo` sobre `.ahdoc`, y `.ugc` es el
 *    primer elemento propio del dibujo; puesta ahí le gana a la heredada para todo lo de adentro.
 */
export function varsDeFuente(id: string | null | undefined): Record<string, string> | undefined {
  const g = fuenteGuardable(id);
  if (!g) return undefined;
  const f = fuenteDe(g);
  return { '--font-archivo': f.pila, '--ugc-fuente': f.pila };
}
