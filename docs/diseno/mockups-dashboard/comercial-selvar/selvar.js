// ═══════════════════════════════════════════════════════════════════════════════════════════
// COMERCIAL (SELVAR) — el dibujo de la página «Overview» de Selvar. 4/11/2026. Código nuestro.
// El INFORME de Selvar (demos/selvar/INFORME.txt) trae la entrada del ARMAZÓN (la barra lateral entra de la izquierda y sus
// renglones de a uno, la barra de arriba baja) y los hover del CSS. La entrada de la página «Overview» vive en su propio chunk
// (overview-*.js), que el INFORME no muestra: no se inventa, las tarjetas quedan quietas.
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

  // ── la línea de cada número: sólo el trazo, de punta a punta de su caja ─────────────────────────
  $$('[data-spark]').forEach((svg) => {
    const v = JSON.parse(svg.dataset.spark);
    const W = svg.clientWidth, H = svg.clientHeight, max = Math.max(...v), min = Math.min(...v);
    const pts = v.map((n, i) => [+(W * i / (v.length - 1)).toFixed(1), +(H - 2 - (H - 4) * ((n - min) / (max - min || 1))).toFixed(1)]);
    el('path', { d: curva(pts) }, svg);
  });

  // ── las ventas por semana o por mes: columnas apiladas y la línea punteada del ritmo ─────────────────
  const dibujar = (caja, d) => {
    const pre = d.pre ?? '$', plata = (k) => (k >= 1000 ? `${pre}${(k / 1000).toFixed(k % 1000 ? 1 : 0)}M` : `${pre}${k}k`);
    caja.innerHTML = '';
    const W = caja.clientWidth, H = caja.clientHeight, izq = 44, abajo = 26, arriba = 6;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}` }, caja);
    const alto = H - abajo - arriba, y = (v) => arriba + alto - (alto * v) / d.tope;
    for (let v = 0; v <= d.tope; v += d.paso) {
      el('line', { class: 'gl', x1: izq, x2: W, y1: y(v), y2: y(v) }, svg);
      el('text', { class: 'yl', x: 0, y: y(v) + 4 }, svg).textContent = v === 0 ? `${pre}0` : plata(v);
    }
    const n = d.x.length, paso = (W - izq) / n, ancho = Math.min(34, paso * 0.42);
    d.x.forEach((rot, i) => {
      const cx = izq + paso * (i + 0.5), g = el('g', { class: 'col' }, svg);
      let base = 0;
      d.s.forEach((serie, k) => {
        const v = serie[i]; if (!v) return;
        const arriba1 = !d.s.slice(k + 1).some((s) => s[i]);
        const top = y(base + v), h = y(base) - top;
        const r = arriba1 ? Math.min(6, h / 2) : 0;
        el('path', { class: `b${k + 1}`, d: `M${cx - ancho / 2},${y(base)} V${top + r} Q${cx - ancho / 2},${top} ${cx - ancho / 2 + r},${top} H${cx + ancho / 2 - r} Q${cx + ancho / 2},${top} ${cx + ancho / 2},${top + r} V${y(base)} Z` }, g);
        if (base) el('line', { x1: cx - ancho / 2, x2: cx + ancho / 2, y1: y(base), y2: y(base), stroke: '#fbfbfc', 'stroke-width': 1.5 }, g);
        base += v;
      });
      el('title', {}, g).textContent = `${rot}: ${plata(base)}`;
      if (paso >= 50 || i % 2 === 0) el('text', { class: 'xl', x: cx, y: H - 6 }, svg).textContent = rot;
    });
    el('line', { class: 'pace', x1: izq, x2: W, y1: y(d.pace), y2: y(d.pace) }, svg);
  };
  $$('[data-chart]').forEach((caja) => {
    const datos = JSON.parse(caja.dataset.chart), tarjeta = caja.closest('.card');
    let vista = 'semanas';
    const pintar = () => {
      dibujar(caja, datos[vista]);
      const p = tarjeta.querySelector('[data-pace]'); if (p) p.textContent = datos[vista].paceTxt;
      const s = tarjeta.querySelector('[data-sub]'); if (s && datos[vista].sub) s.textContent = datos[vista].sub;
      // La leyenda de cada vista (la de MaKo: por semana va por funnel, por mes es lo vendido entero).
      if (datos[vista].leyenda) {
        const caja = tarjeta.querySelector('.legend'), pace = caja.querySelector('[data-pace]').parentElement;
        $$('[data-serie]', caja).forEach((n) => n.remove());
        datos[vista].leyenda.forEach((nombre, k) => {
          const s = document.createElement('span'); s.dataset.serie = '';
          s.innerHTML = `<i class="sw" style="width:10px;height:10px;--c:${['var(--c-cobalt)', 'var(--c-amber)', 'var(--c-sky)'][k]}"></i>`;
          s.append(nombre); caja.insertBefore(s, pace);
        });
      }
    };
    pintar();
    $$('.seg__opt', tarjeta).forEach((b) => b.addEventListener('click', () => {
      vista = b.dataset.vista;
      $$('.seg__opt', tarjeta).forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
      pintar();
    }));
    let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(pintar, 80); });
  });

  // ── la cruz de cada señal la saca de la lista ─────────────────────────────────────────────
  $$('.sig .xbtn').forEach((b) => b.addEventListener('click', () => b.closest('.sig').remove()));
})();
