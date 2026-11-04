// AUTOMATIZACIONES (NORIA) — lo que se mueve en la copia de la página «Overview» de Noria. Código nuestro, escrito desde las RECETAS
// medidas (el INFORME del medidor: la barra lateral entra desde la izquierda en .9 s con power3.out, sus filas en escalera de 35 ms,
// la barra de arriba baja 12 px en escalera de 50 ms, la página entra a los 120 ms) y desde las capturas. Nada del código de la tienda.
(function () {
  'use strict';
  var quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var P3 = 'cubic-bezier(.215,.61,.355,1)';
  var BACK = 'cubic-bezier(.34,1.56,.64,1)';
  function entra(el, desde, dur, demora, curva) {
    if (quieto || !el.animate) return;
    el.animate([desde, { opacity: 1, transform: 'none' }], { duration: dur, delay: demora, easing: curva || P3, fill: 'backwards' });
  }

  // ── Los datos del demo (los de la captura) ──────────────────────────────────────────────────────────────────────────
  var HORAS = {
    ok: [4, 3, 3, 5, 3, 1, 8, 14, 21, 24, 20], ko: [0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2],
    antes: [2.5, 2.5, 2.5, 2.5, 2.5, 2.6, 3.6, 7.5, 15.9, 24.4, 29.6, 30.6, 30.7, 30.7, 30.2, 27.7, 21.1, 11.7, 5, 2.9, 2.6, 2.5, 2.5, 2.5],
    ahora: 10.2, tope: 50, eje: [0, 3, 6, 9, 12, 15, 18, 21], rotulo: function (i) { return (i < 10 ? '0' : '') + i + ':00'; },
  };
  var DIAS7 = {
    ok: [102, 131, 124, 118, 96, 41, 106], ko: [3, 6, 2, 4, 5, 1, 4], antes: [96, 120, 128, 110, 101, 38, 33], ahora: null, tope: 150,
    eje: [0, 1, 2, 3, 4, 5, 6], rotulo: function (i) { return ['Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue'][i]; },
  };
  var DIAS30 = (function () {
    var ok = [], ko = [], antes = [];
    for (var i = 0; i < 30; i++) { var f = (i % 7 === 4 || i % 7 === 5) ? .4 : 1; ok.push(Math.round((96 + 18 * Math.sin(i / 3)) * f)); ko.push(1 + (i * 7) % 5); antes.push(Math.round((90 + 16 * Math.cos(i / 4)) * f)); }
    return { ok: ok, ko: ko, antes: antes, ahora: null, tope: 150, eje: [0, 5, 10, 15, 20, 25], rotulo: function (i) { return 'Sep ' + (21 + i > 30 ? 21 + i - 30 : 21 + i); } };
  })();
  var RANGOS = { today: HORAS, 7: DIAS7, 30: DIAS30 };

  // ── Run pulse ──────────────────────────────────────────────────────────────────────────────────────────────────────
  var pulso = $('#pulse');
  function curva(pts) {
    var d = 'M' + pts[0][0] + ',' + pts[0][1];
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += ' C' + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(2) + ',' + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(2) + ' ' + (p2[0] - (p3[0] - p1[0]) / 6).toFixed(2) + ',' + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(2) + ' ' + p2[0] + ',' + p2[1];
    }
    return d;
  }
  function dibujaPulso(r, anima) {
    var n = r.antes.length, H = 100, k = H / r.tope;
    var h = '<div class="pulse__plot">';
    [0, .5, 1].forEach(function (f) { h += '<div class="pulse__grid" style="top:' + (H - f * H) + '%"></div><span class="pulse__y" style="top:' + (H - f * H) + '%">' + Math.round(f * r.tope) + '</span>'; });
    h += '<div class="pulse__cols" style="grid-template-columns:repeat(' + n + ',1fr)">';
    for (var i = 0; i < n; i++) {
      var fut = i >= r.ok.length;
      h += '<div class="pcol' + (fut ? ' pcol--fut' : '') + '"><span class="pcol__rail"></span>';
      if (!fut) {
        var ok = r.ok[i] * k, ko = r.ko[i] * k;
        h += '<span class="pcol__ok" style="height:' + ok.toFixed(2) + '%"></span>';
        if (r.ko[i]) h += '<span class="pcol__ko" style="height:max(9px,calc(' + ko.toFixed(2) + '% - 1px));bottom:calc(' + ok.toFixed(2) + '% + 3px)"></span>';
      }
      h += '</div>';
    }
    h += '</div>';
    var pts = r.antes.map(function (v, i) { return [((i + .5) / n * 1000).toFixed(2) * 1, +(H - v * k).toFixed(2)]; });
    h += '<svg class="pulse__line" viewBox="0 0 1000 ' + H + '" preserveAspectRatio="none"><path vector-effect="non-scaling-stroke" d="' + curva(pts) + '"/></svg>';
    if (r.ahora != null) h += '<div class="pulse__now" style="left:' + ((r.ahora + .5) / n * 100).toFixed(3) + '%"><span>Now</span><i></i></div>';
    r.eje.forEach(function (i) { h += '<span class="pulse__x" style="left:' + ((i + .5) / n * 100).toFixed(3) + '%">' + r.rotulo(i) + '</span>'; });
    h += '</div><div class="legend"><span><i style="background:var(--primary)"></i>Succeeded</span><span><i style="background:var(--bad-c)"></i>Failed</span><span><i class="l"></i>A week earlier</span></div>';
    pulso.innerHTML = h;
    if (!anima) return;
    $$('.pcol', pulso).forEach(function (c, i) {
      $$('.pcol__ok, .pcol__ko', c).forEach(function (b) { entra(b, { opacity: 0, transform: 'scaleY(0)' }, 700, 260 + i * 24); });
    });
    var linea = $('.pulse__line', pulso);
    if (!quieto && linea.animate) linea.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 1100, delay: 420, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'backwards' });
    var ahora = $('.pulse__now', pulso);
    if (ahora) entra(ahora, { opacity: 0, transform: 'translateY(-6px)' }, 500, 900);
  }

  // El selector: la pastilla se desliza (la única transición de transform del INFORME: .35 s con su --ease).
  var seg = $('.seg');
  if (seg) {
    var marca = document.createElement('span');
    marca.className = 'seg__mark';
    marca.style.cssText = 'position:absolute;top:4px;left:0;height:29px;border-radius:10px;background:var(--raised);box-shadow:0 1px 2px #14221e14,0 4px 10px -4px #14221e2e;transition:transform .35s var(--ease),width .35s var(--ease);pointer-events:none';
    seg.style.position = 'relative';
    seg.insertBefore(marca, seg.firstChild);
    var pon = function (b) { marca.style.width = b.offsetWidth + 'px'; marca.style.transform = 'translateX(' + b.offsetLeft + 'px)'; };
    $$('.seg__btn', seg).forEach(function (b) {
      b.style.position = 'relative'; b.style.zIndex = 1;
      if (b.classList.contains('is-on')) { b.style.background = 'transparent'; b.style.boxShadow = 'none'; }
      b.addEventListener('click', function () {
        $$('.seg__btn', seg).forEach(function (x) { x.classList.toggle('is-on', x === b); x.style.background = 'transparent'; x.style.boxShadow = 'none'; });
        pon(b); dibujaPulso(RANGOS[b.dataset.r], true);
      });
    });
    requestAnimationFrame(function () { pon($('.seg__btn.is-on', seg)); });
    addEventListener('resize', function () { pon($('.seg__btn.is-on', seg)); });
  }

  // ── Reliability: 14 días por flujo ──────────────────────────────────────────────────────────────────────────────────
  var REL = [
    ['POD matcher', '32224323211131', '97.9%'], ['Booking confirmations', '13111111331311', '99.2%'],
    ['Customs entry pre-check', '33341144441144', '94.7%'], ['ETA change alerts', '11111113331131', '99.1%'],
    ['Detention invoice audit', '41414114144144', '91.2%'], ['Free-time watch', '11111141111141', '98.1%'],
    ['Freight invoices to ERP', '11100444110011', '98.3%'],
  ];
  var rel = $('#rel');
  rel.innerHTML = REL.map(function (f) {
    return '<a class="rel__row" href="#"><span class="rel__n">' + f[0] + '</span><span class="rel__d">' + f[1].split('').map(function (q) { return '<i class="q' + q + '"></i>'; }).join('') + '</span><span class="rel__p num">' + f[2] + '</span></a>';
  }).join('');

  // ── Busiest flows ───────────────────────────────────────────────────────────────────────────────────────────────────
  var FLOWS = [
    ['OI', 'oi', 'POD matcher', 'Email with an attachment in Ops inbox', 473, '98.3%', 0, '4 min ago', [9, 9, 8.6, 3, 1, 8.4, 8.5, 8.6, 8.8, 9.3, 5.5, 5, 9, 4]],
    ['BW', 'bw', 'Booking confirmations', 'Booking confirmed in Bluewater TMS', 353, '98.9%', 0, '21 min ago', [8, 7.6, 7.8, 4, 1, 7.2, 7.3, 7.5, 7.6, 7.3, 4, 2.8, 6.5, 2]],
    ['BW', 'bw', 'Customs entry pre-check', 'Shipment booked in Bluewater TMS', 187, '91.4%', 1, '2 min ago', [8, 7.2, 5, 6, 3.5, 6.8, 7.2, 7.1, 6.5, 2.5, 3, 3.6, 8.5, 1]],
    ['PW', 'pw', 'ETA change alerts', 'Vessel ETA moves by more than 12 h', 167, '98.2%', 0, '16 min ago', [7.5, 7.5, 7.2, 3, 2.5, 7, 7.3, 7.5, 7.2, 6.5, 2.5, 4, 7.8, 1]],
    ['OI', 'oi', 'Detention invoice audit', 'Carrier invoice in Ops inbox', 125, '88.0%', 1, '22 min ago', [5, 3, 8, 2.5, 7, 2, 4, 6, 5.5, 8, 2, 3, 7, 1]],
    ['PW', 'pw', 'Free-time watch', 'Every 2 hours', 78, '97.4%', 0, '42 min ago', [8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 2]],
  ];
  function spark(v) {
    var W = 110, H = 26, mx = 10, pts = v.map(function (y, i) { return [+(i / (v.length - 1) * W).toFixed(2), +(H - 1 - (y / mx) * (H - 3)).toFixed(2)]; });
    var l = 'M' + pts.map(function (p) { return p.join(','); }).join(' L');
    var d = curva(pts);
    return '<svg class="spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none"><path class="a" d="' + d + ' L' + W + ',' + H + ' L0,' + H + ' Z"/><path class="l" d="' + d + '"/></svg>';
  }
  $('#flows').innerHTML = FLOWS.map(function (f) {
    return '<tr><td class="c-fl"><span class="fl"><span class="ap ap--lg ap--' + f[1] + '">' + f[0] + '</span><span><b>' + f[2] + '</b><span>' + f[3] + '</span></span></span></td>'
      + '<td class="c-st"><span class="pill pill--ok pill--live">Live</span></td><td class="c-sp">' + spark(f[8]) + '</td>'
      + '<td class="c-runs r tnum num">' + f[4] + '</td><td class="c-pc r tpct num' + (f[6] ? ' is-bad' : '') + '">' + f[5] + '</td>'
      + '<td class="c-ago"><span class="tago">' + f[7] + '</span></td><td class="c-dots"><svg class="i tdots" style="width:18px;height:18px"><use href="#i-more"/></svg></td></tr>';
  }).join('');

  // ── Las cifras que cuentan (una vez, al entrar) ─────────────────────────────────────────────────────────────────────
  function cuenta(el, demora) {
    var n = parseFloat(el.dataset.n), d = +(el.dataset.d || 0), s = el.dataset.s || '';
    if (quieto || !isFinite(n)) return;
    var t0 = null, dur = 1100;
    el.textContent = (0).toFixed(d) + s;
    setTimeout(function () {
      requestAnimationFrame(function paso(t) {
        if (t0 == null) t0 = t;
        var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
        el.textContent = (n * e).toFixed(d) + s;
        if (p < 1) requestAnimationFrame(paso);
      });
    }, demora);
  }

  // ── La entrada (la línea de tiempo del armazón del INFORME) ─────────────────────────────────────────────────────────
  var movil = matchMedia('(max-width: 760px)').matches;
  dibujaPulso(HORAS, true);
  var side = $('.side');
  if (side && !movil) {
    entra(side, { opacity: 0, transform: 'translateX(-40px)' }, 900, 0);
    $$('.side__top > *, .nav > *, .side__foot > *').forEach(function (e, i) { entra(e, { opacity: 0, transform: 'translateX(-12px)' }, 600, 150 + i * 35); });
  }
  var tab = $('.tabbar');
  if (tab && movil) entra(tab, { opacity: 0, transform: 'translateY(90px)' }, 900, 0);
  $$('.top > *').filter(function (e) { return e.offsetParent; }).forEach(function (e, i) { entra(e, { opacity: 0, transform: 'translateY(-12px)' }, 600, 50 + i * 50); });
  $$('.ov__head > div > *, .ov__acts > *').forEach(function (e, i) { entra(e, { opacity: 0, transform: 'translateY(14px)' }, 700, 120 + i * 50); });
  $$('.ov > .card').forEach(function (c, i) { entra(c, { opacity: 0, transform: 'translateY(18px)' }, 800, 180 + i * 60); });
  $$('.kpis [data-n]').forEach(function (e, i) { cuenta(e, 320 + i * 60); });
  $$('.steps .step').forEach(function (s, i) { entra(s, { opacity: 0, transform: 'translateX(-8px)' }, 500, 420 + i * 70); });
  $$('.jf li').forEach(function (s, i) { entra(s, { opacity: 0, transform: 'translateY(6px)' }, 450, 600 + i * 40); });
  $$('.look__row').forEach(function (s, i) { entra(s, { opacity: 0, transform: 'translateY(10px)' }, 600, 520 + i * 60); });
  $$('.rel__d').forEach(function (r, j) { $$('i', r).forEach(function (c, i) { entra(c, { opacity: 0, transform: 'scale(.4)' }, 420, 560 + j * 40 + i * 18, BACK); }); });
  $$('.spark').forEach(function (s, i) { if (!quieto && s.animate) s.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 900, delay: 700 + i * 60, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'backwards' }); });
  $$('.feed__item').forEach(function (s, i) { entra(s, { opacity: 0, transform: 'translateY(8px)' }, 500, 760 + i * 45); });
  $$('.ask__sug').forEach(function (s, i) { entra(s, { opacity: 0, transform: 'translateY(8px)' }, 500, 700 + i * 50); });
})();
