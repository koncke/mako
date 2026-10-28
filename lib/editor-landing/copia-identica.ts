// =============================================================================
// editor-landing/copia-identica — la foto de la página (copia-identica-script.ts) → una landing que se EDITA (28/10/2026)
// =============================================================================
// Pedido de Martín (28/10/2026): «Enfocate primero en replicar tal cual, tanto en diseño como copy y luego vemos de
// personalizarlo». La copia idéntica es el DOM que armó la página, sin su JavaScript, con SUS hojas (y sus media
// queries), partida en secciones «Diseño editable» (html-editable.ts): el texto, las imágenes y los enlaces se tocan a
// la vista, como en la landing de MaKo. No es el iframe cerrado de la «Página web» de antes (replicarFiel).
//
// Lo que hace con la foto, en orden:
//   1. LA HOJA: las hojas de la página en su orden (las que el navegador no dejó leer las baja el server con su baranda,
//      `bajarHoja`), con sus direcciones absolutas y sus media queries; los `@import` adentro; y PODADA como hace
//      SingleFile (y PurgeCSS): se va la regla cuyo selector pide una clase, un id o una etiqueta que la página no tiene.
//      Un selector que no se entiende se queda (podar de más rompe; de menos, sólo pesa).
//   2. EL <html> Y EL <body> NO VIAJAN: la copia vive adentro de la página de MaKo (`.gm-libre`). Sus clases van en una
//      caja que envuelve cada sección (una regla `.body { fondo }` de Webflow la sigue pintando), y en la hoja, una regla
//      que pedía `html.w-mod-js` o `body.home` pide sólo `html` / `body` (eran SUS clases: se cumplían), y `body > x`
//      pasa a `body x` (entre el body y la página hay cajas de MaKo).
//   3. LAS SECCIONES: los hijos del primer nivel con varias partes; lo que pasa de `PARTIR_DESDE` se abre en sus hijos
//      (la caja pasa a ser un ENVOLTORIO) y lo chico seguido se junta (`juntarVecinas`). Cada sección lleva sus
//      envoltorios: la página publicada los abre UNA vez alrededor de las que los comparten (render.ts) y el editor los
//      pone alrededor de la sección en su iframe (html-editable.ts, `documentoEditable`), así el `gap` del <main> y el
//      `main > section` del original siguen valiendo.
//
// Lo que NO se copia igual, y por qué (sin inventar reemplazos): el JavaScript (un carrusel queda en su primera diapositiva,
// un video de fondo hecho con un <canvas> queda en su cuadro de ese momento), un formulario (se ve, pero no envía: copiado
// tal cual en nuestro dominio sería phishing), un iframe que no es de un proveedor de lib/embeds.ts. Las imágenes y las
// fuentes quedan en SU sitio (por su URL): la política de la publicada deja pasar sus orígenes (`origenesDeMedios`).
//
// ⚠️ PURO (sin red ni base): lo que baja hojas lo pasa quien llama (`bajar`). El saneo del HTML (server-only) también.
// =============================================================================

import { NODO, TOPES, nuevoId, tarjeta, type JsonNodo, type LandingContenido } from './doc';
import { TOPES_ENVOLTORIOS } from './html-editable';
import { cssAbsoluto, esChica, nodosDeNivel, type NodoNivel } from './replicar-reglas';
import type { InstantaneaCruda } from './copia-identica-script';

export type Instantanea = InstantaneaCruda;

/** Topes de lo que llega del navegador (una página de afuera: no se le cree el tamaño). */
export const TOPES_COPIA = {
  /** El <body> ya armado. Una landing de Framer con sus SVG ronda 1-2 MB. */
  cuerpo: 6_000_000,
  // Builder.io mete un <style> por bloque: respond.io tiene 208 hojas, y con 120 los bloques de más abajo llegaban sin su
  // CSS sin que nada lo dijera (28/10/2026). El tamaño lo cuida `hojasTotal`.
  hojas: 1_000,
  /** Cada hoja (la de Webflow o Tailwind entera ronda 200-400 KB) y todas juntas antes de podar. */
  hoja: 3_000_000,
  hojasTotal: 8_000_000,
} as const;

const texto = (v: unknown, tope: number): string => (typeof v === 'string' ? v.slice(0, tope) : '');
const esObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** La foto como llega del navegador, con forma y topes. null si no sirve (sin cuerpo). */
export function sanearInstantanea(raw: unknown): Instantanea | null {
  if (!esObj(raw)) return null;
  const cuerpo = texto(raw.cuerpo, TOPES_COPIA.cuerpo + 1);
  if (!cuerpo.trim() || cuerpo.length > TOPES_COPIA.cuerpo) return null;
  const h = esObj(raw.html) ? raw.html : {};
  const b = esObj(raw.body) ? raw.body : {};
  const m = esObj(raw.medidas) ? raw.medidas : {};
  let total = 0;
  const hojas: Instantanea['hojas'] = [];
  for (const x of Array.isArray(raw.hojas) ? raw.hojas.slice(0, TOPES_COPIA.hojas) : []) {
    if (!esObj(x)) continue;
    const css = typeof x.css === 'string' && x.css.length <= TOPES_COPIA.hoja ? x.css : undefined;
    const href = typeof x.href === 'string' && /^https?:\/\//i.test(x.href) ? x.href.slice(0, 2_000) : undefined;
    if (!css && !href) continue;
    total += css?.length ?? 0;
    if (total > TOPES_COPIA.hojasTotal) break;
    hojas.push({ ...(css ? { css } : {}), ...(href ? { href } : {}), ...(typeof x.base === 'string' ? { base: x.base.slice(0, 2_000) } : {}), ...(typeof x.media === 'string' && x.media ? { media: x.media.slice(0, 500) } : {}) });
  }
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0);
  return {
    url: texto(raw.url, 2_000), base: texto(raw.base, 2_000), titulo: texto(raw.titulo, 300),
    html: { clase: texto(h.clase, 2_000), estilo: texto(h.estilo, 20_000), lang: texto(h.lang, 20) },
    body: { clase: texto(b.clase, 2_000), estilo: texto(b.estilo, 20_000), fondo: texto(b.fondo, 2_000) },
    cuerpo, hojas, ancho: n(raw.ancho),
    medidas: { imagenes: n(m.imagenes), lienzos: n(m.lienzos), usos: n(m.usos), campos: n(m.campos), marcos: n(m.marcos) },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// La hoja: un lector de CSS chico (bloques, comentarios y strings) y la poda
// ─────────────────────────────────────────────────────────────────────────────

/** Una pieza de una hoja: una regla de estilo, una at-rule con bloque, o una sentencia (`@import …;`). */
type Pieza =
  | { tipo: 'regla'; selector: string; cuerpo: string }
  | { tipo: 'at'; nombre: string; preludio: string; cuerpo: string }
  | { tipo: 'sentencia'; texto: string };

/** Lo que hay en una hoja, en su orden. Tolera CSS roto: lo que no cierra se descarta. */
export function piezasDeCss(css: string): Pieza[] {
  const s = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: Pieza[] = [];
  let i = 0;
  const n = s.length;
  while (i < n) {
    while (i < n && /\s|;/.test(s[i])) i++;
    if (i >= n) break;
    // El preludio: hasta la `{` o el `;` del primer nivel (fuera de strings y paréntesis).
    const ini = i;
    let par = 0;
    let q = '';
    while (i < n) {
      const c = s[i];
      if (q) { if (c === '\\') i++; else if (c === q) q = ''; i++; continue; }
      // Una barra afuera de un string escapa lo que sigue: el `\'` de un selector de Tailwind no abre un string
      // (medido el 28/10/2026: con eso se perdían dos tercios de la hoja de respond.io).
      if (c === '\\') { i += 2; continue; }
      if (c === '"' || c === "'") { q = c; i++; continue; }
      if (c === '(') par++;
      else if (c === ')') par = Math.max(0, par - 1);
      else if (par === 0 && (c === '{' || c === ';' || c === '}')) break;
      i++;
    }
    const preludio = s.slice(ini, i).trim();
    if (i >= n) break;
    if (s[i] === ';' || s[i] === '}') {
      if (preludio.startsWith('@')) out.push({ tipo: 'sentencia', texto: preludio });
      i++;
      continue;
    }
    // El bloque: hasta su `}` (con bloques adentro).
    let prof = 0;
    const abre = i;
    q = '';
    for (; i < n; i++) {
      const c = s[i];
      if (q) { if (c === '\\') i++; else if (c === q) q = ''; continue; }
      if (c === '\\') { i++; continue; }
      if (c === '"' || c === "'") { q = c; continue; }
      if (c === '{') prof++;
      else if (c === '}') { prof--; if (prof === 0) break; }
    }
    if (prof !== 0) break;
    const cuerpo = s.slice(abre + 1, i);
    i++;
    if (preludio.startsWith('@')) {
      const m = /^@([\w-]+)\s*([\s\S]*)$/.exec(preludio);
      if (m) out.push({ tipo: 'at', nombre: m[1].toLowerCase(), preludio: m[2].trim(), cuerpo });
    } else if (preludio) out.push({ tipo: 'regla', selector: preludio, cuerpo });
  }
  return out;
}

/** Las partes de una lista separada por comas del primer nivel (`a, b:is(c, d)` → 2). */
export function separarPorComas(s: string): string[] {
  const out: string[] = [];
  let prof = 0;
  let q = '';
  let ini = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = ''; continue; }
    if (c === '\\') { i++; continue; }
    if (c === '"' || c === "'") q = c;
    else if (c === '(' || c === '[') prof++;
    else if (c === ')' || c === ']') prof = Math.max(0, prof - 1);
    else if (c === ',' && prof === 0) { out.push(s.slice(ini, i)); ini = i + 1; }
  }
  out.push(s.slice(ini));
  return out.map((x) => x.trim()).filter(Boolean);
}

/** Lo que tiene el HTML de la copia: sus clases, sus ids y sus etiquetas (en minúscula). */
export type Fichas = { clases: Set<string>; ids: Set<string>; etiquetas: Set<string> };

export function fichasDeHtml(html: string): Fichas {
  const clases = new Set<string>();
  const ids = new Set<string>();
  const etiquetas = new Set<string>(['html', 'body']);
  // La etiqueta hasta su `>` de cierre, respetando las comillas: una clase de Tailwind lleva `>` (`[&>*]:p-2`).
  for (const m of html.matchAll(/<([a-zA-Z][\w-]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/g)) {
    etiquetas.add(m[1].toLowerCase());
    const attrs = m[2];
    const cl = /\sclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
    if (cl) for (const c of (cl[1] ?? cl[2] ?? cl[3] ?? '').split(/\s+/)) if (c) clases.add(desescaparHtml(c));
    const id = /\sid\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
    if (id) { const v = desescaparHtml(id[1] ?? id[2] ?? id[3] ?? ''); if (v) ids.add(v); }
  }
  return { clases, ids, etiquetas };
}

const desescaparHtml = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

/** Un identificador de CSS sin sus escapes (`md\:flex` → `md:flex`, `\31 0` → `10`). */
export function desescaparCss(s: string): string {
  return s.replace(/\\([0-9a-fA-F]{1,6})\s?|\\(.)/g, (_m, hex: string | undefined, c: string | undefined) => (hex ? String.fromCodePoint(parseInt(hex, 16)) : c ?? ''));
}

const RE_IDENT = String.raw`(?:\\[0-9a-fA-F]{1,6}\s?|\\.|[\w-]|[^\x00-\x7F])+`;

/**
 * ¿Algún elemento de la copia puede cumplir este selector? Pide que estén TODAS sus clases, ids y etiquetas (sin contar
 * lo de adentro de `:not()`, `:is()`… ni los pseudo): si falta una, nada lo cumple. Lo que no se entiende, se queda.
 */
export function selectorVive(sel: string, f: Fichas): boolean {
  // Sin lo de adentro de los paréntesis (`:not(.x)`, `:nth-child(2n)`), sin atributos y sin strings.
  // Un corchete o un paréntesis ESCAPADO es parte de una clase de Tailwind (`.\[\&\>\*\]\:p-2`, `.w-\[calc\(100\%\)\]`):
  // no es un atributo ni un argumento, y sacarlo deja una clase que nadie tiene.
  let s = sel;
  for (let k = 0; k < 6 && /(?<!\\)\((?:\\.|[^()\\])*(?<!\\)\)/.test(s); k++) s = s.replace(/(?<!\\)\((?:\\.|[^()\\])*(?<!\\)\)/g, '');
  s = s.replace(/(?<!\\)\[(?:\\.|[^\]\\])*\]/g, '').replace(/"[^"]*"|'[^']*'/g, '');
  // Un `\#` o un `\.` escapados son de la clase (`.bg-\[\#0A0B14\]`, `.p-\[0\.060rem\]`): no empiezan un id ni otra clase.
  // Medido el 28/10/2026: tryholo.ai perdía todos sus fondos oscuros.
  for (const m of s.matchAll(new RegExp(String.raw`(?<!\\)\.(${RE_IDENT})`, 'g'))) if (!f.clases.has(desescaparCss(m[1]))) return false;
  for (const m of s.matchAll(new RegExp(String.raw`(?<!\\)#(${RE_IDENT})`, 'g'))) if (!f.ids.has(desescaparCss(m[1]))) return false;
  // Las etiquetas: al principio de cada compuesto (después de un combinador que no esté escapado, o del inicio).
  for (const m of s.matchAll(/(?:^|(?<!\\)[\s>+~])([a-zA-Z][\w-]*)/g)) {
    const t = m[1].toLowerCase();
    if (!f.etiquetas.has(t)) return false;
  }
  return true;
}

/**
 * Un selector de la página para la copia: las clases de SU <html> y SU <body> que pedía se cumplían, así que se sacan
 * (`html.w-mod-js .x` → `html .x`); `:root`/`html`/`body` con un `>` atrás pasan a descendiente (la copia está adentro
 * de cajas de MaKo). Una clase del body sola (`.body`) queda: la cumple la caja que envuelve cada sección.
 */
export function selectorParaCopia(sel: string, clasesHtml: ReadonlySet<string>, clasesBody: ReadonlySet<string>): string {
  // El `>` de después NO se come el espacio que sigue: ese espacio es el que deja reconocer el `body` de `html > body.x`.
  return sel.replace(new RegExp(String.raw`(^|[\s>+~(,])(html|body|:root)((?:\.${RE_IDENT}|\[[^\]]*\]|:[\w-]+(?:\([^)]*\))?)*)(\s*>)?`, 'gi'), (_m, antes: string, tag: string, quals: string, hijo: string | undefined) => {
    const propias = tag.toLowerCase() === 'body' ? clasesBody : clasesHtml;
    const resto = quals.replace(new RegExp(String.raw`\.(${RE_IDENT})`, 'g'), (q: string, c: string) => (propias.has(desescaparCss(c)) ? '' : q));
    return `${antes}${tag}${resto}${hijo ? ' ' : ''}`;
  }).replace(/\s{2,}/g, ' ').trim();
}

/** Las at-rules cuyo bloque lleva reglas (se podan adentro). */
const CON_REGLAS = new Set(['media', 'supports', 'layer', 'container', 'document', '-moz-document', 'scope', 'starting-style']);

export type HojaPodada = { css: string; antes: number; despues: number; reglas: number; quitadas: number };

/**
 * La hoja de la copia: sin las reglas que nada cumple, sin `@keyframes` que nadie nombra, sin `@import`/`@charset`
 * (las hojas importadas ya vienen adentro), con los selectores para la copia (`selectorParaCopia`) y sin espacios de más.
 */
export function podarCss(css: string, f: Fichas, clasesHtml: ReadonlySet<string> = new Set(), clasesBody: ReadonlySet<string> = new Set()): HojaPodada {
  let reglas = 0;
  let quitadas = 0;
  const caminar = (piezas: Pieza[]): string[] => {
    const out: string[] = [];
    for (const p of piezas) {
      if (p.tipo === 'sentencia') {
        // `@layer a, b;` ordena las capas: se queda. `@import`, `@charset` y `@namespace` no.
        if (/^@layer\b/i.test(p.texto)) out.push(`${p.texto};`);
        continue;
      }
      if (p.tipo === 'regla') {
        reglas++;
        const vivos = separarPorComas(p.selector).filter((x) => selectorVive(x, f));
        if (!vivos.length) { quitadas++; continue; }
        out.push(`${vivos.map((x) => selectorParaCopia(x, clasesHtml, clasesBody)).join(',')}{${compactar(p.cuerpo)}}`);
        continue;
      }
      if (CON_REGLAS.has(p.nombre)) {
        const adentro = caminar(piezasDeCss(p.cuerpo));
        if (adentro.length) out.push(`@${p.nombre} ${p.preludio}{${adentro.join('')}}`);
        continue;
      }
      out.push(`@${p.nombre}${p.preludio ? ` ${p.preludio}` : ''}{${compactar(p.cuerpo)}}`);
    }
    return out;
  };
  const piezas = caminar(piezasDeCss(css));
  // Los @keyframes que ninguna regla nombra (Webflow y Framer traen decenas).
  const sinKeyframes = piezas.filter((p) => !/^@(?:-webkit-)?keyframes\s/i.test(p));
  const usado = sinKeyframes.join('');
  const final = piezas.filter((p) => {
    const m = /^@(?:-webkit-)?keyframes\s+([^{\s]+)/i.exec(p);
    if (!m) return true;
    const nombre = m[1].replace(/^["']|["']$/g, '');
    return usado.includes(nombre);
  });
  const salida = final.join('\n');
  return { css: salida, antes: css.length, despues: salida.length, reglas, quitadas };
}

/** Un bloque de declaraciones sin espacios de más (fuera de strings y url()). */
function compactar(cuerpo: string): string {
  return cuerpo.replace(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|url\([^)]*\))|\s+/g, (m, intacto: string | undefined) => (intacto ? intacto : ' ')).trim();
}

/**
 * Las hojas de la foto, en orden, en UNA hoja: absolutas contra su dirección, con su media query, y con los `@import`
 * de una hoja bajada adentro (un nivel). `bajar` baja una hoja (la baranda de red es suya); lo que falla se anota.
 */
export async function hojaDeLaFoto(inst: Instantanea, bajar: (href: string) => Promise<string>): Promise<{ css: string; bajadas: number; fallidas: string[] }> {
  const fallidas: string[] = [];
  let bajadas = 0;
  const bajarUna = async (href: string): Promise<string> => {
    try { bajadas++; return await bajar(href); } catch (e) { fallidas.push(`${href}: ${e instanceof Error ? e.message : String(e)}`); return ''; }
  };
  const partes = await Promise.all(inst.hojas.map(async (h) => {
    let css = h.css ?? (h.href ? await bajarUna(h.href) : '');
    const base = h.base || h.href || inst.base || inst.url;
    if (!h.css && css) {
      // Los @import de una hoja bajada (los de una leída en el navegador ya vienen adentro).
      const imports: string[] = [];
      css = css.replace(/@import\s+(?:url\(\s*)?["']?([^"')\s;]+)["']?\s*\)?([^;]*);/gi, (_m, u: string) => { imports.push(new URL(u, base).toString()); return ''; });
      const traidas = await Promise.all(imports.map((u) => bajarUna(u).then((t) => cssAbsoluto(t, u))));
      css = traidas.join('\n') + '\n' + css;
    }
    css = cssAbsoluto(css, base);
    return h.media && !/^(all|)$/i.test(h.media.trim()) ? `@media ${h.media}{${css}}` : css;
  }));
  return { css: partes.join('\n'), bajadas, fallidas };
}

// ─────────────────────────────────────────────────────────────────────────────
// Las secciones
// ─────────────────────────────────────────────────────────────────────────────

const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Las clases del <html> y del <body> de la página. */
export const clasesDe = (s: string): Set<string> => new Set(s.split(/\s+/).filter(Boolean));

/** Una sección de la copia: su HTML y las etiquetas que la envolvían en la página, de afuera hacia adentro. */
export type SeccionCopia = { html: string; envoltorios: string[] };

/**
 * Desde qué tamaño una parte se abre en sus hijos: una sección que se toca en el editor ronda 5-80 KB, y el `<main>`
 * entero de respond.io (648 KB, medido el 28/10/2026) no entraba ni en el tope de una sección (`TOPES.htmlEditable`).
 */
export const PARTIR_DESDE = 60_000;
/** Las etiquetas que no son partes (las saca la foto, pero una página puede traerlas sueltas). */
const SUELTAS = new Set(['script', 'style', 'link', 'noscript', 'template', 'meta']);

/**
 * Las secciones de la copia: baja por los envoltorios de un solo hijo hasta el primer nivel con varias partes (lo chico
 * va pegado a lo que sigue), y una parte más grande que `PARTIR_DESDE` que es UNA caja con varios hijos se abre: la caja
 * pasa a ser un envoltorio de sus hijos. Arriba de todo, la caja con las clases del <html> y del <body> de la página.
 */
export function partirParaCopia(inst: Instantanea): SeccionCopia[] {
  const clases = [inst.html.clase, inst.body.clase].join(' ').replace(/\s+/g, ' ').trim();
  const caja = `<div${clases ? ` class="${escAttr(clases)}"` : ''}${inst.body.estilo ? ` style="${escAttr(inst.body.estilo)}"` : ''} data-gm-copia="body">`;
  const out: SeccionCopia[] = [];
  const elementos = (nodos: NodoNivel[]) => nodos.filter((n): n is Extract<NodoNivel, { tipo: 'el' }> => n.tipo === 'el' && !SUELTAS.has(n.tag));
  const bajar = (html: string, envs: string[], prof: number): void => {
    let actual = html;
    const mios = [...envs];
    for (let k = 0; k < 16; k++) {
      const nodos = nodosDeNivel(actual);
      const els = elementos(nodos);
      const hayTexto = nodos.some((n) => n.tipo === 'texto' && actual.slice(n.inicio, n.fin).trim() !== '');
      const el = els[0];
      if (els.length !== 1 || hayTexto || !el || el.cierreInicio <= el.aperturaFin || mios.length >= PROFUNDIDAD_MAX) break;
      mios.push(actual.slice(el.inicio, el.aperturaFin));
      actual = actual.slice(el.aperturaFin, el.cierreInicio);
    }
    const crudas: string[] = [];
    for (const n of nodosDeNivel(actual)) {
      if (n.tipo === 'comentario' || (n.tipo === 'el' && SUELTAS.has(n.tag))) continue;
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
    // Una parte grande se abre: si es UNA caja con hijos, la caja pasa a envoltorio; si son varias piezas (lo chico va
    // pegado a lo que sigue: reportei.com llevaba un espaciador delante de 484 KB), cada pieza va por su lado.
    const abrir = (parte: string, profP: number): void => {
      if (parte.length > PARTIR_DESDE && profP < 8 && mios.length < PROFUNDIDAD_MAX) {
        const nodos = nodosDeNivel(parte);
        const els = elementos(nodos);
        const el = els.length === 1 ? els[0] : null;
        if (el && el.cierreInicio > el.aperturaFin && elementos(nodosDeNivel(parte.slice(el.aperturaFin, el.cierreInicio))).length >= 1) {
          bajar(parte.slice(el.aperturaFin, el.cierreInicio), [...mios, parte.slice(el.inicio, el.aperturaFin)], profP + 1);
          return;
        }
        if (els.length > 1) {
          for (const n of nodos) {
            if (n.tipo === 'comentario' || (n.tipo === 'el' && SUELTAS.has(n.tag))) continue;
            const h = parte.slice(n.inicio, n.fin);
            if (h.trim()) abrir(h, profP + 1);
          }
          return;
        }
      }
      out.push({ html: parte, envoltorios: mios });
    };
    for (const parte of partes) abrir(parte, prof);
  };
  bajar(inst.cuerpo, [caja], 0);
  // Las piezas chicas seguidas, bajo los mismos envoltorios, van juntas: abrir lo grande de Elementor daba 116 secciones
  // de 1-3 KB en reportei.com (28/10/2026), y una página lleva hasta `TOPES.tarjetasPorPagina`.
  let juntas = juntarVecinas(out, JUNTAR_HASTA);
  for (let tope = JUNTAR_HASTA * 2; juntas.length > TOPES.tarjetasPorPagina && tope <= TOPES.htmlEditable; tope *= 2) juntas = juntarVecinas(juntas, tope);
  return juntas;
}

/** Hasta cuántas etiquetas se baja: una menos que el tope de envoltorios (la caja del body va arriba de todo). */
const PROFUNDIDAD_MAX = TOPES_ENVOLTORIOS.cantidad - 1;
/** Hasta qué tamaño se juntan las piezas vecinas en una sección. */
export const JUNTAR_HASTA = 16_000;

/** Las secciones seguidas con los MISMOS envoltorios, juntas mientras no pasen de `hasta` (en orden). */
export function juntarVecinas(secciones: readonly SeccionCopia[], hasta: number): SeccionCopia[] {
  const out: SeccionCopia[] = [];
  for (const s of secciones) {
    const ult = out[out.length - 1];
    if (ult && ult.envoltorios.join('') === s.envoltorios.join('') && ult.html.length + s.html.length <= hasta) out[out.length - 1] = { html: ult.html + s.html, envoltorios: ult.envoltorios };
    else out.push(s);
  }
  return out;
}

/** Los proveedores de agenda: su embed en la copia le llevaría los leads (nombre, mail, hora) a la cuenta de la otra. */
const RE_HOST_AGENDA = /(^|\.)(calendly\.com|cal\.com|hubspot\.com|hubspot\.net|tidycal\.com|leadconnectorhq\.com|msgsndr\.com|gohighlevel\.com|savvycal\.com|zcal\.co|youcanbook\.me|acuityscheduling\.com|calendar\.google\.com)$/i;

/**
 * Lo que en la copia llevaría a la OTRA (verificación de 5004dba08, 28/10/2026): en una copia idéntica cada enlace que no es
 * un ancla de la misma página lleva al mundo de la original (su registro, su Calendly, su WhatsApp), y su agenda embebida
 * le llevaría los leads. Los enlaces pasan a «#»; el embed de una agenda, a una caja vacía del mismo tamaño y marcada
 * (`data-gm-agenda-original`), así la página no se corre; y un `data-calendly` se va. Se cuenta para el aviso.
 */
export function sinDestinosAjenos(html: string): { html: string; enlaces: number; agendas: number } {
  let enlaces = 0;
  let agendas = 0;
  let h = html.replace(/<iframe\b([^>]*)>[\s\S]*?<\/iframe>/gi, (todo: string, attrs: string) => {
    const src = /\ssrc="([^"]*)"/i.exec(attrs)?.[1] ?? '';
    let host = '';
    try { host = new URL(desescaparHtml(src)).hostname; } catch { return todo; }
    if (!RE_HOST_AGENDA.test(host)) return todo;
    agendas++;
    const clase = /\sclass="[^"]*"/i.exec(attrs)?.[0] ?? '';
    const estilo = /\sstyle="[^"]*"/i.exec(attrs)?.[0] ?? '';
    return `<div${clase}${estilo} data-gm-agenda-original="${escAttr(host)}"></div>`;
  });
  h = h.replace(/\sdata-calendly\s*=\s*"[^"]*"/gi, () => { agendas++; return ''; });
  h = h.replace(/(<a\b[^>]*?\shref=")([^"]*)(")/gi, (todo: string, a: string, href: string, c: string) => {
    if (/^\s*#/.test(href)) return todo;
    enlaces++;
    return `${a}#${c}`;
  });
  return { html: h, enlaces, agendas };
}

/** Las secciones → el contenido de la landing nueva: una sección de diseño a sangre por parte, con sus envoltorios. */
export function contenidoDeCopiaIdentica(secciones: readonly SeccionCopia[]): LandingContenido {
  const tarjetas: JsonNodo[] = secciones.map((s) => tarjeta(
    [{ type: NODO.htmlEditable, attrs: { id: nuevoId('e'), html: s.html, ...(s.envoltorios.length ? { envoltorios: s.envoltorios } : {}) } }],
    { ancho: 'completo', alineacion: 'arriba' },
  ));
  return { v: 1, paginas: [{ id: nuevoId('p'), titulo: 'Inicio', ruta: '', doc: { type: 'doc', content: tarjetas } }] };
}

/** Lo que entra: cada sección bajo `TOPES.htmlEditable` y la hoja bajo `TOPES.cssDiseno`. */
export const entraEnLaCopia = (secciones: readonly SeccionCopia[], css: string): boolean =>
  secciones.every((s) => s.html.length <= TOPES.htmlEditable) && css.length <= TOPES.cssDiseno;
