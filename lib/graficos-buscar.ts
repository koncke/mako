// =============================================================================
// graficos-buscar — la BÚSQUEDA del Dashboard: el «Ctrl+F» de la hoja y la barra de una tabla
// =============================================================================
// Tanda v5 (12/10/2026), decisión tomada en el contrato (docs/relevo/dashboard-v5.md): «La barra de búsqueda
// está SIEMPRE a la vista a su izquierda [del Filtro]… Ctrl/Cmd+F con el foco en el Dashboard enfoca la barra
// (si la barra ya tiene el foco, el segundo Ctrl+F es el del navegador)». Y el punto 14: una tabla trae su
// propia barra, que filtra ESA tabla.
//
// Son dos cosas distintas y no se mezclan:
//   · LA BARRA DE LA HOJA (app/dashboard/BuscarEnHoja.tsx, `BuscarEnHoja`) busca en lo DIBUJADO, como el
//     Ctrl+F del navegador: no pide datos, no filtra nada y no toca el DOM de React (pinta con la CSS Custom
//     Highlight API). Lo que el límite de una tabla dejó afuera no está dibujado, así que no lo encuentra.
//   · LA BARRA DE UNA TABLA (`BuscarEnTabla`) es un control `texto` de ese gráfico sobre el campo de su
//     dimensión: lo escrito va a la VISTA (no se guarda) y filtra en el server, así que encuentra también lo
//     que el límite dejaba afuera.
//
// Acá vive lo PURO de las dos (sin React, sin `server-only`): la normalización sin acentos con el mapa de
// índices sobre el texto original, la búsqueda sobre los pedazos de texto de la página, qué tecla enfoca la
// barra, y qué control es la barra de una tabla.
//
// ⚠️ LA COMPARACIÓN ES LA MISMA QUE LA DE LOS FILTROS (`filtrarFilas`, `opcionesDeLista`): sin acentos y en
//    minúsculas. Con dos comparaciones, «promoción» encontraría la fila en la barra de la tabla y no en la de
//    la hoja, y se leería como que la página no la tiene.

import { tipoDe, type ControlVista, type Grafico } from './graficos-catalogo';
import { campoDeDimension } from './graficos-controles-texto';

// ── La normalización, con el mapa de vuelta al texto original ────────────────────────────────────

/** Las marcas que deja la descomposición NFD (tildes, diéresis, la virgulilla de la ñ). */
const MARCAS = /\p{M}/gu;
/** Los caracteres de control: no viajan en una consulta (y el separador entre grupos es uno). */
const CONTROL = /[\u0000-\u001f\u007f]/g;
/** Entre dos grupos de texto (dos celdas, dos tarjetas): ninguna consulta lo contiene, así que nada lo cruza. */
const SEPARADOR = '\u0000';

/**
 * Un texto en su forma de comparar: sin acentos, en minúsculas y con cada racha de espacios (incluido el
 * duro, un salto o un tab) como UN espacio. `ini[i]` y `fin[i]` dicen qué pedazo del ORIGINAL produjo la
 * letra `i` del plano (un punto de código entero: un emoji no se parte), para pintar sobre el original.
 */
export type Plano = { plano: string; ini: number[]; fin: number[] };

/** Un punto de código en su forma de comparar («Á» → «a», «ñ» → «n», «İ» → «i»). */
const comparable = (cp: string) => cp.normalize('NFD').replace(MARCAS, '').toLowerCase().normalize('NFD').replace(MARCAS, '');

export function aPlano(texto: string): Plano {
  let plano = '';
  const ini: number[] = [];
  const fin: number[] = [];
  let i = 0;
  for (const cp of texto) {
    const largo = cp.length;
    if (/\s/u.test(cp)) {
      // Una racha de espacios es UNO: el primero se queda y se estira hasta el último.
      if (plano.endsWith(' ')) fin[fin.length - 1] = i + largo;
      else { plano += ' '; ini.push(i); fin.push(i + largo); }
    } else {
      const n = comparable(cp);
      for (let k = 0; k < n.length; k++) { plano += n[k]; ini.push(i); fin.push(i + largo); }
    }
    i += largo;
  }
  return { plano, ini, fin };
}

/** La consulta en su forma de comparar: sin los espacios de las puntas y sin caracteres de control. */
export const consultaPlana = (q: string): string => aPlano(q.replace(CONTROL, ' ')).plano.trim();

// ── La búsqueda sobre lo dibujado ─────────────────────────────────────────────────────────────

/**
 * Un pedazo de texto de la página (un nodo de texto del DOM), con su GRUPO: los pedazos seguidos del mismo
 * grupo se leen juntos («12» y « leads» de `{n} leads` son dos nodos y una frase), y entre dos grupos nada
 * cruza (el final de una celda y el principio de la siguiente no forman una palabra).
 */
export type Segmento = { texto: string; grupo: number };
/** Un punto del texto original: el pedazo y la posición adentro de él. */
export type Punto = { seg: number; off: number };
export type Coincidencia = { desde: Punto; hasta: Punto };

/** Cuántas se marcan como mucho: una consulta de una letra sobre una tabla de 50 filas son miles. */
export const TOPE_RESULTADOS = 500;

/**
 * Todas las apariciones de `consulta` en los pedazos, en orden y sin solaparse, como rangos sobre el texto
 * ORIGINAL de cada pedazo (para armar un `Range` del DOM). `cortado` = había más que `tope`.
 * Una consulta vacía (o de puros espacios) no encuentra nada: no es «todo».
 */
export function buscarEnSegmentos(segmentos: readonly Segmento[], consulta: string, tope = TOPE_RESULTADOS): { resultados: Coincidencia[]; cortado: boolean } {
  const q = consultaPlana(consulta);
  if (!q) return { resultados: [], cortado: false };
  let plano = '';
  const mapa: Array<{ seg: number; ini: number; fin: number } | null> = [];
  segmentos.forEach((s, k) => {
    if (k > 0 && s.grupo !== segmentos[k - 1].grupo) { plano += SEPARADOR; mapa.push(null); }
    const p = aPlano(s.texto);
    for (let i = 0; i < p.plano.length; i++) {
      // Dos pedazos del mismo grupo que se tocan con espacios («12 » y « leads») dejan UNO.
      if (p.plano[i] === ' ' && plano.endsWith(' ')) continue;
      plano += p.plano[i];
      mapa.push({ seg: k, ini: p.ini[i], fin: p.fin[i] });
    }
  });
  const resultados: Coincidencia[] = [];
  let cortado = false;
  for (let desde = 0; ;) {
    const a = plano.indexOf(q, desde);
    if (a < 0) break;
    if (resultados.length >= tope) { cortado = true; break; }
    const b = a + q.length;
    // La consulta no tiene separadores (`consultaPlana` saca los de control), así que ni la primera ni la
    // última letra de una coincidencia pueden caer en uno.
    const m0 = mapa[a]!;
    const m1 = mapa[b - 1]!;
    resultados.push({ desde: { seg: m0.seg, off: m0.ini }, hasta: { seg: m1.seg, off: m1.fin } });
    desde = b;
  }
  return { resultados, cortado };
}

/** La siguiente (o la anterior) coincidencia, dando la vuelta como el Ctrl+F del navegador. -1 = ninguna. */
export function vecina(actual: number, total: number, delta: 1 | -1): number {
  if (total <= 0) return -1;
  if (actual < 0) return delta > 0 ? 0 : total - 1;
  return (actual + delta + total) % total;
}

/** «2 de 7» (o «2 de 500+» si se cortó). Sin coincidencias, «0 de 0», como el contador del navegador. */
export function textoContador(actual: number, total: number, cortado = false): string {
  if (total <= 0) return '0 de 0';
  return `${Math.max(0, actual) + 1} de ${total}${cortado ? '+' : ''}`;
}

// ── El atajo ─────────────────────────────────────────────────────────────────────────────────

/**
 * Dónde está el foco cuando alguien aprieta Ctrl/Cmd+F: en la barra misma, en el Dashboard (o en ningún lado
 * y lo último que tocó fue el Dashboard), o afuera (la barra lateral, un modal, otra cosa de la página).
 */
export type FocoBuscar = 'barra' | 'dashboard' | 'afuera';

/**
 * ¿Esta tecla es la que enfoca la barra? Ctrl+F (Cmd+F en la Mac) sin Alt ni Shift, y SÓLO con el foco en el
 * Dashboard: con la barra ya enfocada, el segundo Ctrl+F es el del navegador (decisión del contrato v5), y
 * afuera del Dashboard no se le roba el atajo a nadie.
 */
export function atajoBuscar(e: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }, foco: FocoBuscar): boolean {
  if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return false;
  if (e.key.toLowerCase() !== 'f') return false;
  return foco === 'dashboard';
}

// ── La barra de una tabla ─────────────────────────────────────────────────────────────────────

/** Los grupos de la galería que son tablas: los que tienen FILAS para buscar. */
const GRUPOS_TABLA = new Set(['Tabla', 'Tabla dinámica']);

/** El campo que filtra la barra de una tabla: el de SU dimensión (`campoDeDimension`). null = no se puede. */
export function campoDeBusqueda(g: Grafico): string | null {
  const grupo = tipoDe(g.tipo)?.grupo;
  if (!grupo || !GRUPOS_TABLA.has(grupo)) return null;
  return campoDeDimension(g.fuente, g.dimension);
}

// ⚠️ QUÉ CONTROL ES LA BARRA no se decide acá: lo decide `idBusquedaDe` (app/dashboard/exportar.ts, el que arma
//    los pedidos de datos), y `conBusqueda` le pone a la tabla ese control `texto` «de fábrica» mientras tenga la
//    barra prendida —NO se guarda ningún control: así una tabla migrada (la de «Las llamadas») busca sin que
//    nadie le agregue nada—. Si la tabla ya tiene un `texto` propio para mirar sobre ese campo, la barra usa ÉSE;
//    si tiene una lista o un fijo, no hay barra (`idBusquedaDe` da null). Una sola regla, en un solo lugar: la
//    barra (app/dashboard/BuscarEnHoja.tsx) y el desplegable «Filtro» la piden allá.

/**
 * Por qué no se le puede poner la barra a esta tabla (corto, para el `title`), o null si se puede. `idBarra` es
 * lo que contesta `idBusquedaDe` para esta tabla (null = sobre ese campo ya hay una lista o un filtro fijo).
 */
export function motivoSinBusqueda(g: Grafico, idBarra: string | null): string | null {
  if (!campoDeBusqueda(g)) return 'Sólo en una tabla por categoría';
  if (!idBarra) return 'Ya hay un filtro de ese campo';
  return null;
}

/**
 * El parche que prende o apaga la barra de una tabla: SÓLO la marca (`tabla.buscar`), con lo demás de `tabla`
 * intacto. El control de la barra no se guarda (ver arriba). `controles` va igual, ENTERO (los fijos
 * incluidos), porque el que lo aplica (`onCambiarComp`) recibe la lista de la tarjeta junto con lo que cambia.
 */
export function parcheBuscarEnTabla(g: Grafico, prender: boolean): { controles: ControlVista[]; tabla: Grafico['tabla'] } {
  const resto = { ...(g.tabla ?? {}) };
  delete resto.buscar;
  const tabla = prender ? { ...resto, buscar: true } : Object.keys(resto).length ? resto : undefined;
  return { controles: [...g.controles], tabla };
}
