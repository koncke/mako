// CONTENIDO E IA (ORRERY) — lo que se mueve en la copia de la página «Overview» de Orrery. Código nuestro, escrito desde la LÍNEA
// DE TIEMPO medida en el INFORME (demos/orrery/INFORME.txt): los títulos suben desde abajo con una máscara (yPercent 115 → 0, .8 s,
// power4.out, 22 ms de escalera); a los .1 s las tarjetas entran desde opacidad 0, 32 px más abajo y .985 de escala (.8 s,
// power3.out, 65 ms de escalera); a los .25 s los números cuentan desde cero (1,3 s, power3.out; el costo de cada modelo, 1,2 s);
// a los .45 s las líneas chicas se descubren de izquierda a derecha (1,1 s, power3.inOut); a los .55 s las filas de las listas
// entran desde 10 px (.5 s, power3.out, 40 ms). Lo que el INFORME no dice (cómo entra el gráfico grande y las barras del costo) se
// supone y está anotado en el relevo. Nada del código de la tienda.
(function () {
  'use strict';
  var quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var P3 = 'cubic-bezier(.215,.61,.355,1)', P4 = 'cubic-bezier(.165,.84,.44,1)', P3IO = 'cubic-bezier(.645,.045,.355,1)';
  var p3 = function (t) { return 1 - Math.pow(1 - t, 3); };
  function anima(el, kf, dur, demora, curva) {
    if (quieto || !el || !el.animate) return;
    el.animate(kf, { duration: dur, delay: demora, easing: curva || P3, fill: 'backwards' });
  }

  // ── Los números cuentan desde cero, con sus decimales, su prefijo y su sufijo («$1,463», «107.7k», «697ms») ─────────────
  function cuenta(el, demora, dur) {
    var fin = el.textContent, m = fin.match(/^(\D*?)(\d[\d,]*)(\.\d+)?(.*)$/);
    if (quieto || !m) return;
    var pre = m[1], dec = m[3] || '', suf = m[4], v = Number(m[2].replace(/,/g, '') + dec), d = Math.max(0, dec.length - 1);
    var fmt = function (x) { return pre + x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) + suf; };
    var t0 = null;
    function f(t) { if (t0 == null) t0 = t + demora; var k = Math.max(0, Math.min(1, (t - t0) / dur)); el.textContent = k < 1 ? fmt(v * p3(k)) : fin; if (k < 1) requestAnimationFrame(f); }
    el.textContent = fmt(0); requestAnimationFrame(f);
  }

  $$('.phead h1, .phead__s').forEach(function (n, i) { anima(n, [{ transform: 'translateY(115%)' }, { transform: 'none' }], 800, i * 22, P4); });
  $$('.card').forEach(function (n, i) { anima(n, [{ opacity: 0, transform: 'translateY(32px) scale(.985)' }, { opacity: 1, transform: 'none' }], 800, 100 + i * 65); });
  $$('.kpi__n').forEach(function (n) { cuenta(n, 250, 1300); });
  $$('.sp__h b').forEach(function (n) { cuenta(n, 250, 1200); });
  $$('.spark').forEach(function (n) { anima(n, [{ clipPath: 'inset(-4px 100% -4px -4px)' }, { clipPath: 'inset(-4px -4px -4px -4px)' }], 1100, 450, P3IO); });
  $$('.plot__line').forEach(function (n) {
    n.setAttribute('pathLength', '1'); n.setAttribute('stroke-dasharray', '1');
    anima(n, [{ strokeDashoffset: '1' }, { strokeDashoffset: '0' }], 1100, 400, P3IO);
  });
  $$('.sp__bar i, .budget i').forEach(function (n) { n.style.transformOrigin = '0 50%'; anima(n, [{ transform: 'scaleX(0)' }, { transform: 'none' }], 1200, 250); });
  $$('.models > li, .rq li').forEach(function (n, i) { anima(n, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], 500, 550 + i * 40); });
})();
