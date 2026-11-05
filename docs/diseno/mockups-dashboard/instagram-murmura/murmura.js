// INSTAGRAM Y REDES (MURMURA) — lo que se mueve en la copia de la página «Overview» de Murmura. Código nuestro, escrito desde las RECETAS
// medidas en el INFORME (demos/murmura/INFORME.txt, la librería de entradas): el título sube por palabra con un giro de 6° (115 % → 0,
// .85 s, power4.out, 22 ms); los números de la cabecera y su botón entran desde 14 px (.55 s, power3.out, 80 ms, a los .12 s); una
// tarjeta sube desde 34 px y .985 (.9 s, power3.out, 70 ms); una fila entra desde 12 px (.55 s, power3.out, 45 ms); una ficha se
// levanta desde 40 px girada ±3° y .94 (.8 s, back.out(1.4), 60 ms); los números cuentan 1,2 s (power3.out); al pasar, lo que lleva
// «data-lift» sube 4 px (.45 s; baja en .5 s). El armazón: el fondo aparece en 1,2 s, la marca, las pestañas y las herramientas bajan
// desde 14 px (60 ms, a los .05 s) y la barra de la izquierda entra desde 90 px (.9 s, a los .1 s) con sus botones desde 10 px (35 ms,
// a los .3 s).
// ⚠️ QUÉ PIEZA USA CUÁL RECETA Y A QUÉ DEMORA NO ESTÁ EN LO MEDIDO: el INFORME trae la librería y el armazón, no la línea de tiempo de la
// página. Aquí: las tarjetas con la de tarjeta desde los .2 s, las filas con la de fila desde los .45 s, los días de la semana con la
// de ficha desde los .5 s y las barras crecen a los .6 s (supuesto, anotado en el relevo). Nada del código de la tienda.
(function () {
  'use strict';
  var quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var P3 = 'cubic-bezier(.215,.61,.355,1)', P4 = 'cubic-bezier(.165,.84,.44,1)', BACK14 = 'cubic-bezier(.34,1.45,.64,1)';
  var p3 = function (t) { return 1 - Math.pow(1 - t, 3); };
  function anima(el, kf, dur, demora, curva) {
    if (quieto || !el || !el.animate) return;
    el.animate(kf, { duration: dur, delay: demora, easing: curva || P3, fill: 'backwards' });
  }
  function filas(els, y, demora, paso) { els.forEach(function (n, i) { anima(n, [{ opacity: 0, transform: 'translateY(' + y + 'px)' }, { opacity: 1, transform: 'none' }], 550, demora + i * paso); }); }
  function cuenta(el, demora, dur) {
    var fin = el.textContent, m = fin.match(/^(\D*?)(\d[\d,]*)(\.\d+)?(.*)$/);
    if (quieto || !m) return;
    var pre = m[1], dec = m[3] || '', suf = m[4], v = Number(m[2].replace(/,/g, '') + dec), d = Math.max(0, dec.length - 1);
    var fmt = function (x) { return pre + x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) + suf; };
    var t0 = null;
    function f(t) { if (t0 == null) t0 = t + demora; var k = Math.max(0, Math.min(1, (t - t0) / dur)); el.textContent = k < 1 ? fmt(v * p3(k)) : fin; if (k < 1) requestAnimationFrame(f); }
    el.textContent = fmt(0); requestAnimationFrame(f);
  }

  // El armazón.
  anima(document.querySelector('.mesh'), [{ opacity: 0 }, { opacity: 1 }], 1200, 0, 'cubic-bezier(.25,.46,.45,.94)');
  filas([document.querySelector('.brand'), document.querySelector('.tabs')].concat($$('.top__tools > *')), -14, 50, 60);
  anima(document.querySelector('.dock'), [{ opacity: 0, transform: 'translateX(-90px)' }, { opacity: 1, transform: 'none' }], 900, 100);
  filas($$('.dock__btn'), 10, 300, 35);

  // La página.
  var t = document.querySelector('.head__title');
  if (t && !quieto) {
    t.innerHTML = t.textContent.trim().split(/\s+/).map(function (w) { return '<span class="w"><span class="w__i">' + w + '</span></span>'; }).join(' ');
    $$('.w__i', t).forEach(function (n, i) { anima(n, [{ transform: 'translateY(115%) rotate(6deg)' }, { transform: 'none' }], 850, i * 22, P4); });
  }
  $$('.head .stat, .head__actions > *').forEach(function (n, i) { anima(n, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], 550, 120 + i * 80); });
  $$('.ov .card').forEach(function (n, i) { anima(n, [{ opacity: 0, transform: 'translateY(34px) scale(.985)' }, { opacity: 1, transform: 'none' }], 900, 200 + i * 70); });
  filas($$('.ov-after__item, .ov-todo, .ov-netlist li, .ov-ib__row, .ov-feed li'), 12, 450, 45);
  $$('.ov-day').forEach(function (n, i) { anima(n, [{ opacity: 0, transform: 'translateY(40px) rotate(' + (i % 2 ? 3 : -3) + 'deg) scale(.94)' }, { opacity: 1, transform: 'none' }], 800, 500 + i * 60, BACK14); });
  $$('.bar > i').forEach(function (n, i) { anima(n, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(' + getComputedStyle(n).getPropertyValue('--v') + ')' }], 1000, 600 + i * 60); });
  $$('.ov-ib__sent .s').forEach(function (n, i) { anima(n, [{ transform: 'scaleX(0)' }, { transform: 'none' }], 1000, 600 + i * 60); });
  $$('.stat__n b, .ov-growth__big b, .ov-ib__tiles b, .ov-topcard__s b').forEach(function (n) { cuenta(n, 250, 1200); });
  if (!quieto && matchMedia('(hover: hover)').matches) $$('[data-lift]').forEach(function (n) {
    n.addEventListener('pointerenter', function () { n.style.transition = 'transform .45s ' + P3; n.style.transform = 'translateY(-4px)'; });
    n.addEventListener('pointerleave', function () { n.style.transition = 'transform .5s ' + P3; n.style.transform = ''; });
  });
})();
