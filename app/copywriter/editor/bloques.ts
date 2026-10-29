// =============================================================================
// Los bloques del menú «/» del Copywriter — copiados de Notion (un módulo PURO, sin React)
// =============================================================================
// Notion (help/writing-and-editing-basics, «Basic blocks»), con sus nombres y sus descripciones de la versión en
// español, en su orden: Texto, Lista de tareas, Encabezado 1-3, Tabla, Lista con viñetas, Lista numerada, Lista
// desplegable, Cita, Divisor, Texto destacado. Lo que se dejó afuera (Página, Enlace a página, bases de datos,
// medios, insertados): docs/diseno-copywriter.md.
//
// Y dos grupos que Notion no tiene porque no escribe guiones: «Secciones del guion» (la etiqueta de una estructura de
// la biblioteca, lib/guion-estructuras.ts: «/gancho» pone el título de la sección Gancho) y «MaKo» («Pedirle a MaKo»,
// el «Ask AI» de Notion: lleva el cursor a la caja del chat). Lo que encuentra la búsqueda lo usa el plugin del «/»
// (app/web-generator/editor/extensiones/barra.ts, opción `buscar`) para saber si lo escrito todavía es un comando.
// =============================================================================

import { nombreDeSeccion } from '@/lib/copywriter/doc';

export type IdBloqueCopy =
  | 'texto' | 'tareas' | 'h1' | 'h2' | 'h3' | 'tabla' | 'vinetas' | 'numerada' | 'desplegable' | 'cita' | 'separador'
  | 'destacado' | 'mako' | `seccion:${string}`;

export type CategoriaCopy = 'Bloques básicos' | 'Secciones del guion' | 'MaKo';

export type DefBloqueCopy = {
  id: IdBloqueCopy;
  categoria: CategoriaCopy;
  nombre: string;
  descripcion: string;
  /** El atajo markdown que Notion muestra a la derecha del renglón. */
  atajo?: string;
  /** Lo que dibuja el cuadrito de la izquierda (Notion: un ícono del bloque). */
  icono: string;
  /** Otras palabras que lo encuentran (en Notion, «/h1» o «/bullet»). */
  sinonimos: readonly string[];
};

export const BLOQUES_BASICOS: readonly DefBloqueCopy[] = [
  { id: 'texto', categoria: 'Bloques básicos', nombre: 'Texto', descripcion: 'Empieza a escribir con texto sin formato.', icono: 'Aa', sinonimos: ['parrafo', 'text', 'plain'] },
  { id: 'tareas', categoria: 'Bloques básicos', nombre: 'Lista de tareas', descripcion: 'Haz un seguimiento de las tareas con una lista de tareas.', atajo: '[]', icono: '☑', sinonimos: ['todo', 'to-do', 'casilla', 'check'] },
  { id: 'h1', categoria: 'Bloques básicos', nombre: 'Encabezado 1', descripcion: 'Encabezado de sección grande.', atajo: '#', icono: 'H1', sinonimos: ['h1', 'titulo', 'heading'] },
  { id: 'h2', categoria: 'Bloques básicos', nombre: 'Encabezado 2', descripcion: 'Encabezado de sección mediano.', atajo: '##', icono: 'H2', sinonimos: ['h2', 'subtitulo', 'heading'] },
  { id: 'h3', categoria: 'Bloques básicos', nombre: 'Encabezado 3', descripcion: 'Encabezado de sección pequeño.', atajo: '###', icono: 'H3', sinonimos: ['h3', 'heading'] },
  { id: 'tabla', categoria: 'Bloques básicos', nombre: 'Tabla', descripcion: 'Añade una tabla simple.', icono: '▦', sinonimos: ['table', 'grilla'] },
  { id: 'vinetas', categoria: 'Bloques básicos', nombre: 'Lista con viñetas', descripcion: 'Crea una lista con viñetas simple.', atajo: '-', icono: '•', sinonimos: ['bullet', 'lista', 'vinetas', 'puntos'] },
  { id: 'numerada', categoria: 'Bloques básicos', nombre: 'Lista numerada', descripcion: 'Crea una lista con numeración.', atajo: '1.', icono: '1.', sinonimos: ['numbered', 'lista', 'numeros'] },
  { id: 'desplegable', categoria: 'Bloques básicos', nombre: 'Lista desplegable', descripcion: 'Las listas desplegables pueden ocultar y mostrar contenido.', atajo: '>', icono: '▸', sinonimos: ['toggle', 'plegable', 'acordeon'] },
  { id: 'cita', categoria: 'Bloques básicos', nombre: 'Cita', descripcion: 'Captura una cita.', atajo: '"', icono: '❝', sinonimos: ['quote', 'cita'] },
  { id: 'separador', categoria: 'Bloques básicos', nombre: 'Divisor', descripcion: 'Divide visualmente los bloques.', atajo: '---', icono: '—', sinonimos: ['divider', 'linea', 'separador', 'hr'] },
  { id: 'destacado', categoria: 'Bloques básicos', nombre: 'Texto destacado', descripcion: 'Haz que el texto destaque.', icono: '💡', sinonimos: ['callout', 'aviso', 'nota', 'recuadro'] },
];

/** Las etiquetas que más usan las estructuras de la biblioteca: se ofrecen aunque el guion no tenga estructura. */
export const SECCIONES_COMUNES: readonly string[] = ['GANCHO', 'PROBLEMA', 'AGITACION', 'SOLUCION', 'HISTORIA', 'VALOR', 'PRUEBA', 'CTA'];

export const BLOQUE_MAKO: DefBloqueCopy = {
  id: 'mako', categoria: 'MaKo', nombre: 'Pedirle a MaKo', descripcion: 'Escríbele a MaKo qué quieres que escriba o cambie.', icono: '✦',
  sinonimos: ['ia', 'ai', 'mako', 'escribir', 'ayuda'],
};

/** El bloque de una sección (por su etiqueta). */
export function bloqueDeSeccion(etiqueta: string): DefBloqueCopy {
  const nombre = nombreDeSeccion(etiqueta);
  return { id: `seccion:${etiqueta}`, categoria: 'Secciones del guion', nombre, descripcion: `El título de la sección ${nombre}.`, icono: '§', sinonimos: [etiqueta.toLowerCase()] };
}

/** Todo el catálogo, con las secciones del guion abierto primero (las de su estructura) y las comunes después. */
export function catalogoCopy(seccionesDelGuion: readonly string[] = [], { conMako = true }: { conMako?: boolean } = {}): DefBloqueCopy[] {
  const etiquetas = [...new Set([...seccionesDelGuion, ...SECCIONES_COMUNES])];
  // Con un link para editar no hay MaKo (D9): «Pedirle a MaKo» no se ofrece.
  return [...BLOQUES_BASICOS, ...etiquetas.map(bloqueDeSeccion), ...(conMako ? [BLOQUE_MAKO] : [])];
}

/** Sin tildes y en minúscula, para comparar lo escrito. */
const plano = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** Lo que encuentra lo escrito después de la «/»: por el nombre, por sus sinónimos o por su atajo. Vacío = todo. */
export function buscarBloquesCopy(consulta: string, catalogo: readonly DefBloqueCopy[] = catalogoCopy()): DefBloqueCopy[] {
  const q = plano(consulta.trim());
  if (!q) return [...catalogo];
  const palabras = q.split(/\s+/);
  return catalogo.filter((b) => {
    const donde = plano([b.nombre, ...b.sinonimos, b.atajo ?? ''].join(' '));
    return palabras.every((p) => donde.includes(p));
  });
}

export const CATEGORIAS_COPY: readonly CategoriaCopy[] = ['Bloques básicos', 'Secciones del guion', 'MaKo'];

/** Los bloques encontrados, agrupados por categoría en su orden (lo que dibuja el menú). */
export function gruposDeMenu(consulta: string, catalogo: readonly DefBloqueCopy[]): { categoria: CategoriaCopy; bloques: DefBloqueCopy[] }[] {
  const hallados = buscarBloquesCopy(consulta, catalogo);
  return CATEGORIAS_COPY.map((categoria) => ({ categoria, bloques: hallados.filter((b) => b.categoria === categoria) })).filter((g) => g.bloques.length);
}
