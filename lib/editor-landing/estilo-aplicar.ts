// =============================================================================
// editor-landing/estilo-aplicar — dónde va cada imagen y cada fondo del ORIGINAL en la réplica (tanda 6, d)
// =============================================================================
// Decisión de Martín (14/10/2026, docs/relevo/landing-generator.md, «Tanda 6» punto d): al replicar como
// landing «se COPIA el estilo (colores y fuentes leídos en el navegador → tema propio; imágenes al
// bucket), nada de fotos de stock». El tema sale de estilo-original.ts; esto es lo otro: las imágenes de
// la página (ya copiadas a NUESTRO bucket por estilo-server.ts) van a las secciones que las tenían, y una
// sección que en el original tenía otro fondo (un hero oscuro, una franja de color) lo conserva.
//
// Cómo se sabe qué sección de la réplica es cuál del original: por el TÍTULO. La réplica como Landing
// («Conservar») corta una sección por título de la página, palabra por palabra; la Presentación los
// reescribe, y ahí se reconoce por las palabras en común. Lo que no se reconoce queda como hoy: con su
// marcador (el hueco para elegir) y el fondo del tema. Nunca una imagen en una sección que no era la suya.
//
// PURO (sin server-only): lo usan replicar.ts y el test. Aparte de estilo-original.ts a propósito: ése lo
// importa el lector del navegador, y esto arrastra la gramática de la IA (ia-bloques.ts).
// =============================================================================

import { NODO, type JsonNodo, type VarianteOptimizado } from './doc';
import { VARIANTES_CON_IMAGEN } from './ia-bloques';
import { distintos, type EstiloOriginal } from './estilo-original';

// ─────────────────────────────────────────────────────────────────────────────
// Qué sección de la réplica es cuál del original
// ─────────────────────────────────────────────────────────────────────────────

export function normalizarTitulo(s: string): string {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/** Qué tanto se parecen dos títulos: 1 iguales, 0.9 uno contiene al otro, si no las palabras en común. */
export function parecido(a: string, b: string): number {
  const x = normalizarTitulo(a);
  const y = normalizarTitulo(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const [corto, largo] = x.length <= y.length ? [x, y] : [y, x];
  if (corto.length >= 8 && largo.includes(corto)) return 0.9;
  const px = new Set(x.split(' ').filter((w) => w.length >= 3));
  const py = new Set(y.split(' ').filter((w) => w.length >= 3));
  if (!px.size || !py.size) return 0;
  let comun = 0;
  for (const w of px) if (py.has(w)) comun++;
  return comun / (px.size + py.size - comun);
}

/** Desde cuánto parecido un título de la réplica es el del original. */
export const UMBRAL_PARECIDO = 0.5;
/** Cuántos títulos del original se miran hacia adelante (una réplica no saltea más que eso). */
const VENTANA = 15;

/**
 * Para cada sección de la réplica, el índice de la sección ORIGINAL que le corresponde, o null. En orden:
 * una sección nunca se asigna a un título anterior al de la sección de antes. Dos pasadas:
 *   1. por el título (`parecido` ≥ `UMBRAL_PARECIDO`);
 *   2. las que quedaron sin asignar ENTRE dos asignadas, si entre las dos hay exactamente tantos títulos
 *      del original como secciones sin asignar (la sección «Sección» sin título del medio es la del medio).
 */
export function asignarSecciones(secciones: readonly { titulo: string }[], originales: readonly { titulo: string }[]): (number | null)[] {
  const out: (number | null)[] = [];
  let desde = 0;
  for (const s of secciones) {
    let mejor = -1;
    let valor = 0;
    // Hasta la primera asignada se mira TODO el original (lo de antes puede ser un encabezado largo).
    const hasta = out.some((x) => x !== null) ? desde + VENTANA : originales.length;
    for (let j = desde; j < originales.length && j < hasta; j++) {
      const p = parecido(s.titulo, originales[j].titulo);
      if (p > valor) { valor = p; mejor = j; if (p === 1) break; }
    }
    if (mejor >= 0 && valor >= UMBRAL_PARECIDO) { out.push(mejor); desde = mejor + 1; }
    else out.push(null);
  }
  let antes = -1;
  for (let i = 0; i <= out.length; i++) {
    if (i < out.length && out[i] === null) continue;
    const huecos = i - antes - 1;
    if (huecos > 0 && antes >= 0 && i < out.length) {
      const a = out[antes]!;
      const b = out[i]!;
      if (b - a - 1 === huecos) for (let k = 1; k <= huecos; k++) out[antes + k] = a + k;
    }
    antes = i;
  }
  return out;
}

/**
 * Los títulos del original que «son» de cada sección de la réplica: desde el suyo hasta el de la próxima
 * sección asignada (una diapositiva que condensa tres partes del original se queda con las imágenes de
 * las tres). [] para una sección sin asignar.
 */
export function partesDeCadaSeccion(asig: readonly (number | null)[], totalOriginales: number): number[][] {
  return asig.map((j, i) => {
    if (j === null) return [];
    let hasta = totalOriginales;
    for (let k = i + 1; k < asig.length; k++) if (asig[k] !== null) { hasta = asig[k]!; break; }
    const out: number[] = [];
    for (let x = j; x < Math.max(j + 1, hasta); x++) out.push(x);
    return out;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Las imágenes que hay que subir
// ─────────────────────────────────────────────────────────────────────────────

/** Cuántas imágenes del original se copian por réplica, y cuántas por sección. */
export const TOPES_IMAGENES_REPLICA = { total: 12, porSeccion: 4 } as const;

/** Las imágenes de cada sección de la réplica, en el orden del original (las de <img> antes que las de fondo). */
export function imagenesDeCadaSeccion(asig: readonly (number | null)[], estilo: EstiloOriginal): string[][] {
  const partes = partesDeCadaSeccion(asig, estilo.secciones.length);
  const usadas = new Set<string>();
  return partes.map((ps) => {
    const de = estilo.imagenes.filter((x) => ps.includes(x.seccion) && !usadas.has(x.url));
    de.sort((a, b) => ps.indexOf(a.seccion) - ps.indexOf(b.seccion));
    const lista = de.slice(0, TOPES_IMAGENES_REPLICA.porSeccion).map((x) => x.url);
    for (const u of lista) usadas.add(u);
    return lista;
  });
}

/**
 * Qué subir, en dos tandas: `primeras` (la primera imagen de cada sección: se suben mientras la IA arma
 * las secciones) y `resto` (las demás, sólo si al final hay huecos donde ponerlas). Hasta el tope total.
 */
export function imagenesParaSubir(asig: readonly (number | null)[], estilo: EstiloOriginal): { primeras: string[]; resto: string[] } {
  const porSeccion = imagenesDeCadaSeccion(asig, estilo);
  const primeras = porSeccion.map((l) => l[0]).filter((u): u is string => !!u).slice(0, TOPES_IMAGENES_REPLICA.total);
  const resto = porSeccion.flatMap((l) => l.slice(1)).slice(0, Math.max(0, TOPES_IMAGENES_REPLICA.total - primeras.length));
  return { primeras, resto };
}

// ─────────────────────────────────────────────────────────────────────────────
// Ponerlas en las secciones
// ─────────────────────────────────────────────────────────────────────────────

const esHueco = (a: Record<string, unknown> | undefined) => !a?.imagenSrc;

/** Los ítems de un «diseño optimizado» con imagen por ítem que quedaron sin imagen (el marcador). */
function itemsSinImagen(n: JsonNodo, out: JsonNodo[] = []): JsonNodo[] {
  if (n.type === NODO.optimizado && VARIANTES_CON_IMAGEN.has(n.attrs?.variante as VarianteOptimizado)) {
    for (const it of n.content ?? []) if (it.type === NODO.optimizadoItem && esHueco(it.attrs)) out.push(it);
    return out;
  }
  for (const c of n.content ?? []) itemsSinImagen(c, out);
  return out;
}

/** Cuántos huecos de imagen tiene una sección (el de su imagen de acento y los de sus ítems). */
export function huecosDe(t: JsonNodo): number {
  const a = t.attrs ?? {};
  return (a.diseno !== 'sin' && esHueco(a) ? 1 : 0) + itemsSinImagen(t).length;
}

/**
 * Las URLs que faltan subir para llenar los huecos que quedaron (las de `resto` que tienen dónde ir), con
 * las que ya se subieron descontadas.
 */
export function imagenesQueFaltan(tarjetas: readonly JsonNodo[], asig: readonly (number | null)[], estilo: EstiloOriginal, subidas: ReadonlyMap<string, string>): string[] {
  const porSeccion = imagenesDeCadaSeccion(asig, estilo);
  const out: string[] = [];
  tarjetas.forEach((t, i) => {
    const lista = porSeccion[i] ?? [];
    const puestas = lista.filter((u) => subidas.has(u)).length;
    const faltan = Math.max(0, Math.max(1, huecosDe(t)) - puestas);
    out.push(...lista.filter((u) => !subidas.has(u)).slice(0, faltan));
  });
  return out.slice(0, TOPES_IMAGENES_REPLICA.total);
}

export type ResultadoAplicar = { tarjetas: JsonNodo[]; imagenes: number; fondos: number };

/**
 * Las secciones de la réplica con lo del original:
 *   · el FONDO: si la sección del original tenía un fondo distinto del de la página (`fondoTema`, el que
 *     quedó en el tema propio), la sección lo lleva (`fondo: 'color'`; el texto se recalcula legible solo,
 *     `varsDeFondoPropio`); si era el de la página, el del tema. Sin tema copiado (`fondoTema` null) no
 *     se toca: el fondo de la IA va con el tema de fábrica;
 *   · las IMÁGENES (sólo las que ya están en NUESTRO bucket, `subidas`: original → copia): primero el hueco
 *     de la imagen de acento, después los ítems con imagen; si la sección no tenía ningún hueco y era
 *     «sin imagen», se le pone a la derecha (o de fondo, con la superposición oscura, si en el original era
 *     la imagen de fondo de esa parte). Una imagen que no se pudo copiar deja el marcador de hoy.
 * No muta la entrada.
 */
export function aplicarEstilo(
  tarjetas: readonly JsonNodo[],
  asig: readonly (number | null)[],
  estilo: EstiloOriginal,
  subidas: ReadonlyMap<string, string>,
  op: { fondoTema: string | null },
): ResultadoAplicar {
  const copia = JSON.parse(JSON.stringify(tarjetas)) as JsonNodo[];
  const porSeccion = imagenesDeCadaSeccion(asig, estilo);
  const esFondo = new Map(estilo.imagenes.map((x) => [x.url, x.fondo]));
  let imagenes = 0;
  let fondos = 0;
  copia.forEach((t, i) => {
    const j = asig[i];
    if (j === null || j === undefined || t.type !== NODO.tarjeta) return;
    const a = (t.attrs ??= {});
    const f = estilo.secciones[j]?.fondo ?? null;
    if (f && op.fondoTema) {
      if (distintos(f, op.fondoTema)) { a.fondo = 'color'; a.fondoColor = f; a.fondoDegradado = null; fondos++; }
      else { a.fondo = 'tema'; a.fondoColor = null; a.fondoDegradado = null; }
    }
    const lista = (porSeccion[i] ?? []).filter((u) => subidas.has(u));
    if (!lista.length) return;
    const tomar = (prefiereFondo: boolean): string | null => {
      const k = lista.findIndex((u) => esFondo.get(u) === prefiereFondo);
      const [u] = lista.splice(k >= 0 ? k : 0, 1);
      return u ? subidas.get(u) ?? null : null;
    };
    let puestas = 0;
    if (a.diseno !== 'sin' && esHueco(a)) {
      const u = tomar(a.diseno === 'fondo');
      if (u) { a.imagenSrc = u; puestas++; }
    }
    for (const it of itemsSinImagen(t)) {
      if (!lista.length) break;
      const u = tomar(false);
      if (u) { it.attrs = { ...(it.attrs ?? {}), imagenSrc: u }; puestas++; }
    }
    if (!puestas && a.diseno === 'sin' && lista.length) {
      const deFondo = esFondo.get(lista[0]) === true;
      const u = tomar(deFondo);
      if (u) {
        a.diseno = deFondo ? 'fondo' : 'derecha';
        if (deFondo) a.superposicion = 'oscura';
        a.imagenSrc = u;
        puestas++;
      }
    }
    imagenes += puestas;
  });
  return { tarjetas: copia, imagenes, fondos };
}
