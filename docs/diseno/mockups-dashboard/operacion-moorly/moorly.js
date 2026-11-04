// ═══════════════════════════════════════════════════════════════════════════════════════════
// OPERACIÓN DIARIA (MOORLY) — el dibujo de la página «Desk» de Moorly. 4/11/2026. Código nuestro.
// El INFORME de Moorly (demos/moorly/INFORME.txt) trae la entrada del ARMAZÓN (la barra de arriba baja, sus botones entran de a
// uno y la pastilla de «Desk» crece) y los hover del CSS. La entrada de la página «Desk» vive en su propio chunk
// (desk-*.js), que el INFORME no muestra: no se inventa, las tarjetas quedan quietas.
// ═══════════════════════════════════════════════════════════════════════════════════════════
(() => {
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, padre) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); padre?.appendChild(n); return n; };
  const curva = (pts) => {
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0]},${p2[1]}`;
    }
    return d;
  };

  // ── Las líneas chicas de cada número: el relleno y la línea, de punta a punta de su caja ─────────────────────────
  $$('[data-spark]').forEach((svg) => {
    const v = JSON.parse(svg.dataset.spark);
    const W = svg.clientWidth, H = svg.clientHeight, max = Math.max(...v), min = Math.min(...v);
    const pts = v.map((n, i) => [+(W * i / (v.length - 1)).toFixed(1), +(H - 2 - (H - 6) * ((n - min) / (max - min || 1))).toFixed(1)]);
    const lin = curva(pts);
    el('path', { class: 'a', d: `${lin} L${W},${H} L0,${H} Z` }, svg);
    el('path', { class: 'l', d: lin }, svg);
  });

  // ── «Premium on the water»: una curva con su relleno; cinco rayas punteadas ($0 a $800k) y un mes cada dos ──────────
  $$('[data-chart]').forEach((caja) => {
    const d = JSON.parse(caja.dataset.chart);
    const svg = caja.querySelector('svg');
    const W = caja.clientWidth, H = caja.clientHeight, angosto = W < 520, izq = d.pre ? 62 : 50, der = 0, arriba = 6, abajo = 24;
    const y = (n) => arriba + (H - arriba - abajo) * (1 - n / d.tope);
    const x = (i) => izq + (W - izq - der) * (i / (d.v.length - 1));
    const rayas = 4;
    for (let k = 0; k <= rayas; k++) {
      const yy = arriba + (H - arriba - abajo) * (k / rayas);
      el('line', { class: 'gl', x1: izq, x2: W, y1: yy, y2: yy }, svg);
      el('text', { x: 0, y: yy + 4 }, svg).textContent = `${d.pre ?? '$'}${(d.tope * (1 - k / rayas)).toFixed(0)}${d.tope * (1 - k / rayas) ? 'k' : ''}`;
    }
    const paso = angosto ? 3 : 2;
    d.x.forEach((t, i) => {
      if (i % paso && i !== d.x.length - 1) return;
      el('text', { x: x(i), y: H - 4, 'text-anchor': 'middle' }, svg).textContent = t;
    });
    const pts = d.v.map((n, i) => [+x(i).toFixed(1), +y(n).toFixed(1)]);
    const id = `mo-${Math.random().toString(36).slice(2, 7)}`;
    const g = el('linearGradient', { id, x1: 0, x2: 0, y1: 0, y2: 1 }, el('defs', {}, svg));
    el('stop', { offset: 0, 'stop-color': 'oklch(50% .09 205)', 'stop-opacity': .2 }, g);
    el('stop', { offset: 1, 'stop-color': 'oklch(50% .09 205)', 'stop-opacity': 0 }, g);
    const lin = curva(pts);
    el('path', { d: `${lin} L${pts.at(-1)[0]},${y(0)} L${pts[0][0]},${y(0)} Z`, fill: `url(#${id})` }, svg);
    el('path', { d: lin, fill: 'none', stroke: 'oklch(50% .09 205)', 'stroke-width': 2.2, 'stroke-linecap': 'round' }, svg);
  });

  // ── «Renewal tide»: una barra por semana; la más alta, oscura; cuatro rayas punteadas y una semana cada dos ─────────
  $$('[data-tide]').forEach((caja) => {
    const d = JSON.parse(caja.dataset.tide);
    const svg = caja.querySelector('svg');
    // Medido en la captura: cuatro rayas punteadas cada 30 px y la base, 17 px arriba del piso; la semana más alta llega a la mitad.
    const W = caja.clientWidth, H = caja.clientHeight, abajo = 17, alto = H - abajo, arriba = alto - 119, tope = d.tope ?? (Math.max(...d.v) * 2 || 1);
    for (let k = 0; k < 4; k++) el('line', { class: 'gl', x1: 0, x2: W, y1: arriba + 30 * k, y2: arriba + 30 * k }, svg);
    el('line', { x1: 0, x2: W, y1: alto, y2: alto, stroke: 'oklch(30% .03 230/.16)' }, svg);
    const col = W / d.v.length, ancho = Math.min(16, col * .5);
    d.v.forEach((n, i) => {
      const h = 119 * (n / tope);
      if (h > 0) el('rect', { x: col * i + (col - ancho) / 2, y: alto - h, width: ancho, height: h, rx: 3, fill: i === d.hi ? 'oklch(50% .09 205)' : 'oklch(50% .09 205/.5)' }, svg);
      if (i % 2 === 0) el('text', { x: col * i + col / 2, y: H - 2, 'text-anchor': 'middle' }, svg).textContent = d.x[i];
    });
  });

  // ── Los selectores (cambian cuál está elegido: la copia no tiene otra serie) y las casillas de los to-dos ─────────────
  $$('.tabs').forEach((t) => { const b = $$('button', t); b.forEach((x) => x.addEventListener('click', () => b.forEach((k) => k.setAttribute('aria-selected', String(k === x))))); });
  $$('.todo button').forEach((b) => b.addEventListener('click', () => { const on = b.getAttribute('aria-checked') !== 'true'; b.setAttribute('aria-checked', String(on)); b.closest('.todo').classList.toggle('is-done', on); b.innerHTML = on ? '<svg class="i"><use href="#i-check"/></svg>' : ''; }));
})();
