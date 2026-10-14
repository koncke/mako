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
  /**
   * El cajón del menú. Es lo que convierte una lista de 24 en una BIBLIOTECA: sin agrupar, elegir
   * entre 24 nombres es peor que elegir entre 7 — hay que leerlos todos para descartar.
   *
   * ⚠️ «Para títulos» NO es un cajón más: es una ADVERTENCIA. Esas cansan en el tercer párrafo, y la
   *    fuente del curso pinta TODO (las descripciones, las tareas, el papel de una clase), no sólo los
   *    títulos. Van últimas y el menú lo dice.
   */
  grupo: Grupo;
};

/** Los cajones, en el orden del menú. */
export type Grupo = 'Sin serif' | 'Con serif' | 'De máquina' | 'Para títulos';
export const GRUPOS: readonly Grupo[] = ['Sin serif', 'Con serif', 'De máquina', 'Para títulos'];

const GOOGLE = 'https://fonts.googleapis.com/css2?display=swap&family=';

/** La fuente de siempre: la que pinta la hoja del origen. Elegirla BORRA la fila (como todo default). */
export const FUENTE_DEFAULT = 'archivo';

/**
 * EL CATÁLOGO, CERRADO: 24 familias en cuatro cajones.
 *
 * Nació con SIETE el 08/10/2026, elegidas por lectura en párrafos largos. El 13/10 Martín pidió «una
 * biblioteca de tipografías seleccionables dentro de la configuración visual del módulo de cursos»
 * (Fathom 858545195 @88:21), así que creció — y con el buscador y los cajones de abajo, que es lo que
 * hace que 24 se elijan más rápido que 7 sin ellos.
 *
 * ⚠️ LAS SIETE PRIMERAS CONSERVAN SU `id` Y SU ORDEN. El id es lo que está guardado en
 *    `curso_estilo`: renombrar uno deja a los cursos que lo eligieron con la de siempre, sin error y
 *    sin que nadie se entere.
 *
 * ⚠️ Y LA DE SIEMPRE SIGUE PRIMERA, pero ya nadie depende de esa POSICIÓN: el default se nombra
 *    (`FUENTE_DEFAULT`). Antes el selector hacía `f.id === FUENTES[0].id` para mandar `null`, así que
 *    agregar una familia arriba habría dejado de borrar la fila — el curso quedaría guardando «archivo»
 *    como si fuera una elección, y «nadie lo eligió» y «eligió lo de siempre» volverían a mezclarse.
 *
 * ⚠️ AHORA SÍ ENTRAN LAS FAMILIAS DE LA HOJA DEL ORIGEN (Hanken, Bricolage, Instrument Serif), y es una
 *    PREMISA QUE CAMBIÓ: estaban excluidas porque sus `@font-face` apuntaban a `/_next/static/media/*`
 *    del sitio de origen y daban 404, así que elegirlas dibujaba la de respaldo sin decirlo. El
 *    13/10/2026 esos 38 `@font-face` se sacaron de `public/cono-doc/ugc.css` y la hoja los pide a
 *    Google (hallazgos-conocimiento, «La hoja del curso pedía 38 fuentes al dominio del ORIGEN»).
 *    Igual van con su `hoja` propia y no con `null`: el selector y el curso se dibujan en pantallas
 *    donde la hoja del material puede no estar cargada.
 *
 * ⚠️ Lo que NO entra: nada que no esté en Google Fonts (la única forma de cargarla es una hoja
 *    pública), y ninguna familia con menos de 400/700 reales — una negrita sintética en un título se
 *    ve sucia y no hay forma de saberlo desde acá.
 */
export const FUENTES: readonly FuenteCurso[] = [
  // ── Sin serif ───────────────────────────────────────────────────────────────────────────
  { id: 'archivo', nombre: 'Archivo', tipo: 'Neutra', grupo: 'Sin serif', pila: '"Archivo", "Archivo Fallback", system-ui, sans-serif', hoja: null },
  { id: 'inter', nombre: 'Inter', tipo: 'Clara', grupo: 'Sin serif', pila: '"Inter", system-ui, "Segoe UI", sans-serif', hoja: `${GOOGLE}Inter:ital,wght@0,400..800;1,400..800` },
  { id: 'poppins', nombre: 'Poppins', tipo: 'Geométrica', grupo: 'Sin serif', pila: '"Poppins", system-ui, "Segoe UI", sans-serif', hoja: `${GOOGLE}Poppins:ital,wght@0,400;0,600;0,700;0,800;1,400;1,600` },
  { id: 'nunito', nombre: 'Nunito', tipo: 'Redondeada', grupo: 'Sin serif', pila: '"Nunito", system-ui, "Segoe UI", sans-serif', hoja: `${GOOGLE}Nunito:ital,wght@0,400..900;1,400..900` },
  { id: 'atkinson', nombre: 'Atkinson', tipo: 'Muy legible', grupo: 'Sin serif', pila: '"Atkinson Hyperlegible", system-ui, "Segoe UI", sans-serif', hoja: `${GOOGLE}Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400;1,700` },
  { id: 'hanken', nombre: 'Hanken Grotesk', tipo: 'Sobria', grupo: 'Sin serif', pila: '"Hanken Grotesk", system-ui, "Segoe UI", sans-serif', hoja: `${GOOGLE}Hanken+Grotesk:ital,wght@0,300..900;1,300..900` },
  { id: 'dmsans', nombre: 'DM Sans', tipo: 'Compacta', grupo: 'Sin serif', pila: '"DM Sans", system-ui, "Segoe UI", sans-serif', hoja: `${GOOGLE}DM+Sans:ital,opsz,wght@0,9..40,400..800;1,9..40,400..800` },
  { id: 'worksans', nombre: 'Work Sans', tipo: 'De oficio', grupo: 'Sin serif', pila: '"Work Sans", system-ui, "Segoe UI", sans-serif', hoja: `${GOOGLE}Work+Sans:ital,wght@0,400..800;1,400..800` },
  { id: 'figtree', nombre: 'Figtree', tipo: 'Amable', grupo: 'Sin serif', pila: '"Figtree", system-ui, "Segoe UI", sans-serif', hoja: `${GOOGLE}Figtree:ital,wght@0,400..900;1,400..900` },
  { id: 'rubik', nombre: 'Rubik', tipo: 'Serena', grupo: 'Sin serif', pila: '"Rubik", system-ui, "Segoe UI", sans-serif', hoja: `${GOOGLE}Rubik:ital,wght@0,400..900;1,400..900` },
  { id: 'karla', nombre: 'Karla', tipo: 'Con carácter', grupo: 'Sin serif', pila: '"Karla", system-ui, "Segoe UI", sans-serif', hoja: `${GOOGLE}Karla:ital,wght@0,400..800;1,400..800` },
  { id: 'publicsans', nombre: 'Public Sans', tipo: 'Institucional', grupo: 'Sin serif', pila: '"Public Sans", system-ui, "Segoe UI", sans-serif', hoja: `${GOOGLE}Public+Sans:ital,wght@0,400..800;1,400..800` },

  // ── Con serif ───────────────────────────────────────────────────────────────────────────
  { id: 'lora', nombre: 'Lora', tipo: 'Serif', grupo: 'Con serif', pila: '"Lora", Georgia, "Times New Roman", serif', hoja: `${GOOGLE}Lora:ital,wght@0,400..700;1,400..700` },
  { id: 'merriweather', nombre: 'Merriweather', tipo: 'Para leer', grupo: 'Con serif', pila: '"Merriweather", Georgia, "Times New Roman", serif', hoja: `${GOOGLE}Merriweather:ital,wght@0,300..900;1,300..900` },
  { id: 'sourceserif', nombre: 'Source Serif', tipo: 'De pantalla', grupo: 'Con serif', pila: '"Source Serif 4", Georgia, "Times New Roman", serif', hoja: `${GOOGLE}Source+Serif+4:ital,opsz,wght@0,8..60,400..700;1,8..60,400..700` },
  { id: 'crimson', nombre: 'Crimson Pro', tipo: 'De libro', grupo: 'Con serif', pila: '"Crimson Pro", Georgia, "Times New Roman", serif', hoja: `${GOOGLE}Crimson+Pro:ital,wght@0,400..700;1,400..700` },
  { id: 'bitter', nombre: 'Bitter', tipo: 'Robusta', grupo: 'Con serif', pila: '"Bitter", Georgia, "Times New Roman", serif', hoja: `${GOOGLE}Bitter:ital,wght@0,400..800;1,400..800` },
  { id: 'eb', nombre: 'EB Garamond', tipo: 'Clásica', grupo: 'Con serif', pila: '"EB Garamond", Garamond, Georgia, serif', hoja: `${GOOGLE}EB+Garamond:ital,wght@0,400..700;1,400..700` },

  // ── De máquina ──────────────────────────────────────────────────────────────────────────
  { id: 'maquina', nombre: 'Plex Mono', tipo: 'De máquina', grupo: 'De máquina', pila: '"IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace', hoja: `${GOOGLE}IBM+Plex+Mono:ital,wght@0,400;0,600;0,700;1,400` },
  { id: 'jetbrains', nombre: 'JetBrains Mono', tipo: 'De código', grupo: 'De máquina', pila: '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace', hoja: `${GOOGLE}JetBrains+Mono:ital,wght@0,400..800;1,400..800` },
  { id: 'spline', nombre: 'Spline Mono', tipo: 'Mono suave', grupo: 'De máquina', pila: '"Spline Sans Mono", ui-monospace, Menlo, Consolas, monospace', hoja: `${GOOGLE}Spline+Sans+Mono:ital,wght@0,300..700;1,300..700` },

  // ── Para títulos ────────────────────────────────────────────────────────────────────────
  // ⚠️ Cansan en un párrafo largo, y la fuente del curso pinta TODO. El menú lo advierte.
  { id: 'bricolage', nombre: 'Bricolage', tipo: 'Llamativa', grupo: 'Para títulos', pila: '"Bricolage Grotesque", system-ui, "Segoe UI", sans-serif', hoja: `${GOOGLE}Bricolage+Grotesque:opsz,wght@12..96,400..800` },
  { id: 'instrument', nombre: 'Instrument', tipo: 'De revista', grupo: 'Para títulos', pila: '"Instrument Serif", Georgia, "Times New Roman", serif', hoja: `${GOOGLE}Instrument+Serif:ital@0;1` },
  { id: 'fraunces', nombre: 'Fraunces', tipo: 'Expresiva', grupo: 'Para títulos', pila: '"Fraunces", Georgia, "Times New Roman", serif', hoja: `${GOOGLE}Fraunces:ital,opsz,wght@0,9..144,400..900;1,9..144,400..900` },
];

/**
 * El BUSCADOR de la biblioteca. Puro: lo ejecuta el test sin React y sin DOM.
 *
 * Sin acentos y sin mayúsculas, y por TÉRMINOS sueltos: buscar «mono maquina» tiene que encontrar
 * «Plex Mono / De máquina». Un buscador que exige tildes es un buscador que no se usa — la misma
 * regla que el de Conocimientos (app/conocimientos/CursoPortal.tsx).
 *
 * El pajar es el nombre, el tipo Y el grupo: quien escribe «serif» está pidiendo el cajón, no una
 * familia, y quien escribe «titulo» está pidiendo las de títulos.
 *
 * ⚠️ DEVUELVE EL CATÁLOGO ENTERO con la consulta vacía, y NUNCA filtra la elegida hacia afuera: un
 *    menú donde la fuente que está puesta desaparece al tipear es un menú donde no se puede ver qué
 *    hay elegido. De eso se encarga `agrupar`, que la vuelve a meter en su cajón.
 */
const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Con qué palabras se busca cada cajón. NO es el nombre del cajón, y ésa es toda la gracia:
 * «Sin serif» CONTIENE la palabra «serif», así que buscar `serif` —que es lo que más se va a
 * buscar— devolvía 19 de 24, o sea nada. Medido al estrenar el buscador.
 *
 * Acá cada cajón trae los nombres con los que la gente lo pide, y el de las sans NUNCA la palabra
 * «serif»: quien escribe `serif` quiere las de remate, y quien escribe `sans` o `palo seco`, las
 * otras. Lo fija un test.
 */
const PALABRAS_GRUPO: Record<Grupo, string> = {
  'Sin serif': 'sans palo seco',
  'Con serif': 'serif remate',
  'De máquina': 'mono monoespaciada maquina',
  'Para títulos': 'titulos display',
};

export function buscarFuentes(q: string, lista: readonly FuenteCurso[] = FUENTES): FuenteCurso[] {
  const terminos = sinTildes(String(q ?? '')).split(/\s+/).filter(Boolean);
  if (!terminos.length) return [...lista];
  return lista.filter((f) => {
    const heno = sinTildes(`${f.nombre} ${f.tipo} ${PALABRAS_GRUPO[f.grupo]}`);
    return terminos.every((t) => heno.includes(t));
  });
}

/**
 * Lo que dibuja el menú: los cajones en su orden, sin los vacíos, y con la ELEGIDA siempre adentro
 * aunque la búsqueda la haya dejado afuera (ver arriba).
 *
 * Devuelve pares para que el componente no tenga que saber el orden de `GRUPOS`.
 */
export function agrupar(fuentes: readonly FuenteCurso[], elegida?: string | null): Array<[Grupo, FuenteCurso[]]> {
  const dentro = new Set(fuentes.map((f) => f.id));
  const conLaElegida = elegida && !dentro.has(elegida)
    ? [...fuentes, ...FUENTES.filter((f) => f.id === elegida)]
    : [...fuentes];
  return GRUPOS
    .map((g): [Grupo, FuenteCurso[]] => [g, conLaElegida.filter((f) => f.grupo === g)])
    .filter(([, fs]) => fs.length > 0);
}


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
