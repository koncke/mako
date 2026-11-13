// =============================================================================
// La fuente de una landing publicada, servida desde SU dominio y sin frenar el primer pintado (13/11/2026)
// =============================================================================
// Medido en producción (4G lenta, CPU ×4, 375 px): la publicada pintaba recién cuando llegaba la hoja de
// Google Fonts (`<link rel="stylesheet">` bloquea el pintado), y para eso abría dos conexiones nuevas
// (fonts.googleapis.com y fonts.gstatic.com) antes de mostrar una letra. Ahora:
//   1. la hoja de Google la lee el SERVIDOR (`fuentesPropias`, con memoria) y va EN LÍNEA en el documento:
//      ningún pedido antes de pintar;
//   2. sus archivos se piden al MISMO dominio de la página (`/l/html/fuentes/<familia>/<versión>/<archivo>.woff2`,
//      la ruta app/l/html/fuentes/[...ruta]/route.ts los trae de fonts.gstatic.com y el borde los guarda un año):
//      viajan por la conexión que ya está abierta;
//   3. el archivo latino se PRECARGA (`<link rel="preload" as="font">`) y la cara va con `font-display: swap`;
//   4. mientras llega se ve una letra del sistema con las medidas de la fuente de verdad (`size-adjust` y los
//      `*-override`, metricas-fuentes.ts): «<Familia> respaldo» va justo después de la familia en la pila.
// Si Google no contesta, el documento sale como antes (los `<link>` a Google): nunca sin fuente.
//
// ⚠️ POR QUÉ BAJO /l/html: ese prefijo ya pasa por el proxy en hola-mako.site y en el dominio de un cliente
//    (`decidirLandings`, `PREFIJO_PASA`), y `html` es un slug reservado: ninguna landing puede llamarse así. El
//    segmento fijo `fuentes` le gana a `[docId]` en la ruta del HTML libre.
// ⚠️ NO ES UN PROXY ABIERTO: la ruta sólo arma `https://fonts.gstatic.com/s/<a>/<b>/<c>.woff2` con tres segmentos
//    de letras, números, `_` y `-` (`urlDeGoogle`).
// =============================================================================
import { PREFIJO_HTML_LIBRE } from './html-libre';
import { METRICAS_FUENTES } from './metricas-fuentes';

export const PREFIJO_FUENTES = `${PREFIJO_HTML_LIBRE}/fuentes`;
const GSTATIC = 'https://fonts.gstatic.com/s/';
const SEGMENTO = /^[A-Za-z0-9_-]{1,160}$/;
const ARCHIVO = /^[A-Za-z0-9_-]{1,200}\.woff2$/;

/** Los tres segmentos del pedido → la URL de Google, o null. Lo único que la ruta de las fuentes sabe pedir. */
export function urlDeGoogle(segmentos: readonly string[]): string | null {
  if (segmentos.length !== 3) return null;
  const [familia, version, archivo] = segmentos;
  if (!SEGMENTO.test(familia) || !SEGMENTO.test(version) || !ARCHIVO.test(archivo)) return null;
  return `${GSTATIC}${familia}/${version}/${archivo}`;
}

/** `https://fonts.gstatic.com/s/<a>/<b>/<c>.woff2` → `/l/html/fuentes/<a>/<b>/<c>.woff2`, o null si no tiene esa forma. */
export function rutaPropiaDe(url: string): string | null {
  if (!url.startsWith(GSTATIC)) return null;
  const segs = url.slice(GSTATIC.length).split('/');
  return urlDeGoogle(segs) ? `${PREFIJO_FUENTES}/${segs.join('/')}` : null;
}

export type CaraFuente = { familia: string; estilo: string; peso: string; rango: string; ruta: string };

const FAMILIA = /^[A-Za-z0-9 ]{1,60}$/;
const PESO = /^\d{3}(?: \d{3})?$/;
const RANGO = /^[U+0-9A-Fa-f?, -]{1,2000}$/;

/** Las caras de una hoja de Google Fonts (css2, woff2). Lo que no tiene la forma de siempre se descarta. */
export function carasDeHoja(css: string): CaraFuente[] {
  const caras: CaraFuente[] = [];
  for (const bloque of css.split('@font-face').slice(1)) {
    const cuerpo = bloque.slice(bloque.indexOf('{') + 1, bloque.indexOf('}'));
    const prop = (nombre: string): string => {
      const i = cuerpo.indexOf(`${nombre}:`);
      if (i < 0) return '';
      const fin = cuerpo.indexOf(';', i);
      return cuerpo.slice(i + nombre.length + 1, fin < 0 ? undefined : fin).trim();
    };
    const familia = prop('font-family').replace(/^['"]|['"]$/g, '');
    const estilo = prop('font-style') || 'normal';
    const peso = prop('font-weight') || '400';
    const rango = prop('unicode-range');
    const src = /url\((https:\/\/fonts\.gstatic\.com\/s\/[^)\s]+)\)\s*format\(['"]woff2['"]\)/.exec(prop('src'));
    const ruta = src ? rutaPropiaDe(src[1]) : null;
    if (!ruta || !FAMILIA.test(familia) || (estilo !== 'normal' && estilo !== 'italic') || !PESO.test(peso)) continue;
    if (rango && !RANGO.test(rango)) continue;
    caras.push({ familia, estilo, peso, rango, ruta });
  }
  return caras;
}

export type FuentesPropias = {
  /** Las caras (con su ruta propia) y la letra de respaldo de cada familia: va en un `<style>` del documento. */
  css: string;
  /** Los archivos a precargar: el latino de cada familia, sin repetir (en una fuente variable, todos los pesos son uno). */
  precargas: string[];
  /** Las familias que tienen letra de respaldo: «'<Familia>', '<Familia> respaldo', …» en las pilas. */
  familias: string[];
};

const TOPE_PRECARGAS = 2;
const LOCALES = {
  sans: "local('Arial'), local('Helvetica'), local('Roboto'), local('Roboto-Regular')",
  serif: "local('Times New Roman'), local('Times')",
} as const;

export const nombreRespaldo = (familia: string): string => `${familia} respaldo`;

/** El CSS en línea, las precargas y las familias con respaldo. null sin ninguna cara. */
export function armarFuentesPropias(caras: readonly CaraFuente[]): FuentesPropias | null {
  if (!caras.length) return null;
  const reglas: string[] = [];
  const precargas: string[] = [];
  const familias: string[] = [];
  for (const c of caras) {
    reglas.push(`@font-face{font-family:'${c.familia}';font-style:${c.estilo};font-weight:${c.peso};font-display:swap;src:url(${c.ruta}) format('woff2')${c.rango ? `;unicode-range:${c.rango}` : ''}}`);
    // El latino (el que trae U+0000-00FF): el que usa cualquier landing en castellano.
    if (c.estilo === 'normal' && c.rango.includes('U+0000-00FF') && !precargas.includes(c.ruta) && precargas.length < TOPE_PRECARGAS) precargas.push(c.ruta);
  }
  for (const familia of new Set(caras.map((c) => c.familia))) {
    const m = METRICAS_FUENTES[familia];
    if (!m) continue;
    const [respaldo, tamano, alto, bajada, interlinea] = m;
    reglas.push(`@font-face{font-family:'${nombreRespaldo(familia)}';src:${LOCALES[respaldo]};size-adjust:${tamano}%;ascent-override:${alto}%;descent-override:${bajada}%;line-gap-override:${interlinea}%}`);
    familias.push(familia);
  }
  return { css: reglas.join('\n'), precargas, familias };
}

/**
 * Pone «'<Familia> respaldo'» justo después de la familia en las pilas del documento (las arma `pilaFuente` de
 * temas.ts con comillas simples, `'<Familia>', system-ui, …`, y en el HTML guardado pueden venir como `&#39;`).
 * Sin regex sobre el documento: un reemplazo literal del texto exacto de la pila.
 */
export function conRespaldo(html: string, familias: readonly string[]): string {
  let out = html;
  for (const f of familias) {
    for (const q of ["'", '&#39;']) out = out.split(`${q}${f}${q},`).join(`${q}${f}${q}, ${q}${nombreRespaldo(f)}${q},`);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Leer la hoja de Google (servidor), con memoria
// ─────────────────────────────────────────────────────────────────────────────

/** Google arma la hoja según el navegador: con uno moderno da woff2 partido por alfabeto (`unicode-range`). */
const NAVEGADOR = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const ESPERA_MS = 1500;
const VIVE_MS = 12 * 60 * 60 * 1000;
const VIVE_FALLA_MS = 5 * 60 * 1000;
const memoria = new Map<string, { caras: CaraFuente[] | null; hasta: number }>();

export type DepFuentes = { fetch?: typeof fetch; ahora?: () => number };

async function carasDe(url: string, dep: DepFuentes): Promise<CaraFuente[] | null> {
  const ahora = (dep.ahora ?? Date.now)();
  const guardada = memoria.get(url);
  if (guardada && guardada.hasta > ahora) return guardada.caras;
  let caras: CaraFuente[] | null = null;
  try {
    const r = await (dep.fetch ?? fetch)(url, { headers: { 'User-Agent': NAVEGADOR }, signal: AbortSignal.timeout(ESPERA_MS) });
    if (r.ok) {
      const leidas = carasDeHoja(await r.text());
      caras = leidas.length ? leidas : null;
    }
  } catch {
    caras = null;
  }
  memoria.set(url, { caras, hasta: ahora + (caras ? VIVE_MS : VIVE_FALLA_MS) });
  return caras;
}

/**
 * Las fuentes propias de las hojas de Google de una página (ya filtradas por `urlsDeFuentes`). null si no hay
 * hojas o si alguna no se pudo leer: entonces el documento sale con los `<link>` a Google, como antes.
 */
export async function fuentesPropias(urls: readonly string[], dep: DepFuentes = {}): Promise<FuentesPropias | null> {
  if (!urls.length) return null;
  const todas: CaraFuente[] = [];
  for (const caras of await Promise.all(urls.map((u) => carasDe(u, dep)))) {
    if (!caras) return null;
    todas.push(...caras);
  }
  return armarFuentesPropias(todas);
}

// ─────────────────────────────────────────────────────────────────────────────
// Lo que contesta /l/html/fuentes/<familia>/<versión>/<archivo>.woff2
// ─────────────────────────────────────────────────────────────────────────────

/** Un año en el navegador y en el borde: Google versiona la ruta (`v7`), el archivo de una URL no cambia. */
export const CACHE_FUENTE = 'public, max-age=31536000, immutable';
const CACHE_FALLA = 'public, max-age=60';

/** El archivo de la fuente, traído de Google. 404 sin la forma de siempre (no es un proxy abierto); 502 si Google no da. */
export async function responderFuente(segmentos: readonly string[], dep: DepFuentes = {}): Promise<Response> {
  const url = urlDeGoogle(segmentos);
  if (!url) return new Response(null, { status: 404, headers: { 'Cache-Control': CACHE_FALLA } });
  let r: Response;
  try {
    r = await (dep.fetch ?? fetch)(url, { signal: AbortSignal.timeout(8000) });
  } catch {
    return new Response(null, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
  if (r.status === 404) return new Response(null, { status: 404, headers: { 'Cache-Control': CACHE_FALLA } });
  if (!r.ok || !r.body) return new Response(null, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  return new Response(r.body, {
    status: 200,
    headers: {
      'Content-Type': 'font/woff2',
      'Cache-Control': CACHE_FUENTE,
      'Vercel-CDN-Cache-Control': CACHE_FUENTE,
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

/** Para los tests: olvida lo leído. */
export function olvidarFuentes(): void {
  memoria.clear();
}
