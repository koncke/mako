// =============================================================================
// copywriter/mudanza-reglas — lo que ya había en Copywriting, pasado a páginas (PURO)
// =============================================================================
// Pedido de Martín (29/10/2026): «Lo que hoy tiene Copywriter y sirve se migra a páginas; lo que no sirve se depreca».
// Diseño: docs/diseno-copywriter.md (D14). Lo que sirve y tiene texto guardado:
//   · los GUIONES del Ads Writer (app_settings `mako.razones`: cada cruce avatar × motivación con sus guiones, lib/razones.ts)
//     → una página de Ad por guion, con su ángulo y su estructura si siguen en la biblioteca, debajo de «Guiones del Ads
//     Writer». El texto ya viene con las etiquetas en MAYÚSCULA en su renglón: `docDeTexto` lo parte en secciones;
//   · el HISTORIAL de Reels (`reels.historial`, la tab Reels del Editor que se retira) → una página de Reel por pieza, con
//     la forma del template «Guion de Reel» (plantillas.ts) ya llena, debajo de «Reels».
// Se COPIA: lo original queda donde estaba (la matriz del Ads Writer sigue andando). Lo hace UNA vez por negocio
// (lib/copywriter/mudanza.ts).
// ⚠️ CADA PÁGINA MUDADA TIENE UN ID QUE SALE DE SU ORIGEN (`idDeMudanza`: el negocio + la celda + el guion), no al azar.
// Verificación del Cerebro de 544991179 (ALTA): con ids al azar, una mudanza cortada después de escribir el índice (la
// marca «hecha» que no llegó, o la respuesta del índice que se perdió) se repetía ENTERA a los 10 minutos: 7 → 14 páginas,
// dos «Guiones del Ads Writer». Con el id del origen, repetirla encuentra lo que ya está y no lo vuelve a crear.
// =============================================================================

import { createHash } from 'node:crypto';
import type { PiezaReel } from '../ig-writer';
import { CAPTION_VISIBLE } from '../ig-formatos';
import { tituloDeSeccion } from './doc';
import { docDeTexto } from './texto';
import type { JsonNodo, PropsGuion, TipoGuion } from './tipos';

/**
 * El id de una página mudada: el mismo cada vez que se muda lo mismo en el mismo negocio (válido para `esIdPagina`: «g» y
 * 12 de hex). Con el negocio adentro, dos negocios nunca comparten un id (ni la charla `copywriter:<id>` de esa página).
 */
export const idDeMudanza = (ws: number, clave: string): string =>
  `g${createHash('sha256').update(`copywriter-mudanza:${ws}:${clave}`).digest('hex').slice(0, 12)}`;

/** Una página por crear: `clave` la nombra (su id sale de ahí, `idDeMudanza`) y sus hijas la encuentran por `padreClave`. */
export type PaginaMudada = {
  clave: string;
  padreClave: string | null;
  titulo: string;
  tipo: TipoGuion;
  emoji: string | null;
  props: Partial<PropsGuion>;
  contenido: JsonNodo;
};

/** Cuántas trae como máximo una mudanza (el índice tiene su tope de 500 páginas; el resto queda donde estaba). */
export const TOPE_MUDANZA = 300;

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const texto = (t: string, negrita = false): JsonNodo => ({ type: 'text', text: t, ...(negrita ? { marks: [{ type: 'bold' }] } : {}) });
const parrafo = (...c: JsonNodo[]): JsonNodo => ({ type: 'paragraph', ...(c.length ? { content: c } : {}) });
const campo = (etiqueta: string, valor: string): JsonNodo => ({ type: 'listItem', content: [parrafo(texto(`${etiqueta}: `, true), ...(valor ? [texto(valor)] : []))] });
const celda = (t: string, titulo = false): JsonNodo => ({ type: titulo ? 'tableHeader' : 'tableCell', content: [parrafo(...(t ? [texto(t)] : []))] });
const nota = (t: string): JsonNodo => ({ type: 'callout', attrs: { emoji: '📦' }, content: [parrafo(texto(t))] });
const corto = (t: string, n = 80) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);

/** Un guion crudo de la matriz: lo que usa la mudanza (lib/razones.ts tiene `normalizarGuion`, pero es server-only). */
function guionDe(raw: unknown): { id: string; texto: string; anguloId: string; anguloNombre: string; estructuraId: string } | null {
  const g = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const texto = str(g.texto);
  return texto ? { id: str(g.id), texto, anguloId: str(g.anguloId), anguloNombre: str(g.anguloNombre), estructuraId: str(g.estructuraId) } : null;
}

/**
 * Los guiones de una celda de la matriz. Una celda de ANTES del multi-guion (30/07/2026) tiene un solo string en `guion`:
 * la matriz la adopta como un guion «General» (lib/razones.ts, normalizarGuiones) y la mudanza también (verificación del
 * Cerebro de 544991179: se quedaba afuera aunque la matriz la mostrara).
 */
function guionesDeCelda(o: Record<string, unknown>): unknown[] {
  const guiones = Array.isArray(o.guiones) ? o.guiones : [];
  const legado = str(o.guion);
  return guiones.length || !legado ? guiones : [{ id: 'general', anguloNombre: 'General', texto: legado }];
}

/** Los guiones del Ads Writer (el JSON crudo de `mako.razones`) → páginas de Ad debajo de «Guiones del Ads Writer». */
export function paginasDeAdsWriter(raw: unknown, catalogo: { angulos: ReadonlySet<string>; estructuras: ReadonlySet<string> }): PaginaMudada[] {
  const celdas = Array.isArray(raw) ? raw : [];
  const hijas: PaginaMudada[] = [];
  const claves = new Set<string>();
  celdas.forEach((c, ci) => {
    const o = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>;
    const nombre = str(o.nombre);
    guionesDeCelda(o).forEach((g, gi) => {
      const n = guionDe(g);
      if (!n) return;
      const titulo = [nombre, n.anguloNombre].filter(Boolean).join(' · ') || corto(n.texto.split('\n')[0] ?? 'Guion');
      // La clave (y con ella el id) sale de la celda y del guion, con su lugar si no traen id; una repetida no se muda dos veces.
      const clave = `ads:${str(o.id) || `c${ci}`}:${n.id || `g${gi}`}`;
      if (claves.has(clave)) return;
      claves.add(clave);
      hijas.push({
        clave, padreClave: 'ads', titulo: corto(titulo), tipo: 'ad', emoji: null,
        props: { angulo: catalogo.angulos.has(n.anguloId) ? n.anguloId : null, estructura: catalogo.estructuras.has(n.estructuraId) ? n.estructuraId : null },
        contenido: docDeTexto(n.texto),
      });
    });
  });
  if (!hijas.length) return [];
  const padre: PaginaMudada = {
    clave: 'ads', padreClave: null, titulo: 'Guiones del Ads Writer', tipo: 'pagina', emoji: '📣', props: {},
    contenido: { type: 'doc', content: [nota('Los guiones que tenías en el Ads Writer, ahora como páginas. El original sigue en su matriz.')] },
  };
  return [padre, ...hijas];
}

/** Una pieza de la tab Reels → el cuerpo del template «Guion de Reel», ya lleno. */
export function docDeReel(p: Partial<PiezaReel>): JsonNodo {
  const hook = (p.hook ?? {}) as Partial<PiezaReel['hook']>;
  const escenas = Array.isArray(p.escenas) ? p.escenas : [];
  const content: JsonNodo[] = [
    tituloDeSeccion('GANCHO'),
    { type: 'bulletList', content: [campo('Frase hablada', str(hook.frase)), campo('Título en pantalla', str(hook.tituloEnPantalla)), campo('Visual', str(hook.visual))] },
    tituloDeSeccion('HISTORIA'),
    { type: 'table', content: [
      { type: 'tableRow', content: ['Escena', 'Locución', 'Cámara'].map((t) => celda(t, true)) },
      ...(escenas.length ? escenas : [{ texto: '', indicacionVisual: '' }]).map((e, i) => ({ type: 'tableRow', content: [celda(String(i + 1)), celda(str(e?.texto)), celda(str(e?.indicacionVisual))] })),
    ] },
    tituloDeSeccion('MORALEJA'), parrafo(...(str(p.moraleja) ? [texto(str(p.moraleja))] : [])),
    tituloDeSeccion('CTA'), parrafo(...(str(p.cta) ? [texto(str(p.cta))] : [])),
    { type: 'bulletList', content: [campo('Palabra clave', str(p.palabraClave))] },
    tituloDeSeccion('CAPTION'),
    { type: 'callout', attrs: { emoji: '✂️' }, content: [parrafo(texto(`Los primeros ${CAPTION_VISIBLE} caracteres se ven sin tocar «más».`))] },
    parrafo(...(str(p.caption) ? [texto(str(p.caption))] : [])),
  ];
  return { type: 'doc', content };
}

/** El historial de Reels (el JSON crudo de `reels.historial`) → páginas de Reel debajo de «Reels». */
export function paginasDeReels(raw: unknown): PaginaMudada[] {
  const lista = Array.isArray(raw) ? raw : [];
  const hijas: PaginaMudada[] = [];
  const claves = new Set<string>();
  lista.forEach((e, i) => {
    const o = (e && typeof e === 'object' ? e : {}) as Record<string, unknown>;
    const pieza = (o.pieza && typeof o.pieza === 'object' ? o.pieza : null) as Partial<PiezaReel> | null;
    const clave = `reel:${str(o.id) || `i${i}`}`;
    if (!pieza || claves.has(clave)) return;
    claves.add(clave);
    const duracion = typeof pieza.duracionEstimadaSeg === 'number' && pieza.duracionEstimadaSeg > 0 ? Math.round(pieza.duracionEstimadaSeg) : null;
    hijas.push({
      clave, padreClave: 'reels', titulo: corto(str(o.pedido) || 'Reel'), tipo: 'reel', emoji: null,
      props: { estructura: 'reel-viral', duracion }, contenido: docDeReel(pieza),
    });
  });
  if (!hijas.length) return [];
  const padre: PaginaMudada = {
    clave: 'reels', padreClave: null, titulo: 'Reels', tipo: 'pagina', emoji: '🎬', props: {},
    contenido: { type: 'doc', content: [nota('Los guiones que habías hecho en la tab Reels del Editor, ahora como páginas.')] },
  };
  return [padre, ...hijas];
}

/** Todo lo que se muda, con el tope (las hijas que no entran quedan donde estaban; el padre va si va alguna hija). */
export function loQueSeMuda(grupos: readonly PaginaMudada[][], lugar: number): PaginaMudada[] {
  const out: PaginaMudada[] = [];
  let quedan = Math.max(0, Math.min(TOPE_MUDANZA, lugar));
  for (const g of grupos) {
    if (quedan < 2 || !g.length) continue;
    const [padre, ...hijas] = g;
    const van = hijas.slice(0, quedan - 1);
    out.push(padre, ...van);
    quedan -= 1 + van.length;
  }
  return out;
}
