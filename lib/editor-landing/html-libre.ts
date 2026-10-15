// =============================================================================
// editor-landing/html-libre — el «HTML personalizado» servido desde SU PROPIA URL (tanda 2, T6)
// =============================================================================
// Pedido de Martín (11/10/2026, tanda 2, punto 9): «Si se tiene que poder editar libremente con
// "HTML personalizado", esto permitirá copiar otras landing...». Decisión T6 en
// docs/diseno-editor-landing.md: el bloque `htmlLibre` lleva HTML, CSS y JS propios; en la página
// publicada se sirve desde `/l/html/<docId>/<idBloque>` (app/l/html/[docId]/[bloque]/route.ts) con
// `Content-Security-Policy: sandbox …` —un origen OPACO: no ve la sesión de hola-mako.com— y el iframe
// se ajusta al alto que el contenido le manda por `postMessage`.
//
// Por qué una URL propia y no el `srcdoc` de siempre: un `<iframe srcdoc>` HEREDA la política de la
// página que lo contiene (el sandbox aísla el ORIGEN, no la política), y la página publicada tiene una
// política estricta (sólo sus scripts, por hash: pagina-publica.ts). Con `srcdoc`, el JavaScript del
// bloque no corría en la publicada (docs/hallazgos-editor-landing.md). Una URL propia trae su propio
// header.
//
// Lo que vive acá, PURO y apto para el navegador (lo importan render.ts —que corre también en el
// editor—, el NodeView del editor, la ruta y next.config.ts):
//   · la política y las cabeceras del bloque servido (`CSP_HTML_LIBRE`, `CABECERAS_HTML_LIBRE`);
//   · la URL de un bloque (`urlBloqueHtmlLibre`);
//   · el documento que se sirve (y que el editor pone en su `srcdoc`): el HTML de la persona + un
//     script chico que mide el alto y se lo manda al padre (`documentoHtmlLibre`, `SCRIPT_ALTO`);
//   · cómo el padre lee ese mensaje (`altoDeMensaje`, mismos topes que el script de la página);
//   · de dónde sale el HTML de un bloque (la foto publicada o el borrador) y la respuesta de la ruta.
//
// ⚠️ SIN IMPORTS DE NODE (ni `node:crypto`): render.ts lo importa y render.ts corre en el navegador
//    (miniaturas, Presentar). El ETag sale de un hash propio en JS.
// ⚠️ next.config.ts importa `CABECERAS_HTML_LIBRE` de acá: este módulo sólo puede importar
//    `./doc` (que no importa nada). Un import más pesado entra al arranque de Next.
// =============================================================================

import { NODO, type JsonNodo, type LandingContenido } from './doc';

// ─────────────────────────────────────────────────────────────────────────────
// La política del bloque servido
// ─────────────────────────────────────────────────────────────────────────────

/** El prefijo de la ruta: `/l/html/<docId>/<idBloque>`. */
export const PREFIJO_HTML_LIBRE = '/l/html';

/**
 * Lo que puede el bloque en la página publicada: correr scripts, mandar formularios y abrir
 * ventanas. SIN `allow-same-origin` (origen opaco: ni cookies ni `localStorage` de hola-mako.com) y
 * SIN `allow-top-navigation` (no puede llevarse la pestaña). Va igual en el atributo del iframe y en
 * la política del documento servido: el documento queda aislado aunque alguien lo abra suelto.
 */
export const SANDBOX_PUBLICO = 'allow-scripts allow-forms allow-popups';
/** En el editor, la vista en vivo sólo corre scripts (nada de formularios ni ventanas al editar). */
export const SANDBOX_EDITOR = 'allow-scripts';

/**
 * La política del documento servido. `sandbox` lo vuelve un origen opaco; `default-src *` con
 * `data:`, `blob:`, `'unsafe-inline'` y `'unsafe-eval'` deja cargar lo que traiga el HTML copiado
 * (sus fuentes, sus imágenes, sus scripts): adentro del sandbox no toca nada nuestro.
 * `frame-ancestors 'self'`: sólo se deja enmarcar por una página del MISMO host (la publicada).
 */
export const CSP_HTML_LIBRE =
  `sandbox ${SANDBOX_PUBLICO}; default-src * data: blob: 'unsafe-inline' 'unsafe-eval'; frame-ancestors 'self'`;

/**
 * Las cabeceras que next.config.ts tiene que poner en `/l/html/:path*`, en un bloque DESPUÉS del
 * global. Next 16 descarta el header que pone una ruta si next.config ya puso el mismo
 * (send-response.js: «only append the header if it is either not present»), y el global manda
 * `X-Frame-Options: DENY` y `frame-ancestors 'none'`: sin este bloque el iframe no carga. Dos
 * bloques que matchean la misma ruta con la misma clave: gana el ÚLTIMO (docs de Next, «Header
 * Overriding Behavior»).
 */
export const CABECERAS_HTML_LIBRE: ReadonlyArray<{ key: string; value: string }> = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Content-Security-Policy', value: CSP_HTML_LIBRE },
];

// ─────────────────────────────────────────────────────────────────────────────
// Formas
// ─────────────────────────────────────────────────────────────────────────────

/** Id de fila: entero positivo, como lo escribe la base (sin ceros adelante). */
export const RE_DOC_ID = /^[1-9][0-9]{0,14}$/;
/** Id de bloque: la misma forma que el de una sección (`RE_ID` de especificacion.ts). */
export const RE_ID_BLOQUE = /^[A-Za-z0-9_-]{1,60}$/;
/** El token del link privado del borrador: 32 bytes en base64url (`vistaTokenValido`, server-reglas.ts). */
export const RE_TOKEN_VISTA = /^[A-Za-z0-9_-]{43}$/;

/**
 * La URL (relativa al host) de un bloque: la publicada, o la del borrador si viene el token del link
 * privado (`?vista=<token>`). RELATIVA a propósito: así sirve en hola-mako.site (tanda 4), en el
 * dominio propio del cliente (T7) y en local — en todos, el iframe pide al mismo host que la página
 * (y `frame-ancestors 'self'` exige justo eso). null si algo no tiene la forma: el render cae
 * entonces al `srcdoc` de siempre.
 */
export function urlBloqueHtmlLibre(docId: unknown, idBloque: unknown, vista?: string | null): string | null {
  const doc = typeof docId === 'number' ? String(docId) : docId;
  if (typeof doc !== 'string' || !RE_DOC_ID.test(doc)) return null;
  if (typeof idBloque !== 'string' || !RE_ID_BLOQUE.test(idBloque)) return null;
  if (vista != null && !RE_TOKEN_VISTA.test(vista)) return null;
  return `${PREFIJO_HTML_LIBRE}/${doc}/${idBloque}${vista ? `?vista=${vista}` : ''}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lo que MaKo no sirve: un formulario de contraseña
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ¿Este HTML pide una CONTRASEÑA? Un `<input type=password>`, o el script que lo arma
 * (`.type = 'password'`, `setAttribute('type', 'password')`).
 *
 * Revisión de la tanda 2 (12/10/2026, MEDIA): el HTML libre corre con `allow-forms allow-popups` y la
 * «Copia fiel» copia cualquier página tal cual, así que se podía publicar el login copiado de un banco
 * en `hola-mako.com/l/<slug>`. El origen opaco protege la SESIÓN de MaKo, pero la barra del navegador
 * dice hola-mako.com, y si Google Safe Browsing marca esa página puede marcar el dominio ENTERO de la
 * app. Una landing de un cliente no tiene por qué pedir una contraseña, así que no se copia
 * (`copiaFiel`), no se publica (`publicar`) y no se sirve (`responderHtmlLibre`: la ruta por la que
 * pasan la publicada y el link de la vista previa, que también se puede compartir). En el editor sigue
 * viéndose (srcdoc, detrás de la sesión y sin `allow-forms`): ahí es donde se arregla.
 *
 * ⚠️ ES UN FRENO, NO UNA BARRERA: un script puede armar la palabra por partes, o disfrazar un campo de
 * texto. Lo de fondo era servir el contenido de los clientes desde un dominio aparte (como
 * `githubusercontent`): hecho en la tanda 4 (14/10/2026) — la landing y su /l/html viven en
 * hola-mako.site (o en el dominio del cliente), y en producción hola-mako.com ya no sirve /l/html
 * (proxy.ts, `decidirLEnApp`). El freno se queda: una página que pide contraseñas igual puede hacer
 * que Safe Browsing marque hola-mako.site, que es donde viven TODAS las landings.
 */
const RE_PIDE_CONTRASENA = /type\s*[=:]\s*["'`]?\s*password\b|setAttribute\s*\(\s*["'`]type["'`]\s*,\s*["'`]password\b/i;
export function pideContrasena(html: unknown): boolean {
  return typeof html === 'string' && RE_PIDE_CONTRASENA.test(html);
}

/** El texto que se dibuja cuando MaKo no copia, no publica o no muestra un bloque así. */
export const TEXTO_PIDE_CONTRASENA = 'MaKo no muestra formularios que piden una contraseña.';

// ─────────────────────────────────────────────────────────────────────────────
// El alto: el script de adentro y lo que lee el padre
// ─────────────────────────────────────────────────────────────────────────────

/** El tipo del mensaje que manda el bloque. */
export const MENSAJE_ALTO = 'gm-html-alto';
/** Un bloque vacío no puede quedar en 0 (sería invisible), ni uno con `height: 120vh` crecer sin fin. */
export const ALTO_MIN = 24;
export const ALTO_MAX = 20_000;

/**
 * El alto que trae un mensaje, ya topeado, o null si no es un mensaje del bloque. Lo usa el NodeView
 * del editor; el script de la página publicada (pagina-publica.ts, `SCRIPT_PAGINA`) aplica la MISMA
 * regla en su texto (un string que se sirve no puede importar): el test corre los dos con las mismas
 * entradas.
 */
export function altoDeMensaje(data: unknown): number | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (d.tipo !== MENSAJE_ALTO) return null;
  const n = Math.round(Number(d.alto));
  if (!Number.isFinite(n)) return null;
  return Math.min(ALTO_MAX, Math.max(ALTO_MIN, n));
}

/**
 * El script que mide el documento y le manda el alto al padre. Corre ADENTRO del sandbox (origen
 * opaco), así que el destino es `'*'`: el mensaje sólo lleva un número, y el padre lo acepta
 * únicamente si `ev.source` es la ventana de uno de sus iframes.
 *
 * Mide `documentElement` (su caja, no su `scrollHeight`: ése nunca baja del alto del iframe, y un
 * bloque que se achica no lo diría nunca) y el `scrollHeight` del body. Vuelve a medir con un
 * ResizeObserver, al cargar (imágenes y fuentes), cuando cambia la vista (`resize`) y en tres
 * tiempos fijos.
 *
 * ⚠️ El freno: un contenido con `height: 120vh` crece cada vez que el iframe crece. Más de 25
 *    avisos en 3 segundos y deja de avisar (el padre además topea en ALTO_MAX).
 * ⚠️ Es un string que se sirve: sin backticks, sin `${`, y sin la etiqueta que lo cierra.
 *
 * Una página armada como APP (pendiente de la tanda 2: la copia fiel quedaba en 400 px por sección):
 * `html` y `body` al 100% y el contenido adentro de un contenedor con scroll propio (`overflow-y: auto`).
 * Ahí `documentElement` y el body miden lo mismo que el iframe, y el bloque no crecía nunca. Cuando el
 * documento entra justo en la vista, `interno()` busca ese contenedor (un descendiente que desborda con
 * scroll vertical y ocupa al menos la mitad de la vista) y suma a la medida lo que ese contenedor esconde
 * (`scrollHeight − clientHeight`). No «su borde de arriba + su scrollHeight»: eso dejaba afuera lo que va
 * DEBAJO del contenedor (un pie de 50 px quedaba con scroll, medido). Al crecer el iframe, el contenedor
 * (alto del 100%) crece con él y deja de desbordar: la medida de siempre da lo mismo y no hay otro aviso.
 * ⚠️ Una caja de alto FIJO con scroll (un chat, unos términos) también desborda, pero no crece con el
 *    iframe. En una página que ya es más alta que la vista no se mira (la medida de siempre manda), y
 *    al bloque ya ajustado la caja no le llega a la mitad. Si igual se la midió (un bloque que es casi
 *    sólo esa caja) y después de crecer la vista sigue con el mismo alto, se marca (`__gmFijo`) y no se
 *    vuelve a mirar: el bloque vuelve a su alto en el aviso siguiente. Un textarea o un select tienen
 *    su propio scroll: no cuentan. Por eso se escucha también `resize`: con un documento de alto
 *    automático, que el iframe crezca no le cambia la caja a nadie y el ResizeObserver no avisa.
 * ⚠️ El contenido que CRECE CON LA VISTA (verificación de la tanda 6: un hero `min-height: 100vh` adentro
 *    del contenedor de la app). Lo que esconde el contenedor no baja nunca: al crecer el iframe crece el
 *    hero, y cada aviso sumaba otra vez lo mismo (medido en Chromium: 400 → 8.200 en 5 avisos; en el
 *    arnés del test, hasta ALTO_MAX). Por eso se guarda también lo escondido (`__gmOculto`): si la vista
 *    creció y lo escondido no bajó al menos la mitad de lo que creció la vista, el contenido crece con
 *    ella, y la caja se marca (`__gmFijo`). El bloque queda en la primera medida (la barra, un hero del
 *    alto de la vista de antes y el resto), con su scroll adentro para lo que sobra: acotado.
 */
export const SCRIPT_ALTO = [
  '(function () {',
  '  var w = window, d = document, ultimo = 0, n = 0, t0 = Date.now(), parado = false;',
  '  function interno(vista, h) {',
  '    var b = d.body, todos, i, el, oy, oculto, bajo, alto = 0;',
  "    if (!b || !b.getElementsByTagName || typeof w.getComputedStyle !== 'function') return 0;",
  "    todos = b.getElementsByTagName('*');",
  '    for (i = 0; i < todos.length && i < 4000; i++) {',
  '      el = todos[i];',
  '      if (el.__gmFijo || !(el.clientHeight > 0) || !(el.scrollHeight > el.clientHeight + 1)) continue;',
  "      if (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') continue;",
  '      oy = (w.getComputedStyle(el) || {}).overflowY;',
  "      if (oy !== 'auto' && oy !== 'scroll') continue;",
  '      oculto = el.scrollHeight - el.clientHeight;',
  '      if (el.__gmVista && vista > el.__gmVista + 1 && (el.clientHeight <= el.__gmAlto + 1 || (el.__gmOculto - oculto) * 2 < vista - el.__gmVista)) { el.__gmFijo = true; continue; }',
  '      if (el.clientHeight * 2 < vista) continue;',
  '      el.__gmVista = vista; el.__gmAlto = el.clientHeight; el.__gmOculto = oculto;',
  '      bajo = h + oculto;',
  '      if (bajo > alto) alto = bajo;',
  '    }',
  '    return alto;',
  '  }',
  '  function medir() {',
  '    var h = 0, de = d.documentElement, b = d.body, vista = w.innerHeight || 0;',
  '    if (de && de.getBoundingClientRect) h = de.getBoundingClientRect().height;',
  '    if (b) h = Math.max(h, b.scrollHeight || 0, b.offsetHeight || 0);',
  '    if (vista && h <= vista + 1) { try { h = Math.max(h, interno(vista, h)); } catch (e) {} }',
  '    return Math.ceil(h);',
  '  }',
  '  function avisar() {',
  '    if (parado) return;',
  '    var h = medir();',
  '    if (!h || Math.abs(h - ultimo) < 2) return;',
  '    var ahora = Date.now();',
  '    if (ahora - t0 > 3000) { t0 = ahora; n = 0; }',
  '    if (++n > 25) { parado = true; return; }',
  '    ultimo = h;',
  "    try { w.parent.postMessage({ tipo: '" + MENSAJE_ALTO + "', alto: h }, '*'); } catch (e) {}",
  '  }',
  '  try {',
  "    if (typeof w.ResizeObserver === 'function') {",
  '      var ro = new w.ResizeObserver(avisar);',
  '      if (d.documentElement) ro.observe(d.documentElement);',
  '      if (d.body) ro.observe(d.body);',
  '    }',
  '  } catch (e) {}',
  "  w.addEventListener('load', avisar);",
  "  w.addEventListener('resize', avisar);",
  "  d.addEventListener('DOMContentLoaded', avisar);",
  '  w.setTimeout(avisar, 60); w.setTimeout(avisar, 600); w.setTimeout(avisar, 2500);',
  '  avisar();',
  '})();',
].join('\n');

const TIENE_DOCTYPE = /^\s*(?:<!--[\s\S]*?-->\s*)*<!doctype/i;
const TIENE_BASE_CON_TARGET = /<base\b[^>]*\btarget\s*=/i;

/**
 * El documento que se sirve (y que el editor pone en su `srcdoc`): el HTML de la persona TAL CUAL,
 * con tres agregados:
 *   · `<!doctype html>` adelante si no lo trae (sin él, el documento servido entraría en modo
 *     «quirks» y se vería distinto que en el `srcdoc` del editor, que nunca es quirks);
 *   · `<base target="_blank">` si no hay un `<base>` con destino: un enlace del bloque abre una
 *     pestaña en vez de navegar adentro del recuadro (el bloque no puede llevarse la pestaña);
 *   · el script del alto, AL FINAL (antes del doctype pondría el documento en quirks; después de
 *     `</html>` el navegador lo muda al body, y corre igual).
 */
export function documentoHtmlLibre(html: string): string {
  const fuente = typeof html === 'string' ? html.replace(/\u0000/g, '') : '';
  const doctype = TIENE_DOCTYPE.test(fuente) ? '' : '<!doctype html>\n';
  const base = TIENE_BASE_CON_TARGET.test(fuente) ? '' : '\n<base target="_blank">';
  return `${doctype}${fuente}${base}\n<script>${SCRIPT_ALTO.replace(/<\/script/gi, '<\\/script')}</script>\n`;
}

// ─────────────────────────────────────────────────────────────────────────────
// De dónde sale el HTML de un bloque
// ─────────────────────────────────────────────────────────────────────────────

const esObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Recorre los htmlLibre de una lista de nodos (sin entrar a las secciones ocultas). */
function cadaHtmlLibre(nodos: unknown, fn: (id: string, html: string) => void, prof = 0): void {
  if (!Array.isArray(nodos) || prof > 40) return;
  for (const n of nodos) {
    if (!esObj(n)) continue;
    if (n.type === NODO.tarjeta && esObj(n.attrs) && n.attrs.oculta === true) continue;
    if (n.type === NODO.htmlLibre) {
      const a = esObj(n.attrs) ? n.attrs : {};
      if (typeof a.id === 'string' && RE_ID_BLOQUE.test(a.id) && typeof a.html === 'string' && a.html) fn(a.id, a.html);
      continue;
    }
    cadaHtmlLibre(n.content, fn, prof + 1);
  }
}

/**
 * `{ idBloque: html }` de las páginas de una landing YA SANEADA (validar.ts le pone el id a cada
 * bloque). Es lo que la foto publicada guarda en `publicado.htmlLibre`: la ruta sirve la versión
 * PUBLICADA del bloque, nunca el borrador (AGENTS.md, «publicar promueve lo GUARDADO»).
 */
export function fuentesHtmlLibre(paginas: ReadonlyArray<{ doc?: { content?: JsonNodo[] } }>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of paginas ?? []) cadaHtmlLibre(p?.doc?.content, (id, html) => { if (!(id in out)) out[id] = html; });
  return out;
}

/** El HTML de un bloque en una landing YA SANEADA (el borrador por el link privado), o null. */
export function htmlDeBloque(contenido: LandingContenido, idBloque: string): string | null {
  let hallado: string | null = null;
  for (const p of contenido?.paginas ?? []) {
    cadaHtmlLibre(p?.doc?.content, (id, html) => { if (hallado === null && id === idBloque) hallado = html; });
    if (hallado !== null) break;
  }
  return hallado;
}

/** El HTML de un bloque en la foto publicada (`landing_docs.publicado.htmlLibre`), o null. */
export function htmlLibreDeFoto(publicado: unknown, idBloque: string): string | null {
  if (!esObj(publicado) || !esObj(publicado.htmlLibre)) return null;
  const h = publicado.htmlLibre[idBloque];
  return typeof h === 'string' && h ? h : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// La respuesta de la ruta (la decisión entera, con test; la ruta sólo enchufa la lectura)
// ─────────────────────────────────────────────────────────────────────────────

export type PedidoHtmlLibre = { docId: string; bloque: string; vista: string | null };

export type DepHtmlLibre = {
  /** El HTML del bloque. null = no existe, no está publicado o el token no es de esa landing. Tira = la base falló. */
  leer: () => Promise<string | null>;
};

/**
 * El publicado: el navegador guarda y pregunta cada vez (con el ETag igual, 304). `private` y no
 * `public`: la respuesta depende de `Sec-Fetch-Dest` (ver `responderHtmlLibre`), y un caché
 * compartido que la guardara para un iframe se la podría servir a una pestaña. El borrador: ni en disco.
 */
export const CACHE_HTML_LIBRE = 'private, no-cache';
export const CACHE_HTML_LIBRE_VISTA = 'private, no-store';

/** Hash de 53 bits (cyrb53) en JS: alcanza para un ETag y no arrastra `node:crypto` al navegador. */
function hash53(s: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export function etagHtmlLibre(doc: string): string {
  return `"h${hash53(doc)}-${doc.length.toString(36)}"`;
}

function coincide(ifNoneMatch: string | null, etag: string): boolean {
  if (!ifNoneMatch) return false;
  return ifNoneMatch.split(',').some((t) => { const v = t.trim(); return v === '*' || v === etag || v === `W/${etag}`; });
}

function noHay(status: 403 | 404 | 451 | 503, sinCuerpo: boolean): Response {
  const headers: Record<string, string> = {
    'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow',
    'Content-Security-Policy': CSP_HTML_LIBRE, Vary: 'Sec-Fetch-Dest',
  };
  if (status === 503) headers['Retry-After'] = '30';
  const texto = status === 404 ? 'No existe' : status === 403 ? 'Sólo dentro de su página' : status === 451 ? TEXTO_PIDE_CONTRASENA : 'No disponible';
  return new Response(sinCuerpo ? null : texto, { status, headers });
}

/**
 * ¿Lo pide un IFRAME? El navegador lo dice en `Sec-Fetch-Dest` y una página no lo puede falsear.
 *
 * ⚠️ ES LA GUARDA QUE NO DEPENDE DE NADIE MÁS. El documento es HTML de un cliente servido desde
 *    hola-mako.com: abierto como PESTAÑA, sin la política `sandbox` (Next la descarta si next.config
 *    ya puso otra: ver `CABECERAS_HTML_LIBRE`), correría con el origen de MaKo — con la sesión de quien
 *    lo abra, y un link así se le puede mandar a cualquiera. Adentro de un iframe, en cambio, el
 *    atributo `sandbox` que escribe especificacion.ts ya lo aísla aunque la cabecera falte, y
 *    `frame-ancestors` (`'none'` global hoy, `'self'` con el bloque de next.config) no deja que otro
 *    sitio lo enmarque. Sin la cabecera (un navegador viejo, un `curl`), tampoco se sirve.
 */
export function pedidoDeIframe(req: Request): boolean {
  return (req.headers.get('sec-fetch-dest') ?? '').toLowerCase() === 'iframe';
}

/**
 * Lo que contesta GET/HEAD de `/l/html/<docId>/<bloque>[?vista=<token>]`:
 *   · no lo pide un iframe (`Sec-Fetch-Dest`) → 403 SIN tocar la base (ver `pedidoDeIframe`);
 *   · docId, bloque o token sin la forma → 404 SIN tocar la base;
 *   · la lectura devolvió null (no existe, no publicado, sitio pausado, papelera, token ajeno) → 404,
 *     el mismo para todos los casos: no se enumera qué existe;
 *   · la lectura TIRÓ → 503 sin caché («no pude leer» no es «no existe»);
 *   · el HTML pide una contraseña (`pideContrasena`) → 451 con el texto que lo dice, sin caché;
 *   · si no, 200 con el documento, la política `sandbox`, `noindex`, su ETag (y 304 si ya lo tiene).
 */
export async function responderHtmlLibre(req: Request, pedido: PedidoHtmlLibre, dep: DepHtmlLibre): Promise<Response> {
  const sinCuerpo = req.method.toUpperCase() === 'HEAD';
  if (!pedidoDeIframe(req)) return noHay(403, sinCuerpo);
  if (!RE_DOC_ID.test(pedido.docId) || !RE_ID_BLOQUE.test(pedido.bloque)) return noHay(404, sinCuerpo);
  if (pedido.vista !== null && !RE_TOKEN_VISTA.test(pedido.vista)) return noHay(404, sinCuerpo);

  let html: string | null;
  try {
    html = await dep.leer();
  } catch (err) {
    console.error(`[l/html] no pude leer el bloque ${pedido.bloque} de #${pedido.docId}: ${err instanceof Error ? err.message : String(err)}`);
    return noHay(503, sinCuerpo);
  }
  if (typeof html !== 'string' || !html) return noHay(404, sinCuerpo);
  if (pideContrasena(html)) {
    console.warn(`[l/html] el bloque ${pedido.bloque} de #${pedido.docId}${pedido.vista ? ' (borrador)' : ''} pide una contraseña: no se sirve`);
    return noHay(451, sinCuerpo);
  }

  const doc = documentoHtmlLibre(html);
  const etag = etagHtmlLibre(doc);
  const comunes: Record<string, string> = {
    'Cache-Control': pedido.vista ? CACHE_HTML_LIBRE_VISTA : CACHE_HTML_LIBRE,
    ETag: etag,
    'X-Robots-Tag': 'noindex, nofollow',
    // Las dos van también en next.config.ts (CABECERAS_HTML_LIBRE): ahí GANAN; acá quedan para
    // cuando la ruta corre sin esas cabeceras globales (un test, otro servidor).
    'Content-Security-Policy': CSP_HTML_LIBRE,
    'X-Frame-Options': 'SAMEORIGIN',
    Vary: 'Sec-Fetch-Dest',
  };
  if (coincide(req.headers.get('if-none-match'), etag)) return new Response(null, { status: 304, headers: comunes });
  return new Response(sinCuerpo ? null : doc, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', ...comunes } });
}
