// =============================================================================
// El PUENTE del mapa de calor EN VIVO: qué se dicen MaKo y la página del cliente
// =============================================================================
// Decisión de Martín (12/10/2026): el mapa de calor muestra la landing EN VIVO adentro de un celular (o de una
// compu), con el calor encima, «exactamente igual» que la página. Aceptó el costo: abrir el mapa le cuenta un
// PageView al Pixel de Meta del cliente (corre adentro de la página, y desde MaKo no se puede apagar).
//
// POR QUÉ HACE FALTA UN PUENTE: la página es de OTRO origen. Desde afuera de un iframe así no se puede leer ni
// su alto, ni cuánto scrolleó, ni dónde está cada elemento (`contentDocument` tira SecurityError). Así que algo
// ADENTRO de la página contesta por `postMessage`: el alto, el scroll, la caja de cada elemento tocado y la de
// cada marco o video (lo que el mapa no mide). Ese algo es `public/replay/901/r.js` (fuente:
// scripts/replay-puente.js), y llega SIN que nadie vuelva a pegar código:
//
//   1. MaKo abre la página con `?mko_test=mapa-<id>` (`urlEnVivo`). El snippet ya pegado marca cada evento de
//      esa pestaña como PRUEBA (los conjuntos del Dashboard excluyen `prueba`: nuestro tráfico no ensucia).
//   2. El pageview contesta `rec = { v: PUENTE_MAPA_VERSION }` para una prueba del mapa (app/api/track/vsl),
//      y el snippet v21+ baja `/replay/<v>/r.js` como bajaría el grabador.
//   3. Ese r.js NO GRABA (no define `rrwebRecord`: el snippet no encuentra con qué grabar y no hace nada) e
//      instala el puente. El r.js de los visitantes de verdad (`REPLAY_LIB_VERSION`) no cambia.
//
// ⚠️ LAS DOS PUNTAS VALIDAN, y es lo que hace que esto no sea una puerta:
//   · MaKo acepta un mensaje sólo si `event.origin` es el de la página que embebió y `event.source` es SU
//     iframe (`leerMensajeDelPuente`). Cualquier otra ventana —otra pestaña, un anuncio, un marco adentro de
//     la página— que mande algo con la misma forma se ignora.
//   · El puente contesta sólo si el mensaje viene de `window.parent` con el origen de MaKo (el de su propio
//     script), y le escribe SÓLO a ese origen (`postMessage(m, origen)`, nunca '*').
//
// Los números de versión del r.js: el grabador cuenta desde 1 (REPLAY_LIB_VERSION, lib/replay-contrato.ts) y
// el puente desde 901, para que un grabador nuevo no choque nunca con él.
//
// SIN `server-only`: lo importan la pantalla (app/dashboard/MapaCalorVivo.tsx), el beacon (app/api/track/vsl) y
// los tests (tests/landing-mapa-vivo.test.ts).
// =============================================================================

import { ubicarPorAncla, ubicarPorPunto, type Dispositivo, type ToqueMapa } from './landing-mapa';
import type { TipoHueco } from './landing-mapa-foto';

/** La versión del r.js que instala el puente: `/replay/901/r.js`. Inmutable una vez publicada (scripts/replay-libs.mjs). */
export const PUENTE_MAPA_VERSION = 901;

/** Desde qué versión del Pixel la página baja un r.js (el bloque del grabador entró en la v21). */
export const PIXEL_PUENTE_DESDE = 21;

/** El marcador de prueba del mapa: `mapa-<id>`. Cabe en los 40 caracteres que guarda el beacon. */
export const PREFIJO_PRUEBA_MAPA = 'mapa-';

/** El campo `mko` de cada mensaje, en las dos direcciones. */
export const MARCA_PUENTE = 'mko-mapa';

/** La versión del protocolo de mensajes (no la del archivo). */
export const PROTOCOLO_PUENTE = 1;

/** Cuántos elementos se le piden como mucho, y cuántos marcos o videos devuelve. */
export const MAX_SELECTORES = 80;
export const MAX_HUECOS = 30;

/** Un hueco más chico que esto (un píxel de seguimiento, un marco escondido) no lleva cartel. */
export const HUECO_MINIMO = 40;

/** Más grande que esto no es una página: es un número que no salió del puente. */
const MAX_PX = 200_000;

/** El tamaño de la pantalla de cada aparato en el mapa EN VIVO: un celular común y una compu común. */
export const PANTALLAS: Readonly<Record<Dispositivo, { ancho: number; alto: number }>> = {
  movil: { ancho: 390, alto: 844 },
  escritorio: { ancho: 1440, alto: 900 },
};

const RE_PRUEBA = /^mapa-[A-Za-z0-9_-]{4,34}$/;

/** ¿Este marcador de prueba es el del mapa? (el beacon lo usa para servir el puente en vez del grabador) */
export function esPruebaDelMapa(prueba: unknown): prueba is string {
  return typeof prueba === 'string' && RE_PRUEBA.test(prueba);
}

/** Un marcador nuevo para una apertura del mapa. */
export function nuevaPruebaDelMapa(azar: () => number = Math.random): string {
  const A = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 12; i++) s += A.charAt(Math.min(A.length - 1, Math.floor(azar() * A.length)));
  return PREFIJO_PRUEBA_MAPA + s;
}

/**
 * La dirección que se mete en el marco: la página con `?mko_test=<prueba>`. `null` si no es https (una página
 * http adentro de MaKo la bloquea el navegador) o trae usuario y clave.
 */
export function urlEnVivo(url: string, prueba: string): string | null {
  if (!esPruebaDelMapa(prueba)) return null;
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== 'https:' || u.username || u.password) return null;
  u.searchParams.set('mko_test', prueba);
  u.hash = '';
  return u.toString();
}

/** El origen de una dirección (`https://negocio.com`), o null. */
export function origenDe(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const o = new URL(url).origin;
    return o && o !== 'null' ? o : null;
  } catch {
    return null;
  }
}

// ── Los mensajes ───────────────────────────────────────────────────────────────────────────

/** Una caja en px CSS de la VENTANA de la página (como `getBoundingClientRect`). */
export type RectPuente = { x: number; y: number; w: number; h: number };
export type HuecoPuente = RectPuente & { tipo: TipoHueco; src: string | null };

export type ListoPuente = { tipo: 'listo'; v: number };
export type EstadoPuente = {
  tipo: 'estado';
  v: number;
  /** El número del pedido que contesta (0 = lo mandó solo, por un scroll o un cambio de tamaño). */
  pedido: number;
  /** Ancho de la ventana, alto del documento, alto de la ventana y cuánto scrolleó. */
  ancho: number;
  alto: number;
  vh: number;
  sy: number;
  /** Alineado con los selectores del último pedido: la caja de cada uno, o null si no está en la página. */
  rects: Array<RectPuente | null>;
  huecos: HuecoPuente[];
};
export type MensajePuente = ListoPuente | EstadoPuente;

const entero = (v: unknown, min: number, max: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? Math.round(v) : null;

const rect = (v: unknown): RectPuente | null => {
  if (!Array.isArray(v) || v.length < 4) return null;
  const x = entero(v[0], -MAX_PX, MAX_PX), y = entero(v[1], -MAX_PX, MAX_PX);
  const w = entero(v[2], 0, MAX_PX), h = entero(v[3], 0, MAX_PX);
  return x == null || y == null || w == null || h == null ? null : { x, y, w, h };
};

const hueco = (v: unknown): HuecoPuente | null => {
  const r = rect(v);
  if (!r || !Array.isArray(v)) return null;
  const tipo = v[4] === 'video' ? 'video' : v[4] === 'iframe' ? 'iframe' : null;
  if (!tipo) return null;
  const src = typeof v[5] === 'string' && v[5] ? v[5].slice(0, 500) : null;
  return { ...r, tipo, src };
};

/**
 * Lee un mensaje que llegó a la pantalla del mapa. `null` = no es del puente de ESTE marco, y se ignora.
 *
 * ⚠️ El origen se compara EXACTO (AGENTS.md, «un guard de ORIGEN se escribe con origin») y la ventana por
 * IDENTIDAD: `event.source` tiene que ser el `contentWindow` del marco que embebimos. Con sólo el origen, otro
 * marco de la misma página del cliente (o otra pestaña del cliente abierta por la nuestra) podría hablar en
 * nombre del puente; con sólo la ventana, una página que navegó a otro sitio adentro del marco también.
 */
export function leerMensajeDelPuente(
  ev: { origin: string; source: unknown; data: unknown },
  esperado: { origen: string | null; ventana: unknown },
): MensajePuente | null {
  if (!esperado.origen || ev.origin !== esperado.origen) return null;
  if (esperado.ventana == null || ev.source !== esperado.ventana) return null;
  const d = ev.data;
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  const o = d as Record<string, unknown>;
  if (o.mko !== MARCA_PUENTE) return null;
  const v = entero(o.v, 1, 999);
  if (v == null) return null;
  if (o.tipo === 'listo') return { tipo: 'listo', v };
  if (o.tipo !== 'estado') return null;
  const ancho = entero(o.ancho, 1, MAX_PX), alto = entero(o.alto, 1, MAX_PX), vh = entero(o.vh, 1, MAX_PX);
  const sy = entero(o.sy, 0, MAX_PX);
  if (ancho == null || alto == null || vh == null || sy == null) return null;
  const rects = Array.isArray(o.rects) ? o.rects.slice(0, MAX_SELECTORES).map(rect) : [];
  const huecos = Array.isArray(o.huecos)
    ? o.huecos.slice(0, MAX_HUECOS).map(hueco).filter((h): h is HuecoPuente => h != null)
    : [];
  return { tipo: 'estado', v, pedido: entero(o.pedido, 0, 1e9) ?? 0, ancho, alto, vh, sy, rects, huecos };
}

/** Lo que MaKo le pide al puente: la caja de estos elementos (y el resto del estado). */
export function pedidoAlPuente(pedido: number, sels: readonly string[]) {
  return { mko: MARCA_PUENTE, v: PROTOCOLO_PUENTE, tipo: 'pedir' as const, pedido, sels: sels.slice(0, MAX_SELECTORES) };
}

/** Que la página scrollee hasta `y` (la rueda y el arrastre van por acá: el marco no recibe clics). */
export function scrollAlPuente(y: number) {
  return { mko: MARCA_PUENTE, v: PROTOCOLO_PUENTE, tipo: 'scroll' as const, y: Math.max(0, Math.round(Number.isFinite(y) ? y : 0)) };
}

/** Hasta dónde se puede scrollear. */
export function scrollMaximo(e: Pick<EstadoPuente, 'alto' | 'vh'>): number {
  return Math.max(0, e.alto - e.vh);
}

// ── Dónde va cada toque ──────────────────────────────────────────────────────────────────

/** Los elementos que se le piden al puente: los anclados, del más tocado al menos, sin repetir. */
export function selectoresDe(toques: readonly Pick<ToqueMapa, 'sel'>[]): string[] {
  const n = new Map<string, number>();
  for (const t of toques) if (t.sel) n.set(t.sel, (n.get(t.sel) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, MAX_SELECTORES).map(([s]) => s);
}

export type Punto = { x: number; y: number };
export type PuntosVivo = {
  /** En px del DOCUMENTO: se dibujan en la capa que se corre con el scroll. */
  doc: Punto[];
  /** En px de la PANTALLA: los de un elemento fijo (se mueven con la ventana, no con la página). */
  pantalla: Punto[];
  /** Los que no se pudieron ubicar (sin ancla en la página de hoy y fuera de la página por su punto). */
  fuera: number;
};

/**
 * Dónde dibujar cada toque sobre la página EN VIVO, con lo que contestó el puente.
 *
 *   · CON ancla y el elemento en la página: sobre su caja (`ubicarPorAncla`, la misma cuenta que la foto). Si el
 *     elemento es fijo, en la capa de la PANTALLA (su caja ya viene medida con el scroll de ahora); si no, en
 *     la del documento (caja + scroll).
 *   · Sin ancla, o con un ancla que la página de HOY ya no tiene: por su punto (`ubicarPorPunto`), contra el
 *     ancho de la ventana y el alto del documento que manda el puente. Un fijo sin ancla no se dibuja.
 *
 * ⚠️ Lo que se ve es la página de HOY y los toques son del período: si la página cambió, el ancla que ya no
 * está cae a su punto, que es aproximado. No se inventa una caja.
 */
export function puntosEnVivo(
  toques: readonly ToqueMapa[], sels: readonly string[], e: EstadoPuente, disp: Dispositivo,
): PuntosVivo {
  const indice = new Map(sels.map((s, i) => [s, i] as const));
  const out: PuntosVivo = { doc: [], pantalla: [], fuera: 0 };
  for (const t of toques) {
    if (t.sel && t.rx != null && t.ry != null) {
      const i = indice.get(t.sel);
      const r = i != null ? e.rects[i] ?? null : null;
      const p = r ? ubicarPorAncla(t, { left: r.x, top: r.y, width: r.w, height: r.h }) : null;
      if (p) {
        if (t.fijo === true) out.pantalla.push(p);
        else out.doc.push({ x: p.x, y: p.y + e.sy });
        continue;
      }
    }
    const q = ubicarPorPunto(t, e.ancho, e.alto, disp);
    if (q) out.doc.push(q); else out.fuera++;
  }
  return out;
}

/** Los marcos y videos de la página, en px del DOCUMENTO, sin los chiquitos (un píxel de seguimiento). */
export function huecosEnDoc(e: EstadoPuente): HuecoPuente[] {
  return e.huecos.filter((h) => h.w >= HUECO_MINIMO && h.h >= HUECO_MINIMO).map((h) => ({ ...h, y: h.y + e.sy }));
}
