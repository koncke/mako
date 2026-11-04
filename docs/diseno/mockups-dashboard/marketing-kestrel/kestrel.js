// ═══════════════════════════════════════════════════════════════════════════════════════════
// MARKETING (KESTREL) — el dibujo y el movimiento de la página «Realtime overview» de Kestrel. 4/11/2026. Código nuestro.
// Los movimientos salen del INFORME (demos/kestrel/INFORME.txt), que esta vez SÍ trae la entrada de la página:
//   · el armazón: la barra lateral entra de la izquierda (x −24, .7 s) y sus renglones de a uno (x −10, .6 s, cada .035 s, desde
//     .15 s); la barra de arriba baja (y −10, .6 s, desde .1 s);
//   · la página: el encabezado y las tarjetas suben (y 22, escala .985 → 1, .85 s, cada .07 s), con la curva de la casa;
//   · los números cuentan desde 0 (1,1 s, power3.out);
//   · las líneas de Trends se dibujan (1,4 s, desde .1 s + .12 s por línea, power2.inOut) y su punto y su rótulo aparecen
//     (1 s, desde .6 s + .12 s por línea);
//   · la tinta de las pestañas corre (.45 s) y al cambiar de pestaña lo de adentro sale (.18 s) y las filas entran de a una (y 6,
//     .4 s, cada .02 s); la tabla de Trends reemplaza al gráfico igual (.18 s afuera, .35 s adentro con y 6).
// ⚠️ Lo que el INFORME NO dice y acá se supone (anotado en el relevo): la demora de cada número al contar (se usa la de su
// tarjeta) y la del anillo, que usa la del medidor (1,1 s, power3.out, desde .2 s).
// ═══════════════════════════════════════════════════════════════════════════════════════════
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, padre) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); padre?.appendChild(n); return n; };
  const W = 'cubic-bezier(.22, 1, .36, 1)', P3 = 'cubic-bezier(.215, .61, .355, 1)', P2IO = 'cubic-bezier(.455, .03, .515, .955)', P2IN = 'cubic-bezier(.55, .085, .68, .53)';
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const anim = (n, kf, o) => (quieto ? null : n.animate(kf, { fill: 'backwards', ...o }));

  // ── la entrada ──────────────────────────────────────────────────────────────────────────────
  const side = $('.side');
  if (side) {
    anim(side, [{ transform: 'translateX(-24px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 700, easing: W });
    $$('.side__logo, .nav__item, .side__foot', side).forEach((n, i) => anim(n, [{ transform: 'translateX(-10px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 600, delay: 150 + i * 35, easing: W }));
  }
  const top = $('.top');
  if (top) anim(top, [{ transform: 'translateY(-10px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 600, delay: 100, easing: W });
  const piezas = $$('.pagehead, .card');
  piezas.forEach((n, i) => anim(n, [{ transform: 'translateY(22px) scale(.985)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 850, delay: i * 70, easing: W }));
  const demoraDe = (n) => Math.max(0, piezas.indexOf(n.closest('.card, .pagehead'))) * 70;

  // ── los números cuentan desde cero ────────────────────────────────────────────────────────────
  const FMT = {
    int: (v) => Math.round(v).toLocaleString('en-US'),
    x: (v) => `${v.toFixed(1)}×`,
    pct: (v) => `${v.toFixed(1)}%`,
    usd: (v) => `$${Math.round(v).toLocaleString('en-US')}`,
    usd2: (v) => `$${v.toFixed(2)}`,
    musd2: (v) => `US$${v.toFixed(2)}`,
    usdm: (v) => `US$${Math.round(v).toLocaleString('en-US')}`,
  };
  const easeP3 = (t) => 1 - Math.pow(1 - t, 3);
  $$('[data-count]').forEach((n) => {
    if (quieto) return;
    const fin = Number(n.dataset.count), fmt = FMT[n.dataset.fmt] ?? FMT.int, demora = demoraDe(n), dur = 1100;
    n.textContent = fmt(0);
    const t0 = performance.now() + demora;
    const paso = (ahora) => {
      const t = Math.min(1, Math.max(0, (ahora - t0) / dur));
      n.textContent = fmt(fin * easeP3(t));
      if (t < 1) requestAnimationFrame(paso); else n.textContent = fmt(fin);
    };
    requestAnimationFrame(paso);
  });

  // ── el anillo ───────────────────────────────────────────────────────────────────────────────
  $$('[data-ring]').forEach((svg) => {
    const arc = $('.ring__arc', svg), r = Number(arc.getAttribute('r')), C = 2 * Math.PI * r, v = Number(svg.dataset.ring);
    arc.setAttribute('stroke-dasharray', C.toFixed(2));
    arc.setAttribute('stroke-dashoffset', (C * (1 - v)).toFixed(2));
    anim(arc, [{ strokeDashoffset: C }, { strokeDashoffset: C * (1 - v) }], { duration: 1100, delay: 200 + demoraDe(svg), easing: P3 });
  });

  // ── Trends: tres líneas en % contra el arranque ───────────────────────────────────────────────
  const azar = (semilla) => () => { semilla |= 0; semilla = (semilla + 0x6d2b79f5) | 0; let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const caminata = (n, fin, semilla) => {
    const r = azar(semilla), w = [0];
    for (let i = 1; i < n; i++) w.push(w[i - 1] + (r() + r() + r() - 1.5) * 1.45);
    const corr = w[n - 1] - fin;
    return w.map((v, i) => +(v - corr * (i / (n - 1))).toFixed(2));
  };
  const signo = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}%`;
  const fechaDe = (desde, i) => { const d = new Date(`${desde}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + i); return d; };
  const MES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  $$('[data-trends]').forEach((caja) => {
    const d = JSON.parse(caja.dataset.trends), plot = $('.chart__plot', caja), tabla = $('.chart__table', caja), tip = $('.chart__tip', caja);
    const series = d.series.map((s) => ({ ...s, v: s.v ?? caminata(d.dias, s.fin, s.seed) }));
    const n = series[0].v.length;
    let primera = true;
    const dibujar = () => {
      plot.innerHTML = '';
      const ancho = plot.clientWidth, alto = plot.clientHeight, izq = 44, der = ancho - 62, arriba = 21, abajo = alto - 29, tope = d.tope ?? 20;
      const svg = el('svg', { viewBox: `0 0 ${ancho} ${alto}` }, plot);
      const y = (v) => arriba + (abajo - arriba) * (1 - (v + tope) / (2 * tope)), x = (i) => izq + (der - izq) * (i / (n - 1));
      for (let v = tope; v >= -tope; v -= tope / 2) {
        el('line', { class: v === -tope ? 'gl gl0' : 'gl', x1: izq, x2: der, y1: y(v), y2: y(v) }, svg);
        el('text', { class: 'yl', x: 36, y: y(v) + 4, 'text-anchor': 'end' }, svg).textContent = `${v > 0 ? '+' : ''}${v}%`.replace('+0%', '0%');
      }
      (d.meses ?? []).forEach(([rot, fecha]) => {
        const i = Math.round((new Date(`${fecha}T12:00:00Z`) - new Date(`${d.desde}T12:00:00Z`)) / 864e5);
        if (i < 0 || i >= n) return;
        el('line', { class: 'xt', x1: x(i), x2: x(i), y1: abajo, y2: abajo + 5 }, svg);
        el('text', { class: 'xl', x: x(i), y: abajo + 22, 'text-anchor': 'middle' }, svg).textContent = rot;
      });
      series.forEach((s, k) => {
        const p = el('path', { class: 'ln', stroke: s.c, d: s.v.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ') }, svg);
        const fin = el('g', {}, svg);
        el('circle', { cx: x(n - 1), cy: y(s.v[n - 1]), r: 3.5, fill: s.c }, fin);
        el('text', { class: 'end', x: x(n - 1) + 10, y: y(s.v[n - 1]) + 4 }, fin).textContent = signo(s.v[n - 1]);
        if (primera && !quieto) {
          const L = p.getTotalLength();
          p.style.strokeDasharray = L; p.style.strokeDashoffset = L;
          const a = p.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 1400, delay: 100 + k * 120 + demoraDe(caja), easing: P2IO, fill: 'forwards' });
          a.onfinish = () => { a.cancel(); p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; };
          anim(fin, [{ opacity: 0 }, { opacity: 1 }], { duration: 1000, delay: 600 + k * 120 + demoraDe(caja) });
        }
      });
      primera = false;
      // El cruce al pasar el mouse: la línea punteada, un punto por serie y la nota con los tres valores.
      const cruz = el('line', { class: 'cross', y1: arriba, y2: abajo, opacity: 0 }, svg);
      const puntos = series.map((s) => el('circle', { r: 4, fill: s.c, stroke: '#fbfcfd', 'stroke-width': 2, opacity: 0 }, svg));
      const hit = el('rect', { x: izq, y: 0, width: der - izq, height: alto, fill: 'transparent' }, svg);
      let ult = -1;
      hit.addEventListener('pointermove', (e) => {
        const r = svg.getBoundingClientRect(), i = Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left - izq) / (der - izq)) * (n - 1))));
        if (i === ult) return; ult = i;
        cruz.setAttribute('x1', x(i)); cruz.setAttribute('x2', x(i)); cruz.setAttribute('opacity', 1);
        puntos.forEach((c, k) => {
          c.setAttribute('cx', x(i)); c.setAttribute('cy', y(series[k].v[i])); c.setAttribute('opacity', 1);
          if (!quieto) c.animate([{ transform: 'scale(.6)' }, { transform: 'scale(1)' }], { duration: 250, easing: 'cubic-bezier(.34, 1.9, .64, 1)', transformOrigin: '50% 50%' });
        });
        const f = fechaDe(d.desde, i);
        tip.innerHTML = `<b>${MES[f.getUTCMonth()]} ${f.getUTCDate()}</b>` + series.map((s) => `<span class="chart__tip-row"><i style="--c:${s.c}"></i>${s.k}<strong>${signo(s.v[i])}</strong></span>`).join('');
        tip.hidden = false; tip.style.left = `${x(i)}px`; tip.style.top = `${Math.min(...series.map((s) => y(s.v[i])))}px`;
      });
      hit.addEventListener('pointerleave', () => { ult = -1; cruz.setAttribute('opacity', 0); puntos.forEach((c) => c.setAttribute('opacity', 0)); tip.hidden = true; });
    };
    dibujar();
    let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(dibujar, 80); });
    // «Table»: la tabla reemplaza al gráfico (y al revés).
    const boton = $('[data-tabla]', caja.closest('.card'));
    tabla.innerHTML = `<table><thead><tr><th>Date</th>${series.map((s) => `<th>${s.k}</th>`).join('')}</tr></thead><tbody>${series[0].v.map((_, i) => i).reverse().map((i) => { const f = fechaDe(d.desde, i); return `<tr><td>${MES[f.getUTCMonth()]} ${f.getUTCDate()}</td>${series.map((s) => `<td>${signo(s.v[i])}</td>`).join('')}</tr>`; }).join('')}</tbody></table>`;
    boton?.addEventListener('click', () => {
      const ver = boton.getAttribute('aria-pressed') !== 'true', sale = ver ? plot : tabla, entra = ver ? tabla : plot;
      boton.setAttribute('aria-pressed', String(ver));
      const cambiar = () => { sale.hidden = true; entra.hidden = false; anim(entra, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 350, easing: W }); };
      if (quieto) return cambiar();
      sale.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180 }).onfinish = cambiar;
    });
  });

  // ── las columnas de X.com ──────────────────────────────────────────────────────────────────────
  $$('[data-bars]').forEach((caja) => {
    const d = JSON.parse(caja.dataset.bars);
    const pintar = () => {
      caja.innerHTML = '';
      const ancho = caja.clientWidth, base = 86, svg = el('svg', { viewBox: `0 0 ${ancho} ${caja.clientHeight}` }, caja);
      [0, 43, 86].forEach((y0) => el('line', { class: 'gl', x1: 0, x2: ancho, y1: y0, y2: y0 }, svg));
      const paso = ancho / d.v.length, b = Math.min(23, paso * 0.62);
      d.v.forEach((v, i) => {
        const cx = paso * (i + 0.5), h = (base * v) / d.tope, r = Math.min(3, h / 2);
        el('path', { class: 'b', d: `M${cx - b / 2},${base} V${base - h + r} Q${cx - b / 2},${base - h} ${cx - b / 2 + r},${base - h} H${cx + b / 2 - r} Q${cx + b / 2},${base - h} ${cx + b / 2},${base - h + r} V${base} Z` }, svg);
        el('text', { class: 'xl', x: cx, y: base + 19 }, svg).textContent = d.x[i];
      });
    };
    pintar();
    let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(pintar, 80); });
  });

  // ── las pestañas: la tinta corre y las filas entran de a una ─────────────────────────────────────
  $$('.tabs').forEach((tabs) => {
    const lista = $('[role=tablist]', tabs), tinta = $('.tabs__ink', tabs), botones = $$('[role=tab]', lista);
    const tarjeta = tabs.closest('.card');
    let activa = botones.find((b) => b.getAttribute('aria-selected') === 'true') ?? botones[0];
    const ubicar = (suave) => {
      const r = activa.getBoundingClientRect(), base = tabs.getBoundingClientRect();
      const destino = { transform: `translateX(${r.left - base.left}px)`, width: `${r.width}px` };
      if (suave && !quieto) tinta.animate([{ transform: tinta.style.transform || 'translateX(0)', width: tinta.style.width || '0px' }, destino], { duration: 450, easing: W });
      tinta.style.transform = destino.transform; tinta.style.width = destino.width;
    };
    ubicar(false);
    addEventListener('resize', () => ubicar(false));
    lista.addEventListener('scroll', () => ubicar(false));
    botones.forEach((b) => b.addEventListener('click', () => {
      if (b === activa) return;
      botones.forEach((o) => o.setAttribute('aria-selected', String(o === b)));
      activa = b; ubicar(true);
      const filas = $$('tbody tr', tarjeta);
      if (quieto) return;
      const cuerpo = $('tbody', tarjeta);
      cuerpo.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-6px)' }], { duration: 180, easing: P2IN }).onfinish = () => {
        cuerpo.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 450, easing: W });
        filas.forEach((f, i) => anim(f, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 400, delay: i * 20, easing: W }));
      };
    }));
  });
})();
