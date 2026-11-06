// COLD CALLING (CORVANE) — el movimiento y los dibujos de la copia. 6/11/2026. Código nuestro, desde lo medido (demos/corvane/INFORME.txt).
// La entrada del ARMAZÓN es la del INFORME (la barra x −40, sus renglones x −14 de a 0,025 s, lo de arriba y −16 de a 0,04 s). La entrada de
// la página «Overview» vive en un chunk que el INFORME no muestra: no se inventa, las tarjetas quedan quietas. Los hover son los del CSS.
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const NS = 'http://www.w3.org/2000/svg';
  const P3 = 'cubic-bezier(.215, .61, .355, 1)';
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── «Captured today»: los 30 días (25 Sept → 24 Oct), leídos de la captura ──────────────────────────────────────────────────────
  const DIAS = [9.5, 10.5, 8.4, 7.4, 6.2, 10.4, 8.6, 12.9, 12.3, 7.9, 10.1, 10.1, 6.8, 9.2, 11.7, 9.3, 11.1, 8.6, 8.0, 10.7, 10.1, 11.3, 10.6, 10.2, 9.8, 9.5, 9.6, 10.9, 10.5, 9.2, 11.3].slice(0, 30);
  const ROT = ['25 Sept', '26 Sept', '27 Sept', '28 Sept', '29 Sept', '30 Sept', '1 Oct', '2 Oct', '3 Oct', '4 Oct', '5 Oct', '6 Oct', '7 Oct', '8 Oct', '9 Oct', '10 Oct', '11 Oct', '12 Oct', '13 Oct', '14 Oct', '15 Oct', '16 Oct', '17 Oct', '18 Oct', '19 Oct', '20 Oct', '21 Oct', '22 Oct', '23 Oct', '24 Oct'];
  /** Una curva suave (Catmull-Rom → Bézier) por los puntos. */
  const curva = (pts) => pts.map((p, i) => {
    if (!i) return `M${p[0]},${p[1]}`;
    const a = pts[i - 2] ?? pts[i - 1], b = pts[i - 1], d = pts[i + 1] ?? p;
    return `C${b[0] + (p[0] - a[0]) / 6},${b[1] + (p[1] - a[1]) / 6} ${p[0] - (d[0] - b[0]) / 6},${p[1] - (d[1] - b[1]) / 6} ${p[0]},${p[1]}`;
  }).join('');
  const el = (tag, at, padre) => { const n = document.createElementNS(NS, tag); for (const k in at) n.setAttribute(k, at[k]); padre?.appendChild(n); return n; };
  function grafico() {
    const caja = $('#chart'); if (!caja) return;
    const W = caja.clientWidth, H = 248, tel = W < 400;
    const x0 = 56, x1 = W - 13, y0 = 13, y1 = 223;
    caja.innerHTML = '';
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}` }, caja);
    const g = el('defs', {}, svg); const gr = el('linearGradient', { id: 'cv-area', x1: 0, y1: 0, x2: 0, y2: 1 }, g);
    el('stop', { offset: 0, 'stop-color': '#b0521f', 'stop-opacity': '.24' }, gr); el('stop', { offset: 1, 'stop-color': '#b0521f', 'stop-opacity': '0' }, gr);
    for (let k = 0; k <= 4; k++) {
      const y = y0 + ((y1 - y0) * k) / 4;
      el('line', { class: 'grid', x1: x0, x2: x1, y1: y, y2: y }, svg);
      el('text', { x: x0 - 11, y: y + 4, 'text-anchor': 'end' }, svg).textContent = k === 4 ? '$0' : `$${(20 - k * 5)}K`;
    }
    const pts = DIAS.map((v, i) => [x0 + ((x1 - x0) * i) / (DIAS.length - 1), y1 - ((y1 - y0) * v) / 20]);
    const d = curva(pts);
    el('path', { d: `${d}L${x1},${y1}L${x0},${y1}Z`, fill: 'url(#cv-area)' }, svg);
    el('path', { d, fill: 'none', stroke: '#b0521f', 'stroke-width': 2.2, 'stroke-linecap': 'round' }, svg);
    const marcas = tel ? [0, 10, 20, 29] : [0, 4, 8, 12, 16, 20, 24, 29];
    for (const i of marcas) {
      const t = el('text', { x: pts[i][0], y: H - 4, 'text-anchor': i === 0 ? 'start' : i === 29 ? 'end' : 'middle' }, svg);
      t.textContent = ROT[i];
    }
  }

  // ── «Top merchants» ───────────────────────────────────────────────────────────────────────────────────────────────────────────
  const TM = [['Halden Cycle Works', 12.8, '$12.8K'], ['Kaito Audio', 8.5, '$8.5K'], ['Pinecrest Outfitters', 7.4, '$7.4K'], ['Okoro Textiles', 6.63, '$6.63K'], ['Casa Alvar Muebles', 6.11, '$6.11K'], ['Tobiko & Rice', 4.55, '$4.55K']];
  $('#bars').innerHTML = TM.map(([n, v, t]) => `<li><div class="bars__top"><span>${n.replace('&', '&amp;')}</span><b>${t}</b></div><div class="bars__track"><div class="bars__fill" style="width:${(v / TM[0][1]) * 100}%"></div></div></li>`).join('');

  // ── las líneas de los cuatro números ──────────────────────────────────────────────────────────────────────────────────────────
  for (const s of $$('[data-spark]')) {
    const v = s.dataset.spark.split(',').map(Number), W = 80, H = 26, mx = Math.max(...v), mn = Math.min(...v);
    s.setAttribute('viewBox', `0 0 ${W} ${H}`);
    el('path', { d: curva(v.map((y, i) => [2 + ((W - 4) * i) / (v.length - 1), H - 3 - ((H - 6) * (y - mn)) / (mx - mn || 1)])) }, s);
  }

  // ── el selector: la píldora corre a la opción elegida ─────────────────────────────────────────────────────────────────────────
  function seg(c, primera) {
    const pl = $('.seg__pill', c), on = $('[aria-pressed="true"]', c);
    pl.style.width = `${on.offsetWidth}px`;
    if (primera) pl.style.transition = 'none';
    pl.style.translate = `${on.offsetLeft - 3}px 0`;
    if (primera) requestAnimationFrame(() => { pl.style.transition = ''; });
  }
  for (const c of $$('[data-seg]')) {
    seg(c, true);
    c.addEventListener('click', (e) => { const b = e.target.closest('.seg__opt'); if (!b) return; for (const o of $$('.seg__opt', c)) o.setAttribute('aria-pressed', String(o === b)); seg(c); });
  }

  grafico();
  addEventListener('resize', () => { grafico(); for (const c of $$('[data-seg]')) seg(c, true); });

  // ── la entrada del armazón (INFORME: la línea de tiempo del armazón) ──────────────────────────────────────────────────────────
  if (quieto) return;
  const anim = (n, kf, o) => n.animate(kf, { fill: 'backwards', easing: P3, ...o });
  if (innerWidth > 760) anim($('.side'), [{ transform: 'translateX(-40px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 600 });
  $$('.nav__item, .side__group').forEach((n, i) => anim(n, [{ transform: 'translateX(-14px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 450, delay: 150 + i * 25 }));
  $$('.top > *').forEach((n, i) => anim(n, [{ transform: 'translateY(-16px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 500, delay: 200 + i * 40 }));
})();
