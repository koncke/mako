// =============================================================================
// cerebro-filtro — QUÉ parte del segundo cerebro se está mirando
// =============================================================================
// El estado del filtro y su predicado, en un módulo propio y SIN `server-only`, por
// dos razones que no son de estilo:
//
// 1. LO USAN DOS PANTALLAS. El mapa lo usa para decidir qué dibuja, y el exportador
//    para decidir qué entra al ZIP. Eran dos sistemas distintos —el mapa filtraba por
//    carpeta/sección/autoría y el ZIP tenía diez casillas de área— y el usuario tenía
//    que aprender los dos para hacer lo mismo. Ahora es un solo control y un solo
//    predicado; lo que ves es lo que baja, sin traducción de por medio.
// 2. SE PUEDE TESTEAR. Adentro de un componente de 1.700 líneas, la única regla que
//    decide qué dato existe para el usuario no la puede importar ningún test.
//
// La semántica es la del tablero (`passes` en app/plan/board/BoardShell.tsx): AND entre
// dimensiones, OR adentro de cada una. Y `Set` vacío significa TODOS, nunca «ninguno»:
// así el estado inicial y el estado limpio son el mismo objeto, y no hay forma de dejar
// la pantalla en blanco sin haberlo pedido.
// =============================================================================

import { AREAS, type AreaId, type NodoCerebro } from './cerebro-modelo';

/** Quién escribió el dato. Es una PARTICIÓN, no un conjunto de etiquetas: «MaKo + vos»
 *  es lo mismo que «todos», así que se elige uno solo. */
export type Autoria = 'todos' | 'mako' | 'usuario' | 'falta';

export type EstadoFiltro = {
  /** ids de NIVEL1 (las carpetas madre). */
  carpetas: Set<string>;
  areas: Set<AreaId>;
  autoria: Autoria;
};

export const FILTRO_VACIO: EstadoFiltro = { carpetas: new Set(), areas: new Set(), autoria: 'todos' };

/** Cuántos filtros hay puestos. Cada VALOR elegido suma uno, igual que en el tablero:
 *  tres secciones marcadas son tres filtros, no uno. */
export function cuentaFiltros(f: EstadoFiltro): number {
  return f.carpetas.size + f.areas.size + (f.autoria !== 'todos' ? 1 : 0);
}

/** Un filtro NUEVO, con Sets propios. `FILTRO_VACIO` es una constante compartida y sus
 *  Sets son mutables: usarla como estado inicial de dos pantallas las ata entre sí. */
export const filtroVacio = (): EstadoFiltro => ({ carpetas: new Set(), areas: new Set(), autoria: 'todos' });

/** Copia con Sets propios — para sembrar el filtro del exportador con el del mapa sin
 *  que tocar uno mueva el otro. */
export const clonarFiltro = (f: EstadoFiltro): EstadoFiltro => ({
  carpetas: new Set(f.carpetas),
  areas: new Set(f.areas),
  autoria: f.autoria,
});

/** El andamiaje del dibujo: la raíz, las carpetas madre y los nodos de área. Existen
 *  para sostener el mapa y NO son datos del negocio — no se cuentan, no se exportan y
 *  no se rigen por la autoría, porque no tienen una. */
export const esAndamio = (n: NodoCerebro): boolean =>
  n.id === 'raiz' || n.id.startsWith('area:') || n.id.startsWith('n1:');

/**
 * ¿Este nodo pasa el filtro?
 *
 * El andamio se rige por la MISMA condición que sus hijos en carpeta y sección —filtrar
 * por «Oferta» y dejar dibujadas las otras cuatro carpetas es no haber filtrado— pero
 * queda EXENTO de la autoría, porque no tiene autoría propia y sacarlo dejaría las
 * etiquetas flotando sin racimo.
 *
 * La raíz pasa siempre: es el centro del mapa y sin ella las áreas cuelgan de la nada.
 * Ojo con eso en cualquier conteo de cara al usuario — el mínimo alcanzable no es cero.
 */
export function pasaFiltro(n: NodoCerebro, f: EstadoFiltro): boolean {
  if (n.id === 'raiz') return true;

  const suArea = AREAS.find((a) => a.id === n.area);
  if (f.carpetas.size && !f.carpetas.has(suArea?.padre ?? '')) return false;
  if (f.areas.size && !f.areas.has(n.area)) return false;

  if (f.autoria !== 'todos') {
    if (esAndamio(n)) return true;
    if (f.autoria === 'falta') return n.autoria === 'pendiente';
    return n.autoria === f.autoria;
  }
  return true;
}

/** Las opciones que tiene sentido ofrecer en una categoría, dado lo elegido en la otra.
 *  Sin esto el menú ofrece combinaciones que dan cero —«carpeta Oferta» + «sección
 *  Razones» son ramas distintas del árbol— y el usuario se entera recién cuando la
 *  pantalla queda vacía. */
export const areasOfrecidas = (f: EstadoFiltro) =>
  (f.carpetas.size ? AREAS.filter((a) => f.carpetas.has(a.padre)) : AREAS);

/** Al cambiar de carpeta se PODAN las secciones que quedaron fuera: el filtro es AND, y
 *  dejarlas daría cero resultados sin que se vea por qué. */
export function podarAreas(f: EstadoFiltro, carpetas: Set<string>): Set<AreaId> {
  if (!carpetas.size) return f.areas;
  return new Set([...f.areas].filter((a) => carpetas.has(AREAS.find((x) => x.id === a)?.padre ?? '')));
}
