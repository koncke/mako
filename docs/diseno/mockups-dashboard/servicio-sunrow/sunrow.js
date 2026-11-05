// AGENCIA O SERVICIO (SUNROW) — lo que se mueve en la copia de la página «Overview» de Sunrow. Código nuestro, escrito desde las RECETAS
// medidas en el INFORME (demos/sunrow/INFORME.txt, la línea de tiempo de la página): la tarjeta de arriba sube desde 24 px (opacidad 0 y
// .985, .9 s, power3.out); a los .05 s el saludo sube por palabra con un giro de 6° (115 % → 0, .85 s, power4.out, 22 ms); a los .15 s
// la fecha, el texto y las píldoras entran desde 10 px (.55 s, 60 ms); a los .2 s la tarjeta de la IA entra desde 30 px a la derecha y
// .97 (.8 s); a los .25 s los seis números suben desde 22 px (.9 s, 60 ms); a los .4 s las tarjetas de abajo y las de la derecha suben
// desde 30 px (.9 s, 70 ms); a los .7 s las barras de cada sitio crecen (1 s, power3.out, 80 ms); a los .75 s las filas de las listas
// entran desde 10 px (.55 s, 25 ms); a los .8 s los días del calendario crecen desde .4 (.6 s, back.out(3), 12 ms, del de hoy hacia
// afuera). Los números cuentan 1,2 s (power3.out). Al pasar, una tarjeta con «data-lift» sube 4 px (.45 s; baja en .5 s).
// ⚠️ Cómo entran el gráfico del avance y el anillo del presupuesto no está en lo medido: el gráfico se dibuja de izquierda a derecha y el
// anillo crece desde cero, a los .7 s (supuesto, anotado en el relevo). Nada del código de la tienda.
(function () {
  'use strict';
  var quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var P3 = 'cubic-bezier(.215,.61,.355,1)', P4 = 'cubic-bezier(.165,.84,.44,1)', P2IO = 'cubic-bezier(.455,.03,.515,.955)', BACK3 = 'cubic-bezier(.34,2.2,.64,1)';
  var p3 = function (t) { return 1 - Math.pow(1 - t, 3); };
  function anima(el, kf, dur, demora, curva) {
    if (quieto || !el || !el.animate) return;
    el.animate(kf, { duration: dur, delay: demora, easing: curva || P3, fill: 'backwards' });
  }
  function sube(els, y, demora, paso) { els.forEach(function (n, i) { anima(n, [{ opacity: 0, transform: 'translateY(' + y + 'px) scale(.985)' }, { opacity: 1, transform: 'none' }], 900, demora + i * paso); }); }
  function entra(els, y, demora, paso) { els.forEach(function (n, i) { anima(n, [{ opacity: 0, transform: 'translateY(' + y + 'px)' }, { opacity: 1, transform: 'none' }], 550, demora + i * paso); }); }
  function cuenta(el, demora, dur) {
    var fin = el.textContent, m = fin.match(/^(\D*?)(\d[\d,]*)(\.\d+)?(.*)$/);
    if (quieto || !m) return;
    var pre = m[1], dec = m[3] || '', suf = m[4], v = Number(m[2].replace(/,/g, '') + dec), d = Math.max(0, dec.length - 1);
    var fmt = function (x) { return pre + x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) + suf; };
    var t0 = null;
    function f(t) { if (t0 == null) t0 = t + demora; var k = Math.max(0, Math.min(1, (t - t0) / dur)); el.textContent = k < 1 ? fmt(v * p3(k)) : fin; if (k < 1) requestAnimationFrame(f); }
    el.textContent = fmt(0); requestAnimationFrame(f);
  }

  sube($$('.hero'), 24, 0, 0);
  var t = document.querySelector('.hero__title');
  if (t && !quieto) {
    t.innerHTML = t.textContent.trim().split(/\s+/).map(function (w) { return '<span class="w"><span class="w__i">' + w + '</span></span>'; }).join(' ');
    $$('.w__i', t).forEach(function (n, i) { anima(n, [{ transform: 'translateY(115%) rotate(6deg)' }, { transform: 'none' }], 850, 50 + i * 22, P4); });
  }
  entra($$('.hero__eyebrow, .hero__sub, .hchip'), 10, 150, 60);
  anima(document.querySelector('.ai-card'), [{ opacity: 0, transform: 'translateX(30px) scale(.97)' }, { opacity: 1, transform: 'none' }], 800, 200);
  sube($$('.kpi'), 22, 250, 60);
  sube($$('.dash__main > .card, .dash__row3 > .card, .dash__aside > .card'), 30, 400, 70);
  $$('.sites .meter__fill').forEach(function (n, i) { anima(n, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(' + getComputedStyle(n).getPropertyValue('--v') + ')' }], 1000, 700 + i * 80); });
  $$('.bar2 > i').forEach(function (n, i) { anima(n, [{ transform: 'scaleX(0)' }, { transform: 'none' }], 1000, 700 + i * 50); });
  $$('.chart__plan, .chart__act').forEach(function (n) { n.setAttribute('pathLength', '1'); n.style.strokeDasharray = '1 1'; anima(n, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], 1100, 700, P2IO); });
  $$('.donut__seg').forEach(function (n) { anima(n, [{ strokeDasharray: '0 100' }, { strokeDasharray: n.getAttribute('stroke-dasharray') }], 1000, 700); });
  entra($$('.sites .site, .list .list__row, .todo, .notes .list__row, .quick__a'), 10, 750, 25);
  var dias = $$('.cal__d:not(.is-pad)'), i0 = dias.findIndex(function (d) { return d.classList.contains('is-today'); });
  dias.map(function (d, i) { return { d: d, k: Math.abs(i - i0) }; }).sort(function (a, b) { return a.k - b.k; })
    .forEach(function (x, i) { anima(x.d, [{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'none' }], 600, 800 + i * 12, BACK3); });
  $$('.kpi__n, .donut__c b, .read b, .site__r strong, .gauge__n').forEach(function (n) { cuenta(n, 250, 1200); });
  if (!quieto && matchMedia('(hover: hover)').matches) $$('[data-lift]').forEach(function (n) {
    n.addEventListener('pointerenter', function () { n.style.transition = 'transform .45s ' + P3; n.style.transform = 'translateY(-4px)'; });
    n.addEventListener('pointerleave', function () { n.style.transition = 'transform .5s ' + P3; n.style.transform = ''; });
  });
})();
