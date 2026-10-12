// =============================================================================
// El PUENTE del mapa de calor EN VIVO — lo que es `public/replay/901/r.js`
// =============================================================================
// `scripts/replay-libs.mjs` arma `public/replay/901/r.js` con ESTE archivo, sin sus comentarios de línea entera
// (no viajan). El protocolo y por qué existe están en lib/landing-mapa-puente.ts; acá, lo que hace adentro de
// la página del cliente.
//
// QUIÉN LO BAJA: SÓLO una visita de prueba del mapa de MaKo (`?mko_test=mapa-<id>`). El beacon
// (app/api/track/vsl) contesta `rec.v = 901` a esa visita, y el snippet v21+ baja `/replay/901/r.js` en el lugar
// del grabador. Un visitante de verdad nunca lo recibe: a él se le contesta el grabador de siempre.
//
// ⚠️ NO GRABA. No define `window.rrwebRecord` ni `window.rrweb`: el snippet, al terminar de bajarlo, busca con
// qué grabar, no encuentra nada y no hace nada más (lib/landing-token.ts, `replayGrabar`). Un r.js que grabara
// guardaría como sesión del cliente a quien mira el mapa.
//
// ⚠️ SÓLO LE HABLA A MaKo, Y SÓLO LE CONTESTA A MaKo:
//   · el origen de MaKo sale de la dirección de ESTE script (lo baja el snippet desde el dominio de MaKo);
//   · un mensaje cuenta sólo si viene de `window.parent` Y con ese origen;
//   · lo que manda va con `postMessage(m, origen)`, nunca con '*'.
// Abierta sola (sin marco), la página no tiene padre y el puente no se instala.
//
// ⚠️ UN ERROR ACÁ NO PUEDE ROMPER LA PÁGINA DEL CLIENTE: todo va en try/catch, y lo único que deja colgado de
// `window` es la marca `mkoPuenteMapa`. Lo que manda es geometría (cajas, alto, scroll) y la dirección de cada
// marco o video SIN su query: nada de lo que escribe la persona ni del texto de la página.
//
// ⚠️ Y UNA VERSIÓN PUBLICADA NO SE REESCRIBE: el generador tiene fijada su huella. Un cambio de código acá es la
// 902 (entrada nueva en scripts/replay-libs.mjs y PUENTE_MAPA_VERSION = 902).
// =============================================================================
;(function () {
  'use strict';
  try {
    if (window.mkoPuenteMapa) return;
    var padre = window.parent;
    if (!padre || padre === window) return;

    var MARCA = 'mko-mapa';
    var V = 1;
    var MAX_SELS = 80;
    var MAX_HUECOS = 30;
    var MAX_SRC = 500;
    var MAX_Y = 1000000;

    // El origen de MaKo: el de la dirección de este script. `currentScript` existe mientras corre un script
    // que no es un módulo, también uno con `async`; si no está, se busca el r.js entre los scripts.
    var origenDeMako = function () {
      try {
        var s = document.currentScript;
        var src = s && s.src ? s.src : '';
        if (!src) {
          var todos = document.getElementsByTagName('script');
          for (var i = todos.length - 1; i >= 0; i--) {
            if (/\/replay\/\d+\/r\.js(\?|#|$)/.test(todos[i].src || '')) { src = todos[i].src; break; }
          }
        }
        if (!src) return null;
        var u = new URL(src, location.href);
        var local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
        if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) return null;
        return u.origin;
      } catch (e) { return null; }
    };
    var origen = origenDeMako();
    if (!origen) return;
    window.mkoPuenteMapa = V;

    var sels = [];
    var pedido = 0;
    var timer = 0;
    var repasos = -1;

    var num = function (n) { n = Math.round(Number(n)); return isFinite(n) ? n : 0; };
    var cajaDe = function (el) {
      try {
        var r = el.getBoundingClientRect();
        return [num(r.left), num(r.top), num(r.width), num(r.height)];
      } catch (e) { return null; }
    };
    var buscar = function (sel) {
      try { return document.querySelector(sel); } catch (e) { return null; }
    };
    var altoDelDocumento = function () {
      var d = document.documentElement, b = document.body;
      return Math.max(d ? d.scrollHeight : 0, b ? b.scrollHeight : 0, window.innerHeight || 0);
    };
    var scrollY = function () {
      var d = document.documentElement;
      return window.pageYOffset || (d ? d.scrollTop : 0) || 0;
    };
    var huecos = function () {
      var out = [];
      try {
        var els = document.querySelectorAll('iframe, video');
        for (var i = 0; i < els.length && out.length < MAX_HUECOS; i++) {
          var el = els[i];
          var r = cajaDe(el);
          if (!r || r[2] < 1 || r[3] < 1) continue;
          var tag = String(el.tagName || '').toLowerCase();
          var src = tag === 'video' ? (el.currentSrc || el.getAttribute('src') || '') : (el.getAttribute('src') || '');
          out.push([r[0], r[1], r[2], r[3], tag, String(src).split(/[?#]/)[0].slice(0, MAX_SRC)]);
        }
      } catch (e) {}
      return out;
    };
    // El ancho que USA la página: sin la barra de scroll (en Windows le come 15-17 px a la ventana).
    var anchoUtil = function () {
      var d = document.documentElement;
      return (d && d.clientWidth) || window.innerWidth || 0;
    };
    var estado = function () {
      var rects = [];
      for (var i = 0; i < sels.length; i++) {
        var el = buscar(sels[i]);
        rects.push(el ? cajaDe(el) : null);
      }
      return {
        mko: MARCA, v: V, tipo: 'estado', pedido: pedido,
        ancho: num(anchoUtil()), alto: num(altoDelDocumento()), vh: num(window.innerHeight), sy: num(scrollY()),
        rects: rects, huecos: huecos()
      };
    };
    var mandar = function (m) {
      try { padre.postMessage(m, origen); } catch (e) {}
    };
    // Un estado por cuadro como mucho: el scroll dispara decenas de eventos por segundo.
    var programar = function () {
      if (timer) return;
      var listo = function () { timer = 0; mandar(estado()); };
      try {
        timer = window.requestAnimationFrame ? window.requestAnimationFrame(listo) : setTimeout(listo, 16);
      } catch (e) { timer = setTimeout(listo, 16); }
    };
    // Las imágenes y las fuentes que llegan tarde corren los elementos: durante los primeros segundos después
    // del primer pedido se vuelve a medir una vez por segundo.
    var repasar = function () {
      if (repasos >= 8) return;
      repasos++;
      setTimeout(function () { mandar(estado()); repasar(); }, 1000);
    };

    window.addEventListener('message', function (e) {
      try {
        if (e.origin !== origen || e.source !== padre) return;
        var d = e.data;
        if (!d || typeof d !== 'object' || d.mko !== MARCA) return;
        if (d.tipo === 'pedir') {
          var nuevos = [];
          var lista = Array.isArray(d.sels) ? d.sels : [];
          for (var i = 0; i < lista.length && nuevos.length < MAX_SELS; i++) {
            if (typeof lista[i] === 'string' && lista[i].length <= 200) nuevos.push(lista[i]);
          }
          sels = nuevos;
          pedido = typeof d.pedido === 'number' && isFinite(d.pedido) ? d.pedido : 0;
          mandar(estado());
          if (repasos < 0) repasar();
        } else if (d.tipo === 'scroll') {
          var y = Number(d.y);
          if (isFinite(y)) window.scrollTo(0, Math.max(0, Math.min(y, MAX_Y)));
          programar();
        }
      } catch (err) {}
    });
    try { window.addEventListener('scroll', programar, { passive: true }); } catch (e) {}
    try { window.addEventListener('resize', programar); } catch (e) {}
    try {
      if (window.ResizeObserver) {
        var ro = new window.ResizeObserver(programar);
        if (document.documentElement) ro.observe(document.documentElement);
        if (document.body) ro.observe(document.body);
      }
    } catch (e) {}

    mandar({ mko: MARCA, v: V, tipo: 'listo' });
  } catch (e) {}
})();
