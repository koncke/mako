// CURSO O COMUNIDAD (VITREA) — lo que se mueve en la copia de la página «Overview» de Vitrea. Código nuestro, escrito desde las RECETAS
// medidas en el INFORME (demos/vitrea/INFORME.txt): la barra de arriba baja desde 70 px (.9 s, back.out(1.3), 70 ms de escalera) y la de
// la izquierda entra desde 90 px (.9 s, power3.out) con sus botones desde 10 px (.55 s, 35 ms); el título sube por palabra desde abajo
// con un giro de 6° (115 % → 0, .85 s, power4.out, 22 ms); los números de arriba entran desde 14 px (.55 s, power3.out, 80 ms, a los
// .12 s); cada tarjeta se descubre desde 22 px, .975 de escala y un recorte de abajo (.75 s, expo.out, 60 ms) y su contenido aparece
// desde 8 px (.4 s, power3.out, 30 ms); los números cuentan 1,2 s con power3.out. ⚠️ El recorte de la tarjeta lo arma una función del
// INFORME que no se ve entera: acá sale de abajo hacia arriba desde el 30 %. Nada del código de la tienda.
(function () {
  'use strict';
  var quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var P3 = 'cubic-bezier(.215,.61,.355,1)', P4 = 'cubic-bezier(.165,.84,.44,1)', EXPO = 'cubic-bezier(.16,1,.3,1)', BACK = 'cubic-bezier(.34,1.3,.64,1)';
  var p3 = function (t) { return 1 - Math.pow(1 - t, 3); };
  function anima(el, kf, dur, demora, curva) {
    if (quieto || !el || !el.animate) return;
    el.animate(kf, { duration: dur, delay: demora, easing: curva || P3, fill: 'backwards' });
  }
  function cuenta(el, demora, dur) {
    var fin = el.textContent, m = fin.match(/^(\D*?)(\d[\d,]*)(\.\d+)?(.*)$/);
    if (quieto || !m) return;
    var pre = m[1], dec = m[3] || '', suf = m[4], v = Number(m[2].replace(/,/g, '') + dec), d = Math.max(0, dec.length - 1);
    var fmt = function (x) { return pre + x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) + suf; };
    var t0 = null;
    function f(t) { if (t0 == null) t0 = t + demora; var k = Math.max(0, Math.min(1, (t - t0) / dur)); el.textContent = k < 1 ? fmt(v * p3(k)) : fin; if (k < 1) requestAnimationFrame(f); }
    el.textContent = fmt(0); requestAnimationFrame(f);
  }

  // ── El armazón ───────────────────────────────────────────────────────────────────────────────────────────────────────
  $$('.brand, .tabs, .tools').forEach(function (n, i) { anima(n, [{ transform: 'translateY(-70px)' }, { transform: 'none' }], 900, 20 + i * 70, BACK); });
  var dock = document.querySelector('.dock');
  if (dock && getComputedStyle(dock).position !== 'fixed') anima(dock, [{ transform: 'translateX(-90px)' }, { transform: 'none' }], 900, 100);
  $$('.dock__btn').forEach(function (n, i) { anima(n, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], 550, 300 + i * 35); });

  // ── El título, por palabra, y los números de arriba ──────────────────────────────────────────────────────────────────
  var t = document.querySelector('.head__title');
  if (t && !quieto) {
    t.innerHTML = t.textContent.trim().split(/\s+/).map(function (w) { return '<span class="w"><span class="w__i">' + w + '</span></span>'; }).join(' ');
    $$('.w__i', t).forEach(function (n, i) { anima(n, [{ transform: 'translateY(115%) rotate(6deg)' }, { transform: 'none' }], 850, i * 22, P4); });
  }
  $$('.head .stat').forEach(function (n, i) { anima(n, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], 550, 120 + i * 80); });

  // ── Las tarjetas ─────────────────────────────────────────────────────────────────────────────────────────────────────
  $$('.card').forEach(function (n, i) {
    var d = 200 + i * 60;
    anima(n, [{ transform: 'translateY(22px) scale(.975)', clipPath: 'inset(30% 0 0 0 round 26px)' }, { transform: 'none', clipPath: 'inset(-60px -60px -60px -60px round 26px)' }], 750, d, EXPO);
    Array.prototype.slice.call(n.children).forEach(function (c, k) { anima(c, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], 400, d + 50 + k * 30); });
  });
  $$('.stat__n, .big b, .rate__n, .tile__v').forEach(function (n) {
    var txt = n.firstChild && n.firstChild.nodeType === 3 ? n.firstChild : null;
    if (txt && n.childNodes.length === 1) { cuenta(n, 250, 1200); return; }
    if (txt) { var s = document.createElement('span'); s.textContent = txt.textContent.trim(); n.replaceChild(s, txt); if (n.childNodes.length > 1) n.insertBefore(document.createTextNode(' '), s.nextSibling); cuenta(s, 250, 1200); }
  });
})();
