// =============================================================================
// editor-landing/replicar-reglas — lo PURO de «Replicar en el editor» (tanda 2, puntos 8 y 9)
// =============================================================================
// Pedido de Martín (11/10/2026, tanda 2): «si traigo una landing de afuera […] me gustaría si es una
// landing de afuera tener la opción de replicarla con nuestro editor» y «Si se tiene que poder editar
// libremente con "HTML personalizado", esto permitirá copiar otras landing». Decisiones T5 y T6 en
// docs/diseno-editor-landing.md.
//
// Dos formas de replicar (tanda 2; desde la tanda 6, tres formatos que van por estas dos: ver
// `configDeReplica` más abajo):
//   · «Como bloques editables»: el texto de la página (el extractor del Landing Analyst) pasa por el
//     esquema en modo «Conservar» y las secciones de la IA (lib/editor-landing/ia.ts). Queda una
//     landing NUESTRA, editable bloque por bloque, con el copy tal cual.
//   · «Copia fiel (HTML)»: se baja el HTML (lib/landing-fetch.ts, con su guarda anti-SSRF) y se arma
//     una sección «HTML personalizado» por cada parte de la página, cada una con el <head> original
//     (sus estilos) y un `<base href>` a la página de origen (sus imágenes y hojas cargan de allá).
//
// Este módulo es lo que se puede testear sin red ni base: cómo se parte el HTML, qué se le saca y
// cómo queda el contenido. Lo que baja, llama a la IA y crea la landing vive en replicar.ts.
//
// ⚠️ NO es un parser de HTML completo (no hay uno en las dependencias: htmlparser2 viaja sólo como
//    dependencia de otra y no se importa). Es un recorrido de etiquetas que respeta comillas, los
//    comentarios, los elementos de texto crudo (script, style…) y los vacíos (img, br…). Si la página
//    no se deja partir, se copia ENTERA en una sola sección: nunca se inventa una estructura.
// ⚠️ Lo que se SACA de la copia, a propósito: los rastreadores del dueño original (su Píxel de Meta,
//    su Google Tag Manager, su Hotjar…: correrían en nuestra copia midiendo para otro), su política
//    de contenido en un <meta> (bloquearía lo que carga desde el `base`), su `<meta refresh>` y su
//    `<base>` (lo reemplaza el nuestro).
// =============================================================================

import { NODO, TOPES, nuevoId, tarjeta, type JsonNodo, type LandingContenido } from './doc';
import { pideContrasena } from './html-libre';
import type { ConfigLanding, ParamsGeneracion } from './api-tipos';
import type { Lectura, SeLeeEnNavegador } from './lectura-tipos';

/**
 * Los dos modos de la tanda 2. Desde la tanda 6 los elige `formato` (abajo); se siguen aceptando en el
 * pedido mientras dure un deploy (una pestaña abierta con la pantalla vieja manda `modo`).
 */
export const MODOS_REPLICAR = ['bloques', 'fiel'] as const;
export type ModoReplicar = (typeof MODOS_REPLICAR)[number];

// ─────────────────────────────────────────────────────────────────────────────
// El formato (tanda 6)
// ─────────────────────────────────────────────────────────────────────────────
// Decisión de Martín (14/10/2026, docs/relevo/landing-generator.md, «Tanda 6» punto d): «Replicar en el
// editor» pregunta 3 formatos: Presentación (diapositivas), Landing (secciones editables) y Página web
// (la copia idéntica de hoy). Ninguno pone fotos de stock al azar: las imágenes quedan como huecos para
// elegir (`fuenteImagenes: 'marcadores'`). Antes «Como bloques» buscaba en el stock lo que la IA
// describía, y una landing replicada salía con caras de banco de imágenes donde el original tenía las
// suyas. Y la otra mitad de la decisión, «se COPIA el estilo»: replicar.ts llena esos huecos con las
// imágenes de la ORIGINAL (copiadas a nuestro bucket) y la landing nace con un tema propio armado con sus
// colores y fuentes (estilo-original.ts, estilo-aplicar.ts). Esta receta no cambia: el hueco es el punto
// de partida, y el que no se puede llenar queda como hoy.

export const FORMATOS_REPLICAR = ['presentacion', 'landing', 'web'] as const;
export type FormatoReplicar = (typeof FORMATOS_REPLICAR)[number];
/** El nombre de cada formato, como lo dice la pantalla (y la API de MaKo al proponer). */
export const NOMBRE_FORMATO_REPLICAR: Record<FormatoReplicar, string> = {
  presentacion: 'Presentación',
  landing: 'Landing',
  web: 'Página web',
};

/**
 * El formato pedido. Sin `formato`, el `modo` viejo de la tanda 2 («bloques» = Landing, «fiel» = Página
 * web) mientras dure el deploy. null si no es ninguno.
 */
export function formatoReplicar(raw: unknown, modoViejo?: unknown): FormatoReplicar | null {
  if ((FORMATOS_REPLICAR as readonly unknown[]).includes(raw)) return raw as FormatoReplicar;
  if (raw !== undefined && raw !== null && raw !== '') return null;
  const modo = modoReplicar(modoViejo);
  return modo === 'fiel' ? 'web' : modo === 'bloques' ? 'landing' : null;
}

/** Cómo se arma la réplica de un formato: por qué camino, con qué parámetros de la IA y con qué configuración nace. */
export type ConfigReplica = {
  formato: FormatoReplicar;
  /** 'fiel' = el HTML de la página en secciones «HTML personalizado»; 'bloques' = su texto + las secciones de la IA. */
  via: 'fiel' | 'bloques';
  /** Los parámetros de la IA (sólo por bloques). `formato` va crudo: ia.ts lo lee del pedido (`esDiapositivas`). */
  params: Partial<ParamsGeneracion> | null;
  /** La configuración con que nace la landing nueva (formato, proporción y de dónde salió). */
  config: Partial<ConfigLanding>;
};

/**
 * La receta de cada formato, PURA (el test la fija):
 *   · Presentación: diapositivas 16:9 con el texto CONDENSADO (una idea por diapositiva: las reglas de
 *     diapositivas de ia.ts entran solas con `formato: 'presentacion'`);
 *   · Landing: las secciones editables con el texto TAL CUAL («Conservar»: el esquema no pasa por la IA);
 *   · Página web: la copia idéntica de hoy (`copiaFiel`).
 * Las dos por bloques, con marcadores en vez de fotos de stock. `basadoEnUrl` en el origen es lo que
 * muestra «Ver instrucción de origen».
 */
export function configDeReplica(formato: FormatoReplicar, url: string): ConfigReplica {
  const origen: NonNullable<ConfigLanding['origen']> = { modo: 'importar', basadoEnUrl: url };
  if (formato === 'presentacion') {
    return {
      formato,
      via: 'bloques',
      params: { modoTexto: 'condensar', fuenteImagenes: 'marcadores', formato: 'presentacion', textoPorSeccion: 'breve', cantidad: 10 },
      config: { formato: 'presentacion', proporcion: '16:9', origen },
    };
  }
  if (formato === 'landing') {
    return {
      formato,
      via: 'bloques',
      params: { modoTexto: 'conservar', fuenteImagenes: 'marcadores', formato: 'pagina' },
      config: { formato: 'pagina', origen },
    };
  }
  return { formato, via: 'fiel', params: null, config: { formato: 'pagina', origen } };
}

/**
 * Lo que manda la pantalla a POST /api/landing-generator/replicar (tanda 6). `lectura`: la página ya
 * leída en el navegador (cuando el server contestó `enNavegador`); `texto`: el texto pegado por la
 * persona. Cualquiera de los dos reemplaza la bajada, y sólo valen para Presentación y Landing (la
 * copia idéntica necesita el HTML). `modo` es el pedido viejo (tanda 2), aceptado durante el deploy.
 */
export type PedidoReplicar = { url: string; formato: FormatoReplicar; lectura?: Lectura; texto?: string } | { url: string; modo: ModoReplicar };
/** Lo que contesta: el id de la landing nueva (la pantalla la abre en el editor). */
export type RespuestaReplicar =
  | { ok: true; id: number; titulo: string; secciones: number; formato: FormatoReplicar; aviso?: string }
  | ({ ok: false; error: string } & Partial<SeLeeEnNavegador>);

/** Partes de la página como máximo (las de más se juntan). Una landing larga ronda las 12-15. */
export const MAX_SECCIONES_FIEL = 24;
/**
 * Lo que puede pesar la copia entera. Por debajo de `TOPES.bytesContenido` (1,5 MB) con margen: el
 * contenido se mide como JSON, y el HTML con comillas crece al escaparlo.
 */
export const PRESUPUESTO_FIEL = 1_100_000;

/** Una URL que se puede intentar bajar (la guarda de red de verdad la pone landing-fetch.ts). */
export function urlParaReplicar(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t || t.length > 2_000 || /\s/.test(t)) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    return (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname.includes('.') ? u.toString() : null;
  } catch {
    return null;
  }
}

export function modoReplicar(raw: unknown): ModoReplicar | null {
  return (MODOS_REPLICAR as readonly unknown[]).includes(raw) ? (raw as ModoReplicar) : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lo que se saca
// ─────────────────────────────────────────────────────────────────────────────

/** Los rastreadores conocidos: si un script los nombra, no viaja a la copia. */
const RE_RASTREADOR = /googletagmanager\.com|google-analytics\.com|gtag\s*\(|\bGTM-[A-Z0-9]{4,}|connect\.facebook\.net|fbevents|fbq\s*\(|facebook\.com\/tr|hotjar|clarity\.ms|analytics\.tiktok\.com|\bttq\.|snap\.licdn\.com|static\.ads-twitter\.com|segment\.(?:com|io)|cdn\.mxpnl\.com|mixpanel|js\.hs-scripts\.com|hs-analytics|doubleclick\.net|matomo|plausible\.io|pixel\.wp\.com|bat\.bing\.com|clarity\(/i;

export function esRastreador(bloque: string): boolean {
  return RE_RASTREADOR.test(bloque);
}

/** Saca de un pedazo de HTML los scripts y `<noscript>` de rastreadores. */
export function sinRastreadores(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, (b) => (esRastreador(b) ? '' : b))
    .replace(/<script\b[^>]*\/>/gi, (b) => (esRastreador(b) ? '' : b))
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript\s*>/gi, (b) => (esRastreador(b) ? '' : b));
}

/** El <head> sin lo que rompe o espía en la copia (ver la cabecera), y sin el charset (va el nuestro). */
export function headLimpio(head: string): string {
  return sinRastreadores(head)
    .replace(/<base\b[^>]*>/gi, '')
    .replace(/<meta\b[^>]*http-equiv\s*=\s*["']?(?:content-security-policy|refresh)["']?[^>]*>/gi, '')
    .replace(/<meta\b[^>]*\bcharset\s*=[^>]*>/gi, '')
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Las direcciones relativas, absolutas
// ─────────────────────────────────────────────────────────────────────────────
//
// ⚠️ EL `<base href>` SOLO NO ALCANZA. En el EDITOR (y en la vista del Diagnóstico) el bloque es un
//    `<iframe srcdoc>`, y un srcdoc HEREDA la política de la página que lo contiene: la de la app trae
//    `base-uri 'self'` (next.config.ts), así que el navegador IGNORA el `<base>` de la copia y todo lo
//    relativo («/_next/static/…css», «/img/foto.jpg») se pide a hola-mako.com. Medido en el navegador
//    (12/10/2026) replicando https://hola-mako.com/: en el editor, una caja en blanco de 3200 px (sin
//    una sola hoja de estilos); en la publicada, bien (/l/html trae su propia política). Por eso, al
//    copiar, cada dirección relativa se escribe ABSOLUTA contra la base; el `<base>` queda igual para
//    lo que arma el JavaScript de la página.

/** Atributos que llevan una dirección (los `srcset` aparte: son una lista). */
const ATTRS_URL = new Set(['src', 'href', 'xlink:href', 'poster', 'action', 'data-src', 'background', 'formaction']);
const ATTRS_SRCSET = new Set(['srcset', 'data-srcset', 'imagesrcset']);
/** Lo que ya es absoluto o no es una dirección: un esquema (https:, data:, mailto:, javascript:…) o un `#`. */
const RE_NO_RELATIVA = /^(?:[a-z][a-z0-9+.-]*:|#)/i;

function absoluta(u: string, base: string): string {
  const t = u.trim();
  if (!t || RE_NO_RELATIVA.test(t)) return u;
  try { return new URL(t, base).toString(); } catch { return u; }
}

/** Los `url(…)` y los `@import "…"` de una hoja de estilos escrita en la página. */
export function cssAbsoluto(css: string, base: string): string {
  return css
    .replace(/url\(\s*(['"]?)([^'")]*)\1\s*\)/gi, (m, q: string, u: string) => (RE_NO_RELATIVA.test(u.trim()) || !u.trim() ? m : `url(${q}${absoluta(u, base)}${q})`))
    .replace(/@import\s+(['"])([^'"]+)\1/gi, (_m, q: string, u: string) => `@import ${q}${absoluta(u, base)}${q}`);
}

const RE_ATRIBUTO = /(\s)([^\s"'>/=]+)(\s*=\s*)(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

function atributosAbsolutos(attrs: string, base: string): string {
  return attrs.replace(RE_ATRIBUTO, (m, esp: string, nombre: string, igual: string, dq?: string, sq?: string, nq?: string) => {
    const n = nombre.toLowerCase();
    const crudo = dq ?? sq ?? nq ?? '';
    let nuevo: string | null = null;
    if (ATTRS_URL.has(n)) nuevo = absoluta(decodificar(crudo), base);
    else if (ATTRS_SRCSET.has(n) && !/data:/i.test(crudo)) nuevo = decodificar(crudo).split(',').map((p) => p.replace(/^(\s*)(\S+)/, (_x, e: string, u: string) => e + absoluta(u, base))).join(',');
    else if (n === 'style' && /url\(|@import/i.test(crudo)) nuevo = cssAbsoluto(decodificar(crudo), base);
    if (nuevo === null || nuevo === decodificar(crudo)) return m;
    return `${esp}${nombre}${igual}"${escAttr(nuevo)}"`;
  });
}

/**
 * Cada dirección relativa del HTML, absoluta contra `base`: los atributos de las etiquetas (src, href,
 * srcset, poster, action, style) y las hojas `<style>`. El CUERPO de un `<script>` (o un `<textarea>`,
 * un `<title>`) no se toca: un "<img src=…>" adentro de una cadena de JavaScript no es una etiqueta.
 */
export function absolutizarUrls(html: string, base: string): string {
  const RE = /<(script|style|textarea|title)\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/\1\s*>|<!--[\s\S]*?-->|<([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/gi;
  return html.replace(RE, (m, crudo?: string, attrsCrudo?: string, cuerpo?: string, tag?: string, attrs?: string) => {
    if (crudo) {
      const abre = atributosAbsolutos(attrsCrudo ?? '', base);
      const dentro = crudo.toLowerCase() === 'style' ? cssAbsoluto(cuerpo ?? '', base) : cuerpo ?? '';
      return `<${crudo}${abre}>${dentro}</${crudo}>`;
    }
    if (!tag) return m; // un comentario
    return `<${tag}${atributosAbsolutos(attrs ?? '', base)}>`;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Leer el documento
// ─────────────────────────────────────────────────────────────────────────────

const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decodificar = (s: string): string => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => { const n = parseInt(h, 16); return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''; })
  .replace(/&#(\d+);/g, (_, d) => { const n = Number(d); return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''; })
  .replace(/&([a-z]+);/gi, (m, n) => ENTIDADES[n.toLowerCase()] ?? m);

const escAttr = (s: string): string => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** El valor de un atributo en una etiqueta de apertura, o null. */
function atributo(etiqueta: string, nombre: string): string | null {
  const m = new RegExp(`\\s${nombre}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(etiqueta);
  return m ? decodificar(m[1] ?? m[2] ?? m[3] ?? '') : null;
}

/** El título de la página: <title>, si no og:title. Sin etiquetas ni saltos, con tope. */
export function tituloDeDocumento(html: string, respaldo: string): string {
  const crudo = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]
    ?? atributo(/<meta[^>]+property\s*=\s*["']og:title["'][^>]*>/i.exec(html)?.[0] ?? '', 'content')
    ?? '';
  const t = decodificar(crudo.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  return (t || respaldo).slice(0, TOPES.titulo);
}

/**
 * La dirección contra la que se resuelve todo lo relativo de la copia: el `<base href>` de la página,
 * si no su `canonical` o su `og:url` (la dirección FINAL si hubo redirecciones: el extractor no la
 * devuelve), y si no la que se pidió. Sólo http(s).
 */
export function baseDeDocumento(html: string, urlPedida: string): string {
  const candidatas = [
    atributo(/<base\b[^>]*>/i.exec(html)?.[0] ?? '', 'href'),
    atributo(/<link\b[^>]*rel\s*=\s*["']?canonical["']?[^>]*>/i.exec(html)?.[0] ?? '', 'href'),
    atributo(/<meta\b[^>]*property\s*=\s*["']og:url["'][^>]*>/i.exec(html)?.[0] ?? '', 'content'),
  ];
  for (const c of candidatas) {
    if (!c) continue;
    try {
      const u = new URL(c, urlPedida);
      if (u.protocol === 'https:' || u.protocol === 'http:') return u.toString();
    } catch { /* la siguiente */ }
  }
  return urlPedida;
}

type Partes = { htmlAttrs: string; head: string; bodyAttrs: string; body: string };

/** Separa `<html …>`, el <head> y el <body> (con sus atributos). Sin <body>: todo lo que no es head. */
export function partesDeDocumento(html: string): Partes {
  const htmlTag = /<html\b([^>]*)>/i.exec(html);
  const headM = /<head\b[^>]*>([\s\S]*?)<\/head\s*>/i.exec(html);
  const bodyOpen = /<body\b([^>]*)>/i.exec(html);
  let body: string;
  if (bodyOpen) {
    const ini = bodyOpen.index + bodyOpen[0].length;
    const fin = html.toLowerCase().lastIndexOf('</body');
    body = html.slice(ini, fin > ini ? fin : undefined);
  } else {
    body = html
      .replace(/<!doctype[^>]*>/i, '')
      .replace(/<head\b[^>]*>[\s\S]*?<\/head\s*>/i, '')
      .replace(/<\/?html\b[^>]*>/gi, '');
  }
  return { htmlAttrs: htmlTag?.[1] ?? '', head: headM?.[1] ?? '', bodyAttrs: bodyOpen?.[1] ?? '', body };
}

// ─────────────────────────────────────────────────────────────────────────────
// Recorrer las etiquetas de un nivel
// ─────────────────────────────────────────────────────────────────────────────

const VACIOS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const CRUDOS = new Set(['script', 'style', 'textarea', 'title', 'noscript', 'template', 'xmp', 'iframe']);
/** Lo que en la copia es de TODAS las partes (estilos y scripts sueltos entre las secciones). */
const COMUNES = new Set(['script', 'style', 'link', 'noscript', 'template', 'meta']);

export type NodoNivel =
  | { tipo: 'el'; tag: string; inicio: number; aperturaFin: number; cierreInicio: number; fin: number }
  | { tipo: 'texto' | 'comentario'; inicio: number; fin: number };

/** El índice DESPUÉS del `>` que cierra la etiqueta que empieza en `lt` (respeta comillas). -1 si no cierra. */
function finDeEtiqueta(s: string, lt: number): number {
  let comilla: string | null = null;
  for (let i = lt + 1; i < s.length; i++) {
    const c = s[i];
    if (comilla) { if (c === comilla) comilla = null; continue; }
    if (c === '"' || c === "'") comilla = c;
    else if (c === '>') return i + 1;
  }
  return -1;
}

/** Dónde cierra el elemento crudo `tag` que abre en `desde`: [inicio del cierre, fin]. */
function cierreCrudo(s: string, desde: number, tag: string): [number, number] {
  const re = new RegExp(`</${tag}\\s*>`, 'ig');
  re.lastIndex = desde;
  const m = re.exec(s);
  return m ? [m.index, m.index + m[0].length] : [s.length, s.length];
}

/**
 * Dónde cierra el elemento `tag` cuya apertura termina en `desde`. Lleva una pila de lo que abre
 * adentro; un cierre saca de la pila hasta su pareja (así un `<p>` o un `<li>` sin cerrar no la
 * desarma). Sin cierre: hasta el final.
 */
function cierreDe(s: string, desde: number, tag: string): [number, number] {
  const pila: string[] = [tag];
  let i = desde;
  while (i < s.length) {
    const lt = s.indexOf('<', i);
    if (lt < 0) break;
    if (s.startsWith('<!--', lt)) { const e = s.indexOf('-->', lt + 4); i = e < 0 ? s.length : e + 3; continue; }
    if (s[lt + 1] === '/') {
      const m = /^<\/([a-zA-Z][\w:-]*)\s*>/.exec(s.slice(lt, lt + 80));
      const e = finDeEtiqueta(s, lt);
      if (!m) { i = e < 0 ? s.length : e; continue; }
      const t = m[1].toLowerCase();
      const k = pila.lastIndexOf(t);
      if (k >= 0) {
        pila.length = k;
        if (k === 0) return [lt, lt + m[0].length];
      }
      i = lt + m[0].length;
      continue;
    }
    const m = /^<([a-zA-Z][\w:-]*)/.exec(s.slice(lt, lt + 80));
    if (!m) { i = lt + 1; continue; }
    const t = m[1].toLowerCase();
    const e = finDeEtiqueta(s, lt);
    if (e < 0) break;
    if (CRUDOS.has(t)) { i = cierreCrudo(s, e, t)[1]; continue; }
    if (!VACIOS.has(t) && s[e - 2] !== '/') pila.push(t);
    i = e;
  }
  return [s.length, s.length];
}

/** Los nodos de PRIMER nivel de un pedazo de HTML (elementos, texto y comentarios), en orden. */
export function nodosDeNivel(s: string): NodoNivel[] {
  const out: NodoNivel[] = [];
  let i = 0;
  const texto = (a: number, b: number) => { if (b > a) out.push({ tipo: 'texto', inicio: a, fin: b }); };
  while (i < s.length) {
    const lt = s.indexOf('<', i);
    if (lt < 0) { texto(i, s.length); break; }
    if (s.startsWith('<!--', lt)) {
      texto(i, lt);
      const e = s.indexOf('-->', lt + 4);
      const fin = e < 0 ? s.length : e + 3;
      out.push({ tipo: 'comentario', inicio: lt, fin });
      i = fin;
      continue;
    }
    const m = /^<([a-zA-Z][\w:-]*)/.exec(s.slice(lt, lt + 80));
    if (!m) {
      // `</algo>` suelto, `<!doctype>`, `<?xml?>`: se saltea entero. Un `<` suelto es texto.
      if (s[lt + 1] === '/' || s[lt + 1] === '!' || s[lt + 1] === '?') { texto(i, lt); const e = finDeEtiqueta(s, lt); i = e < 0 ? s.length : e; continue; }
      i = lt + 1;
      continue;
    }
    texto(i, lt);
    const tag = m[1].toLowerCase();
    const aperturaFin = finDeEtiqueta(s, lt);
    if (aperturaFin < 0) { out.push({ tipo: 'texto', inicio: lt, fin: s.length }); break; }
    let cierreInicio: number, fin: number;
    if (VACIOS.has(tag) || s[aperturaFin - 2] === '/') [cierreInicio, fin] = [aperturaFin, aperturaFin];
    else if (CRUDOS.has(tag)) [cierreInicio, fin] = cierreCrudo(s, aperturaFin, tag);
    else [cierreInicio, fin] = cierreDe(s, aperturaFin, tag);
    out.push({ tipo: 'el', tag, inicio: lt, aperturaFin, cierreInicio, fin });
    i = fin;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Partir el cuerpo en secciones
// ─────────────────────────────────────────────────────────────────────────────

export type CuerpoPartido = {
  /** Las aperturas de los envoltorios que se atravesaron (`<div class="wrapper">`…), en orden. */
  abre: string[];
  /** Sus cierres, del más adentro al más afuera. */
  cierra: string[];
  /** Cada parte de la página, ya agrupada (lo chico va con lo que sigue). */
  partes: string[];
  /** Estilos y scripts sueltos entre las partes: van en TODAS (cada parte es un documento aparte). */
  comunes: string[];
};

const textoVisible = (html: string): string =>
  decodificar(html.replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const RE_MEDIO = /<(img|picture|video|iframe|svg|canvas|form|input|button|select|textarea)\b/i;
/** Una parte que sola no se ve (un espaciador, un ancla vacía): viaja pegada a la que sigue. */
const esChica = (html: string): boolean => textoVisible(html).length < 15 && !RE_MEDIO.test(html);

/**
 * Baja por los envoltorios de UN solo hijo (`body > div#app > main`) hasta el primer nivel con varias
 * partes, y las devuelve agrupadas. Los envoltorios se conservan (abre/cierra) para que los selectores
 * de la hoja original (`.wrapper > section`) sigan valiendo dentro de cada parte.
 */
export function partirCuerpo(body: string): CuerpoPartido {
  const abre: string[] = [];
  const cierra: string[] = [];
  const comunes: string[] = [];
  let actual = body;
  for (let prof = 0; prof < 8; prof++) {
    const nodos = nodosDeNivel(actual);
    const elementos = nodos.filter((n): n is Extract<NodoNivel, { tipo: 'el' }> => n.tipo === 'el' && !COMUNES.has(n.tag));
    const hayTexto = nodos.some((n) => n.tipo === 'texto' && actual.slice(n.inicio, n.fin).trim() !== '');
    for (const n of nodos) if (n.tipo === 'el' && COMUNES.has(n.tag)) comunes.push(actual.slice(n.inicio, n.fin));
    if (elementos.length === 1 && !hayTexto) {
      const el = elementos[0];
      abre.push(actual.slice(el.inicio, el.aperturaFin));
      cierra.unshift(el.cierreInicio < el.fin ? actual.slice(el.cierreInicio, el.fin) : `</${el.tag}>`);
      actual = actual.slice(el.aperturaFin, el.cierreInicio);
      continue;
    }
    // El nivel con varias partes: cada elemento (o texto suelto) es una; lo chico va con lo que sigue.
    const crudas: string[] = [];
    for (const n of nodos) {
      if (n.tipo === 'comentario') continue;
      if (n.tipo === 'el' && COMUNES.has(n.tag)) continue;
      const h = actual.slice(n.inicio, n.fin);
      if (n.tipo === 'texto' && !h.trim()) continue;
      crudas.push(h);
    }
    const partes: string[] = [];
    let pendiente = '';
    for (const c of crudas) {
      pendiente += c;
      if (!esChica(pendiente)) { partes.push(pendiente); pendiente = ''; }
    }
    if (pendiente) {
      if (partes.length) partes[partes.length - 1] += pendiente;
      else partes.push(pendiente);
    }
    // Demasiadas partes: se juntan de a varias, en orden, hasta entrar en el tope.
    if (partes.length > MAX_SECCIONES_FIEL) {
      const porGrupo = Math.ceil(partes.length / MAX_SECCIONES_FIEL);
      const juntas: string[] = [];
      for (let k = 0; k < partes.length; k += porGrupo) juntas.push(partes.slice(k, k + porGrupo).join(''));
      return { abre, cierra, partes: juntas, comunes };
    }
    return { abre, cierra, partes, comunes };
  }
  return { abre, cierra, partes: actual.trim() ? [actual] : [], comunes };
}

// ─────────────────────────────────────────────────────────────────────────────
// La copia fiel
// ─────────────────────────────────────────────────────────────────────────────

export type CopiaFiel = { ok: true; titulo: string; documentos: string[]; partida: boolean } | { ok: false; error: string };

/** Un documento de la copia: el <head> original (limpio), el `base`, y una parte del cuerpo. */
function documento(p: Partes, head: string, base: string, cuerpo: string): string {
  return [
    '<!doctype html>',
    `<html${p.htmlAttrs}>`,
    '<head>',
    '<meta charset="utf-8">',
    `<base href="${escAttr(base)}">`,
    head,
    '</head>',
    `<body${p.bodyAttrs}>`,
    cuerpo,
    '</body>',
    '</html>',
  ].join('\n');
}

/**
 * La página de afuera → los documentos de las secciones «HTML personalizado». Partida en secciones si
 * se puede y entra (cada una ≤ `TOPES.htmlLibre`, todas ≤ `PRESUPUESTO_FIEL`); si no, ENTERA en una
 * sola; y si ni así entra, un error que lo dice (el formato «Landing», el texto en secciones, sigue disponible).
 */
export function copiaFiel(html: string, urlPedida: string): CopiaFiel {
  if (typeof html !== 'string' || !html.trim()) return { ok: false, error: 'La página vino vacía.' };
  // Un login copiado tal cual, servido en hola-mako.com, es phishing con nuestra barra de direcciones
  // (revisión de la tanda 2): esa página no se copia fiel. El formato «Landing» reescribe el contenido
  // (en la tanda 2 se llamaba «Como bloques»).
  if (pideContrasena(html)) return { ok: false, error: 'Esa página pide una contraseña y MaKo no la copia tal cual. Prueba el formato «Landing».' };
  const host = (() => { try { return new URL(urlPedida).hostname.replace(/^www\./, ''); } catch { return 'Landing'; } })();
  const titulo = tituloDeDocumento(html, host);
  const base = baseDeDocumento(html, urlPedida);
  const p = partesDeDocumento(html);
  // Absolutas ANTES de partir y de medir: los topes miden lo que se guarda (ver «Las direcciones
  // relativas, absolutas», arriba).
  const head = absolutizarUrls(headLimpio(p.head), base);
  const cuerpo = absolutizarUrls(sinRastreadores(p.body), base);

  const partido = partirCuerpo(cuerpo);
  const cola = partido.comunes.join('\n');
  if (partido.partes.length >= 2) {
    const docs = partido.partes.map((parte) => documento(p, head, base, `${partido.abre.join('')}${parte}${partido.cierra.join('')}${cola ? `\n${cola}` : ''}`));
    const total = docs.reduce((n, d) => n + d.length, 0);
    if (docs.every((d) => d.length <= TOPES.htmlLibre) && total <= PRESUPUESTO_FIEL) return { ok: true, titulo, documentos: docs, partida: true };
  }
  const entero = documento(p, head, base, cuerpo.trim());
  if (!textoVisible(cuerpo) && !RE_MEDIO.test(cuerpo)) return { ok: false, error: 'La página no trae nada para copiar.' };
  if (entero.length > TOPES.htmlLibre) return { ok: false, error: 'La página pesa demasiado para copiarla tal cual. Prueba el formato «Landing».' };
  return { ok: true, titulo, documentos: [entero], partida: false };
}

/** Los documentos de la copia → el contenido de la landing nueva: una sección de ancho completo por parte. */
export function contenidoDeCopiaFiel(documentos: readonly string[], partida: boolean): LandingContenido {
  const tarjetas: JsonNodo[] = documentos.map((html) => tarjeta(
    [{ type: NODO.htmlLibre, attrs: { id: nuevoId('h'), html, alto: partida ? 400 : 800 } }],
    { ancho: 'completo', alineacion: 'arriba' },
  ));
  return { v: 1, paginas: [{ id: nuevoId('p'), titulo: 'Inicio', ruta: '', doc: { type: 'doc', content: tarjetas } }] };
}
