// CS ANALYST (MENDER) — lo que se mueve en la copia de «Cases overview». Código nuestro, escrito desde las RECETAS medidas en el
// INFORME de la entrada: los números cuentan 1,1 s con power3.out; los anillos se dibujan desde su valor en 1,1 s (power3.out, 30 ms
// de escalera); el anillo de motivos reparte sus tramos en 1,1 s con power3.inOut y 60 ms de escalera; las tarjetas entran desde
// .92 con back.out(1.5) en .45 s; la pastilla de las pestañas se corre en .5 s con expo.out. Nada del código de la tienda.
(function () {
  'use strict';
  var quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var P3 = 'cubic-bezier(.215,.61,.355,1)';
  var P3IO = 'cubic-bezier(.645,.045,.355,1)';
  var BACK = 'cubic-bezier(.34,1.56,.64,1)';
  var p3 = function (t) { return 1 - Math.pow(1 - t, 3); };
  var p3io = function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  function entra(el, desde, dur, demora, curva) {
    if (quieto || !el.animate) return;
    el.animate([desde, { opacity: 1, transform: 'none' }], { duration: dur, delay: demora, easing: curva || P3, fill: 'backwards' });
  }
  function tween(dur, demora, curva, paso) {
    if (quieto) { paso(1); return; }
    var t0 = null;
    function f(t) { if (t0 == null) t0 = t + demora; var k = Math.max(0, Math.min(1, (t - t0) / dur)); paso(curva(k)); if (k < 1) requestAnimationFrame(f); }
    paso(0); requestAnimationFrame(f);
  }

  // ── El anillo de los motivos: un círculo por tramo, cada uno corrido a donde arranca ──────────────────────────────────
  var donut = $('#donut');
  if (donut) {
    var TR = [[46, 'var(--emerald)'], [27, 'var(--coral)'], [17, 'var(--amber)'], [10, 'var(--ink-4)']];
    var GAP = .8, R = 75;
    donut.innerHTML = TR.map(function () {
      return '<circle cx="86" cy="86" r="' + R + '" fill="none" stroke-width="22" pathLength="100"/>';
    }).join('');
    var cs = $$('circle', donut);
    var fin = []; var acc = 0;
    TR.forEach(function (t) { fin.push({ s: acc, l: t[0] }); acc += t[0]; });
    cs.forEach(function (c, i) { c.style.stroke = TR[i][1]; });
    var pinta = function (k) {
      cs.forEach(function (c, i) {
        var s = fin[i].s * k, l = Math.max(0, fin[i].l * k - GAP);
        c.setAttribute('stroke-dasharray', l.toFixed(3) + ' 100');
        c.setAttribute('stroke-dashoffset', (-s - GAP / 2).toFixed(3));
      });
    };
    tween(1100, 220, p3io, pinta);
  }

  // ── Los números cuentan desde cero (el total del anillo, los porcentajes y los conteos de los carriles) ───────────────
  $$('[data-cuenta]').forEach(function (el, i) {
    var v = Number(el.getAttribute('data-cuenta')); var suf = el.getAttribute('data-suf') || '';
    tween(1100, 200 + i * 20, p3, function (k) { el.textContent = Math.round(v * k) + suf; });
  });

  // ── Los anillos de salud se dibujan desde su valor ──────────────────────────────────────────────────────────────────
  $$('.ring__val').forEach(function (c, n) {
    var f = Number(c.getAttribute('data-fill'));
    tween(1100, 260 + n * 30, p3, function (k) { c.setAttribute('stroke-dashoffset', (f * (1 - k)).toFixed(3)); });
  });
  $$('.legend__bar i').forEach(function (b, i) { entra(b, { transform: 'scaleX(0)' }, 1100, 260 + i * 60, P3IO); });

  // ── La entrada de la página ─────────────────────────────────────────────────────────────────────────────────────────
  entra($('.page-t'), { opacity: 0, transform: 'translateY(10px)' }, 600, 120);
  $$('.panel').forEach(function (p, i) { entra(p, { opacity: 0, transform: 'translateY(16px)' }, 700, 160 + i * 70); });
  $$('.case').forEach(function (c, i) { entra(c, { opacity: 0, transform: 'scale(.92)' }, 450, 260 + i * 25, BACK); });

  // ── Las pestañas: la pastilla se corre a la elegida ─────────────────────────────────────────────────────────────────
  $$('.seg').forEach(function (seg) {
    var pill = $('.seg__pill', seg); var tabs = $$('[role="tab"]', seg);
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () {
        tabs.forEach(function (o, j) { o.setAttribute('aria-selected', String(j === i)); });
        pill.style.transform = 'translateX(' + (i * 100) + '%)';
      });
    });
  });
})();
