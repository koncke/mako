// =============================================================================
// Las reglas puras de la pantalla de Create (app/_crear/PantallaCrear.tsx)
// =============================================================================
// Martín, 29/10/2026, textual en lo central: «para todas las secciones de "create" no quiero otras tabs... En todas las tabs
// el mismo diseño de la barra lateral del chat de MaKo SIEMPRE abierto a la izquierda, y que los diferentes proyectos sean
// todos como en "Web generator" que estén al costado en la tab de chat con la flecha para ver a todos y que se pueda crear una
// nueva... En "nueva" dependiendo de qué tab, deberías ponerme TEMPLATES con la sección de ¿Qué vas a crear hoy?».
// Acá vive lo que se decide sin pantalla (qué proyectos se ven al buscar, qué muestra el centro) y se prueba en
// tests/crear-pantalla.test.ts.
// =============================================================================

import type { CSSProperties } from 'react';

/** Un proyecto de la tab (un video, un diseño, un guion, un avatar): un renglón de la lista de la tarjeta izquierda. */
export type ProyectoCrear = {
  id: string;
  nombre: string;
  /** A dónde lleva el renglón (con el `?ws=` de la pestaña, lo pone el Link). Sin esto, `onAbrir` de la pantalla. */
  href?: string;
  /** Cuándo se tocó por última vez (ms), para «hace 2 h» al costado. */
  cuando?: number | null;
  /** El «⋯» del renglón (Cambiar nombre, Duplicar, Eliminar…), como cada landing del Web Generator. Sin esto, no hay «⋯». */
  menu?: readonly AccionProyecto[];
};

/** Una opción del «⋯» de un proyecto. `peligro` la pinta en rojo (Eliminar) y pide confirmar con `confirmar`. */
export type AccionProyecto = {
  rotulo: string;
  hacer: () => void | Promise<void>;
  peligro?: boolean;
  /** La frase de confirmación («¿Eliminar "Mi reel"? No se puede deshacer.»). Sin esto, se hace directo. */
  confirmar?: string;
};

/** Una plantilla de «¿Qué vas a crear hoy?»: una tarjeta con su miniatura y su nombre (sin bajada: tanda 6 del Web Generator). */
export type PlantillaCrear = {
  id: string;
  nombre: string;
  /** La proporción de la miniatura (`'9 / 16'` un reel, `'1 / 1'` un post): sin imagen, la tarjeta dibuja ese marco. */
  formato?: string;
  /** La miniatura, si la plantilla tiene una. */
  imagen?: string | null;
  /** El rótulo chico del marco vacío («1080 × 1920», «Reel»), cuando no hay imagen. */
  rotulo?: string;
};

/** La cara de la tarjeta izquierda: el chat de MaKo (siempre, de entrada) o la lista de proyectos (la «←»). */
export type CaraTarjeta = 'chat' | 'lista';

/** En el teléfono no entran las dos columnas: se ve una por vez, y el interruptor de arriba cambia. */
export type VistaMovil = 'mako' | 'pieza';

export const SIN_NOMBRE = 'Sin título';

/** Para buscar: minúsculas y sin tildes («Reél» encuentra «reel»). */
export function normalizar(t: string): string {
  return t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/** Los proyectos que se ven con lo que se buscó, en el orden en que vinieron (el de la tab: lo último tocado arriba). */
export function proyectosVisibles(lista: readonly ProyectoCrear[], busca: string): ProyectoCrear[] {
  const q = normalizar(busca);
  if (!q) return [...lista];
  return lista.filter((p) => normalizar(p.nombre || SIN_NOMBRE).includes(q));
}

/**
 * ¿Qué ocupa el centro? «¿Qué vas a crear hoy?» cuando no hay nada abierto (la portada de la tab ES elegir qué crear, como el
 * Panel del Web Generator) o cuando se tocó «Nuevo …»; si no, la pieza abierta.
 */
export function centroDe(hayPieza: boolean, creando: boolean): 'nueva' | 'pieza' {
  return !hayPieza || creando ? 'nueva' : 'pieza';
}

/** La proporción de un formato `'9 / 16'` como número (ancho / alto); uno roto o vacío es un cuadrado. */
export function proporcion(formato: string | undefined): number {
  const m = /^\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/.exec(formato ?? '');
  if (!m) return 1;
  const r = Number(m[1]) / Number(m[2]);
  return Number.isFinite(r) && r > 0 ? r : 1;
}

/**
 * El marco vacío de una plantilla sin imagen, adentro de una miniatura de 4:3: lo que manda es el lado que toca primero.
 * Un formato más ancho que 4:3 (16:9) se mide por el ANCHO y uno más alto (9:16) por el ALTO; con los dos topes a la vez el
 * navegador rompe la proporción (el alto queda y el ancho se recorta).
 */
export function marcoDe(formato: string | undefined): CSSProperties {
  const r = proporcion(formato);
  const lado = r >= 4 / 3 ? { width: '72%' } : { height: '72%' };
  return { ...lado, aspectRatio: String(r), maxWidth: 'none' };
}

/** «hace 5 min», «hace 3 h», «hace 2 d»: lo justo para ordenar a ojo; sin fecha, nada. */
export function haceCuanto(cuando: number | null | undefined, ahora: number): string {
  if (!cuando || !Number.isFinite(cuando)) return '';
  const min = Math.max(0, Math.round((ahora - cuando) / 60_000));
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d < 31) return `hace ${d} d`;
  return new Date(cuando).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

/**
 * El estilo de la <Pagina> de una tab de Create: de borde a borde y del alto de la ventana (menos la barra de arriba de la
 * agencia), sin padding. Una sola copia para todas: si cada página escribiera el suyo, el día que cambie quedan cuatro.
 * ⚠️ Es un `calc(`: la regla global sólo corrige un alto que EMPIEZA con `height: 100vh` (docs/hallazgos-ui.md, 22/10/2026).
 * ⚠️ `flex: 'none'` + el alto + `overflow: hidden`, LOS TRES (el molde de app/offer/page.tsx y del Dashboard): <Pagina> trae
 *    `flex: 1`, que en la columna del layout anula el `height`, y el <main> crecería con el chat (scrollearía el documento y
 *    la caja de escribir se iría para abajo). `dvh` y no `vh`: en el teléfono, 100vh incluye la barra del navegador.
 */
export const ESTILO_PAGINA_CREAR: CSSProperties = {
  padding: 0,
  flex: 'none',
  height: 'calc(100dvh - var(--barra-agencia, 0px))',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};
