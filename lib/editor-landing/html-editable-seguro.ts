import 'server-only';

// =============================================================================
// editor-landing/html-editable-seguro — el saneo del «Diseño editable» (lo decide el SERVER)
// =============================================================================
// El bloque `htmlEditable` (html-editable.ts) se publica EN LA PÁGINA, sin iframe: lo que pase acá llega
// tal cual al HTML de hola-mako.site (y, para las landings de MaKo, al de hola-mako.com). Por eso este
// saneo es la primera capa y la política de la página publicada (pagina-publica.ts: scripts sólo por hash)
// la segunda. En el editor y en las miniaturas el bloque va en un iframe sin scripts ni mismo origen.
//
// LISTA BLANCA (como lib/html-seguro.ts, pero para MAQUETA y no para texto rico): pasan las etiquetas de
// un diseño (cajas, texto, listas, tablas, imágenes, video, canvas, SVG en línea, botones) con `class`,
// `id`, `style`, `data-*` y `aria-*`. Lo que nunca pasa: script, style, link, meta, base, form, input,
// object, embed, template, on*, `javascript:`, `srcdoc`, comentarios. Un `<iframe>` pasa SÓLO si su
// `src` es de un proveedor de lib/embeds.ts (el VSL de Panda, una agenda) y se queda con SU src (con sus
// parámetros: el color del reproductor de la landing de MaKo es uno) y sus atributos de forma.
//
// ⚠️ SERVER-ONLY: sanitize-html arrastra postcss y htmlparser2. El navegador sólo DIBUJA.
// =============================================================================

import sanitizeHtml from 'sanitize-html';
import { embedDe } from '../embeds';
import { NODO, TOPES, type JsonNodo, type LandingContenido } from './doc';
import { envoltoriosValidos, medioPermitido } from './html-editable';

const ETIQUETAS = [
  // cajas y texto
  'div', 'section', 'header', 'footer', 'nav', 'main', 'article', 'aside', 'figure', 'figcaption', 'span', 'p', 'a',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'em', 'i', 'u', 's', 'small', 'mark', 'sub', 'sup', 'br', 'hr',
  'blockquote', 'code', 'pre', 'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'details', 'summary', 'dialog', 'abbr', 'time', 'label',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
  // medios
  'img', 'picture', 'source', 'video', 'canvas', 'iframe', 'button',
  // SVG en línea (los íconos del diseño)
  'svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'defs', 'lineargradient',
  'radialgradient', 'stop', 'clippath', 'mask', 'title', 'desc', 'text', 'tspan',
];

const SVG_ATTRS = [
  'viewbox', 'viewBox', 'xmlns', 'fill', 'fill-rule', 'fill-opacity', 'clip-rule', 'clip-path', 'stroke', 'stroke-width',
  'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-opacity', 'opacity', 'd', 'cx', 'cy',
  'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'points', 'transform', 'width', 'height', 'offset', 'stop-color',
  'stop-opacity', 'gradientunits', 'gradientUnits', 'gradienttransform', 'gradientTransform', 'preserveaspectratio',
  'preserveAspectRatio', 'mask', 'text-anchor', 'dominant-baseline', 'font-size', 'font-weight', 'font-family', 'letter-spacing',
];

const COMUNES = ['class', 'id', 'style', 'title', 'role', 'hidden', 'popover', 'tabindex', 'lang', 'dir', 'data-*', 'aria-*'];

// `allowedEmptyAttributes` existe en sanitize-html 2.18 (lo usa: medido), pero sus tipos todavía no lo declaran.
const OPCIONES: sanitizeHtml.IOptions & { allowedEmptyAttributes?: string[] } = {
  allowedTags: ETIQUETAS,
  allowedAttributes: {
    '*': COMUNES,
    a: ['href', 'target', 'rel'],
    img: ['src', 'srcset', 'sizes', 'alt', 'width', 'height', 'loading', 'decoding'],
    source: ['src', 'srcset', 'type', 'media', 'sizes'],
    video: ['src', 'poster', 'autoplay', 'muted', 'loop', 'playsinline', 'preload', 'controls', 'width', 'height'],
    canvas: ['width', 'height'],
    iframe: ['src', 'allow', 'allowfullscreen', 'loading', 'referrerpolicy', 'frameborder', 'width', 'height', 'name'],
    button: ['type', 'disabled'],
    td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan', 'scope'], col: ['span'], colgroup: ['span'],
    time: ['datetime'], details: ['open'], dialog: ['open'],
    svg: SVG_ATTRS, g: SVG_ATTRS, path: SVG_ATTRS, circle: SVG_ATTRS, ellipse: SVG_ATTRS, rect: SVG_ATTRS, line: SVG_ATTRS,
    polyline: SVG_ATTRS, polygon: SVG_ATTRS, defs: SVG_ATTRS, lineargradient: SVG_ATTRS, radialgradient: SVG_ATTRS,
    stop: SVG_ATTRS, clippath: SVG_ATTRS, mask: SVG_ATTRS, text: SVG_ATTRS, tspan: SVG_ATTRS,
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  // `pagina:<id>` (26/10/2026): «a otra página» del selector de destino, como en un botón de bloque. Se traduce a la
  // dirección de esa página al publicar (`conEnlacesDePaginas`, html-editable.ts); el id se valida abajo.
  allowedSchemesByTag: { a: ['http', 'https', 'mailto', 'tel', 'pagina'], img: ['https', 'data'], source: ['https'], video: ['https'], iframe: ['https'] },
  allowedSchemesAppliedToAttributes: ['href', 'src', 'poster', 'srcset'],
  allowProtocolRelative: false,
  // VACÍOS que valen (28/10/2026): sanitize-html borra por defecto un `hidden=""` o un `popover=""` (los tiene por no
  // booleanos), y lo que la página escondía aparecía en la copia (el menú de idiomas de respond.io, abierto).
  allowedEmptyAttributes: ['alt', 'hidden', 'popover', 'open'],
  // Comentarios y el texto de lo que no pasa (un <script>) se van; el de una etiqueta desconocida queda.
  disallowedTagsMode: 'discard',
  nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript', 'template'],
  parser: { lowerCaseAttributeNames: false },
  exclusiveFilter: (frame) => frame.tag === 'iframe' && !iframePermitido(frame.attribs.src),
  transformTags: {
    a: (tag, attribs) => {
      const a = { ...attribs };
      // Un `pagina:` que no es un id de página no pasa (queda el enlace sin destino).
      if (typeof a.href === 'string' && /^\s*pagina:/i.test(a.href) && !RE_PAGINA.test(a.href.trim())) delete a.href;
      if (a.target === '_blank') a.rel = 'noopener noreferrer';
      return { tagName: tag, attribs: a };
    },
    // LO QUE ESCRIBE CHROME (26/10/2026): el tachado de `execCommand` sin `styleWithCSS` es un `<strike>` (y un pegado
    // puede traer `<del>` o `<font color>`). No están en la lista: con `discard` se iba la etiqueta y el formato se
    // perdía al guardar, sin aviso. Pasan a sus equivalentes de la lista.
    strike: 's',
    del: 's',
    font: (_tag, attribs) => {
      const a: sanitizeHtml.Attributes = {};
      if (/^#[0-9a-f]{3,8}$|^[a-z]{3,20}$/i.test(attribs.color ?? '')) a.style = `color:${attribs.color}`;
      return { tagName: 'span', attribs: a };
    },
  },
};

/** Un enlace a otra página del sitio (el `pagina:<id>` del selector de destino). */
const RE_PAGINA = /^pagina:[A-Za-z0-9_-]{1,60}$/;

/** ¿El `src` de un iframe es de un proveedor permitido (lib/embeds.ts)? Se queda con SU src, completo. */
function iframePermitido(src: unknown): boolean {
  if (typeof src !== 'string' || !/^https:\/\//i.test(src)) return false;
  try {
    const host = new URL(src).hostname.toLowerCase();
    const e = embedDe(src);
    return !!e && new URL(e.src).hostname.toLowerCase() === host;
  } catch {
    return false;
  }
}

const desescapar = (v: string) => v.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&');

/** Saca de un estilo los `url()` que no son un medio permitido (quedan `url()`, que no carga nada). */
function estiloSeguro(estilo: string): string {
  return estilo.replace(/url\(\s*(["']?)(.*?)\1\s*\)/gi, (todo: string, _c: string, url: string) => (medioPermitido(url) ? todo : 'url()'));
}

/** La segunda pasada sobre lo que dejó sanitize-html: los medios y los url() de los estilos (ver `medioPermitido`). */
function endurecer(html: string): string {
  return html
    .replace(/\s(src|poster)="([^"]*)"/g, (todo: string, _a: string, v: string) => (medioPermitido(desescapar(v)) ? todo : ''))
    .replace(/\ssrcset="([^"]*)"/g, (todo: string, v: string) => (desescapar(v).split(',').every((c) => medioPermitido(c.trim().split(/\s+/)[0] ?? '')) ? todo : ''))
    .replace(/\sstyle="([^"]*)"/g, (_t: string, v: string) => ` style="${estiloSeguro(desescapar(v)).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`);
}

/** El HTML de una sección de diseño, saneado. Pasado el tope (`TOPES.htmlEditable`), vacío. */
export function sanearHtmlEditable(html: unknown): string {
  if (typeof html !== 'string' || !html.trim() || html.length > TOPES.htmlEditable) return '';
  return endurecer(sanitizeHtml(html, OPCIONES)).trim();
}

/**
 * Los envoltorios de una copia (copia-identica.ts), saneados con la MISMA lista que el HTML: cada etiqueta pasa por
 * sanitize-html con su cierre y queda su apertura. Si una no pasa, ninguna (una pila a medias cambia la página). null si no hay.
 */
export function sanearEnvoltorios(raw: unknown): string[] | null {
  const env = envoltoriosValidos(raw);
  if (!env) return null;
  const out: string[] = [];
  for (const e of env) {
    const tag = (/^<([a-z][a-z0-9]*)/i.exec(e)?.[1] ?? '').toLowerCase();
    const limpio = endurecer(sanitizeHtml(`${e}</${tag}>`, OPCIONES)).trim();
    const m = new RegExp(`^<${tag}\\b[^<>]*>`, 'i').exec(limpio);
    if (!tag || !m) return null;
    out.push(m[0]);
  }
  return out;
}

/** El contenido con cada «Diseño editable» saneado (no muta: devuelve otro). */
export function sanearEditablesDe(c: LandingContenido): LandingContenido {
  const nodo = (n: JsonNodo): JsonNodo => {
    if (n.type === NODO.htmlEditable) {
      const { envoltorios: _crudos, ...resto } = (n.attrs ?? {}) as Record<string, unknown>;
      const envoltorios = sanearEnvoltorios(_crudos);
      return { ...n, attrs: { ...resto, html: sanearHtmlEditable(n.attrs?.html), ...(envoltorios ? { envoltorios } : {}) } };
    }
    return n.content ? { ...n, content: n.content.map(nodo) } : n;
  };
  return { ...c, paginas: c.paginas.map((p) => ({ ...p, doc: { ...p.doc, content: p.doc.content.map(nodo) } })) };
}
