import 'server-only';

// =============================================================================
// html-seguro — el saneo del texto rico (la descripción de una clase, y lo que venga después)
// =============================================================================
// Contrato (docs/diseno-curso-skool.md, D4): `sanearHtml(html): string` · `textoDeHtml(html): string`.
//
// Pedido de Martín (07/10/2026, item 17): «Se debería poder adjuntar cosas a la descripción…
// Imágenes, PDF, archivos, etc. Y mejora bastante las opciones de editar texto allí, se debería
// poder editar el texto completo, como si fuera un word».
//
// ⚠️ LISTA BLANCA, NUNCA LISTA NEGRA. El saneador viejo del tablero (`sanitizeHtml` en
//    app/plan/board/RichText.tsx) borra lo que conoce —script, on*, `javascript:`— y deja pasar
//    todo lo demás: `<svg><animate>`, `href="java&#09;script:"`, `<a href="data:text/html,…">`,
//    `<img src=x onerror=…>` con comillas raras. Acá pasa SOLO lo que el editor escribe (y lo
//    que hace falta para pegar de Word o Docs sin perder la forma), y cada valor se valida.
//
// ⚠️ SERVER-ONLY, y no por prolijidad: sanitize-html arrastra postcss y htmlparser2, y lo que el
//    navegador recibe tiene que ser lo que el server ya decidió. El navegador DIBUJA
//    (app/_ui/HtmlSeguro.tsx); no decide qué es seguro.
//
// Lo que deja pasar, y cómo:
//   · Bloques: p, h2, h3, blockquote, pre, hr, ul, ol, li. Un h1 baja a h2 y un h4-h6 sube a h3
//     (el editor ofrece dos niveles: Título y Subtítulo).
//   · Marcas: strong, em, u, s, code, mark, span, br. `b`/`i`/`strike`/`del`/`ins` se pasan a la
//     etiqueta que usa el editor (un `<b style="font-weight:normal">` de Google Docs NO es negrita).
//   · Color: SÓLO `color` y `background-color` en un span (y el fondo en un mark), con un valor que
//     sea un hex o un rgb()/rgba() — nada de `expression(…)`, `url(…)` ni `var(…)`.
//   · Alineación: SÓLO `text-align: left|center|right|justify` en p, h2 y h3.
//   · Links: http, https y mailto, y la referencia a un adjunto. Todo link sale con
//     `target="_blank" rel="noopener noreferrer nofollow"`.
//   · Imágenes: la referencia a un adjunto (`mako-adjunto:<uuid>`) o una URL https de un origen
//     de la lista (`ORIGENES_IMAGEN`), y de ahí sólo un ARCHIVO de imagen estático
//     (`RUTA_IMAGEN_PROPIA`: nada de `/api/`). Una imagen de cualquier otro lado es un pixel que
//     avisa cuándo abre la clase cada alumno: se sube como adjunto o no va.
//   · Listas de tareas (las del editor): `ul[data-type=taskList]`, `li[data-type=taskItem]` con
//     `data-checked` true/false. La casilla la DIBUJA el CSS; el `<input>` no se guarda.
//   · El tamaño de una imagen (08/10/2026, item 10): `data-ancho` con uno de los diecinueve anchos
//     de `ANCHOS_IMAGEN` (10 a 100, de a 5) y `data-alinea="centro"`. Comparados como TEXTO contra
//     la lista, dos veces: en el transform y en los `values` de `allowedAttributes`. Nunca un
//     `style` en una imagen: el ancho de Word (`width`/`height` en px) sigue pasando como antes.
//   · Tablas (08/10/2026, item 10): table, thead, tbody, tr, th, td. De todo lo que trae una tabla
//     pegada de Excel o Word, pasan sólo `colspan`/`rowspan` (un entero de 2 a 20: el 1 es el
//     default y no se escribe) y la alineación de la celda (la misma regla que un párrafo). Ni
//     `style` en la tabla, ni `colgroup`/`col` (los anchos de columna en px del editor), ni
//     `scope`/`headers`/`background`/`bgcolor`. Un `caption` pierde la etiqueta y deja su texto,
//     como toda etiqueta que no pasa.
//
//   · Lo INSERTADO (08/10/2026, item 15 del audio, 24:30: «que lo pueda embeber cosas como… el
//     Calendar, que se puedan embeber ahí mismo»): un `<iframe>` y SÓLO así: su `src` pasa por
//     `embedDe` (lib/embeds.ts: https, un host de la lista comparado exacto, y el `src` lo vuelve a
//     armar ese módulo), y los demás atributos los pone el transform desde `atributosDeIframe` —
//     `sandbox`, `allow`, `loading` y `referrerpolicy` fijos, el `title` y `data-proveedor` de una
//     lista, `data-alto` (sólo una agenda) de la lista `ALTOS_EMBED`—. Ningún atributo del pedido se
//     copia: un `srcdoc`, un `onload`, un `style` o un `sandbox` más flojo no tienen dónde entrar. Lo
//     que traiga adentro no es texto de nadie (`textFilter`). Segunda capa: los hosts de los `src`
//     que arma lib/embeds.ts (`allowedIframeHostnames`/`allowedIframeDomains`) y el esquema https.
//
// Lo que nunca pasa, aunque venga bien escrito: on*, style libre, un iframe que no sea lo de arriba,
// svg, math, form, input, base, meta, link, script, style, object, embed, comentarios, `javascript:`
// (con entidades, mayúsculas, tabs o espacios en el medio), `data:`, `vbscript:`, `file:`, rutas relativas.

import sanitizeHtml from 'sanitize-html';
import { idDeRef, anchoDeImagen, alineaDeImagen, ANCHOS_IMAGEN } from '@/app/_ui/HtmlSeguro';
import {
  embedDeIframe, atributosDeIframe, ALTOS_EMBED, PROVEEDORES_EMBED, SANDBOX_EMBED, ALLOW_EMBED,
  REFERRER_EMBED, HOSTS_IFRAME, DOMINIOS_IFRAME,
} from './embeds';
import { APP_BASE_URL } from './app-url';

/**
 * Lo más largo que se acepta ENTRAR. Un pegado de Word con todo su ruido son decenas de KB; esto
 * es un tope contra un cuerpo armado para gastar CPU, no contra una descripción larga.
 */
export const TOPE_HTML_ENTRADA = 400_000;

/**
 * Lo más largo que se GUARDA, ya saneado. El saneo deja el HTML magro (sin estilos de Word ni
 * clases), así que 100.000 caracteres son decenas de páginas. ⚠️ La columna tiene su propio
 * techo en la base (mig 0216, 200.000): éste es más chico a propósito, para que la pantalla diga
 * «demasiado larga» antes de que la base conteste un error de constraint.
 */
export const TOPE_HTML = 100_000;

/** Los orígenes de los que se acepta una imagen por URL (además de los adjuntos). */
const ORIGENES_IMAGEN: ReadonlySet<string> = new Set(
  [APP_BASE_URL, 'https://hola-mako.com', 'https://www.hola-mako.com']
    .map((u) => { try { return new URL(u).origin; } catch { return ''; } })
    .filter((o) => o.startsWith('https://')),
);

/**
 * De esos orígenes, SÓLO UN ARCHIVO DE IMAGEN ESTÁTICO (`/cono-ugc/a.webp`): sin query, sin
 * `/api/` ni `/_next/`, sin `%` (un `/%61pi/` es `/api/` para el router) y sin `//`.
 *
 * ⚠️ UN `<img>` DE NUESTRO PROPIO ORIGEN ES UN GET CON LAS COOKIES DE QUIEN MIRA (mismo sitio: la
 *    cookie viaja aunque sea SameSite=Lax). Con «cualquier ruta de hola-mako.com», el admin de un
 *    negocio escribía `<img src="https://hola-mako.com/api/compartido/curso/entrar?t=…">` y cada
 *    persona que abría la clase —sus alumnos, su equipo, el super admin que inspecciona el curso—
 *    le pegaba a esa ruta con su sesión. Medido (revisión del 08/10/2026): `sanearHtml` lo dejaba
 *    pasar tal cual. El editor nunca escribe una imagen así (el pegado las saca); esto sólo
 *    achica lo que acepta un pedido armado a mano.
 */
const RUTA_IMAGEN_PROPIA = /^(?!.*\/\/)\/(?!api\/|_next\/)[a-z0-9._~\-/]+\.(?:png|jpe?g|webp|gif|avif)$/i;

/** Un color que se deja pasar: hex de 3/4/6/8, o rgb()/rgba() con números. Nada más. */
const COLOR = /^(?:#[0-9a-f]{3,4}|#[0-9a-f]{6}|#[0-9a-f]{8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d{1,3})\s*)?\))$/i;
const ALINEACION = /^(?:left|center|right|justify)$/;

/** Saca caracteres de control y recorta. Para `alt` y `title`, que son texto libre. */
const textoCorto = (v: unknown, tope: number): string =>
  typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, tope) : '';

/**
 * El esquema de una URL como lo lee un NAVEGADOR: sin espacios ni controles a los costados, y sin
 * tabs ni saltos de línea en el medio (el navegador los ignora adentro del esquema: `java	script:`
 * ES `javascript:`). Las entidades ya vienen decodificadas por el parser (`&#106;avascript:` llega
 * como `javascript:`). `null` = sin esquema (una ruta relativa), que acá nunca vale.
 */
function esquemaDe(v: string): { esquema: string; limpio: string } | null {
  const limpio = v.replace(/[\t\n\r]/g, '').replace(/^[\u0000-\u0020]+|[\u0000-\u0020]+$/g, '');
  const m = /^([a-z][a-z0-9+.-]*):/i.exec(limpio);
  return m ? { esquema: m[1].toLowerCase(), limpio } : null;
}

/** El `href` de un link, o `null` si no es uno de los que pasan. */
export function hrefSeguro(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const e = esquemaDe(raw);
  if (!e) return null;
  if (e.esquema === 'mako-adjunto') return idDeRef(e.limpio) ? e.limpio : null;
  if (e.esquema === 'mailto') {
    const resto = e.limpio.slice('mailto:'.length);
    return resto && resto.length <= 320 && !/[\s<>"'\\]/.test(resto) ? `mailto:${resto}` : null;
  }
  if (e.esquema !== 'http' && e.esquema !== 'https') return null;
  try {
    const u = new URL(e.limpio);
    if ((u.protocol !== 'http:' && u.protocol !== 'https:') || !u.hostname) return null;
    // Sin usuario ni clave: `https://banco.com@otro.sitio` se lee como el banco y va al otro.
    if (u.username || u.password) return null;
    return u.href.length <= 2000 ? u.href : null;
  } catch {
    return null;
  }
}

/** El `src` de una imagen, o `null`: un adjunto, o https de un origen de la lista. */
export function srcSeguro(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const e = esquemaDe(raw);
  if (!e) return null;
  if (e.esquema === 'mako-adjunto') return idDeRef(e.limpio) ? e.limpio : null;
  if (e.esquema !== 'https') return null;
  try {
    const u = new URL(e.limpio);
    if (u.protocol !== 'https:' || u.username || u.password || !ORIGENES_IMAGEN.has(u.origin)) return null;
    if (u.search || u.hash || !RUTA_IMAGEN_PROPIA.test(u.pathname)) return null;
    return u.href.length <= 2000 ? u.href : null;
  } catch {
    return null;
  }
}

const dimension = (v: unknown): string | null =>
  typeof v === 'string' && /^\d{1,4}$/.test(v.trim()) && Number(v) > 0 ? String(Number(v)) : null;

/**
 * Cuántas columnas o filas abarca una celda: un entero de 2 a 20, o nada. El 1 es el default y no
 * se escribe (así el HTML del editor y el saneado son el mismo texto). Un `colspan="999"` pegado
 * de algún lado haría una tabla de mil columnas vacías: se acota.
 */
const TOPE_SPAN = 20;
const VALORES_SPAN: string[] = Array.from({ length: TOPE_SPAN - 1 }, (_, i) => String(i + 2));
const span = (v: unknown): string | null =>
  typeof v === 'string' && /^[1-9]\d?$/.test(v) && Number(v) >= 2 && Number(v) <= TOPE_SPAN ? v : null;

/** Una celda: sólo su `colspan`/`rowspan` válidos y su `style` (que después filtra `allowedStyles`). */
function celda(tag: 'td' | 'th', a: Attrs): { tagName: string; attribs: Attrs } {
  const out: Attrs = {};
  const c = span(a.colspan), r = span(a.rowspan);
  if (c) out.colspan = c;
  if (r) out.rowspan = r;
  if (a.style) out.style = a.style;
  return { tagName: tag, attribs: out };
}

type Attrs = Record<string, string>;

/** Sólo el `style` (que después filtra `allowedStyles`): lo demás de un título pegado no se copia. */
const soloEstilo = (a: Attrs): Attrs => (a.style ? { style: a.style } : {});

/**
 * Un iframe: lo que arma `atributosDeIframe` desde lo que `embedDe` reconoce en su `src`, o NADA (sin
 * `src`, `exclusiveFilter` lo saca entero). El alto de una agenda: el `data-alto` si es uno de la lista,
 * si no el `height` que trajo pegado (llevado a la lista), si no el de su proveedor. Del pedido no se
 * copia ningún otro atributo.
 */
function iframeSeguro(a: Attrs): Attrs {
  const e = embedDeIframe(a);
  return e ? Object.fromEntries(atributosDeIframe(e)) : {};
}
const NOMBRES_EMBED: string[] = Object.values(PROVEEDORES_EMBED).map((p) => p.nombre);
type Frame = { tag: string; name?: string; attribs: Attrs; text: string; mediaChildren?: string[] };

const OPCIONES: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'h2', 'h3', 'blockquote', 'pre', 'hr', 'ul', 'ol', 'li', 'br',
    'strong', 'em', 'u', 's', 'code', 'mark', 'span', 'a', 'img',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'iframe',
  ],
  allowedAttributes: {
    // Lo insertado: la segunda capa, con los VALORES exactos (la primera es `iframeSeguro`).
    iframe: ['src',
      { name: 'title', multiple: false, values: NOMBRES_EMBED },
      { name: 'data-proveedor', multiple: false, values: Object.keys(PROVEEDORES_EMBED) },
      { name: 'data-alto', multiple: false, values: ALTOS_EMBED.map(String) },
      { name: 'sandbox', multiple: false, values: [SANDBOX_EMBED] },
      { name: 'allow', multiple: false, values: [ALLOW_EMBED] },
      { name: 'loading', multiple: false, values: ['lazy'] },
      { name: 'referrerpolicy', multiple: false, values: [REFERRER_EMBED] }],
    a: ['href', 'target', 'rel', 'title'],
    // El ancho y la alineación: la segunda capa, con los VALORES exactos (la primera es el
    // transform). Si alguien afloja una de las dos, queda la otra.
    img: ['src', 'alt', 'title', 'width', 'height',
      { name: 'data-ancho', multiple: false, values: ANCHOS_IMAGEN.map(String) },
      { name: 'data-alinea', multiple: false, values: ['centro'] }],
    span: ['style'],
    mark: ['style'],
    p: ['style'],
    h2: ['style'],
    h3: ['style'],
    ol: ['start'],
    ul: ['data-type'],
    li: ['data-type', 'data-checked'],
    th: [{ name: 'colspan', multiple: false, values: VALORES_SPAN }, { name: 'rowspan', multiple: false, values: VALORES_SPAN }, 'style'],
    td: [{ name: 'colspan', multiple: false, values: VALORES_SPAN }, { name: 'rowspan', multiple: false, values: VALORES_SPAN }, 'style'],
  },
  // `class` sólo en un link, y sólo la del chip de un archivo adjunto (la pone el transform).
  allowedClasses: { a: ['mk-adjunto'] },
  allowedStyles: {
    span: { color: [COLOR], 'background-color': [COLOR] },
    mark: { 'background-color': [COLOR] },
    p: { 'text-align': [ALINEACION] },
    h2: { 'text-align': [ALINEACION] },
    h3: { 'text-align': [ALINEACION] },
    th: { 'text-align': [ALINEACION] },
    td: { 'text-align': [ALINEACION] },
  },
  // La segunda capa, después de `hrefSeguro`/`srcSeguro` (que corren en el transform): la del
  // propio sanitize-html. Si un día alguien afloja una de las dos, queda la otra.
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { a: ['http', 'https', 'mailto', 'mako-adjunto'], img: ['https', 'mako-adjunto'], iframe: ['https'] },
  allowedSchemesAppliedToAttributes: ['href', 'src', 'cite'],
  allowProtocolRelative: false,
  // Los hosts de un iframe: los de los `src` que arma lib/embeds.ts. Sin rutas relativas.
  allowedIframeHostnames: [...HOSTS_IFRAME],
  allowedIframeDomains: [...DOMINIOS_IFRAME],
  allowIframeRelativeUrls: false,
  // Lo que un iframe traiga ADENTRO (el texto «tu navegador no muestra iframes», o lo que alguien
  // escondió ahí) no es texto de nadie: el iframe se dibuja vacío.
  textFilter: (texto, tag) => (tag === 'iframe' ? '' : texto),
  // (`alt=""` vacío pasa por el default de sanitize-html, `allowedEmptyAttributes: ['alt']`, que los
  // tipos de @types/sanitize-html no declaran: por eso no se escribe acá.)
  disallowedTagsMode: 'discard',
  // Lo que se tira CON su contenido: el texto de un <script> o de un <svg> no es texto de nadie.
  nonTextTags: ['script', 'style', 'textarea', 'option', 'xmp', 'noscript', 'noembed', 'noframes', 'iframe', 'object', 'embed', 'svg', 'math', 'template', 'head', 'title', 'select', 'canvas', 'audio', 'video'],
  // Un anidamiento absurdo (un cuerpo armado para colgar el parser) se aplana.
  nestingLimit: 30,
  parseStyleAttributes: true,
  transformTags: {
    // Google Docs envuelve TODO el pegado en `<b style="font-weight:normal">`: pasarlo a strong
    // pondría en negrita la descripción entera.
    b: (_t, a) => ({ tagName: /font-weight\s*:\s*(?:normal|[1-4]00)\b/i.test(a.style ?? '') ? 'span' : 'strong', attribs: {} }),
    i: () => ({ tagName: 'em', attribs: {} }),
    strike: () => ({ tagName: 's', attribs: {} }),
    del: () => ({ tagName: 's', attribs: {} }),
    ins: () => ({ tagName: 'u', attribs: {} }),
    h1: (_t, a) => ({ tagName: 'h2', attribs: soloEstilo(a) }),
    h4: (_t, a) => ({ tagName: 'h3', attribs: soloEstilo(a) }),
    h5: (_t, a) => ({ tagName: 'h3', attribs: soloEstilo(a) }),
    h6: (_t, a) => ({ tagName: 'h3', attribs: soloEstilo(a) }),
    a: (_t, a) => {
      const out: Attrs = {};
      const href = hrefSeguro(a.href);
      if (href) {
        out.href = href;
        // Un link a un adjunto es el CHIP del archivo: la clase la pone el saneo, no el pedido.
        if (idDeRef(href)) out.class = 'mk-adjunto';
      }
      const title = textoCorto(a.title, 200);
      if (title) out.title = title;
      if (href) { out.target = '_blank'; out.rel = 'noopener noreferrer nofollow'; }
      return { tagName: 'a', attribs: out };
    },
    img: (_t, a) => {
      const out: Attrs = {};
      const src = srcSeguro(a.src);
      if (src) out.src = src;
      out.alt = textoCorto(a.alt, 300);
      const title = textoCorto(a.title, 200);
      if (title) out.title = title;
      const w = dimension(a.width), h = dimension(a.height);
      if (w) out.width = w;
      if (h) out.height = h;
      const ancho = anchoDeImagen(a['data-ancho']);
      if (ancho) out['data-ancho'] = String(ancho);
      const alinea = alineaDeImagen(a['data-alinea']);
      if (alinea) out['data-alinea'] = alinea;
      return { tagName: 'img', attribs: out };
    },
    td: (_t, a) => celda('td', a),
    th: (_t, a) => celda('th', a),
    iframe: (_t, a) => ({ tagName: 'iframe', attribs: iframeSeguro(a) }),
    ol: (_t, a) => {
      const s = (a.start ?? '').trim();
      const attribs: Attrs = /^\d{1,5}$/.test(s) && Number(s) !== 1 ? { start: String(Number(s)) } : {};
      return { tagName: 'ol', attribs };
    },
    ul: (_t, a) => {
      const attribs: Attrs = a['data-type'] === 'taskList' ? { 'data-type': 'taskList' } : {};
      return { tagName: 'ul', attribs };
    },
    li: (_t, a) => {
      const c = a['data-checked'];
      const attribs: Attrs = a['data-type'] === 'taskItem'
        ? { 'data-type': 'taskItem', 'data-checked': c === 'true' || c === '' ? 'true' : 'false' }
        : {};
      return { tagName: 'li', attribs };
    },
  },
  exclusiveFilter: (frame) => {
    const f = frame as unknown as Frame;
    const tag = f.name ?? f.tag;
    const attrs = Object.keys(f.attribs ?? {});
    // «Vacío» = sin texto Y sin una imagen adentro: un link o una negrita que envuelven sólo una
    // imagen no están vacíos, y sacarlos se llevaría la imagen.
    const vacio = !(f.text ?? '').trim() && !(f.mediaChildren ?? []).length;
    // Una imagen sin un `src` que pasó: no hay nada que mostrar. Un iframe tampoco, y se va CON lo de
    // adentro (`true`, no `'excludeTag'`).
    if (tag === 'img' || tag === 'iframe') return !f.attribs?.src;
    // Un link sin destino es texto: se saca la etiqueta y queda lo de adentro.
    if (tag === 'a') return !f.attribs?.href ? 'excludeTag' : vacio;
    // Un span sin estilo es ruido de Word/Docs; uno vacío no dibuja nada.
    if (tag === 'span') return vacio ? true : attrs.length ? false : 'excludeTag';
    if (tag === 'mark' || tag === 'strong' || tag === 'em' || tag === 'u' || tag === 's' || tag === 'code') return vacio;
    return false;
  },
};

/**
 * ¿Este HTML ya saneado no tiene NADA que mostrar? (sin texto, sin imagen, sin línea, sin nada
 * insertado). ⚠️ Una tarea que es SÓLO una agenda insertada tiene contenido: sin el `iframe` acá, el
 * saneo la vaciaba y la tarea quedaba sin descripción.
 */
function sinContenido(saneado: string): boolean {
  if (/<(img|hr|iframe)\b/.test(saneado)) return false;
  return !saneado.replace(/<[^>]*>/g, '').replace(/&nbsp;|\u00a0/g, ' ').trim();
}

/**
 * Sanea un HTML con la lista blanca. NUNCA TIRA: lo peor que devuelve es `''`.
 *
 * Es IDEMPOTENTE (`sanearHtml(sanearHtml(x)) === sanearHtml(x)`, lo fija el test): se puede
 * pasar al guardar y otra vez al mandar al navegador sin que el HTML cambie de una vuelta a otra.
 *
 * ⚠️ Lo que pasa de `TOPE_HTML_ENTRADA` se CORTA antes de parsear (una etiqueta partida al final
 *    sale como texto escapado, nunca como etiqueta). Para decirle a la persona que se pasó, el
 *    camino de guardar usa `validarHtmlRico`, que no corta: rechaza.
 */
export function sanearHtml(html: string | null | undefined): string {
  if (typeof html !== 'string' || !html.trim()) return '';
  const entrada = html.length > TOPE_HTML_ENTRADA ? html.slice(0, TOPE_HTML_ENTRADA) : html;
  let out: string;
  try {
    out = sanitizeHtml(entrada, OPCIONES).trim();
  } catch (e) {
    // sanitize-html no debería tirar; si tira, lo seguro es no dibujar nada.
    console.error('[html-seguro] el saneo tiró:', e instanceof Error ? e.message : e);
    return '';
  }
  return sinContenido(out) ? '' : out;
}

const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
function decodificar(s: string): string {
  return s.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]+|#39);/gi, (todo, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : todo;
    }
    return ENTIDADES[e.toLowerCase()] ?? todo;
  }).replace(/\u00a0/g, ' ');
}

/**
 * El TEXTO PLANO de un HTML rico: para la búsqueda, para la IA y para los mensajes (lo que se sigue
 * guardando en `curso_clases.descripcion`). Párrafos separados por una línea en blanco, ítems de
 * lista con «•» (o su número, o «[x]»/«[ ]» si es de tareas), el chip de un archivo como su nombre,
 * una tabla como un renglón por fila con las celdas separadas por « | ». Las imágenes no dejan
 * texto: una referencia no le sirve a nadie que lee.
 *
 * Sanea antes de leer, así que trabaja sobre la forma regular del saneo (sin comentarios, con el
 * `<` del texto escapado) y alcanza con un tokenizador de una expresión.
 */
export function textoDeHtml(html: string | null | undefined): string {
  const limpio = sanearHtml(html);
  if (!limpio) return '';
  let out = '';
  /** ¿Lo último que se escribió es la marca de un ítem? (el primer párrafo del ítem va pegado) */
  let recienMarca = false;
  const listas: Array<{ ordenada: boolean; n: number }> = [];
  /**
   * Las tablas abiertas (pueden anidarse): cuántas celdas lleva el renglón actual. Una tabla sale
   * como renglones con las celdas separadas por « | », y lo de adentro de una celda va en el mismo
   * renglón — un párrafo por celda partiría cada fila en tantos renglones como columnas.
   */
  const tablas: Array<{ celdas: number }> = [];
  /** ¿Lo último que se escribió es el principio de una celda? (su primer párrafo va pegado) */
  let recienCelda = false;
  /** Que lo escrito termine en `n` saltos de línea como mínimo (nunca al principio). */
  const salto = (n: number) => {
    out = out.replace(/[ \t]+$/, '');
    if (!out) return;
    const tiene = /\n*$/.exec(out)![0].length;
    if (tiene < n) out += '\n'.repeat(n - tiene);
  };
  const re = /<(\/?)([a-z0-9]+)([^>]*)>|([^<]+)/gi;
  for (const m of limpio.matchAll(re)) {
    if (m[4] != null) {
      const t = decodificar(m[4]);
      out += t;
      if (t.trim()) { recienMarca = false; recienCelda = false; }
      continue;
    }
    const cierra = m[1] === '/';
    const tag = m[2].toLowerCase();
    const attrs = m[3] ?? '';
    if (tag === 'br') { out += tablas.length ? ' ' : '\n'; continue; }
    if (tag === 'hr') { salto(2); continue; }
    // Lo insertado deja su DIRECCIÓN: es lo único que le sirve a quien lee el texto plano (la IA, un
    // mensaje), y una tarea que es sólo una agenda tiene que seguir teniendo texto (`tieneTarea`).
    if (tag === 'iframe') {
      const src = cierra ? null : /\ssrc="([^"]*)"/.exec(attrs);
      if (src) {
        if (tablas.length) out += (recienCelda ? '' : ' ') + decodificar(src[1]);
        else { salto(listas.length ? 1 : 2); out += decodificar(src[1]); }
        recienMarca = false; recienCelda = false;
      }
      continue;
    }
    if (tag === 'table') {
      if (cierra) { tablas.pop(); if (!tablas.length) salto(2); continue; }
      if (tablas.length) { if (!recienCelda) out += ' '; } else salto(2);
      tablas.push({ celdas: 0 });
      continue;
    }
    if (tag === 'tr') {
      const t = tablas[tablas.length - 1];
      if (!cierra && t) { if (tablas.length === 1) salto(1); t.celdas = 0; }
      continue;
    }
    if (tag === 'td' || tag === 'th') {
      const t = tablas[tablas.length - 1];
      if (!cierra && t) { if (t.celdas++ > 0) out += ' | '; recienCelda = true; }
      continue;
    }
    if (tag === 'ul' || tag === 'ol') {
      if (cierra) { listas.pop(); continue; }
      const start = /\sstart="(\d+)"/.exec(attrs);
      salto(listas.length ? 1 : 2);
      listas.push({ ordenada: tag === 'ol', n: start ? Number(start[1]) : 1 });
      continue;
    }
    if (tag === 'li') {
      if (cierra) continue;
      const l = listas[listas.length - 1];
      let marca = '• ';
      if (/\sdata-type="taskItem"/.test(attrs)) marca = /\sdata-checked="true"/.test(attrs) ? '[x] ' : '[ ] ';
      else if (l?.ordenada) marca = `${l.n++}. `;
      salto(1);
      out += '  '.repeat(Math.max(0, listas.length - 1)) + marca;
      recienMarca = true;
      continue;
    }
    if (!cierra && (tag === 'p' || tag === 'h2' || tag === 'h3' || tag === 'blockquote' || tag === 'pre')) {
      if (tablas.length) { if (!recienCelda) out += ' '; recienCelda = true; continue; }
      if (listas.length) { if (!recienMarca) salto(1); } else salto(2);
    }
  }
  return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Lo que usa el camino de GUARDAR una descripción: sanea, controla el largo y deriva el texto plano.
 * A diferencia de `sanearHtml`, acá pasarse NO se corta en silencio: se rechaza con un error corto,
 * que la pantalla dibuja tal cual.
 */
export function validarHtmlRico(html: unknown): { ok: true; html: string; texto: string } | { ok: false; error: string } {
  if (html == null || html === '') return { ok: true, html: '', texto: '' };
  if (typeof html !== 'string') return { ok: false, error: 'La descripción no llegó bien.' };
  if (html.length > TOPE_HTML_ENTRADA) return { ok: false, error: 'La descripción es demasiado larga.' };
  const saneado = sanearHtml(html);
  if (saneado.length > TOPE_HTML) return { ok: false, error: 'La descripción es demasiado larga.' };
  return { ok: true, html: saneado, texto: textoDeHtml(saneado) };
}
