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
    var programar = function () {
      if (timer) return;
      var listo = function () { timer = 0; mandar(estado()); };
      try {
        timer = window.requestAnimationFrame ? window.requestAnimationFrame(listo) : setTimeout(listo, 16);
      } catch (e) { timer = setTimeout(listo, 16); }
    };
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
