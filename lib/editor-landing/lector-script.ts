// =============================================================================
// editor-landing/lector-script — el script que LEE una landing desde ADENTRO de la página (tanda 6, b)
// =============================================================================
// Pedido de Martín (14/10/2026): «El mimso error que nos saltaba con Mauricio "No pude leer el texto de
// esa página.". Soluciona eso...». Una landing armada como app (Vite/React) no trae texto en el HTML: lo
// arma el JavaScript en el navegador, y el server no tiene navegador (nada de Chrome en el server ni
// pago: decisión del mismo día). Así que se lee en el navegador de la persona, con UN script que corre
// adentro de la página real y es el MISMO para los dos caminos (contrato y protocolo: lector.ts):
//   · CON el Pixel de MaKo: la página real en una ventana, y el Pixel carga este script desde
//     `/m.js?leer=<id>` (`responderLectorDelPixel`, abajo);
//   · SIN el Pixel: la ventana de MaKo con la página aislada y este script adentro (lector-pagina.ts).
//
// Lo que hace, en orden (con un tope total de `TOPE` y sin tocar nada antes del «dale» de MaKo):
//   1. espera a que la página cargue y se quede QUIETA (800 ms sin cambios en el DOM, tope 10 s), la
//      recorre de arriba abajo para que se arme lo que aparece al bajar, y vuelve arriba;
//   2. abre UNO POR VEZ lo que se despliega sin salir de la página (`details`, `[aria-expanded=false]`
//      que no sea link ni submit, pestañas, `[data-state=closed]` que dispara algo), lee lo que apareció
//      y lo vuelve a cerrar;
//   3. anota a dónde lleva cada botón SIN seguirlo: un link se lee de su `href`; un botón se toca con
//      todo lo que saldría de la página atajado (clics a links y submits en fase de captura con
//      preventDefault, `window.open` parcheado, la Navigation API cancelada) y se mira qué pasó
//      (#ancla, url, una ventana adentro, bajó, nada). Un submit NUNCA se toca;
//   4. mira las agendas embebidas (Calendly, Cal.com, GoHighLevel): si están, su alto y si cargaron,
//      SIN tocar nada adentro (son de otro origen: no se puede, y no se quiere reservar);
//   5. arma las piezas en el orden de la página y se las manda a MaKo; MaKo arma el texto y la cierra.
// Antes de tocar nada, apaga los rastreadores de la página (fbq, gtag, ttq…, sendBeacon y los pedidos a
// sus dominios): un clic del lector no puede ser una conversión en el Meta de un cliente.
//
// ⚠️ ES JAVASCRIPT PLANO ADENTRO DE UN `String.raw`: las barras de las expresiones regulares llegan tal
//    cual (AGENTS.md, «el fuente y lo que se sirve no son el mismo texto»). Sin backticks, sin el
//    signo de pesos con llave y sin «menor que» seguido de barra (va adentro de un <script> y lo
//    cerraría). tests/editor-landing-lector.test.ts lo compila con vm y vigila las tres cosas.
// ⚠️ SIN IMPORTS DE NODE NI DE MÓDULOS server-only: lo sirve /m.js y lo arma la ruta de la ventana.
// =============================================================================

import { CAMINOS_LECTURA, idLecturaValido, type CaminoLectura } from './lector';

/** El parámetro de `/m.js` que pide el lector en vez del Pixel (lo arma el Pixel, lib/landing-token.ts). */
export const PARAM_LECTOR_CARGADOR = 'leer';

/**
 * Apaga los rastreadores de la página: el Pixel de Meta, gtag/GTM, TikTok y compañía quedan mudos, y los
 * pedidos a sus dominios (fetch, XHR, sendBeacon, imágenes y scripts que se suman) no salen. Lo corren
 * el lector antes de tocar nada y, en la ventana sin Pixel, el preludio ANTES de la página: ahí la
 * página corre con la dirección de MaKo y un PageView mandado desde ahí ensucia el Pixel del cliente.
 * Un `fbq` que ya existe hace que el código de Meta no se baje (su primera línea es «si ya hay fbq, no
 * hagas nada»). Una expresión de función sin argumentos, en JavaScript plano (las reglas de JS_LECTOR).
 */
export const JS_APAGAR_RASTREADORES = String.raw`function () {
  if (window.__mkMudo) return;
  window.__mkMudo = 1;
  var RE = /facebook\.com\/tr|connect\.facebook\.net|google-analytics\.com|googletagmanager\.com|analytics\.google\.com|doubleclick\.net|analytics\.tiktok\.com|clarity\.ms|hotjar|\/api\/track\/|bat\.bing\.com|px\.ads\.linkedin\.com|ct\.pinterest\.com|tr\.snapchat\.com/i;
  function mudo() {
    var f = function () { return p; };
    var p = typeof Proxy === 'function' ? new Proxy(f, {
      get: function (t, k) { if (k === 'then') return undefined; if (k === 'push') return function () { return 0; }; if (k === 'loaded') return true; if (typeof k === 'symbol') return undefined; return p; },
      apply: function () { return p; },
    }) : f;
    return p;
  }
  ['fbq', '_fbq'].forEach(function (k) { try { window[k] = mudo(); } catch (e) {} });
  ['gtag', 'ttq', 'clarity', 'hj', 'lintrk', 'twq', 'snaptr', 'rdt', 'pintrk', 'obApi', 'qp', 'mixpanel', 'analytics'].forEach(function (k) {
    try { if (k in window) window[k] = mudo(); } catch (e) {}
  });
  ['dataLayer', '_hsq', '_paq', '_gaq', 'uetq'].forEach(function (k) {
    try {
      if (!window[k] || typeof window[k] !== 'object') window[k] = [];
      window[k].push = function () { return 0; };
    } catch (e) {}
  });
  try { navigator.sendBeacon = function () { return true; }; } catch (e) {}
  try {
    var f0 = window.fetch;
    if (f0) window.fetch = function (r) {
      var u = typeof r === 'string' ? r : (r && r.url) || '';
      if (RE.test(String(u))) return Promise.resolve(new Response(null, { status: 204 }));
      return f0.apply(this, arguments);
    };
  } catch (e) {}
  try {
    var xo = XMLHttpRequest.prototype.open, xs = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (m, u) { this.__mkMudo = RE.test(String(u)); return xo.apply(this, arguments); };
    XMLHttpRequest.prototype.send = function () { if (this.__mkMudo) return; return xs.apply(this, arguments); };
  } catch (e) {}
  [window.HTMLImageElement, window.HTMLScriptElement, window.HTMLIFrameElement].forEach(function (C) {
    try {
      var d = Object.getOwnPropertyDescriptor(C.prototype, 'src');
      Object.defineProperty(C.prototype, 'src', {
        configurable: true, enumerable: d.enumerable, get: d.get,
        set: function (v) { if (RE.test(String(v))) return; d.set.call(this, v); },
      });
    } catch (e) {}
  });
  try {
    var sa = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (n, v) {
      if (String(n).toLowerCase() === 'src' && RE.test(String(v)) && /^(IMG|SCRIPT|IFRAME)$/.test(this.tagName)) return;
      return sa.apply(this, arguments);
    };
  } catch (e) {}
}`;

/**
 * El lector: una expresión de función `(id, camino, origenMako)`. `origenMako` es el único origen al que
 * le habla (el `targetOrigin` de cada mensaje) y del único que acepta el «dale».
 */
export const JS_LECTOR = String.raw`function (id, camino, origenMako) {
  if (window.__mkLector || window.__mkNoAislada) return;
  window.__mkLector = 1;
  var abre = window.opener;
  if (!abre) return;
  var T0 = Date.now();
  var TOPE = 17000, QUIETO = 800, TOPE_QUIETO = 10000, TOPE_TOQUES = 7000;
  var MAX_DESP = 40, MAX_CLICS = 25, MAX_PIEZAS = 480, MAX_CHARS = 58000, MAX_NODOS = 25000;
  var dale = false, enviado = false, tocando = false, quietoOk = false, empezado = false, navego = false;
  var inicioToques = 0, pendiente = null, botonActual = null;
  var anotado = new Map(), despues = new Map(), hechos = new WeakSet(), cargados = new WeakSet();
  var consumidos = new WeakSet(), consumidosIds = {}, agendaVista = {}, pestanasOriginales = new Map();
  var SALTEAR = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEMPLATE: 1, TEXTAREA: 1, SELECT: 1, SVG: 1, CANVAS: 1, VIDEO: 1, AUDIO: 1, OBJECT: 1, EMBED: 1, IFRAME: 1, HEAD: 1, TITLE: 1, LINK: 1, META: 1 };
  var RE_AGENDA = /calendly\.com|(?:^|[\/.])cal\.com|leadconnectorhq\.com|msgsndr\.com|gohighlevel\.com|\/widget\/booking\//i;
  // Lo que no es de la página sino de la plataforma que la arma: no se lee ni se toca.
  var SEL_RUIDO = '#lovable-badge, .w-webflow-badge, #__framer-badge-container';
  var SEL_DESP = 'summary, [aria-expanded="false"], [role="tab"], [data-state="closed"]';
  var SEL_BOTON = 'a, button, [role="button"], input[type="submit"], input[type="button"]';
  var SEL_MODAL = 'dialog[open], [role="dialog"], [role="alertdialog"], [aria-modal="true"], .calendly-overlay, .modal.show, .modal.in, .fancybox-container, .mfp-wrap, .elementor-popup-modal';

  function ahora() { return Date.now() - T0; }
  function tarde() { return ahora() > TOPE; }
  function tardeToques() { return tarde() || ahora() - inicioToques > TOPE_TOQUES; }
  function esperar(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }
  function mandar(m) { m.tipo = 'mako-lectura'; m.id = id; try { abre.postMessage(m, origenMako); } catch (e) {} }
  function limpio(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function textoDe(el) { return el ? String(el.innerText || '').replace(/[ \t\u00a0]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim() : ''; }
  function irA(y) { try { window.scrollTo({ top: y, behavior: 'instant' }); } catch (e) { try { window.scrollTo(0, y); } catch (x) {} } }

  // ── El saludo: nada se toca hasta que MaKo conteste ──────────────────────────
  function hola() { if (!dale && !enviado) mandar({ fase: 'hola', camino: camino }); }
  window.addEventListener('message', function (ev) {
    var d = ev.data;
    if (d && d.tipo === 'mako-lectura' && d.id === id && d.fase === 'dale') {
      if (ev.source === abre && ev.origin === origenMako && !dale) { dale = true; listo(arrancar); }
      return;
    }
    try { if (ev.origin && RE_AGENDA.test(ev.origin)) agendaVista[proveedor(ev.origin)] = 1; } catch (e) {}
  });
  hola();
  var reHola = setInterval(function () { if (dale || enviado || ahora() > 10000) clearInterval(reHola); else hola(); }, 600);
  function listo(fn) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true }); else fn(); }

  // ── Lo que saldría de la página se ataja (desde el arranque: esta ventana no la usa nadie) ──
  function aLanding(u) {
    if (!u) return '';
    try {
      var x = new URL(String(u), document.baseURI);
      if (camino === 'ventana' && x.origin === location.origin) x = new URL(x.pathname + x.search + x.hash, document.baseURI);
      return sinLeer(x.href).slice(0, 500);
    } catch (e) { return ''; }
  }
  function sinLeer(u) { return String(u).replace(/([?&])mako_leer=[^&#]*&?/, '$1').replace(/[?&](#|$)/, '$1'); }
  function existeAncla(h) {
    try { var k = decodeURIComponent(String(h).replace(/^#/, '')); return !!(k && (document.getElementById(k) || document.getElementsByName(k).length)); } catch (e) { return null; }
  }
  function anotarSalida(tipo, valor) {
    if (!tocando || pendiente) return;
    if (tipo === 'ancla') pendiente = { tipo: 'ancla', valor: String(valor).slice(0, 200), existe: existeAncla(valor) };
    else if (tipo === 'formulario') pendiente = { tipo: 'formulario', valor: aLanding(valor) };
    else { var u = aLanding(valor); pendiente = u ? { tipo: 'url', valor: u } : { tipo: 'nada' }; }
  }
  function destinoDeHref(a) {
    var h = String(a.getAttribute('href') || '').trim();
    if (!h || h === '#' || /^javascript:/i.test(h)) return null;
    var u = aLanding(a.href || h);
    if (!u) return null;
    var aqui = sinLeer(String(document.baseURI)).split('#')[0];
    if (h.charAt(0) === '#' || (u.indexOf('#') > 0 && u.split('#')[0] === aqui)) {
      var hh = '#' + u.split('#')[1];
      return { tipo: 'ancla', valor: hh.slice(0, 200), existe: existeAncla(hh) };
    }
    return { tipo: 'url', valor: u };
  }
  try { window.open = function (u) { anotarSalida('url', u); return null; }; } catch (e) {}
  try { HTMLFormElement.prototype.submit = function () { anotarSalida('formulario', this.action); }; } catch (e) {}
  try { HTMLFormElement.prototype.requestSubmit = function () { anotarSalida('formulario', this.action); }; } catch (e) {}
  window.addEventListener('submit', function (ev) {
    ev.preventDefault(); ev.stopImmediatePropagation();
    anotarSalida('formulario', ev.target && ev.target.action);
  }, true);
  window.addEventListener('click', function (ev) {
    if (!tocando) return;
    var a = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
    var d = a ? destinoDeHref(a) : null;
    if (d) { ev.preventDefault(); anotarSalida(d.tipo, d.valor); }
  }, true);
  try {
    if (window.navigation && window.navigation.addEventListener) window.navigation.addEventListener('navigate', function (ev) {
      if (!tocando) return;
      var dest = ev.destination ? String(ev.destination.url) : '';
      if (ev.cancelable) ev.preventDefault();
      if (ev.hashChange) anotarSalida('ancla', '#' + dest.split('#')[1]);
      else { anotarSalida('url', dest); navego = true; }
    });
  } catch (e) {}

  // ── Las agendas: un iframe que se suma se anota cuando carga ──
  function proveedor(u) {
    u = String(u);
    if (/calendly\.com/i.test(u)) return 'calendly';
    if (/(?:^|[\/.])cal\.com/i.test(u)) return 'cal';
    if (/leadconnectorhq\.com|msgsndr\.com|gohighlevel\.com|\/widget\/booking\//i.test(u)) return 'ghl';
    return 'otro';
  }
  function vigilarIframe(f) { try { f.addEventListener('load', function () { cargados.add(f); }); } catch (e) {} }
  try {
    new MutationObserver(function (lista) {
      for (var i = 0; i < lista.length; i++) for (var j = 0; j < lista[i].addedNodes.length; j++) {
        var n = lista[i].addedNodes[j];
        if (n.nodeType !== 1) continue;
        if (n.tagName === 'IFRAME') vigilarIframe(n);
        else if (n.querySelectorAll) { var fs = n.querySelectorAll('iframe'); for (var k = 0; k < fs.length; k++) vigilarIframe(fs[k]); }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}
  function sinQuery(u) { try { var x = new URL(String(u), document.baseURI); return (x.origin + x.pathname).slice(0, 500); } catch (e) { return ''; } }
  function cargoPorRecurso(u) {
    try {
      var b = sinQuery(u), l = performance.getEntriesByType('resource');
      for (var i = 0; b && i < l.length; i++) if (l[i].initiatorType === 'iframe' && l[i].name.indexOf(b) === 0) return true;
    } catch (e) {}
    return false;
  }
  function piezaAgenda(el, src) {
    var r = el.getBoundingClientRect(), p = proveedor(src);
    var vio = !!agendaVista[p] || (el.tagName === 'IFRAME' && (cargados.has(el) || cargoPorRecurso(src)));
    return { tipo: 'calendario', proveedor: p, url: sinQuery(src), alto: Math.round(r.height), cargo: vio ? true : (camino === 'pixel' ? false : null) };
  }
  function mirarAgendas(raiz, ancla) {
    var out = [], fs = (raiz || document).querySelectorAll('iframe');
    for (var i = 0; i < fs.length; i++) {
      var f = fs[i], s = f.src || f.getAttribute('data-src') || '';
      if (!RE_AGENDA.test(s) || anotado.has(f)) continue;
      var p = piezaAgenda(f, s);
      if (ancla) out.push(p); else anotado.set(f, p);
    }
    // Una agenda que se arma sola (el contenedor está y el iframe no): también se dice, como «no cargó».
    var ws = (raiz || document).querySelectorAll('.calendly-inline-widget, [data-cal-link], [id*="calendly" i], [data-url*="calendly.com"]');
    for (var j = 0; j < ws.length; j++) {
      var w = ws[j];
      if (anotado.has(w) || w.querySelector('iframe')) continue;
      if (!visible(w) && !w.getBoundingClientRect().height) continue;
      var u = w.getAttribute('data-url') || (w.getAttribute('data-cal-link') ? 'https://cal.com/' + w.getAttribute('data-cal-link') : '');
      var q = piezaAgenda(w, u || 'https://calendly.com/');
      if (ancla) out.push(q); else anotado.set(w, q);
    }
    if (ancla && out.length) despues.set(ancla, (despues.get(ancla) || []).concat(out));
  }

  // ── Esperar ──
  function cargado(tope) {
    return new Promise(function (ok) {
      if (document.readyState === 'complete') return ok();
      var t = setTimeout(ok, Math.max(0, tope));
      window.addEventListener('load', function () { clearTimeout(t); ok(); }, { once: true });
    });
  }
  function esperarQuieto(quieto, tope) {
    return new Promise(function (ok) {
      var ini = Date.now(), ultimo = Date.now(), mo = null;
      try {
        mo = new MutationObserver(function () { ultimo = Date.now(); });
        mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
      } catch (e) {}
      (function mirar() {
        var t = Date.now(), ya = t - ultimo >= quieto;
        if (ya || t - ini >= tope || tarde()) { if (mo) mo.disconnect(); ok(ya); return; }
        setTimeout(mirar, 80);
      })();
    });
  }
  async function bajarYSubir() {
    var paso = Math.max(300, Math.floor(window.innerHeight * 0.85)), y = 0;
    for (var n = 0; n < 40 && !tarde(); n++) {
      y += paso;
      var h = Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
      if (y >= h) break;
      irA(y);
      await esperar(60);
    }
    irA(0);
  }
  async function scrollQuieto() {
    var y = window.scrollY;
    for (var n = 0; n < 15; n++) { await esperar(80); if (window.scrollY === y) return; y = window.scrollY; }
  }

  // ── Apagar los rastreadores antes de tocar nada (JS_APAGAR_RASTREADORES, arriba) ──
  var apagarRastreadores = ` + JS_APAGAR_RASTREADORES + String.raw`;

  // ── Tocar y mirar ──
  function visible(el) {
    if (!el || !el.isConnected) return false;
    try { if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true, checkVisibilityCSS: true })) return false; } catch (e) {}
    var r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    var cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden';
  }
  function etiqueta(el) {
    var t = limpio(el.innerText || el.textContent);
    if (!t) t = limpio(el.getAttribute('aria-label') || el.getAttribute('title') || (el.tagName === 'INPUT' ? el.value : '') || '');
    if (!t && el.querySelector) { var img = el.querySelector('img[alt]'); if (img) t = limpio(img.getAttribute('alt')); }
    return t;
  }
  function tocar(el) {
    var r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    var o = { bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y, button: 0, buttons: 1, pointerId: 1, pointerType: 'mouse', isPrimary: true };
    try { if (window.PointerEvent) el.dispatchEvent(new PointerEvent('pointerdown', o)); } catch (e) {}
    try { el.dispatchEvent(new MouseEvent('mousedown', o)); } catch (e) {}
    o.buttons = 0;
    try { if (window.PointerEvent) el.dispatchEvent(new PointerEvent('pointerup', o)); } catch (e) {}
    try { el.dispatchEvent(new MouseEvent('mouseup', o)); } catch (e) {}
    try { el.click(); } catch (e) {}
  }
  function modales() {
    var out = [], l = document.querySelectorAll(SEL_MODAL);
    for (var i = 0; i < l.length; i++) if (visible(l[i])) out.push(l[i]);
    return out;
  }
  function enModal(el) { try { return !!el.closest(SEL_MODAL); } catch (e) { return false; } }
  function tituloDeModal(m) {
    var h = m.querySelector('h1, h2, h3, [role="heading"]');
    var t = limpio((h && h.innerText) || m.getAttribute('aria-label') || '');
    if (!t && m.querySelector('iframe') && RE_AGENDA.test(m.querySelector('iframe').src || '')) t = 'agenda';
    return t.slice(0, 120);
  }
  async function cerrarModal(m) {
    var esc = function (t) { try { t.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true })); } catch (e) {} };
    esc(document.activeElement || document.body); esc(document);
    await esperar(250);
    if (!visible(m)) return;
    var x = m.querySelector('[aria-label*="lose" i], [aria-label*="errar" i], [data-dismiss], [data-bs-dismiss], .close, button[class*="close" i]') || document.querySelector('.calendly-popup-close');
    if (x) { tocar(x); await esperar(250); }
    if (visible(m)) { try { m.style.setProperty('display', 'none', 'important'); } catch (e) {} }
  }
  // A dónde bajó la página: lo que quedó más cerca de arriba, prefiriendo lo que tiene id (una ancla
  // que se puede nombrar) a un título.
  function anclaVisible() {
    var mejor = null, d = 1e9, l = document.querySelectorAll('[id], h1, h2, h3');
    for (var i = 0; i < l.length && i < 4000; i++) {
      var e = l[i];
      if (e === document.body || e === document.documentElement) continue;
      var t = e.getBoundingClientRect().top;
      if (t < -40 || t > window.innerHeight * 0.5) continue;
      var x = Math.abs(t) + (e.id ? 0 : 30);
      if (x < d && visible(e)) { d = x; mejor = e; }
    }
    if (!mejor) return { tipo: 'desplaza', valor: '' };
    if (mejor.id) return { tipo: 'ancla', valor: ('#' + mejor.id).slice(0, 200), existe: true };
    return { tipo: 'desplaza', valor: limpio(mejor.innerText).slice(0, 120) };
  }
  async function tocarYVer(el) {
    pendiente = null; navego = false; botonActual = el;
    var antes = modales(), y0 = window.scrollY, dy = 0, url0 = location.href, estado0 = history.state;
    var alScroll = function () { var d = Math.abs(window.scrollY - y0); if (d > dy) dy = d; };
    window.addEventListener('scroll', alScroll, true);
    tocar(el);
    await esperarQuieto(150, 1000);
    if (Math.abs(window.scrollY - y0) > 2) await scrollQuieto();
    window.removeEventListener('scroll', alScroll, true);
    // Sin la Navigation API (la ventana aislada es un origen opaco y ahí no avisa nada) un router de
    // app cambia la dirección con pushState: se anota, se vuelve a la de antes y se le avisa al router.
    if (location.href !== url0) {
      var nueva = location.href;
      if (!pendiente) {
        if (nueva.split('#')[0] === url0.split('#')[0]) anotarSalida('ancla', '#' + (nueva.split('#')[1] || ''));
        else anotarSalida('url', nueva);
      }
      try { history.replaceState(estado0, '', url0); } catch (e) {}
      navego = true;
    }
    var nuevo = null, l = modales();
    for (var i = 0; i < l.length && !nuevo; i++) if (antes.indexOf(l[i]) < 0) nuevo = l[i];
    var r = { salida: pendiente, modal: nuevo, bajo: dy > 40 ? anclaVisible() : null };
    pendiente = null; botonActual = null;
    return r;
  }
  async function deshacer(el, r) {
    if (r.modal) { mirarAgendas(r.modal, el); await cerrarModal(r.modal); }
    if (navego) {
      try { window.dispatchEvent(new PopStateEvent('popstate', { state: history.state })); } catch (e) {}
      navego = false;
      await esperarQuieto(120, 800);
    }
  }

  // ── Los desplegables, uno por vez ──
  function esDesplegable(el) {
    var tag = el.tagName;
    if (tag === 'SUMMARY') { var d = el.parentElement; return !!(d && d.tagName === 'DETAILS' && !d.open); }
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'OPTION' || tag === 'DETAILS') return false;
    if (tag === 'A' && destinoDeHref(el)) return false;
    if (tag === 'BUTTON' && el.type === 'submit' && el.form) return false;
    var pop = String(el.getAttribute('aria-haspopup') || '').toLowerCase();
    if (pop && pop !== 'false') return false;
    if (el.getAttribute('role') === 'tab') return true;
    if (el.getAttribute('aria-expanded') === 'false') return true;
    if (el.getAttribute('data-state') === 'closed') return tag === 'BUTTON' || el.getAttribute('role') === 'button' || el.hasAttribute('aria-controls');
    return false;
  }
  function panelDe(el) {
    var ids = String(el.getAttribute('aria-controls') || '').split(/\s+/);
    for (var i = 0; i < ids.length; i++) if (ids[i]) { var p = document.getElementById(ids[i]); if (p) return p; }
    return null;
  }
  function consumir(el) {
    if (!el) return;
    consumidos.add(el);
    if (el.id) consumidosIds[el.id] = 1;
  }
  function contenedor(el) {
    var p = el.parentElement || el;
    for (var i = 0; i < 3 && p.parentElement && p.parentElement !== document.body; i++) {
      if (textoDe(p.parentElement).length > 3000) break;
      p = p.parentElement;
    }
    return p;
  }
  function diferencia(a, b) {
    var i = 0, j = 0;
    while (i < a.length && i < b.length && a.charAt(i) === b.charAt(i)) i++;
    while (j < a.length - i && j < b.length - i && a.charAt(a.length - 1 - j) === b.charAt(b.length - 1 - j)) j++;
    return b.slice(i, b.length - j).trim();
  }
  async function abrirDesplegable(el) {
    var tab = el.getAttribute('role') === 'tab';
    var pieza = { tipo: tab ? 'pestana' : 'desplegable', pregunta: etiqueta(el).slice(0, 300), respuesta: '' };
    if (el.tagName === 'SUMMARY') {
      var det = el.parentElement;
      det.open = true;
      await esperar(80);
      pieza.respuesta = diferencia(textoDe(el), textoDe(det)).slice(0, 2000);
      det.open = false;
      anotado.set(det, pieza);
      return;
    }
    if (tab) {
      var lista = el.closest('[role="tablist"]');
      if (lista && !pestanasOriginales.has(lista)) pestanasOriginales.set(lista, lista.querySelector('[role="tab"][aria-selected="true"]'));
      if (el.getAttribute('aria-selected') === 'true') {
        var actual = panelDe(el);
        pieza.respuesta = textoDe(actual).slice(0, 2000);
        consumir(actual);
        anotado.set(el, pieza);
        return;
      }
    }
    var cont = contenedor(el), antes = textoDe(cont);
    var r = await tocarYVer(el);
    if (r.salida || r.modal) {
      anotado.set(el, { tipo: 'boton', texto: pieza.pregunta.slice(0, 120), destino: r.salida || { tipo: 'modal', valor: tituloDeModal(r.modal) } });
      await deshacer(el, r);
      return;
    }
    var panel = panelDe(el);
    if (panel && visible(panel)) { pieza.respuesta = textoDe(panel); consumir(panel); }
    else pieza.respuesta = diferencia(antes, textoDe(cont));
    pieza.respuesta = pieza.respuesta.slice(0, 2000);
    anotado.set(el, pieza);
    if (!tab && el.isConnected && (el.getAttribute('aria-expanded') === 'true' || el.getAttribute('data-state') === 'open')) {
      tocar(el);
      await esperarQuieto(80, 500);
    }
  }
  async function leerDesplegables() {
    for (var n = 0; n < MAX_DESP && !tardeToques(); n++) {
      var sig = null, l = document.querySelectorAll(SEL_DESP);
      for (var i = 0; i < l.length && !sig; i++) {
        var c = l[i];
        if (!hechos.has(c) && esDesplegable(c) && visible(c) && !enModal(c) && !c.closest(SEL_RUIDO)) sig = c;
      }
      if (!sig) break;
      hechos.add(sig);
      try { await abrirDesplegable(sig); } catch (e) {}
    }
    pestanasOriginales.forEach(function (orig) {
      if (orig && orig.isConnected && orig.getAttribute('aria-selected') !== 'true') tocar(orig);
    });
    if (pestanasOriginales.size) await esperarQuieto(100, 600);
  }

  // ── Los botones: a dónde llevan, sin seguirlos ──
  function dentroDeAnotado(el) {
    for (var p = el.parentElement, n = 0; p && n < 8; p = p.parentElement, n++) if (anotado.has(p)) return true;
    return false;
  }
  function esEnvio(el) {
    return (el.tagName === 'BUTTON' && el.type === 'submit' && !!el.form) || (el.tagName === 'INPUT' && String(el.type).toLowerCase() === 'submit');
  }
  // Dos pasadas: primero lo que se sabe SIN tocar (links con dirección, botones de enviar) y después los
  // botones que hay que tocar. Si uno de esos saca a la página (location.href, que la ventana aislada
  // no puede atajar), lo que no se toca ya quedó anotado.
  async function leerBotones() {
    var l = document.querySelectorAll(SEL_BOTON), porTocar = [], clics = 0, porTexto = {};
    for (var i = 0; i < l.length && anotado.size < MAX_PIEZAS; i++) {
      var el = l[i];
      if (anotado.has(el) || hechos.has(el) || !visible(el) || enModal(el) || dentroDeAnotado(el)) continue;
      if (el.closest('[role="tablist"]') || el.closest(SEL_RUIDO)) continue;
      var texto = etiqueta(el).slice(0, 120);
      if (!texto) continue;
      var destino = null;
      if (el.tagName === 'A' && el.hasAttribute('href')) destino = destinoDeHref(el);
      if (!destino && esEnvio(el)) destino = { tipo: 'formulario', valor: el.form && el.form.getAttribute('action') ? aLanding(el.form.action) : '' };
      if (destino) anotado.set(el, { tipo: 'boton', texto: texto, destino: destino });
      else porTocar.push([el, texto]);
    }
    for (var j = 0; j < porTocar.length && anotado.size < MAX_PIEZAS && !tarde(); j++) {
      var b = porTocar[j][0], t = porTocar[j][1], d = porTexto[t];
      if (!b.isConnected || anotado.has(b) || dentroDeAnotado(b)) continue;
      if (!d) {
        if (clics >= MAX_CLICS || tardeToques()) continue;
        clics++;
        hechos.add(b);
        var r = await tocarYVer(b);
        d = r.salida || (r.modal ? { tipo: 'modal', valor: tituloDeModal(r.modal) } : r.bajo || { tipo: 'nada' });
        await deshacer(b, r);
        if (Math.abs(window.scrollY) > 2) irA(0);
        porTexto[t] = d;
      }
      anotado.set(b, { tipo: 'boton', texto: t, destino: d });
    }
  }

  // ── Armar las piezas en el orden de la página ──
  function construir() {
    var piezas = [], buf = [], chars = 0, nodos = 0;
    function poner(p) {
      if (piezas.length >= MAX_PIEZAS || chars > MAX_CHARS) return;
      var ult = piezas[piezas.length - 1];
      if (p.tipo === 'texto' && ult && ult.tipo === 'texto') ult.texto += '\n' + p.texto;
      else piezas.push(p);
      chars += JSON.stringify(p).length;
    }
    function cortar() {
      var t = buf.join('').replace(/[ \t\u00a0\r\f\v]+/g, ' ').replace(/ *\n */g, '\n').replace(/^(?:#{1,3}|•) ?$/gm, '').replace(/\n{2,}/g, '\n').trim();
      buf = [];
      if (t) poner({ tipo: 'texto', texto: t });
    }
    function andar(n) {
      if (++nodos > MAX_NODOS || piezas.length >= MAX_PIEZAS) return;
      if (n.nodeType === 3) { buf.push(n.nodeValue); return; }
      if (n.nodeType !== 1) return;
      var tag = String(n.tagName).toUpperCase();
      if (tag === 'BR') { buf.push('\n'); return; }
      if (consumidos.has(n) || (n.id && consumidosIds[n.id])) return;
      var a = anotado.get(n);
      if (a) { cortar(); poner(a); (despues.get(n) || []).forEach(poner); return; }
      if (SALTEAR[tag]) return;
      try { if (n.matches(SEL_RUIDO)) return; } catch (e) {}
      var cs = null;
      try { cs = getComputedStyle(n); } catch (e) {}
      if (cs && (cs.display === 'none' || cs.visibility === 'hidden')) return;
      var enBloque = !cs || !/^(inline|contents)/.test(cs.display);
      if (enBloque) buf.push('\n');
      var nivel = /^H([1-6])$/.exec(tag);
      if (nivel) buf.push('###'.slice(0, Math.min(3, Number(nivel[1]))) + ' ');
      else if (tag === 'LI') buf.push('• ');
      for (var c = n.firstChild; c; c = c.nextSibling) andar(c);
      if (n.shadowRoot) for (var s = n.shadowRoot.firstChild; s; s = s.nextSibling) andar(s);
      if (enBloque) buf.push('\n');
    }
    if (document.body) andar(document.body);
    cortar();
    return piezas;
  }
  function terminar(parcial) {
    if (enviado) return;
    enviado = true;
    tocando = false;
    var piezas = [];
    try { piezas = construir(); } catch (e) {}
    mandar({ fase: 'fin', camino: camino, titulo: String(document.title || '').slice(0, 200), piezas: piezas, ms: ahora(), quieto: quietoOk, parcial: !!parcial || tarde() });
    setTimeout(function () { try { window.close(); } catch (e) {} }, 300);
  }

  async function arrancar() {
    if (empezado) return;
    empezado = true;
    setTimeout(function () { if (!enviado) terminar(true); }, Math.max(1000, TOPE + 500 - ahora()));
    try {
      apagarRastreadores();
      await cargado(TOPE_QUIETO - ahora());
      quietoOk = await esperarQuieto(QUIETO, Math.max(300, TOPE_QUIETO - ahora()));
      await bajarYSubir();
      await esperarQuieto(300, 1500);
      mirarAgendas(null, null);
      tocando = true;
      inicioToques = ahora();
      await leerDesplegables();
      await leerBotones();
      tocando = false;
      mirarAgendas(null, null);
      terminar(false);
    } catch (e) {
      // Lo leído hasta acá vale más que un error: sale como lectura parcial.
      terminar(true);
    }
  }
  // La página se va (un botón que navega con location.href: en la ventana aislada no se puede atajar).
  // Se manda lo leído hasta acá, y el botón que la sacó queda como «sale a otra página».
  window.addEventListener('pagehide', function () {
    if (!dale || enviado) return;
    if (tocando && botonActual && !anotado.has(botonActual)) {
      anotado.set(botonActual, { tipo: 'boton', texto: etiqueta(botonActual).slice(0, 120), destino: { tipo: 'url', valor: '' } });
    }
    terminar(true);
  });
}`;

/**
 * Lo que va PRIMERO en la ventana sin Pixel (lector-pagina.ts), antes que cualquier cosa de la página
 * (y antes de los rastreadores, que se apagan acá: `JS_APAGAR_RASTREADORES`):
 *   · LA GUARDA: si el documento NO quedó aislado (la política `sandbox` no llegó), frena la carga y no
 *     corre nada más. Es la defensa que no depende de una cabecera: abierta sin sandbox, una página de
 *     afuera correría con el origen y la sesión de MaKo;
 *   · el CAMINO de la página: el documento vive en la ruta de MaKo, y una app con router (React Router)
 *     dibujaba su «404» al ver ese camino. Se reescribe al de la landing ANTES del `<base>` (con el base
 *     puesto, el camino se resolvería contra otro origen y el navegador lo rechaza). Medido el 14/10/2026
 *     en Chromium: un documento aislado puede cambiar su camino con `replaceState`;
 *   · `localStorage`, `sessionStorage` y `document.cookie` de MEMORIA: en un origen opaco TIRAN al
 *     tocarlos (SecurityError, medido), y una app que los lee al arrancar se caía entera.
 */
export const JS_PRELUDIO_VENTANA = String.raw`function (ruta) {
  var aislada = false;
  try { aislada = String(self.origin) === 'null'; } catch (e) {}
  if (!aislada) { window.__mkNoAislada = 1; try { window.stop(); } catch (e) {} return; }
  try { history.replaceState(history.state, '', location.protocol + '//' + location.host + ruta); } catch (e) {}
  try { (` + JS_APAGAR_RASTREADORES + String.raw`)(); } catch (e) {}
  function memoria() {
    var d = {};
    return {
      getItem: function (k) { k = String(k); return Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null; },
      setItem: function (k, v) { d[String(k)] = String(v); },
      removeItem: function (k) { delete d[String(k)]; },
      clear: function () { d = {}; },
      key: function (i) { return Object.keys(d)[i] || null; },
      get length() { return Object.keys(d).length; },
    };
  }
  ['localStorage', 'sessionStorage'].forEach(function (k) {
    try { window[k].getItem('x'); } catch (e) {
      try { var m = memoria(); Object.defineProperty(window, k, { configurable: true, get: function () { return m; } }); } catch (x) {}
    }
  });
  try { document.cookie; } catch (e) {
    try {
      var c = '';
      Object.defineProperty(document, 'cookie', {
        configurable: true,
        get: function () { return c; },
        set: function (v) { var p = String(v).split(';')[0]; if (p) c = c ? c + '; ' + p : p; },
      });
    } catch (x) {}
  }
}`;

/** Un string como literal de JavaScript que se puede poner adentro de un `<script>` (sin «<»). */
export const literalJs = (s: string): string =>
  JSON.stringify(s).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

/** Un origen http(s) con forma (`https://host[:puerto]`), o null. */
export function origenValido(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  try {
    const u = new URL(v);
    return (u.protocol === 'https:' || u.protocol === 'http:') && u.origin === v ? u.origin : null;
  } catch {
    return null;
  }
}

/** El lector listo para correr, con su id, su camino y el origen de MaKo. null si algo no tiene forma. */
export function scriptLector(id: string, camino: CaminoLectura, origenMako: string): string | null {
  const origen = origenValido(origenMako);
  if (!idLecturaValido(id) || !(CAMINOS_LECTURA as readonly string[]).includes(camino) || !origen) return null;
  return `(${JS_LECTOR})(${literalJs(id)}, ${literalJs(camino)}, ${literalJs(origen)});`;
}

/** El preludio de la ventana sin Pixel, con el camino de la landing (empieza con «/»). */
export function scriptPreludio(ruta: string): string {
  const r = typeof ruta === 'string' && ruta.startsWith('/') && !ruta.startsWith('//') ? ruta.slice(0, 2_000) : '/';
  return `(${JS_PRELUDIO_VENTANA})(${literalJs(r)});`;
}

/** Lo que contesta `/m.js?leer=<id>`: el lector para el camino del Pixel. */
export type RespuestaLectorPixel = { status: number; cuerpo: string; headers: Record<string, string> };

/**
 * `GET /m.js?leer=<id>` (app/m.js/route.ts): el Pixel de una página abierta con `?mako_leer=<id>` pide
 * esto en vez de medir. Sin token y sin base: el lector no lee nada de MaKo, y no hace nada hasta que
 * MaKo (la ventana que abrió la página) le contesta el «dale». Sin caché: cada id es una lectura.
 * Un id sin forma → 404 con un comentario (JavaScript válido que no hace nada, como el cargador).
 */
export function responderLectorDelPixel(leer: string | null | undefined, origenMako: string): RespuestaLectorPixel {
  const headers = { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'private, no-store' };
  const js = scriptLector(String(leer ?? '').trim(), 'pixel', origenMako);
  if (!js) return { status: 404, cuerpo: '/* MaKo: esta lectura no existe */\n', headers };
  return { status: 200, cuerpo: `${js}\n`, headers };
}
