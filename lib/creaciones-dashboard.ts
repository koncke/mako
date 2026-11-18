// =============================================================================
// creaciones-dashboard — una hoja del Dashboard como PLANTILLA: lo puro (18/11/2026)
// =============================================================================
// Leila (30/10/2026): guardar como plantilla en todas las tabs, para el negocio o para la comunidad. Martín (13/10/2026,
// las estrellas): «todas las automatizaciones, los dashboards, los formatos… que los usuarios hagan sus creaciones y otros
// usuarios puedan puntuarles». El enchufe que lee el informe y lo escribe vive en lib/creaciones-enchufes.ts (tipo
// `dashboard`); acá, lo que se decide sin la base y se prueba en tests/creaciones-dashboard.test.ts:
//   · LA DEFINICIÓN es UNA HOJA del informe del Dashboard (`{ v: 1, hoja }`): sus gráficos, filtros, textos, secciones y su
//     estilo. Una hoja no tiene datos: los números los lee el negocio que la abre (el mismo criterio que «Copiar dashboard»,
//     lib/graficos-copia.ts). Privada, viaja tal cual: los filtros que nombran a su gente o a sus campañas son suyos.
//   · PARA COMPARTIRLA (`dashboardParaPublico`), lo que no es texto y es del negocio, fuera, ANTES de la limpieza de textos
//     del server (`limpiarTextos`):
//       - los filtros sobre personas (`hojaParaCopiar`, la lista POSITIVA de campos públicos del AI Analyst) y los filtros
//         PARA MIRAR que nombran cosas del negocio (`hojaParaOtroNegocio`: sólo queda el vocabulario fijo). Es lo que ya
//         hace pegar un dashboard en otro negocio, y por eso se reusa tal cual (una cosa, un lugar);
//       - la dirección de una imagen, un video, un «Insertar» o un enlace de afuera: es un link al storage o al sitio del
//         negocio. Un enlace a una pantalla de MaKo (`/crm`) se queda: no es de nadie;
//       - un experimento ya arrancado (`experimento.id`): es una fila de la tabla del negocio. Uno sin arrancar es una
//         PROPUESTA de texto y se queda (la limpian los textos);
//       - los funnels a los que se ata un bloque de General: son ids del negocio.
//   · AL USARLA (`hojaParaUsar`), entra con TODOS los ids nuevos (`hojaConIdsNuevos`): con los de la hoja de origen, usarla
//     dos veces compartiría lo elegido mirando, y una caja de «Conclusiones de MaKo» leería las conclusiones de la otra.
// SIN `server-only`: lo importan el enchufe, la pantalla (para dibujar la miniatura y agregar la hoja) y el test.
// =============================================================================

import { MAX_HOJAS, esElemento, esGrafico, hojasVisibles, type Componente, type Hoja, type Tablero } from './graficos-catalogo';
import { hojaConIdsNuevos, hojaDeCopia, hojaParaCopiar, hojaParaOtroNegocio, nombreDeHoja } from './graficos-copia';

export type DefinicionDashboard = { v: 1; hoja: Hoja };

/** La definición de una hoja del informe: la hoja tal cual (privada). */
export function definicionDeHoja(h: Hoja): DefinicionDashboard {
  return { v: 1, hoja: h };
}

/** Lee una definición guardada (de la base, o de otro negocio). null si no es una hoja con algo adentro. */
export function leerDefinicionDashboard(def: unknown): DefinicionDashboard | null {
  if (!def || typeof def !== 'object') return null;
  const hoja = hojaDeCopia((def as Record<string, unknown>).hoja);
  return hoja ? { v: 1, hoja } : null;
}

/** Un elemento sin lo del negocio que NO es texto (la limpieza de textos no ve un link a un storage). null = se va entero. */
function elementoParaPublico(c: Componente): Componente | null {
  if (!esElemento(c)) return c;
  if (c.experimento?.id != null) return null;
  let e = c;
  if ((e.tipo === 'imagen' || e.tipo === 'video' || e.tipo === 'insertado') && e.url) e = { ...e, url: '' };
  if (e.tipo === 'enlace' && e.url && !e.url.startsWith('/')) e = { ...e, url: '' };
  if (e.general && (e.general.funnel != null || e.general.funnels)) {
    const { funnel: _f, funnels: _fs, ...general } = e.general;
    void _f; void _fs;
    e = { ...e, general };
  }
  return e;
}

/** Cada componente de la hoja (y los de adentro del pop-up de un gráfico), pasado por `elementoParaPublico`. */
function componentesParaPublico(cs: readonly Componente[]): Componente[] {
  return cs.flatMap((c) => {
    const x = elementoParaPublico(c);
    if (!x) return [];
    if (esGrafico(x) && x.popup) return [{ ...x, popup: { ...x.popup, componentes: componentesParaPublico(x.popup.componentes) } }];
    return [x];
  });
}

/**
 * Lo que no es texto y es del negocio, fuera (ver el encabezado). Si la definición no se lee, vuelve tal cual: la red del
 * server (`fugasDe`) igual frena lo que quede, y una definición que no se lee tampoco se puede guardar.
 */
export function dashboardParaPublico(def: unknown): unknown {
  const d = leerDefinicionDashboard(def);
  if (!d) return def;
  const sinPersonas = hojaParaCopiar(d.hoja).hoja;
  const sinLoDelNegocio = hojaParaOtroNegocio(sinPersonas).hoja;
  const hoja: Hoja = { ...sinLoDelNegocio, componentes: componentesParaPublico(sinLoDelNegocio.componentes) };
  // Un bloque de un diseño (`diseno.piezas`) o un conector que apuntaba a un componente que se fue: el saneo de siempre
  // los poda al leer.
  return { v: 1, hoja };
}

/** Nombre y una línea para la galería: cuántos gráficos y cuántos filtros tiene la hoja. */
export function resumenDashboard(def: unknown): { nombre: string; detalle: string } | null {
  const d = leerDefinicionDashboard(def);
  if (!d) return null;
  const graficos = d.hoja.componentes.filter(esGrafico).length;
  const filtros = d.hoja.controles.length;
  const partes = [`${graficos} ${graficos === 1 ? 'gráfico' : 'gráficos'}`];
  if (filtros) partes.push(`${filtros} ${filtros === 1 ? 'filtro' : 'filtros'}`);
  return { nombre: nombreDeHoja(d.hoja), detalle: partes.join(' · ') };
}

/** La hoja que entra al informe de quien la usa: con todos los ids nuevos. null si la definición no sirve. */
export function hojaParaUsar(def: unknown): Hoja | null {
  const d = leerDefinicionDashboard(def);
  return d ? hojaConIdsNuevos(d.hoja) : null;
}

/** Las hojas de un informe que se pueden guardar como plantilla: las que tienen algo (una en blanco no es una plantilla). */
export function hojasPublicables(t: Pick<Tablero, 'hojas' | 'enBlanco'>): Hoja[] {
  return hojasVisibles(t).filter((h) => h.componentes.length > 0 || h.controles.length > 0);
}

export const LLENO_DE_HOJAS = 'Tu Dashboard ya tiene el máximo de hojas. Archiva una y vuelve a usarla.';

/**
 * El informe con la hoja de la plantilla AL FINAL, como «Nueva hoja» de la pantalla (EditorInforme → `crearHoja`): con
 * todas las hojas eliminadas (`enBlanco`), la de la plantilla es la ÚNICA (la vacía que viajaba por dentro no se guarda).
 */
export function informeConHoja(t: Tablero, h: Hoja): { tablero: Tablero; hoja: Hoja } | { error: string } {
  const hojas = hojasVisibles(t);
  if (hojas.length >= MAX_HOJAS) return { error: LLENO_DE_HOJAS };
  const { enBlanco: _enBlanco, ...resto } = t;
  void _enBlanco;
  const hoja = hojas.some((x) => x.id === h.id) ? hojaConIdsNuevos(h) : h;
  return { tablero: { ...resto, hojas: [...hojas, hoja] }, hoja };
}
