// PRODUCTIVIDAD (FERNLY) — lo que se mueve en la copia de la página «Dashboard» de Fernly. Código nuestro, escrito desde las
// RECETAS medidas en el INFORME: los títulos suben desde abajo con una máscara (yPercent 115 → 0, .85 s, power4.out, 24 ms de
// escalera); las tarjetas entran desde opacidad 0, 36 px más abajo y .985 de escala (.85 s, power3.out, 70 ms de escalera); las filas
// de una lista entran desde 12 px (.55 s, power3.out, 50 ms); los números cuentan 1,3 s con power3.out; una tarjeta con «lift» sube
// 4 px al pasar (.45 s, power3.out). Nada del código de la tienda.
(function () {
  'use strict';
  var quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var P3 = 'cubic-bezier(.215,.61,.355,1)', P4 = 'cubic-bezier(.165,.84,.44,1)';
  var p3 = function (t) { return 1 - Math.pow(1 - t, 3); };
  function entra(el, desde, dur, demora, curva) {
    if (quieto || !el || !el.animate) return;
    el.animate([desde, { opacity: 1, transform: 'none' }], { duration: dur, delay: demora, easing: curva || P3, fill: 'backwards' });
  }

  // ── El medio arco de «Project Progress»: lo terminado, lo que está en curso y lo pendiente (rayado) ─────────────────────
  var g = $('#gauge');
  if (g) {
    var CX = 125, CY = 125, R = 102, W = 46;
    var pto = function (f) { var a = Math.PI * (1 + f); return [CX + R * Math.cos(a), CY + R * Math.sin(a)]; };
    var arco = function (a, b) { var p = pto(a), q = pto(b); return 'M' + p[0].toFixed(2) + ' ' + p[1].toFixed(2) + ' A' + R + ' ' + R + ' 0 0 1 ' + q[0].toFixed(2) + ' ' + q[1].toFixed(2); };
    g.innerHTML = '<defs><pattern id="raya" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="#fdfdfc"/><rect width="2" height="7" fill="#8d9a92"/></pattern></defs>' +
      '<path d="' + arco(0.92, 1) + '" fill="none" stroke="url(#raya)" stroke-width="' + W + '" stroke-linecap="round"/>' +
      '<path class="g-seg" d="' + arco(0.42, 0.92) + '" fill="none" stroke="#0d3a23" stroke-width="' + W + '" stroke-linecap="round" pathLength="100"/>' +
      '<path class="g-seg" d="' + arco(0, 0.42) + '" fill="none" stroke="#1d7347" stroke-width="' + W + '" stroke-linecap="round" pathLength="100"/>';
    if (!quieto) $$('.g-seg', g).forEach(function (s, i) {
      s.animate([{ strokeDasharray: '0 100' }, { strokeDasharray: '100 100' }], { duration: 1300, delay: 300 + i * 120, easing: P3, fill: 'backwards' });
    });
  }

  // ── Los números cuentan ──────────────────────────────────────────────────────────────────────────────────────────────
  $$('[data-cuenta]').forEach(function (el, i) {
    var v = Number(el.getAttribute('data-cuenta')), suf = el.getAttribute('data-suf') || '';
    if (quieto) return;
    var t0 = null, d = 220 + i * 70;
    function f(t) { if (t0 == null) t0 = t + d; var k = Math.max(0, Math.min(1, (t - t0) / 1300)); el.textContent = Math.round(v * p3(k)) + suf; if (k < 1) requestAnimationFrame(f); }
    el.textContent = '0' + suf; requestAnimationFrame(f);
  });

  // ── La entrada ───────────────────────────────────────────────────────────────────────────────────────────────────────
  $$('.head h1, .head p').forEach(function (n, i) { entra(n, { opacity: 0, transform: 'translateY(115%)' }, 850, 80 + i * 24, P4); });
  $$('.head__acts .btn').forEach(function (n, i) { entra(n, { opacity: 0, transform: 'translateY(12px)' }, 550, 160 + i * 50); });
  $$('.card').forEach(function (n, i) { entra(n, { opacity: 0, transform: 'translateY(36px) scale(.985)' }, 850, 140 + i * 70); });
  $$('.plist li, .tlist li').forEach(function (n, i) { entra(n, { opacity: 0, transform: 'translateY(12px)' }, 550, 500 + i * 50); });
  $$('.bar__fill').forEach(function (n, i) { entra(n, { opacity: 0, transform: 'scaleY(0)' }, 850, 320 + i * 60, P4); });

  // ── «Lift»: la tarjeta sube 4 px al pasar ────────────────────────────────────────────────────────────────────────────
  if (!quieto && matchMedia('(hover: hover)').matches) $$('[data-lift]').forEach(function (n) {
    n.addEventListener('pointerenter', function () { n.animate([{ transform: getComputedStyle(n).transform === 'none' ? 'none' : getComputedStyle(n).transform }, { transform: 'translateY(-4px)' }], { duration: 450, easing: P3, fill: 'forwards' }); });
    n.addEventListener('pointerleave', function () { n.animate([{ transform: 'translateY(-4px)' }, { transform: 'none' }], { duration: 500, easing: P3, fill: 'forwards' }); });
  });
})();
