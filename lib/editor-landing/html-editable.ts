// =============================================================================
// editor-landing/html-editable — el bloque «Diseño editable» y la página «libre» que lo publica
// =============================================================================
// Pedido de Martín (23/10/2026), textual: «Que tenga la landing principal de MaKo en el editable de
// web generator y que le pueda hacer cambios de allí y se apliquen. Revisa que no se dañe la landing,
// si hace falta bloques nuevos, animaciones o lo que sea, se debe agregar a Web Generator».
//
// La landing de hola-mako.com es un diseño a medida (Claude Design: HTML con estilos en línea, su hoja,
// carruseles, el VSL, la animación de red, Calendly) que NO entra en los bloques de Gamma sin perder la
// forma. Por eso el bloque nuevo guarda el HTML DE LA SECCIÓN tal cual, y el editor lo deja tocar como
// se toca una sección de Gamma: textos, imágenes y enlaces a la vista (el código, a un clic).
//
// Diferencias con el «HTML personalizado» (`htmlLibre`, html-libre.ts), y por qué son dos bloques:
//   · htmlLibre corre SU JavaScript, aislado en un iframe con origen opaco y sin texto editable.
//   · htmlEditable NO lleva JavaScript (lo saca el saneo del server, html-editable-seguro.ts, y la
//     política de la página publicada lo bloquea igual): se publica EN LA PÁGINA, sin iframe, para que
//     el header pegajoso, las anclas (#beta) y el scroll funcionen como en el diseño original. Lo que
//     se mueve lo pone MaKo con atributos (`SCRIPT_DISENO`, abajo): data-reveal, carruseles,
//     video en bucle, la animación de red de MaKo y la agenda de Calendly.
//
// La PÁGINA LIBRE: una página con al menos una sección de diseño editable se publica sin el marco de
// Gamma (`.gm-libre`): las secciones de diseño van una tras otra, a sangre, y las de Gamma que haya en
// el medio salen en su propia raíz `.gm-doc` (render.ts). Así ninguna regla de CSS_CONTENIDO (que
// cuelga de `.gm-doc`) toca el diseño, y el diseño hereda lo mismo que heredaba en la app: la base de
// Tailwind (`CSS_BASE_LIBRE`, en una capa) y la hoja propia del documento (`config.diseno.css`).
//
// ⚠️ PURO y apto para el navegador (lo importan render.ts, el editor y los tests). El saneo del HTML
//    vive en html-editable-seguro.ts (server-only: sanitize-html arrastra postcss).
// ⚠️ `SCRIPT_DISENO` y `CSS_BASE_LIBRE` son strings que se sirven tal cual: sin backticks ni `${`
//    (AGENTS.md, «el fuente y lo que se sirve no son el mismo texto»). El hash del script va en la
//    política de la página publicada (pagina-publica.ts): si se toca una coma, el hash cambia solo.
// =============================================================================

import { NODO, TOPES, textoDeHtmlEditable, type JsonNodo } from './doc';

export { textoDeHtmlEditable };

/** La raíz de una página libre (y de la vista de una sección en el editor). */
export const CLASE_LIBRE = 'gm-libre';
/** El envoltorio de UNA sección de diseño en la página publicada: `display: contents` (no es una caja). */
export const CLASE_SECCION_LIBRE = 'gm-libre-seccion';
/** El bloque en el editor, la miniatura y la exportación. */
export const CLASE_EDITABLE = 'gm-editable';
/** La sección con la que nace un «Diseño editable» insertado a mano: algo que se toca a la vista. */
export const HTML_EDITABLE_NUEVO =
  '<section style="padding:72px 24px;text-align:center;font-family:system-ui,sans-serif">' +
  '<h2 style="font-size:34px;font-weight:600;letter-spacing:-0.02em">Tu título</h2>' +
  '<p style="margin-top:14px;font-size:17px;color:#5B6472">Tu texto. Haz clic para escribir.</p></section>';
/** Alto del recuadro de una sección de diseño en una miniatura (no se sabe antes de dibujarla). */
export const ALTO_MINIATURA_EDITABLE = 640;

const esObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** ¿La sección es SÓLO diseño editable? (una sección así se publica a sangre, sin el marco de Gamma). */
export function esTarjetaEditable(t: unknown): boolean {
  if (!esObj(t) || t.type !== NODO.tarjeta || !Array.isArray(t.content) || !t.content.length) return false;
  return t.content.every((n) => esObj(n) && n.type === NODO.htmlEditable);
}

/** ¿Alguna sección de estas páginas lleva diseño editable? */
export function tieneEditables(paginas: ReadonlyArray<{ doc?: { content?: JsonNodo[] } }>): boolean {
  const tiene = (n: unknown): boolean => esObj(n) && (n.type === NODO.htmlEditable || (Array.isArray(n.content) && n.content.some(tiene)));
  return paginas.some((p) => (p.doc?.content ?? []).some(tiene));
}

// ─────────────────────────────────────────────────────────────────────────────
// La hoja del diseño
// ─────────────────────────────────────────────────────────────────────────────

/**
 * La base que el diseño heredaba en la app: el preflight de Tailwind 4 (node_modules/tailwindcss/
 * preflight.css), con cada regla colgada de `.gm-libre` y en una CAPA, como en la app (Tailwind lo pone
 * en `@layer base`): una regla sin capa (la hoja del diseño, sus estilos en línea) le gana siempre, sin
 * importar la especificidad. Sin esto, en hola-mako.site y en el editor los títulos y párrafos traían
 * los márgenes del navegador y las imágenes salían en línea: medido contra la landing de la app.
 * Más `.gm-libre-seccion { display: contents }`: el header pegajoso tiene que tener a la PÁGINA como
 * contenedor (una caja por sección lo dejaría pegado sólo a su propio alto).
 */
export const CSS_BASE_LIBRE = [
  '@layer gm-libre-base {',
  '.gm-libre, .gm-libre *, .gm-libre ::after, .gm-libre ::before, .gm-libre ::backdrop { box-sizing: border-box; margin: 0; padding: 0; border: 0 solid; }',
  '.gm-libre { line-height: 1.5; -webkit-text-size-adjust: 100%; tab-size: 4; -webkit-tap-highlight-color: transparent; }',
  '.gm-libre hr { height: 0; color: inherit; border-top-width: 1px; }',
  '.gm-libre abbr:where([title]) { text-decoration: underline dotted; }',
  '.gm-libre :is(h1, h2, h3, h4, h5, h6) { font-size: inherit; font-weight: inherit; }',
  '.gm-libre a { color: inherit; -webkit-text-decoration: inherit; text-decoration: inherit; }',
  '.gm-libre :is(b, strong) { font-weight: bolder; }',
  '.gm-libre :is(code, kbd, samp, pre) { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 1em; }',
  '.gm-libre small { font-size: 80%; }',
  '.gm-libre :is(sub, sup) { font-size: 75%; line-height: 0; position: relative; vertical-align: baseline; }',
  '.gm-libre sub { bottom: -0.25em; }',
  '.gm-libre sup { top: -0.5em; }',
  '.gm-libre table { text-indent: 0; border-color: inherit; border-collapse: collapse; }',
  '.gm-libre summary { display: list-item; }',
  '.gm-libre :is(ol, ul, menu) { list-style: none; }',
  '.gm-libre :is(img, svg, video, canvas, audio, iframe, embed, object) { display: block; vertical-align: middle; }',
  '.gm-libre :is(img, video) { max-width: 100%; height: auto; }',
  '.gm-libre :is(button, input, select, optgroup, textarea) { font: inherit; font-feature-settings: inherit; font-variation-settings: inherit; letter-spacing: inherit; color: inherit; border-radius: 0; background-color: transparent; opacity: 1; }',
  '.gm-libre ::placeholder { opacity: 1; }',
  '.gm-libre textarea { resize: vertical; }',
  '.gm-libre :is(button, input:where([type="button"], [type="reset"], [type="submit"])) { appearance: button; }',
  '.gm-libre [hidden]:where(:not([hidden="until-found"])) { display: none !important; }',
  '}',
  '.gm-libre-seccion { display: contents; }',
].join('\n');

/**
 * ¿Un medio (src, poster, srcset, un url() de un estilo) puede cargarse desde una sección de diseño? Sólo una URL
 * ABSOLUTA https (o una imagen `data:`) y nunca a una ruta /api/. ⚠️ El editor dibuja la sección en un iframe del
 * MISMO origen que la app (para poder editarla): un `<img src="/api/…">` ahí sale con la cookie de quien la abre
 * (un GET con su sesión). Un relativo, además, en hola-mako.site apuntaría a otro lado que en hola-mako.com.
 */
export function medioPermitido(raw: string): boolean {
  const v = raw.trim();
  if (/^data:image\/(png|jpe?g|gif|webp|avif);/i.test(v)) return true;
  if (!/^https:\/\//i.test(v)) return false;
  try {
    const ruta = decodeURIComponent(new URL(v).pathname).replace(/\/+/g, '/').toLowerCase();
    return !ruta.startsWith('/api/') && ruta !== '/api';
  } catch {
    return false;
  }
}

/** Lo único que puede importar la hoja del diseño: una fuente de Google Fonts. */
// La URL de Google Fonts LLEVA `;` (`wght@400;500;600`): el `@import` se lee hasta el cierre de su url() o
// de sus comillas, no hasta el primer `;` (con eso no matcheaba y el import quedaba después de la base).
const RE_IMPORT = /@import\s*(?:url\(\s*(?:"[^"]*"|'[^']*'|[^)]*)\s*\)|"[^"]*"|'[^']*')[^;]*;?/gi;
const DE_GOOGLE_FONTS = /^@import\s*(?:url\(\s*)?["']?https:\/\/fonts\.googleapis\.com\//i;

/**
 * La hoja propia del documento (`config.diseno.css`), lista para ir adentro de un `<style>`. PURA:
 * no valida CSS (no hay riesgo de script en una hoja en un navegador de hoy), sólo cuida lo que rompe
 * el documento o carga de afuera: SIN NINGÚN `<` (ver abajo), sin `-->`, sin NUL, un `@import` sólo de
 * fonts.googleapis.com, y con su tope (`TOPES.cssDiseno`: pasado, queda vacía — recortada quedaría con
 * una regla abierta que se come el resto).
 *
 * ⚠️ REGLA: el CSS del diseño nunca lleva `<`. Sacar `</style` en una pasada se evadía anidando
 * (`<</style/style>` deja un `</style>`, y lo que sigue es HTML: un `<script>` corría en hola-mako.com, donde
 * la portada pinta esta hoja tal cual — revisión de Integración, 23/10/2026). Una hoja no necesita `<` para
 * nada; el `>` se queda (selector hijo).
 */
export function cssDisenoLimpio(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim() || raw.length > TOPES.cssDiseno) return '';
  return raw
    .replace(/\u0000/g, '')
    .replace(/</g, '')
    .replace(/-->/g, '')
    .replace(RE_IMPORT, (todo: string) => (DE_GOOGLE_FONTS.test(todo) ? todo : ''))
    // Un `@import` con otra forma (sin url ni comillas) no se lee: se va.
    .replace(/@import(?![^;]*fonts\.googleapis\.com)[^;]*;?/gi, '')
    // Un url() de la hoja carga en el editor con la sesión de quien lo abre (`medioPermitido`): sólo los permitidos.
    .replace(/url\(\s*(["']?)(.*?)\1\s*\)/gi, (todo: string, _c: string, url: string) => (medioPermitido(url) || /^https:\/\/fonts\.googleapis\.com\//i.test(url) ? todo : 'url()'));
}

/**
 * La hoja que se publica: la base y la hoja del documento en UNA hoja, con los `@import` ADELANTE. Un `@import`
 * después de cualquier regla no vale y el navegador lo ignora sin avisar (medido el 23/10/2026: con la base
 * primero, la Geist de la landing no cargaba en hola-mako.site y todos los textos salían más angostos).
 */
export function hojaDeDiseno(css: string): string {
  const limpia = cssDisenoLimpio(css);
  const imports: string[] = [];
  const resto = limpia.replace(RE_IMPORT, (todo: string) => { imports.push(todo.trim()); return ''; });
  return [...imports, CSS_BASE_LIBRE, resto.trim()].filter(Boolean).join('\n');
}

/**
 * El documento que dibuja UNA sección de diseño en un iframe del editor o de una miniatura (`srcdoc`).
 * Sin scripts: el iframe va con `sandbox` sin `allow-scripts`. La base y la hoja del diseño adelante,
 * el HTML de la sección adentro de `.gm-libre` (la misma raíz que en la página publicada).
 */
export function documentoEditable(html: string, css: string): string {
  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<style>html,body{margin:0;padding:0;background:transparent}</style>',
    '<style>' + CSS_BASE_LIBRE + '</style>',
    css ? '<style>' + cssDisenoLimpio(css) + '</style>' : '',
    '</head><body><div class="' + CLASE_LIBRE + '">',
    html,
    '</div></body></html>',
  ].join('');
}

/** ¿El HTML lleva una agenda de Calendly del diseño (`data-calendly`)? La política de la página la deja cargar. */
export function usaCalendly(html: string): boolean {
  return /\sdata-calendly\s*=/.test(html);
}

// ─────────────────────────────────────────────────────────────────────────────
// Lo que se mueve: el script del diseño
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Los comportamientos del diseño, por atributos (el HTML no trae JavaScript). Es el mismo cableado que
 * hacía app/vsl/Landing.tsx a mano para la landing de MaKo, generalizado:
 *   · `[data-reveal]`: aparece al bajar (opacidad y 16px), con el respaldo de 2,4 s.
 *   · Carruseles: `[data-track="X"]` (sus hijos son las diapositivas; `data-dot-on`, `data-dot-off` y
 *     `data-intervalo` en el track), `[data-car="X"][data-dot="i"]` y `[data-car="X"][data-act="prev|next"]`.
 *     Los que avanzan cada el mismo tiempo avanzan JUNTOS (en la landing, QS Media y Social Media Lab).
 *   · `video[data-autoplay]`: en silencio y en bucle.
 *   · `canvas[data-animacion="mako-red"]`: la animación de la red de MaKo (/vsl-assets/mako-anim.js).
 *   · `[data-calendly="<url>"]`: la agenda de Calendly embebida, con las UTM de la página y el visitante
 *     del Pixel de MaKo en `utm_term` (la cadena de atribución: docs/hallazgos-landing.md).
 *   · La agenda confirmada (`calendly.event_scheduled`, origen exacto) → `Schedule` al Píxel de Meta si la
 *     página lo cargó. Una sola vez por carga (Calendly puede repetir el mensaje).
 * Lo de MaKo (la red) sale SIEMPRE de https://hola-mako.com (fijo: el HTML no lo elige). Idempotente: corre
 * una vez por página (`window.__gmDiseno`).
 */
export const SCRIPT_DISENO = [
  '(function () {',
  '  if (window.__gmDiseno) return;',
  '  var d = document;',
  '  var raiz = d.querySelector(".gm-libre");',
  '  if (!raiz) return;',
  '  window.__gmDiseno = 1;',
  // El origen FIJO de lo de MaKo (la red): un atributo del HTML no lo puede cambiar.
  '  var APP = "https://hola-mako.com";',
  '  var todos = function (sel) { return Array.prototype.slice.call(raiz.querySelectorAll(sel)); };',
  // «Reducir movimiento» del sistema (WCAG 2.2.2 y 2.3.3): ni carrusel que avanza solo ni reveal que se desliza.
  '  var reducir = false;',
  '  try { reducir = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) {}',
  '',
  '  var rev = reducir ? [] : todos("[data-reveal]");',
  '  var ver = function (el) { el.style.opacity = "1"; el.style.transform = "none"; };',
  '  rev.forEach(function (el) {',
  '    el.style.opacity = "0"; el.style.transform = "translateY(16px)";',
  '    el.style.transition = "opacity .6s cubic-bezier(.2,.7,.2,1), transform .6s cubic-bezier(.2,.7,.2,1)";',
  '  });',
  '  if (!rev.length) {',
  '  } else if ("IntersectionObserver" in window) {',
  '    var io = new IntersectionObserver(function (es) {',
  '      es.forEach(function (e) { if (e.isIntersecting) { ver(e.target); io.unobserve(e.target); } });',
  '    }, { threshold: 0.06, rootMargin: "0px 0px -5% 0px" });',
  '    rev.forEach(function (el) { io.observe(el); });',
  '    setTimeout(function () { rev.forEach(ver); }, 2400);',
  '  } else rev.forEach(ver);',
  '',
  '  var cars = {};',
  '  todos("[data-track]").forEach(function (t) {',
  '    var k = t.getAttribute("data-track");',
  '    cars[k] = { t: t, i: 0, n: t.children.length, on: t.getAttribute("data-dot-on") || "#2F6FED",',
  '      off: t.getAttribute("data-dot-off") || "rgba(255,255,255,.85)", ms: parseInt(t.getAttribute("data-intervalo") || "5000", 10) || 5000 };',
  '  });',
  '  var pintar = function (k) {',
  '    var c = cars[k];',
  '    c.t.style.transform = "translateX(-" + c.i * 100 + "%)";',
  '    todos("[data-car=\\"" + k + "\\"][data-dot]").forEach(function (b) {',
  '      var on = parseInt(b.getAttribute("data-dot") || "0", 10) === c.i;',
  '      b.style.width = on ? "22px" : "8px";',
  '      b.style.background = on ? c.on : c.off;',
  '    });',
  '  };',
  '  var ir = function (k, i) { var c = cars[k]; if (!c || !c.n) return; c.i = ((i % c.n) + c.n) % c.n; pintar(k); };',
  // Un carrusel que avanza solo se puede parar (WCAG 2.2.2): con el mouse o el foco encima (hover / foco) y con
  // su botón de pausa (manual). Con «reducir movimiento» no avanza solo: queda con sus flechas y sus puntos.
  '  var relojes = [];',
  '  var parado = function (k) { var c = cars[k]; return !!(c.hover || c.foco || c.manual); };',
  '  var arrancar = function () {',
  '    relojes.forEach(clearInterval); relojes = [];',
  '    if (reducir) return;',
  '    var porMs = {};',
  '    Object.keys(cars).forEach(function (k) { (porMs[cars[k].ms] = porMs[cars[k].ms] || []).push(k); });',
  '    Object.keys(porMs).forEach(function (ms) {',
  '      relojes.push(setInterval(function () { porMs[ms].forEach(function (k) { if (!parado(k)) ir(k, cars[k].i + 1); }); }, +ms));',
  '    });',
  '  };',
  '  Object.keys(cars).forEach(function (k) {',
  '    pintar(k);',
  '    if (reducir) { cars[k].t.style.transition = "none"; return; }',
  '    if (cars[k].n < 2) return;',
  '    var anterior = raiz.querySelector("[data-car=\\"" + k + "\\"][data-act=\\"prev\\"]");',
  '    var cont = anterior && anterior.parentElement ? anterior.parentElement : cars[k].t.parentElement;',
  '    if (!cont) return;',
  // Las zonas del carrusel: su contenedor (con las flechas) y el marco del carril, que puede ser otro.
  '    var zonas = [cont]; if (!cont.contains(cars[k].t)) zonas.push(cars[k].t.parentElement);',
  '    zonas.forEach(function (z) {',
  '      if (!z) return;',
  // Sólo un MOUSE de verdad frena por estar encima (un toque deja el «encima» puesto hasta tocar otra cosa) y sólo el
  // foco de TECLADO (:focus-visible: un toque o un clic en una flecha deja el foco puesto y la pararía para siempre).
  '      z.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") cars[k].hover = 1; });',
  '      z.addEventListener("pointerleave", function () { cars[k].hover = 0; });',
  '      z.addEventListener("focusin", function (e) { var kb = true; try { kb = e.target.matches(":focus-visible"); } catch (x) {} cars[k].foco = kb ? 1 : 0; });',
  '      z.addEventListener("focusout", function () { cars[k].foco = 0; });',
  '    });',
  '    var b = d.createElement("button");',
  '    b.type = "button"; b.setAttribute("data-car", k); b.setAttribute("data-act", "pausa"); b.setAttribute("aria-pressed", "false");',
  '    b.setAttribute("aria-label", "Pausar el carrusel"); b.textContent = "\\u275A\\u275A";',
  '    b.style.cssText = "position:absolute;right:12px;top:12px;z-index:3;width:32px;height:32px;border-radius:50%;border:none;cursor:pointer;background:rgba(0,0,0,.55);color:#fff;font-size:10px;line-height:32px;text-align:center;padding:0";',
  '    cont.appendChild(b);',
  '  });',
  '  arrancar();',
  '  raiz.addEventListener("click", function (e) {',
  '    var t = e.target && e.target.closest ? e.target.closest("[data-car]") : null;',
  '    if (!t || !raiz.contains(t)) return;',
  '    var k = t.getAttribute("data-car");',
  '    if (!cars[k]) return;',
  '    if (t.getAttribute("data-act") === "pausa") {',
  '      cars[k].manual = !cars[k].manual;',
  '      t.setAttribute("aria-pressed", cars[k].manual ? "true" : "false");',
  '      t.setAttribute("aria-label", cars[k].manual ? "Reanudar el carrusel" : "Pausar el carrusel");',
  '      t.textContent = cars[k].manual ? "\\u25B6" : "\\u275A\\u275A";',
  '      return;',
  '    }',
  '    if (t.hasAttribute("data-dot")) ir(k, parseInt(t.getAttribute("data-dot") || "0", 10));',
  '    else if (t.getAttribute("data-act") === "prev") ir(k, cars[k].i - 1);',
  '    else if (t.getAttribute("data-act") === "next") ir(k, cars[k].i + 1);',
  '    else return;',
  '    arrancar();',
  '  });',
  '',
  '  todos("video[data-autoplay]").forEach(function (v) {',
  '    try { v.muted = true; v.defaultMuted = true; var p = v.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {}',
  '  });',
  '',
  '  var cv = raiz.querySelector("canvas[data-animacion=\\"mako-red\\"]");',
  '  if (cv) {',
  '    var empezo = false, t0 = null, esperas = 0;',
  '    var red = function () {',
  '      if (empezo) return;',
  '      if (!window.MakoAnim) { if (esperas++ < 120) setTimeout(red, 80); return; }',
  '      empezo = true;',
  '      var ctx = cv.getContext("2d");',
  '      if (!ctx) return;',
  '      var w = 1, h = 1, dpr = 1;',
  '      var medir = function () {',
  '        var r = cv.getBoundingClientRect();',
  '        dpr = Math.min(window.devicePixelRatio || 1, 2); w = Math.max(1, r.width); h = Math.max(1, r.height);',
  '        cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);',
  '      };',
  '      var pintarRed = function (t) {',
  '        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);',
  '        try { window.MakoAnim.draw(ctx, t, w, h); } catch (e) {}',
  '      };',
  '      medir();',
  '      var quieto = false;',
  '      try { quieto = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}',
  '      if (quieto) { pintarRed(7000); return; }',
  '      var vuelta = function (ahora) {',
  '        if (!cv.isConnected) return;',
  '        var r = cv.getBoundingClientRect();',
  '        if (Math.abs(r.width - w) > 1 || Math.abs(r.height - h) > 1) medir();',
  '        if (t0 === null) t0 = ahora;',
  '        pintarRed((ahora - t0) % window.MakoAnim.DURATION);',
  '        requestAnimationFrame(vuelta);',
  '      };',
  '      requestAnimationFrame(vuelta);',
  '    };',
  '    if (window.MakoAnim) red();',
  '    else {',
  '      var sc = d.createElement("script");',
  '      sc.src = APP + "/vsl-assets/mako-anim.js?v=3"; sc.async = true; sc.onload = red;',
  '      d.body.appendChild(sc);',
  '    }',
  '  }',
  '',
  '  var agendas = todos("[data-calendly]");',
  '  if (agendas.length) {',
  '    var q = new URLSearchParams(location.search);',
  '    var desde = Date.now();',
  '    var visitante = function () { var m = d.cookie.match(/(?:^|; )nqe_visitor_id=([^;]+)/); return m ? decodeURIComponent(m[1]) : undefined; };',
  '    if (!d.getElementById("gm-calendly-css")) {',
  '      var l = d.createElement("link"); l.id = "gm-calendly-css"; l.rel = "stylesheet";',
  '      l.href = "https://assets.calendly.com/assets/external/widget.css"; d.head.appendChild(l);',
  '    }',
  // En la primera visita el visitante lo crea el Pixel de MaKo, que carga en paralelo: se lo espera hasta 2,5 s.
  '    var iniciar = function () {',
  '      if (!window.Calendly || (!visitante() && Date.now() - desde < 2500)) { setTimeout(iniciar, 300); return; }',
  // Sólo las que vienen: el widget de Calendly escribe una clave en undefined como el TEXTO «undefined» en la URL, y
  // así llegaba al lead (medido en producción el 23/10/2026: utm_medium=undefined).
  '      var utm = {};',
  '      [["utmSource", "utm_source"], ["utmMedium", "utm_medium"], ["utmCampaign", "utm_campaign"], ["utmContent", "utm_content"]].forEach(function (p) {',
  '        var v = q.get(p[1]); if (v) utm[p[0]] = v;',
  '      });',
  '      var uid = visitante(); if (uid) utm.utmTerm = uid;',
  '      agendas.forEach(function (el) {',
  '        if (el.getAttribute("data-cal-init")) return;',
  '        var url = el.getAttribute("data-calendly") || "";',
  '        if (!/^https:\\/\\/calendly\\.com\\//.test(url)) return;',
  '        el.setAttribute("data-cal-init", "1");',
  '        window.Calendly.initInlineWidget({ url: url, parentElement: el, utm: utm });',
  '      });',
  '    };',
  '    if (window.Calendly) iniciar();',
  '    else {',
  '      var cs = d.createElement("script");',
  '      cs.src = "https://assets.calendly.com/assets/external/widget.js"; cs.async = true; cs.onload = iniciar;',
  '      d.body.appendChild(cs);',
  '    }',
  '    var agendo = false;',
  '    window.addEventListener("message", function (e) {',
  '      if (agendo || e.origin !== "https://calendly.com" || !e.data || e.data.event !== "calendly.event_scheduled") return;',
  // El MISMO id que arma el servidor (`idDeReservaCalendly`, lib/meta-capi-payload.ts): el último tramo de la URI del
  // evento. Sin la URI no se manda: un Schedule sin id se contaría aparte del de CAPI.
  '      var u = e.data.payload && e.data.payload.event && e.data.payload.event.uri;',
  '      var id = typeof u === "string" ? (u.trim().replace(/\\/+$/, "").split("/").pop() || "").slice(0, 80) : "";',
  '      if (!id) return;',
  '      agendo = true;',
  '      if (typeof window.fbq === "function") window.fbq("track", "Schedule", {}, { eventID: "schedule:" + id });',
  '    });',
  '  }',
  '})();',
].join('\n');
