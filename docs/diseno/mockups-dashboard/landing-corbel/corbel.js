// ═══════════════════════════════════════════════════════════════════════════════════════════
// LANDING (CORBEL) — el dibujo y el movimiento de la página «Dashboard» de Corbel. 4/11/2026. Código nuestro.
// Los movimientos salen del INFORME (demos/corbel/INFORME.txt, la función de entrada de la página y sus ayudantes):
//   · el armazón: el fondo aparece (1,2 s), la marca, las pestañas y las herramientas bajan (y −14, .6 s, cada .06 s), el dock
//     entra de la izquierda (x −90, .9 s) y sus botones suben (y 10, cada .035 s);
//   · la barra de controles sube (y 8, .6 s, cada .05 s, desde .15 s); las tarjetas suben (y 26, escala .985, .9 s, expo.out,
//     cada .07 s, desde .2 s); los números de arriba, después (y 14, .6 s, cada .08 s, desde .27 s);
//   · los números cuentan desde 0 (1,3 s, power3.out, desde .45 s), y con ellos: las barritas suben (1 s, expo.out, cada .08 s),
//     la línea se dibuja (1,3 s, power3.inOut), su área aparece (.8 s, desde 1,05 s) y su punto crece (.5 s, back.out(3), desde
//     1,6 s), el anillo se llena (1,4 s, power3.inOut), las barras finas suben (.9 s, cada .04 s) y el medidor corre hasta su
//     puntaje (1,7 s, power3.inOut);
//   · el gráfico: las líneas guía se dibujan de izquierda a derecha (1,1 s, expo.out, cada .06 s, desde .55 s), sus rótulos
//     entran (x −6, .6 s, cada .05 s, desde .6 s), los meses suben (y 6, .5 s, cada .03 s, desde .65 s), el promedio aparece a
//     1,45 s y la burbuja del mes actual sale a 2,05 s (escala .9, .5 s, back.out(2));
//   · el total de visitas cuenta (1,3 s, desde .85 s) y los gajos del anillo corren de a uno (1,1 s, power3.inOut, cada .18 s);
//   · el «en vivo» gira sus dígitos como un cuentakilómetros (.9 s, expo.out, cada .04 s);
//   · lo que se toca: la tarjeta sube 3 px (.45 s, power3.out) y la pastilla del selector corre (.55 s, expo.out).
// ⚠️ Lo que el INFORME NO dice y acá se supone (anotado en el relevo): cómo suben las columnas del gráfico (se usa la misma
// subida que las barritas, .9 s, expo.out, cada .04 s, desde .7 s) y cómo entra el mapa de calor (las celdas crecen como el
// ayudante «pop» de la casa: escala .6 → 1, .6 s, back.out(2.6), de a una por columna, desde .75 s).
// ═══════════════════════════════════════════════════════════════════════════════════════════
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, padre) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); padre?.appendChild(n); return n; };
  const EXPO = 'cubic-bezier(.16, 1, .3, 1)', P3 = 'cubic-bezier(.215, .61, .355, 1)', P3IO = 'cubic-bezier(.645, .045, .355, 1)';
  const BACK2 = 'cubic-bezier(.34, 1.56, .64, 1)', BACK3 = 'cubic-bezier(.34, 1.8, .64, 1)', BACK26 = 'cubic-bezier(.34, 1.7, .64, 1)';
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const anim = (n, kf, o) => (quieto || !n ? null : n.animate(kf, { fill: 'backwards', ...o }));
  const eP3 = (t) => 1 - Math.pow(1 - t, 3);
  const eP3IO = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const correr = (dur, demora, ease, cada, fin) => {
    if (quieto) { cada(1); fin?.(); return; }
    const t0 = performance.now() + demora;
    const paso = (ahora) => {
      const t = Math.min(1, Math.max(0, (ahora - t0) / dur));
      cada(ease(t));
      if (t < 1) requestAnimationFrame(paso); else fin?.();
    };
    cada(0); requestAnimationFrame(paso);
  };

  // ── el armazón ──────────────────────────────────────────────────────────────────────────────
  anim($('.mesh'), [{ opacity: 0 }, { opacity: 1 }], { duration: 1200, easing: 'ease-out' });
  [$('.brand'), $('.tabs'), ...$$('.tools > *')].forEach((n, i) => anim(n, [{ transform: 'translateY(-14px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 600, delay: 50 + i * 60, easing: P3 }));
  const dock = $('.dock');
  if (dock) {
    const tel = matchMedia('(max-width: 760px)').matches;
    anim(dock, [{ translate: tel ? '0 90px' : '-90px 0', opacity: 0 }, { translate: '0 0', opacity: 1 }], { duration: 900, delay: 100, easing: P3 });
    $$('.dock__btn', dock).forEach((n, i) => anim(n, [{ transform: 'translateY(10px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 600, delay: 300 + i * 35, easing: P3 }));
  }
  anim($('.head'), [{ transform: 'translateY(22px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 1100, delay: 150, easing: EXPO });

  // ── la página ───────────────────────────────────────────────────────────────────────────────
  $$('.bar > *').forEach((n, i) => anim(n, [{ transform: 'translateY(8px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 600, delay: 150 + i * 50, easing: P3 }));
  $$('.board > .card').forEach((n, i) => anim(n, [{ transform: 'translateY(26px) scale(.985)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 900, delay: 200 + i * 70, easing: EXPO }));
  $$('.board > .tile').forEach((n, i) => anim(n, [{ transform: 'translateY(14px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 600, delay: 270 + i * 80, easing: P3 }));

  // ── los números cuentan desde cero ────────────────────────────────────────────────────────────
  const FMT = {
    int: (v) => Math.round(v).toLocaleString('en-US'),
    usd: (v) => `$${Math.round(v).toLocaleString('en-US')}`,
    pct0: (v) => `${Math.round(v)}%`,
    pct1: (v) => `${v.toFixed(1)}%`,
  };
  const DEMORA = (n) => (n.closest('.visits') ? 850 : n.closest('.score') ? 450 : 450);
  const DURA = (n) => (n.closest('.ring, .donut') ? 1400 : n.closest('.visits__ley') ? 1100 : n.closest('.gauge') ? 1700 : 1300);
  $$('[data-count]').forEach((n) => {
    const fin = Number(n.dataset.count), fmt = FMT[n.dataset.fmt] ?? FMT.int;
    const ease = n.closest('.gauge, .ring') ? eP3IO : eP3;
    correr(DURA(n), DEMORA(n), ease, (t) => { n.textContent = fmt(fin * t); }, () => { n.textContent = fmt(fin); });
  });
  $$('.delta svg').forEach((s, i) => anim(s, [{ transform: s.closest('.is-down') ? 'rotate(0deg)' : 'rotate(180deg)' }, { transform: s.closest('.is-down') ? 'rotate(180deg)' : 'rotate(0deg)' }], { duration: 500, delay: 450 + i * 40, easing: BACK2 }));

  // ── lo de adentro de los números de arriba ─────────────────────────────────────────────────────
  $$('.minibars b').forEach((b, i) => anim(b, [{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: 1000, delay: 450 + i * 80, easing: EXPO }));
  $$('.thin b').forEach((b, i) => anim(b, [{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: 900, delay: 450 + i * 40, easing: EXPO }));
  $$('.spark').forEach((s) => {
    anim($('.spark__line', s), [{ strokeDasharray: '100 100', strokeDashoffset: 100 }, { strokeDasharray: '100 100', strokeDashoffset: 0 }], { duration: 1300, delay: 450, easing: P3IO });
    anim($('.spark__area', s), [{ opacity: 0 }, { opacity: 1 }], { duration: 800, delay: 1050 });
    anim($('.spark__dot', s), [{ transform: 'scale(0)' }, { transform: 'scale(1)' }], { duration: 500, delay: 1600, easing: BACK3 });
  });
  $$('.ring__fill').forEach((c) => {
    const fin = Number(c.getAttribute('stroke-dasharray').split(' ')[0]);
    correr(1400, 450, eP3IO, (t) => c.setAttribute('stroke-dasharray', `${(fin * t).toFixed(2)} 100`));
  });

  // ── el medidor ──────────────────────────────────────────────────────────────────────────────
  $$('.gauge').forEach((g) => {
    const svg = $('svg', g), puntaje = Number(g.dataset.score);
    const CX = 150, CY = 146, R = 109;
    const pt = (a, r) => [CX - r * Math.cos(a * Math.PI / 180), CY - r * Math.sin(a * Math.PI / 180)];
    const ticks = [];
    for (let a = 0; a <= 180; a += 6) {
      const mayor = a % 30 === 0;
      const [x1, y1] = pt(a, mayor ? 124.5 : 126.5), [x2, y2] = pt(a, mayor ? 137.5 : 135.5);
      ticks.push([a, el('line', { class: 'gauge__tick', x1, y1, x2, y2 }, svg)]);
    }
    const arco = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;
    el('path', { class: 'gauge__track', d: arco }, svg);
    const fill = el('path', { class: 'gauge__fill', d: arco, pathLength: 100, 'stroke-dasharray': '0 100' }, svg);
    const knob = el('g', {}, svg);
    el('circle', { class: 'gauge__knob', r: 11 }, knob);
    el('circle', { class: 'gauge__knob-c', r: 4 }, knob);
    const pintar = (v) => {
      fill.setAttribute('stroke-dasharray', `${v.toFixed(2)} 100`);
      const [x, y] = pt(v * 1.8, R);
      knob.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
      ticks.forEach(([a, l]) => l.classList.toggle('is-off', a > v * 1.8 + .5));
    };
    correr(1700, 450, eP3IO, (t) => pintar(puntaje * t));
  });

  // ── el gráfico de barras ─────────────────────────────────────────────────────────────────────
  $$('.chart').forEach((c) => {
    const max = Number(c.dataset.max), cols = $$('.col', c);
    cols.forEach((col) => { $('b', col).style.height = `${(Number(col.dataset.v) / max) * 100}%`; col.style.overflow = 'hidden'; });
    const avg = $('.avg', c);
    if (avg) avg.style.top = `${(1 - Number(c.dataset.avg) / max) * 100}%`;
    $$('.col b', c).forEach((b, i) => anim(b, [{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: 900, delay: 700 + i * 40, easing: EXPO }));
    $$('.chart__gl', c).forEach((g, i) => anim(g, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 1100, delay: 550 + i * 60, easing: EXPO }));
    $$('.chart__y span', c).forEach((s, i) => anim(s, [{ opacity: 0, translate: '-6px 0' }, { opacity: 1, translate: '0 0' }], { duration: 600, delay: 600 + i * 50, easing: P3 }));
    $$('.chart__x span', c).forEach((s, i) => anim(s, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: 650 + i * 30, easing: P3 }));
    anim(avg, [{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: 1450 });
    // La burbuja: arriba del mes que se señala, centrada en su columna y sin salirse del gráfico.
    const tip = $('.tip', c), plot = $('.chart__plot', c), xs = $$('.chart__x span', c);
    const MES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const ubicar = (i) => {
      const col = cols[i], w = plot.clientWidth, tw = tip.offsetWidth;
      const cx = col.offsetLeft + col.offsetWidth / 2;
      tip.style.left = `${Math.max(0, Math.min(w - tw, cx - tw / 2))}px`;
      xs.forEach((s, k) => s.classList.toggle('is-now', k === i));
    };
    const llenar = (i) => {
      const col = cols[i], v = Number(col.dataset.v), fore = col.classList.contains('is-fore');
      $('.tip__t', tip).textContent = `${MES[i]} 2026${fore ? ' · Forecast' : ''}`;
      const r = $$('.tip__r b', tip);
      r[0].textContent = `$${v.toLocaleString('en-US')}`;
      r[1].textContent = col.dataset.o ?? '—';
      const y = Number(col.dataset.y);
      r[2].textContent = Number.isFinite(y) && col.dataset.y ? `${y >= 0 ? '+' : '−'}${Math.abs(y).toFixed(1)}%` : '—';
      r[2].classList.toggle('is-up', Number.isFinite(y) && y >= 0);
    };
    const ahora = Number(c.dataset.now);
    ubicar(ahora);
    addEventListener('resize', () => ubicar(Number(tip.dataset.i ?? ahora)));
    anim(tip, [{ opacity: 0, transform: 'scale(.9)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: 2050, easing: BACK2 });
    cols.forEach((col, i) => {
      col.addEventListener('pointerenter', () => { tip.dataset.i = String(i); llenar(i); ubicar(i); });
    });
    plot.addEventListener('pointerleave', () => { tip.dataset.i = String(ahora); llenar(ahora); ubicar(ahora); });
  });

  // ── el mapa de calor ─────────────────────────────────────────────────────────────────────────
  $$('.heat__g').forEach((g) => {
    const celdas = $$('.heat__c', g), cols = 7;
    celdas.forEach((n, i) => {
      const col = i % cols, fila = Math.floor(i / cols);
      anim(n, [{ transform: 'scale(.6)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 600, delay: 750 + col * 50 + fila * 20, easing: BACK26 });
    });
  });

  // ── el anillo de las visitas ───────────────────────────────────────────────────────────────────
  $$('.donut').forEach((d) => {
    const partes = d.dataset.parts.split(',').map(Number), total = partes.reduce((a, b) => a + b, 0);
    const svg = $('svg', d), HUECO = .9, COLORES = ['var(--c1)', 'var(--c2)', 'var(--c3)'];
    let ini = 0;
    partes.forEach((v, i) => {
      const largo = (v / total) * 100, desde = ini;
      ini += largo;
      const c = el('circle', { cx: 76, cy: 76, r: 66, pathLength: 100, style: `stroke:${COLORES[i]}` }, svg);
      const pintar = (t) => {
        c.setAttribute('stroke-dasharray', `${Math.max(0, largo * t - HUECO).toFixed(2)} 100`);
        c.setAttribute('stroke-dashoffset', `${(-desde * t).toFixed(2)}`);
      };
      correr(1100, 850 + i * 180, eP3IO, pintar);
    });
  });

  // ── el «en vivo»: un cuentakilómetros ──────────────────────────────────────────────────────────
  $$('[data-odo]').forEach((n) => {
    let valor = Number(n.dataset.odo);
    const armar = (txt) => {
      n.textContent = '';
      for (const ch of txt) {
        if (!/\d/.test(ch)) { n.append(ch); continue; }
        const odo = document.createElement('span'); odo.className = 'odo';
        const tira = document.createElement('span');
        for (let d = 0; d < 10; d++) { const i = document.createElement('i'); i.textContent = String(d); tira.append(i); }
        odo.append(tira); n.append(odo);
      }
    };
    const mostrar = (v, mover) => {
      const txt = v.toLocaleString('en-US');
      if ($$('.odo', n).length !== txt.replace(/\D/g, '').length) armar(txt);
      [...txt.replace(/\D/g, '')].forEach((d, i) => {
        const tira = $$('.odo > span', n)[i];
        tira.style.transitionDelay = mover ? `${i * 40}ms` : '0ms';
        if (!mover) tira.style.transition = 'none';
        tira.style.transform = `translateY(-${Number(d) * 10}%)`;
        if (!mover) requestAnimationFrame(() => { tira.style.transition = ''; });
      });
    };
    mostrar(0, false);
    setTimeout(() => mostrar(valor, true), 300);
    if (!quieto) setInterval(() => { valor += Math.round((Math.random() - .45) * 8); mostrar(valor, true); }, 3600);
  });

  // ── lo que se toca ──────────────────────────────────────────────────────────────────────────
  if (matchMedia('(hover: hover)').matches && !quieto) {
    $$('[data-lift]').forEach((n) => {
      let a = null;
      n.addEventListener('pointerenter', () => { a?.cancel(); a = n.animate([{ transform: getComputedStyle(n).transform === 'none' ? 'none' : getComputedStyle(n).transform }, { transform: 'translateY(-3px)' }], { duration: 450, easing: P3, fill: 'forwards' }); });
      n.addEventListener('pointerleave', () => { a?.cancel(); a = n.animate([{ transform: 'translateY(-3px)' }, { transform: 'none' }], { duration: 500, easing: P3 }); });
    });
  }
  $$('.seg').forEach((s) => {
    const pill = document.createElement('span'); pill.className = 'seg__pill'; pill.setAttribute('aria-hidden', 'true'); s.prepend(pill);
    const bs = $$('button', s);
    const mover = (b, animar) => {
      if (!animar) pill.style.transition = 'none';
      pill.style.width = `${b.offsetWidth}px`;
      pill.style.transform = `translateX(${b.offsetLeft}px)`;
      if (!animar) requestAnimationFrame(() => { pill.style.transition = ''; });
    };
    const elegir = (b, animar) => { bs.forEach((x) => x.setAttribute('aria-pressed', String(x === b))); mover(b, animar); };
    elegir(bs.find((b) => b.getAttribute('aria-pressed') === 'true') ?? bs[0], false);
    bs.forEach((b) => b.addEventListener('click', () => elegir(b, true)));
    addEventListener('resize', () => mover(bs.find((b) => b.getAttribute('aria-pressed') === 'true') ?? bs[0], false));
  });
})();
