// =============================================================================
// email-html-seguro — el cuerpo HTML de un EMAIL de un flujo de /chatbot: su saneo y su texto
// =============================================================================
// Pedido de Martín (09/10/2026, tercera tanda, punto 12): el editor del email copia el de las
// descripciones de las clases del curso, «donde se puede poner de todo, ya que así funciona un
// email, todos esos formatos están admitidos en Email». Decisión 12 del diseño
// (docs/chatbot-flujo-ramas-diseno.md): el paso guarda `cuerpo_html` (saneado con una lista
// blanca) y el motor lo manda como HTML; `cuerpo` queda como el texto plano de respaldo.
//
// Contrato:
//   sanearHtmlEmail(html, { estilo? }) → el HTML que se guarda y el que sale (lista blanca).
//   textoDeHtmlEmail(html)            → el texto plano de respaldo (`cuerpo`), derivado.
//   aplicarVariablesHtml(html, vars)  → las variables del motor por contexto: escapadas en el
//                                       texto, codificadas en una URL (en la pasada del saneo).
//   htmlEmailVacio(html)              → ¿no tiene nada que leer?
//
// ⚠️ PURO Y SIN DEPENDENCIAS (sólo lib/template-vars.ts, que tampoco importa nada). Lo usan el
//    motor (server), lib/email-html.ts —que lo importa un `'use client'`— y el editor. Por eso NO
//    es lib/html-seguro.ts: aquél es `server-only` y arrastra sanitize-html (postcss y htmlparser2)
//    al bundle. Y la lista es otra: un email no tiene adjuntos privados ni embeds.
//
// ⚠️ LISTA BLANCA, NUNCA LISTA NEGRA, Y LA SALIDA SE ARMA DE CERO. Nada de la entrada se copia tal
//    cual: cada etiqueta que pasa se vuelve a escribir con su nombre canónico, cada atributo se
//    DECODIFICA, se valida y se vuelve a escapar, y todo texto sale escapado. Por eso cualquier
//    diferencia entre cómo parte el HTML este tokenizador y cómo lo parte un navegador sólo puede
//    PERDER contenido, nunca colar una etiqueta: lo que el navegador lee de un atributo es,
//    carácter por carácter, el valor que se validó acá (el `&` de la salida va siempre escapado).
//
// Lo que deja pasar:
//   · Bloques: p, h1, h2, h3 (h4-h6 bajan a h3), blockquote, pre, hr, ul, ol, li, div, br.
//   · Marcas: strong, em, u, s, code, mark, span, sub, sup. b/i/strike/del/ins pasan a la etiqueta
//     del editor.
//   · Estilo: SÓLO `color` y `background-color` (span, mark) con un hex o un rgb()/rgba() de
//     números; `text-decoration` (span: underline o line-through, lo que pega Docs); y `text-align`
//     (p, h1-h3, div, th, td). Nada de url(), expression(), var().
//   · Links: http, https y mailto. Salen con `target="_blank" rel="noopener noreferrer"`.
//   · Imágenes: SÓLO https, sin usuario ni clave en la URL. `alt`, y el tamaño del editor
//     (`data-ancho` de 10 a 100 de a 5, `data-alinea="centro"`).
//   · Tablas: table, thead, tbody, tfoot, tr, th, td, con colspan/rowspan (2 a 20).
//   · `ol` con `start`.
//
// Lo que se va CON su contenido: script, style, iframe, object, svg, math, template, form, los
// controles y todo lo que no es texto de nadie. Un `<iframe>` (un video insertado con el editor:
// un mail no lo reproduce) se manda como un LINK a su dirección si es https: el video no se pierde
// en silencio. El resto de lo desconocido pierde la etiqueta y deja su texto. Comentarios y
// declaraciones, fuera. Los atributos on*, `style` libre, `javascript:`, `data:` y las rutas
// relativas no tienen dónde entrar: no hay ninguna rama que los copie.

import { aplicarVariables } from './template-vars';

/** Lo más largo que se acepta ENTRAR: un tope contra un cuerpo armado para gastar CPU. */
export const TOPE_HTML_EMAIL_ENTRADA = 400_000;
/** Lo más largo que se GUARDA, ya saneado. Un mail con decenas de párrafos son ~20.000. */
export const TOPE_HTML_EMAIL = 100_000;

/** Los nombres de la entrada que pasan con OTRO nombre (el del editor). */
const RENOMBRE: Readonly<Record<string, string>> = {
  b: 'strong', i: 'em', strike: 's', del: 's', ins: 'u', h4: 'h3', h5: 'h3', h6: 'h3',
};

const PERMITIDAS: ReadonlySet<string> = new Set([
  'p', 'h1', 'h2', 'h3', 'blockquote', 'pre', 'hr', 'ul', 'ol', 'li', 'div', 'br',
  'strong', 'em', 'u', 's', 'code', 'mark', 'span', 'sub', 'sup',
  'a', 'img', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
]);
const VACIAS: ReadonlySet<string> = new Set(['br', 'hr', 'img']);

/** Su contenido no es HTML (el navegador lo lee como texto crudo): se salta hasta su cierre. */
const TEXTO_CRUDO: ReadonlySet<string> = new Set(['script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes', 'noscript']);
/** Se van con todo lo que tienen adentro. */
const CON_CONTENIDO: ReadonlySet<string> = new Set([
  'object', 'applet', 'svg', 'math', 'template', 'select', 'head', 'frameset', 'canvas', 'audio', 'video',
  'picture', 'map', 'datalist', 'dialog', 'form', 'button', 'colgroup', 'option', 'optgroup',
]);
/** Vacías que no pasan. Se nombran para que su `/>` no abra nada. */
const VACIAS_FUERA: ReadonlySet<string> = new Set(['embed', 'input', 'meta', 'link', 'base', 'col', 'source', 'track', 'frame', 'area', 'param', 'wbr', 'keygen']);

const COLOR = /^(?:#[0-9a-f]{3,4}|#[0-9a-f]{6}|#[0-9a-f]{8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d{1,3})\s*)?\))$/i;
const ALINEACION = /^(?:left|center|right|justify)$/;
const DECORACION = /^(?:underline|line-through)$/;
/** El ancho de una imagen del editor: 10 a 95 de a 5, o 100 (`ANCHOS_IMAGEN`, app/_ui/HtmlSeguro.tsx). */
const ANCHO = /^(?:[1-9][05]|100)$/;

/** Los atributos ya validados de una etiqueta que pasó, en el orden en que se escriben. */
export type AtributosEmail = ReadonlyArray<readonly [string, string]>;
/**
 * El estilo EN LÍNEA de cada etiqueta cuando el HTML va adentro de un correo (lib/email-html.ts):
 * un cliente de correo no lee hojas de estilo. `padres` son las etiquetas abiertas, de afuera hacia
 * adentro. Lo que devuelve va ANTES del estilo propio de la etiqueta (el color que eligió quien
 * escribe le gana al de la plantilla).
 */
export type EstiloEmail = (tag: string, padres: readonly string[], attrs: AtributosEmail) => string;

// ── Entidades ───────────────────────────────────────────────────────────────────────────────

const NOMBRADAS: Readonly<Record<string, string>> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', tab: '\t', newline: '\n',
  colon: ':', sol: '/', lpar: '(', rpar: ')', period: '.', comma: ',', num: '#', quest: '?', equals: '=',
  hellip: '…', mdash: '—', ndash: '–', laquo: '«', raquo: '»', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’',
  iexcl: '¡', iquest: '¿', bull: '•', middot: '·', copy: '©', reg: '®', trade: '™', euro: '€',
};

/**
 * Las entidades a caracteres. Una nombrada que no está en la lista queda tal cual: sobre un
 * ATRIBUTO eso no abre nada (la salida vuelve a escapar su `&`, así que el navegador lee el mismo
 * texto que se validó), y sobre el TEXTO plano de respaldo sólo deja el nombre a la vista.
 */
function decodificar(s: string): string {
  if (!s.includes('&')) return s;
  return s.replace(/&(#\d{1,7}|#[xX][0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{1,31});?/g, (todo, cuerpo: string) => {
    if (cuerpo[0] === '#') {
      const n = cuerpo[1] === 'x' || cuerpo[1] === 'X' ? parseInt(cuerpo.slice(2), 16) : parseInt(cuerpo.slice(1), 10);
      // El 0 y los sustitutos sueltos no son un carácter: el navegador pone U+FFFD.
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : '�';
    }
    const v = NOMBRADAS[cuerpo] ?? NOMBRADAS[cuerpo.toLowerCase()];
    return v ?? todo;
  });
}

const escapar = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * El TEXTO tal como va a la salida: las entidades bien escritas se quedan (en un texto una entidad
 * sólo puede ser un carácter, nunca una etiqueta) y todo `&` suelto, `<` y `>` se escapa.
 */
const textoSeguro = (t: string): string => t
  .replace(/\u0000/g, '')
  .replace(/&(?!(?:[a-zA-Z][a-zA-Z0-9]{1,31}|#\d{1,7}|#[xX][0-9a-fA-F]{1,6});)/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

// ── El tokenizador ──────────────────────────────────────────────────────────────────────────

type Visita = {
  texto: (crudo: string) => void;
  abre: (tag: string, attrs: Map<string, string>) => void;
  cierra: (tag: string) => void;
};

/** Los atributos de lo que hay entre el nombre de la etiqueta y su `>`, ya DECODIFICADOS. */
function leerAtributos(dentro: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const m of dentro.matchAll(re)) {
    const nombre = m[1].toLowerCase();
    if (out.has(nombre)) continue; // como el navegador: gana el primero
    out.set(nombre, decodificar(m[2] ?? m[3] ?? m[4] ?? ''));
  }
  return out;
}

/**
 * Recorre un HTML y avisa texto, aperturas y cierres. Lo de adentro de un elemento de texto crudo
 * (script, style, iframe…) se salta hasta su cierre: se avisa la apertura (con sus atributos, para
 * el link del iframe) y el cierre, sin nada en el medio. Sin cierre, se salta hasta el final.
 */
function recorrer(s: string, v: Visita): void {
  const n = s.length;
  const nombreRe = /<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)/y;
  let i = 0;
  while (i < n) {
    const lt = s.indexOf('<', i);
    if (lt < 0) { v.texto(s.slice(i)); break; }
    if (lt > i) v.texto(s.slice(i, lt));
    if (s.startsWith('<!--', lt)) {
      const fin = s.indexOf('-->', lt + 4);
      i = fin < 0 ? n : fin + 3;
      continue;
    }
    const c = s[lt + 1];
    if (c === '!' || c === '?') {
      const fin = s.indexOf('>', lt);
      i = fin < 0 ? n : fin + 1;
      continue;
    }
    nombreRe.lastIndex = lt;
    const m = nombreRe.exec(s);
    if (!m) { v.texto('<'); i = lt + 1; continue; }
    // El final de la etiqueta: el primer `>` que no esté adentro de un valor entre comillas.
    let j = nombreRe.lastIndex;
    let comilla: string | null = null;
    for (; j < n; j++) {
      const ch = s[j];
      if (comilla) { if (ch === comilla) comilla = null; }
      else if (ch === '"' || ch === "'") comilla = ch;
      else if (ch === '>') break;
    }
    const nombre = m[2].toLowerCase();
    const dentro = s.slice(nombreRe.lastIndex, j);
    i = j < n ? j + 1 : n;
    if (m[1] === '/') { v.cierra(nombre); continue; }
    v.abre(nombre, leerAtributos(dentro));
    if (TEXTO_CRUDO.has(nombre) || nombre === 'plaintext') {
      if (nombre === 'plaintext') { i = n; break; }
      const cierre = new RegExp(`</${nombre}(?=[\\s/>]|$)`, 'ig');
      cierre.lastIndex = i;
      const k = cierre.exec(s);
      if (!k) { i = n; v.cierra(nombre); break; }
      const fin = s.indexOf('>', k.index);
      i = fin < 0 ? n : fin + 1;
      v.cierra(nombre);
    }
  }
}

// ── Las reglas de cada atributo ─────────────────────────────────────────────────────────────

/** El esquema de una URL como la lee un navegador: sin controles ni espacios en el medio. */
function esquemaDe(url: string): string | null {
  const limpio = url.replace(/[\u0000- \u007f]/g, '');
  const m = /^([a-z][a-z0-9+.-]*):/i.exec(limpio);
  return m ? m[1].toLowerCase() : null;
}

/** Caracteres de control: en una URL el navegador los saltea, y con eso arma un esquema que no se ve. */
const CONTROL = /[\u0000-\u001f\u007f]/;

/**
 * Un `href` que pasa: http, https o mailto, bien formado. Devuelve el valor a escribir, o null.
 * Un espacio, `<` o `"` adentro NO lo descartan: salen escapados (y el navegador codifica el
 * espacio). Descartarlos borraba el link de un lead cuyo nombre lleva un espacio al ponerle las
 * variables (medido al escribir el test de este módulo, 09/10/2026).
 */
function hrefSeguro(raw: string): string | null {
  const v = raw.trim();
  if (!v || v.length > 2048 || CONTROL.test(v)) return null;
  const esquema = esquemaDe(v);
  if (esquema === 'mailto') return v.length > 7 && !/^mailto:\s/i.test(v) ? v : null;
  if ((esquema !== 'http' && esquema !== 'https') || !/^https?:\/\//i.test(v)) return null;
  try { return new URL(v).hostname ? v : null; } catch { return null; }
}

/** Un `src` de imagen que pasa: https, con host, sin usuario ni clave. */
function srcSeguro(raw: string): string | null {
  const v = raw.trim();
  if (!v || v.length > 2048 || CONTROL.test(v) || !/^https:\/\//i.test(v)) return null;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && u.hostname && !u.username && !u.password ? v : null;
  } catch { return null; }
}

/** Un entero de un rango, escrito tal cual («2», no «02» ni «2px»). */
function entero(raw: string | undefined, min: number, max: number): string | null {
  if (raw == null || !/^\d{1,4}$/.test(raw.trim())) return null;
  const n = Number(raw.trim());
  return n >= min && n <= max ? String(n) : null;
}

/** Las declaraciones de un `style` que pasan para esta etiqueta, reescritas. */
function estiloPropio(tag: string, raw: string | undefined): string {
  if (!raw) return '';
  const out: string[] = [];
  const vistas = new Set<string>();
  for (const decl of raw.split(';')) {
    const k = decl.indexOf(':');
    if (k < 0) continue;
    const prop = decl.slice(0, k).trim().toLowerCase();
    const valor = decl.slice(k + 1).replace(/!important/i, '').trim();
    if (!valor || vistas.has(prop)) continue;
    let ok = false;
    if ((prop === 'color' || prop === 'background-color') && (tag === 'span' || tag === 'mark')) ok = COLOR.test(valor);
    else if (prop === 'text-decoration' && tag === 'span') ok = DECORACION.test(valor.toLowerCase());
    else if (prop === 'text-align' && /^(?:p|h1|h2|h3|div|th|td)$/.test(tag)) ok = ALINEACION.test(valor.toLowerCase());
    if (!ok) continue;
    vistas.add(prop);
    out.push(`${prop}:${prop === 'text-align' || prop === 'text-decoration' ? valor.toLowerCase() : valor.replace(/\s+/g, '')}`);
  }
  return out.length ? out.join(';') + ';' : '';
}

/** Los atributos que pasan para una etiqueta permitida, o null si la etiqueta no puede ir (un link sin destino). */
function atributosDe(tag: string, a: Map<string, string>): Array<[string, string]> | null {
  const out: Array<[string, string]> = [];
  const estilo = estiloPropio(tag, a.get('style'));
  switch (tag) {
    case 'a': {
      const href = hrefSeguro(a.get('href') ?? '');
      if (!href) return null;
      out.push(['href', href], ['target', '_blank'], ['rel', 'noopener noreferrer']);
      break;
    }
    case 'img': {
      const src = srcSeguro(a.get('src') ?? '');
      if (!src) return null;
      out.push(['src', src]);
      const alt = (a.get('alt') ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
      out.push(['alt', alt]);
      const ancho = a.get('data-ancho');
      if (ancho && ANCHO.test(ancho)) out.push(['data-ancho', ancho]);
      if (a.get('data-alinea') === 'centro') out.push(['data-alinea', 'centro']);
      break;
    }
    case 'ol': {
      const start = entero(a.get('start'), 2, 9999);
      if (start) out.push(['start', start]);
      break;
    }
    case 'th': case 'td': {
      const cs = entero(a.get('colspan'), 2, 20);
      const rs = entero(a.get('rowspan'), 2, 20);
      if (cs) out.push(['colspan', cs]);
      if (rs) out.push(['rowspan', rs]);
      break;
    }
    default: break;
  }
  if (estilo) out.push(['style', estilo]);
  return out;
}

const escribirApertura = (tag: string, attrs: AtributosEmail): string =>
  `<${tag}${attrs.map(([k, v]) => ` ${k}="${escapar(v)}"`).join('')}>`;

// ── El saneo ────────────────────────────────────────────────────────────────────────────────

/**
 * El HTML de un email, por la lista blanca. Sin `estilo`, es el HTML LIMPIO que se guarda
 * (`cuerpo_html`) y el que vuelve a cargar el editor; con `estilo`, el mismo con el estilo en línea
 * que necesita un cliente de correo (lo pasa lib/email-html.ts).
 *
 * Idempotente: sanear lo saneado devuelve lo mismo (lo fija el test).
 */
export function sanearHtmlEmail(
  html: string | null | undefined,
  o?: { estilo?: EstiloEmail; variables?: Record<string, string> },
): string {
  if (typeof html !== 'string' || !html) return '';
  const entrada = html.length > TOPE_HTML_EMAIL_ENTRADA ? html.slice(0, TOPE_HTML_EMAIL_ENTRADA) : html;
  // Las variables, POR CONTEXTO (ver `aplicarVariablesHtml`): en el texto, el valor escapado; en un
  // `href` o un `src`, codificado como parte de una URL, y recién después se valida la URL.
  const vars = o?.variables;
  const mapa = (f: (v: string) => string): Record<string, string> | null => {
    if (!vars) return null;
    const m: Record<string, string> = {};
    for (const [k, v] of Object.entries(vars)) m[k] = f(typeof v === 'string' ? v : String(v ?? ''));
    return m;
  };
  const varsTexto = mapa(escapar);
  const varsUrl = mapa(encodeURIComponent);
  let out = '';
  const pila: string[] = [];
  /** Aperturas que no se escribieron (un link sin destino): su cierre no cierra nada. */
  const ignoradas = new Map<string, number>();
  /** Lo que se está saltando con todo su contenido: el nombre y la profundidad. */
  let saltando: { tag: string; n: number } | null = null;

  const estiloDe = (tag: string, attrs: Array<[string, string]>): Array<[string, string]> => {
    if (!o?.estilo) return attrs;
    const base = o.estilo(tag, pila, attrs);
    if (!base) return attrs;
    const propio = attrs.find(([k]) => k === 'style')?.[1] ?? '';
    const resto = attrs.filter(([k]) => k !== 'style');
    return [...resto, ['style', `${base.endsWith(';') ? base : base + ';'}${propio}`]];
  };

  recorrer(entrada, {
    texto(t) {
      if (saltando) return;
      out += textoSeguro(varsTexto ? aplicarVariables(t, varsTexto) : t);
    },
    abre(crudo, a) {
      if (saltando) { if (crudo === saltando.tag) saltando.n++; return; }
      if (varsUrl) for (const k of ['href', 'src']) { const v = a.get(k); if (v) a.set(k, aplicarVariables(v, varsUrl)); }
      if (CON_CONTENIDO.has(crudo)) { saltando = { tag: crudo, n: 1 }; return; }
      if (crudo === 'iframe') {
        // Un video insertado: el mail no lo reproduce, pero el lead puede abrirlo.
        const href = srcSeguro(a.get('src') ?? '');
        if (href && !pila.includes('a')) {
          const enBloque = pila.some((t) => /^(?:p|h[1-3]|li|td|th|pre)$/.test(t));
          const link = `${escribirApertura('a', estiloDe('a', [['href', href], ['target', '_blank'], ['rel', 'noopener noreferrer']]))}${textoSeguro(href)}</a>`;
          out += enBloque ? link : `${escribirApertura('p', estiloDe('p', []))}${link}</p>`;
        }
        return;
      }
      if (TEXTO_CRUDO.has(crudo) || VACIAS_FUERA.has(crudo)) return;
      const tag = RENOMBRE[crudo] ?? crudo;
      if (!PERMITIDAS.has(tag)) return; // pierde la etiqueta y deja su texto
      if (tag === 'a' && pila.includes('a')) { ignoradas.set('a', (ignoradas.get('a') ?? 0) + 1); return; }
      const attrs = atributosDe(tag, a);
      if (!attrs) {
        if (!VACIAS.has(tag)) ignoradas.set(tag, (ignoradas.get(tag) ?? 0) + 1);
        return;
      }
      out += escribirApertura(tag, estiloDe(tag, attrs));
      if (!VACIAS.has(tag)) pila.push(tag);
    },
    cierra(crudo) {
      if (saltando) {
        if (crudo === saltando.tag && --saltando.n === 0) saltando = null;
        return;
      }
      const tag = RENOMBRE[crudo] ?? crudo;
      if (!PERMITIDAS.has(tag) || VACIAS.has(tag)) return;
      const ign = ignoradas.get(tag) ?? 0;
      if (ign > 0) { ignoradas.set(tag, ign - 1); return; }
      const k = pila.lastIndexOf(tag);
      if (k < 0) return;
      while (pila.length > k) out += `</${pila.pop()}>`;
    },
  });
  while (pila.length) out += `</${pila.pop()}>`;
  return out;
}

// ── El texto plano de respaldo ──────────────────────────────────────────────────────────────

const BLOQUES = /^(?:p|h1|h2|h3|blockquote|pre|div|table|ul|ol)$/;

/**
 * El TEXTO PLANO de un cuerpo HTML: es el `cuerpo` del paso (lo que lee la tarjeta del lienzo y lo
 * que va como parte de texto del correo). Párrafos separados por un renglón en blanco, las listas
 * con «•» o su número, las celdas con « · », y un link con su dirección entre paréntesis cuando el
 * texto no la dice (en un correo de sólo texto, un link sin dirección no lleva a ningún lado).
 */
export function textoDeHtmlEmail(html: string | null | undefined): string {
  const limpio = sanearHtmlEmail(html);
  if (!limpio) return '';
  let out = '';
  /** Las etiquetas abiertas (el HTML ya está saneado: las aperturas y los cierres casan). */
  const abiertos: string[] = [];
  const listas: Array<{ tipo: 'ul' | 'ol'; n: number }> = [];
  const links: Array<{ href: string; desde: number }> = [];
  let celda = 0;
  /** Recién se escribió «• » o «1. »: el párrafo que abre el ítem va en ESE renglón. */
  let trasMarca = false;
  const enCelda = () => abiertos.includes('td') || abiertos.includes('th');
  const salto = () => { if (out && !out.endsWith('\n')) out += '\n'; };
  recorrer(limpio, {
    texto(t) {
      let s = decodificar(t).replace(/ /g, ' ');
      if (!abiertos.includes('pre')) {
        s = s.replace(/\s+/g, ' ');
        if (!out || out.endsWith('\n') || out.endsWith(' ')) s = s.replace(/^ /, '');
      }
      if (s.trim()) trasMarca = false;
      out += s;
    },
    abre(tag, a) {
      if (tag === 'br') { out += '\n'; return; }
      if (tag === 'img') { const alt = a.get('alt')?.trim(); if (alt) out += `[${alt}]`; return; }
      if (tag === 'hr') { salto(); out += '\n'; return; }
      abiertos.push(tag);
      if (tag === 'a') { links.push({ href: a.get('href') ?? '', desde: out.length }); return; }
      if (tag === 'tr') { salto(); celda = 0; return; }
      if (tag === 'td' || tag === 'th') { if (celda++ > 0) out += ' · '; return; }
      if (tag === 'li') {
        salto();
        const l = listas[listas.length - 1];
        const sangria = '  '.repeat(Math.max(0, listas.length - 1));
        if (l?.tipo === 'ol') { l.n += 1; out += `${sangria}${l.n}. `; } else out += `${sangria}• `;
        trasMarca = true;
        return;
      }
      if (tag === 'ul' || tag === 'ol') listas.push({ tipo: tag, n: Number(a.get('start') ?? '1') - 1 });
      if (BLOQUES.test(tag) && !trasMarca && !enCelda()) salto();
    },
    cierra(tag) {
      const k = abiertos.lastIndexOf(tag);
      if (k < 0) return;
      abiertos.length = k;
      if (tag === 'a') {
        const l = links.pop();
        if (!l || !l.href) return;
        const dicho = out.slice(l.desde).trim();
        if (/^https?:/i.test(l.href)) { if (!dicho.includes(l.href)) out += ` (${l.href})`; }
        else if (!dicho) out += l.href.replace(/^mailto:/i, '');
        return;
      }
      if (tag === 'ul' || tag === 'ol') listas.pop();
      if (tag === 'li' || tag === 'tr') { salto(); return; }
      if (!BLOQUES.test(tag) || enCelda()) return;
      // Adentro de una lista, un renglón; afuera, un párrafo (el renglón en blanco).
      if (abiertos.includes('li')) salto(); else { salto(); out += '\n'; }
    },
  });
  return out
    .split('\n').map((l) => l.replace(/\s+$/, '')).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** ¿El cuerpo no tiene nada que leer (ni texto ni una imagen)? `<p></p>` es vacío. */
export function htmlEmailVacio(html: string | null | undefined): boolean {
  const limpio = sanearHtmlEmail(html);
  return !limpio || (!/<img\b/.test(limpio) && !textoDeHtmlEmail(limpio).trim());
}

// ── Lo que guarda un paso (lo llama `setSecuenciaPasos`, lib/nutricion.ts) ─────────────────

/** El aviso de un cuerpo que no entra, o null. Se mira el CRUDO también: el saneo recorta la entrada. */
export function problemaDeCuerpoHtml(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw) return null;
  if (raw.length > TOPE_HTML_EMAIL_ENTRADA || sanearHtmlEmail(raw).length > TOPE_HTML_EMAIL) return 'es un email demasiado largo';
  return null;
}

/** Lo que GUARDA un paso de email como `cuerpo_html`: saneado, y sólo si tiene algo que leer. null = no va. */
export function cuerpoHtmlAGuardar(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw) return null;
  const s = sanearHtmlEmail(raw);
  return s && !htmlEmailVacio(s) ? s : null;
}

/**
 * El `cuerpo_html` que trae un paso al guardarse. Si quien guarda NO manda el campo (`undefined`:
 * un escritor que arma los pasos sin saber del editor rico, como la API por orden) y el texto es el
 * mismo que ya estaba, sigue el de antes: si no, guardar desde otra pantalla le borraba el formato
 * al email en silencio (la «quinta puerta», AGENTS.md). Si el texto cambió, gana el texto: el HTML
 * viejo mandaría algo que ya no está escrito. Un `null` o un '' explícitos lo sacan.
 */
export function cuerpoHtmlEntrante(
  p: { cuerpo?: unknown; cuerpo_html?: unknown },
  previo?: { cuerpo?: unknown; cuerpo_html?: unknown } | null,
): unknown {
  if (p.cuerpo_html !== undefined) return p.cuerpo_html;
  if (!previo || typeof previo.cuerpo_html !== 'string' || !previo.cuerpo_html) return null;
  const texto = (v: unknown) => (typeof v === 'string' ? v : '');
  return texto(p.cuerpo) === texto(previo.cuerpo) ? previo.cuerpo_html : null;
}

// ── Las variables ───────────────────────────────────────────────────────────────────────────

/**
 * Las variables del motor sobre un HTML, POR CONTEXTO y en la misma pasada del saneo:
 *   · en el TEXTO, el valor escapado: el nombre de un lead que diga `<b>` llega como ese texto;
 *   · en un `href` o un `src`, el valor codificado como parte de una URL (`encodeURIComponent`), y
 *     la URL se valida DESPUÉS de ponerlo: «Ana Pérez» en `?nombre={{lead_nombre}}` es
 *     `Ana%20P%C3%A9rez`, y un valor no puede cambiar el esquema de un link.
 * ⚠️ NO es un reemplazo sobre el HTML ya armado: así, un nombre con un espacio dejaba un `href` que
 *    el saneo siguiente (el de `renderEmailHtml`) descartaba, y el link desaparecía del correo.
 * La función de reemplazo es la del motor (`aplicarVariables`): lo que no conoce queda crudo, igual
 * que en un WhatsApp.
 */
export function aplicarVariablesHtml(html: string, vars: Record<string, string>): string {
  return sanearHtmlEmail(html, { variables: vars });
}
