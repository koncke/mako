// ═══════════════════════════════════════════════════════════════════════════════════════════
// GENERAL (ORVEL) — el dibujo y el movimiento de la página «Overview» de Orvel. 4/11/2026. Código nuestro.
// Lo que el INFORME de Orvel (demos/orvel/INFORME.txt) trae: la entrada del ARMAZÓN (`gn`: la barra lateral entra desde la
// izquierda, x -40 · .9 s power3.out; sus renglones con `ge` x -12 · .03; lo de arriba con `ge` y -12 · .05, a los .05) y los
// estados de hover del CSS. Lo que NO trae: la entrada de la página «Overview» (vive en su propio chunk, que el INFORME no
// muestra) ni el cuerpo del helper `ge` (cuánto dura y con qué curva). Eso no se inventa: las tarjetas quedan quietas, y
// para `ge` se usa la curva power3.out de la barra (la única de esa entrada que está escrita), anotado como inferencia.
// ═══════════════════════════════════════════════════════════════════════════════════════════
(() => {
  const P3O = 'cubic-bezier(.215,.61,.355,1)';
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const captura = location.search.includes('captura');
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, padre) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); padre?.appendChild(n); return n; };

  // ── «Money in and out»: dos curvas suaves (lo que entra, con su relleno; lo que sale, sólo la línea) ─────────────
  // El eje: €0 abajo, €100k arriba (en miles), 13 semanas de punta a punta.
  const curva = (pts) => {
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0]},${p2[1]}`;
    }
    return d;
  };
  $$('[data-chart]').forEach((caja) => {
    const d = JSON.parse(caja.dataset.chart);
    const svg = $('svg', caja);
    // Medido en la captura: la primera semana cae 35 px adentro (44 en el teléfono), la última 27 px antes del borde (12); €100k a 10 px del techo y €0
    // a 27 px del piso (las etiquetas del eje x, 6 px arriba del piso).
    const W = caja.clientWidth, H = caja.clientHeight, angosto = W < 520, izq = angosto ? 44 : 35, der = angosto ? 12 : 27, arriba = 10, abajo = 27;
    const y = (v) => arriba + (H - arriba - abajo) * (1 - v / 100);
    const x = (i, n) => izq + (W - izq - der) * (i / (n - 1));
    d.y.forEach((t, i) => {
      const yy = arriba + (H - arriba - abajo) * (i / (d.y.length - 1));
      el('line', { class: 'gl', x1: izq - 2, x2: W, y1: yy, y2: yy }, svg);
      el('text', { x: 0, y: yy + 4.5 }, svg).textContent = t;
    });
    // La primera etiqueta arranca en su semana y la última termina en la suya; las del medio, centradas.
    // Una etiqueta cada dos semanas en la computadora y cada tres en el teléfono (las dos capturas).
    const paso = W < 520 ? 3 : 2;
    d.x.forEach((t, i) => {
      if (i % paso) return;
      el('text', { x: x(i, d.x.length), y: H - 6, 'text-anchor': i === 0 ? 'start' : i === d.x.length - 1 ? 'end' : 'middle' }, svg).textContent = t;
    });
    const pin = d.in.map((v, i) => [+x(i, d.in.length).toFixed(1), +y(v).toFixed(1)]);
    const pout = d.out.map((v, i) => [+x(i, d.out.length).toFixed(1), +y(v).toFixed(1)]);
    const grad = el('linearGradient', { id: 'ov-in', x1: 0, x2: 0, y1: 0, y2: 1 }, el('defs', {}, svg));
    el('stop', { offset: 0, 'stop-color': '#0f6a45', 'stop-opacity': .22 }, grad);
    el('stop', { offset: 1, 'stop-color': '#0f6a45', 'stop-opacity': .02 }, grad);
    const lin = curva(pin);
    el('path', { d: `${lin} L${pin.at(-1)[0]},${y(0)} L${pin[0][0]},${y(0)} Z`, fill: 'url(#ov-in)' }, svg);
    el('path', { d: curva(pout), fill: 'none', stroke: '#66707d', 'stroke-width': 2, 'stroke-linecap': 'round' }, svg);
    el('path', { d: lin, fill: 'none', stroke: '#0f6a45', 'stroke-width': 2.2, 'stroke-linecap': 'round' }, svg);
  });

  // ── El selector Weeks · Months (cambia cuál está apretado: la copia no tiene otra serie que dibujar) ─────────────
  $$('[data-seg]').forEach((seg) => {
    const btns = $$('button', seg);
    btns.forEach((b) => b.addEventListener('click', () => btns.forEach((k) => k.setAttribute('aria-pressed', String(k === b)))));
  });

  // ── La entrada del armazón (`gn`) ────────────────────────────────────────────────────────────────────────────────
  if (quieto || captura) return;
  const a = (n, desde, dur, delay) => n.animate([desde, { opacity: 1, transform: 'none' }], { duration: dur * 1000, easing: P3O, delay: delay * 1000, fill: 'backwards' });
  const movil = matchMedia('(max-width: 760px)').matches;
  const side = $('.side');
  if (side) a(side, { opacity: 0, transform: movil ? 'translateY(90px)' : 'translateX(-40px)' }, 0.9, 0);
  // `ge` (inferencia: la duración y la curva no están en el INFORME; van .55 s y power3.out)
  $$('.side__top, .nav__label, .nav__item, .cover, .me').forEach((n, i) => a(n, { opacity: 0, transform: movil ? 'translateY(10px)' : 'translateX(-12px)' }, 0.55, 0.12 + i * (movil ? 0.04 : 0.03)));
  $$('.top > *').forEach((n, i) => a(n, { opacity: 0, transform: 'translateY(-12px)' }, 0.55, 0.05 + i * 0.05));
})();
