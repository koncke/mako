// PRISM · copia (5/11/2026). Código nuestro, escrito desde lo medido (demos/prism/captura) y las RECETAS del INFORME:
//   · la barra de arriba entra desde y −10 (.6 s) y los rayos del logo crecen (scaleX 0 → 1, .6 s, cada .08 s, desde .3 s);
//   · cada tarjeta sube desde y 16 (.75 s, power3.out) y sus esquinas (`.hud`) aparecen desde escala 1.08 (.7 s, power2.out, +.05 s);
//     su gráfico arranca a los +.12 s;
//   · las barras de Revenue crecen de izquierda a derecha (1,5 s, lineal) y la línea se dibuja (1,3 s, power2.inOut, .35 s después);
//   · la latencia se revela de izquierda a derecha (1,3 s, power2.inOut); los números cuentan .9 s (power3.out);
//   · la pastilla del rango corre (.5 s, power3.inOut) y se estira (scaleX 1.18 en .22 s y vuelve en .3 s);
//   · el reloj cambia cada dígito subiendo (.35 s) y el viejo se va (.3 s); el ticker entra desde abajo (.45 s, +.1 s) y el viejo sale;
//   · «Refresh» gira 360° (.9 s, power2.inOut); el chip «+$57.69» sube y se apaga (.3 s back.out(2), después 1 s power1.in).
// ⚠️ SUPUESTO (el INFORME no lo trae): a qué tiempo entra cada tarjeta (acá, desde .35 s cada .06 s), cómo crecen las barras de las
// campañas, los anillos, el medidor y las columnas (.9 s, power3.out, cada .06 s), y cómo se ve la línea que barre la página (`.scan`).
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const NS = 'http://www.w3.org/2000/svg';
  const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ease = { p3o: 'cubic-bezier(.215,.61,.355,1)', p2o: 'cubic-bezier(.25,.46,.45,.94)', p2io: 'cubic-bezier(.455,.03,.515,.955)', p3io: 'cubic-bezier(.645,.045,.355,1)', back2: 'cubic-bezier(.34,1.85,.64,1)', p1i: 'cubic-bezier(.55,.085,.68,.53)' };
  const el = (tag, attrs = {}, parent) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; };
  // Un aleatorio con semilla: la misma página en cada carga.
  let semilla = 7; const azar = () => ((semilla = (semilla * 16807) % 2147483647) - 1) / 2147483646;

  // ── los datos (de la captura) ──────────────────────────────────────────────────────────────────────────────
  const REV = Array.from({ length: 60 }, (_, i) => { const base = 205 + i * 0.85; return Math.max(110, Math.round(base + (azar() - 0.5) * 170 + (i > 55 ? 40 : 0))); });
  const TRAFFIC = [['Organic', 35.6, 's1'], ['Paid ads', 26.3, 's2'], ['Social', 16.7, 's3'], ['Referral', 11.7, 's4'], ['Email', 9.8, 's5']];
  const REGION = [['NA', 42.5, 's1', 9], ['EU', 26.6, 's2', 5], ['APAC', 18.4, 's3', 5], ['LATAM', 7.9, 's4', 6], ['MEA', 4.5, 's5', -6]];
  const CAMP = [['Creator collab', 6.0], ['Cart retarget', 5.9], ['Autumn drop', 5.2], ['Brand search', 4.3], ['Lookalike 2%', 3.0], ['Loyalty push', 2.2]];
  const KPIS = [['Orders', '175', 8.0, 's1', [4, 5, 4, 6, 7, 6, 8, 9, 9, 10, 10, 11]], ['Conversion', '3.75%', -0.6, 's2', [3, 4, 3, 5, 3, 6, 7, 8, 8, 7, 8, 7]], ['Avg order value', '$84.10', 2.2, 's4', [4, 4, 5, 5, 6, 6, 7, 8, 8, 7, 6, 2]]];
  const QUARTERS = [["Q2 '25", 1.4], ["Q3 '25", 1.6], ["Q4 '25", 2.0], ["Q1 '26", 2.2], ["Q2 '26", 2.8], ["Q3 '26", 3.28]];
  const SIGNUP = [[16, 11], [14, 10], [15, 10], [17, 12], [15, 10], [14, 9], [15, 11]];
  const CUST = [['Apr', '18.4K', 18.4, ''], ['May', '19.9K', 19.9, '+8%'], ['Jun', '21.8K', 21.8, '+10%'], ['Jul', '23.1K', 23.1, '+6%'], ['Aug', '25.2K', 25.2, '+9%'], ['Sep', '27.6K', 27.6, '+10%']];
  const LAT = [['s1', 65, 18], ['s2', 115, 24], ['s3', 183, 46]].map(([c, m, j]) => [c, Array.from({ length: 60 }, (_, i) => Math.max(20, m + (azar() - 0.5) * j * 2 + (c === 's3' && (i === 34 || i === 35) ? 40 : 0)))]);

  // ── Revenue: las barras, la línea y su chip (la geometría del INFORME: x0 50, x1 w−10, y0 14, y1 h−24) ─────────────────────
  function dibujarRev() {
    const host = $('#rev'); const w = host.clientWidth, h = host.clientHeight;
    const svg = el('svg', { viewBox: `0 0 ${w} ${h}` }, host);
    const x0 = 50, x1 = w - 10, y0 = 14, y1 = h - 24, paso = (x1 - x0) / REV.length, ancho = Math.min(24, Math.max(2, paso * 0.64));
    const max = 400, k = (y1 - y0) / max;
    for (let t = 100; t <= max; t += 100) { const y = Math.round(y1 - t * k) + 0.5; el('line', { x1: x0, x2: x1, y1: y, y2: y, class: 'gridln' }, svg); el('text', { x: 40, y: y + 4, 'text-anchor': 'end', class: 'ax' }, svg).textContent = `$${t}`; }
    el('text', { x: 40, y: y1 + 4, 'text-anchor': 'end', class: 'ax' }, svg).textContent = '$0';
    el('line', { x1: x0, x2: x1, y1: y1 + 0.5, y2: y1 + 0.5, stroke: 'var(--axis)' }, svg);
    const defs = el('defs', {}, svg); const g = el('linearGradient', { id: 'gRev', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el('stop', { offset: 0, 'stop-color': '#2ee6d6' }, g); el('stop', { offset: 1, 'stop-color': '#2ee6d6', 'stop-opacity': 0.25 }, g);
    const barras = REV.map((v, i) => el('rect', { x: x0 + i * paso + (paso - ancho) / 2, y: y1 - v * k, width: ancho, height: v * k, rx: Math.min(4, ancho / 2), fill: 'url(#gRev)' }, svg));
    const cada = paso * 8 < 64 ? 2 : 1;
    for (let i = 0; i <= 6; i += cada) { const x = x0 + (i * 8 + 4.5) * paso; el('text', { x, y: h - 6, 'text-anchor': 'middle', class: 'ax' }, svg).textContent = `08:${String(i * 2).padStart(2, '0')}`; }
    const pts = REV.map((_, i) => [x0 + (i + 0.5) * paso, y1 - (222 + i * 0.75) * k]);
    const linea = el('path', { d: 'M' + pts.map((p) => p.map((n) => n.toFixed(1)).join(' ')).join(' L'), fill: 'none', stroke: 'var(--s2)', 'stroke-width': 2, 'stroke-linecap': 'round' }, svg);
    const ult = pts[pts.length - 1]; el('circle', { cx: ult[0], cy: y1 - REV[REV.length - 1] * k, r: 3.5, fill: 'var(--s1)', stroke: '#071222', 'stroke-width': 1.5 }, svg);
    const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = '+$57.69'; tag.style.left = `${ult[0] + 12}px`; tag.style.top = `${y1 - REV[REV.length - 1] * k}px`; host.appendChild(tag);
    return { barras, linea, y1 };
  }

  // ── los anillos ───────────────────────────────────────────────────────────────────────────────────────────────
  function dibujarAnillo(host, filas, centro, sub, conCambio) {
    host.innerHTML = '';
    const g = document.createElement('div'); g.className = 'donut__g'; host.appendChild(g);
    const svg = el('svg', { viewBox: '0 0 144 144' }, g);
    const r = 61, C = 2 * Math.PI * r, hueco = 2.2; let acum = 0;
    el('circle', { cx: 72, cy: 72, r, fill: 'none', stroke: 'var(--well)', 'stroke-width': 14 }, svg);
    for (let i = 0; i < 60; i++) { const t = (i / 60) * 2 * Math.PI; el('line', { x1: 72 + 74 * Math.cos(t), y1: 72 + 74 * Math.sin(t), x2: 72 + 77.5 * Math.cos(t), y2: 72 + 77.5 * Math.sin(t), stroke: 'var(--axis)', 'stroke-width': 1 }, svg); }
    const arcos = filas.map(([, v, c]) => { const largo = (v / 100) * C; const a = el('circle', { cx: 72, cy: 72, r, fill: 'none', stroke: `var(--${c})`, 'stroke-width': 14, 'stroke-dasharray': `${Math.max(0, largo - hueco)} ${C}`, 'stroke-dashoffset': -acum }, svg); acum += largo; return a; });
    const c = document.createElement('div'); c.className = 'donut__c'; c.innerHTML = `<b>${centro}</b><span>${sub}</span>`; g.appendChild(c);
    const ul = document.createElement('ul'); ul.className = 'dlist' + (conCambio ? ' dlist--d' : '');
    ul.innerHTML = filas.map(([n, v, cl, d]) => `<li><i class="${cl}"></i><span>${n}</span><b>${v.toFixed(1)}%</b>${conCambio ? `<em class="${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '▲' : '▼'} ${Math.abs(d)}%</em>` : ''}</li>`).join('');
    host.appendChild(ul);
    return arcos.map((a) => [a, a.getAttribute('stroke-dasharray')]);
  }

  // ── Campaign ROAS ─────────────────────────────────────────────────────────────────────────────────────────────
  function dibujarCamp() {
    const ul = $('#camp'), MAX = 8, META = 3;
    ul.innerHTML = CAMP.map(([n, v]) => `<li><span>${n}</span><span class="hb__track"><i class="hb__fill ${v > META ? 's1' : 'sm'}" style="width:${(v / MAX) * 100}%"></i><i class="hb__target" style="left:${(META / MAX) * 100}%"></i></span><span class="hb__val">${v.toFixed(1)}×</span></li>`).join('');
    return [...ul.querySelectorAll('.hb__fill')];
  }

  // ── Key metrics ───────────────────────────────────────────────────────────────────────────────────────────────
  function dibujarKpis() {
    const host = $('#kpis');
    host.innerHTML = KPIS.map(([l, v, d, c]) => `<article class="kpi"><span class="kpi__l">${l}</span><b class="kpi__n">${v}</b><span class="kpi__d ${d >= 0 ? 'up' : 'down'}"><svg class="i" viewBox="0 0 12 12"><path d="${d >= 0 ? 'M6 10V2M2.5 5.5 6 2l3.5 3.5' : 'M6 2v8M2.5 6.5 6 10l3.5-3.5'}"/></svg>${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}%</span><div class="kpi__sp" data-c="${c}"></div></article>`).join('');
    const lineas = [];
    host.querySelectorAll('.kpi__sp').forEach((sp, i) => {
      const w = sp.clientWidth, h = sp.clientHeight, s = KPIS[i][4], max = Math.max(...s), min = Math.min(...s), c = sp.dataset.c;
      const pts = s.map((v, j) => [(j / (s.length - 1)) * (w - 6) + 3, h - 4 - ((v - min) / (max - min || 1)) * (h - 10)]);
      const svg = el('svg', { viewBox: `0 0 ${w} ${h}` }, sp);
      const d = curva(pts);
      el('path', { d: `${d} L${pts[pts.length - 1][0]} ${h} L${pts[0][0]} ${h} Z`, fill: `color-mix(in oklab, var(--${c}) 22%, transparent)` }, svg);
      lineas.push(el('path', { d, fill: 'none', stroke: 'var(--spark)', 'stroke-width': 1.6 }, svg));
      lineas.push(el('path', { d: curva(pts.slice(-2)), fill: 'none', stroke: `var(--${c})`, 'stroke-width': 1.8 }, svg));
      const u = pts[pts.length - 1]; el('circle', { cx: u[0], cy: u[1], r: 3, fill: `var(--${c})`, stroke: '#071222', 'stroke-width': 1.5 }, svg);
    });
    return lineas;
  }
  function curva(pts) { // Catmull-Rom como cúbicas
    let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2; d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`; }
    return d;
  }

  // ── el medidor ────────────────────────────────────────────────────────────────────────────────────────────────
  function dibujarGauge(valor) {
    const host = $('#gauge'); const svg = el('svg', { viewBox: '0 0 180 140' }, host);
    const cx = 90, cy = 96, r = 76, a0 = -120, a1 = 120;
    const punto = (ang, rr = r) => { const t = ((ang - 90) * Math.PI) / 180; return [cx + rr * Math.cos(t), cy + rr * Math.sin(t)]; };
    const arco = (de, a) => { const [x0, y0] = punto(de), [x1, y1] = punto(a); return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${a - de > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
    el('path', { d: arco(a0, a1), fill: 'none', stroke: '#2ee6d633', 'stroke-width': 10, 'stroke-linecap': 'round' }, svg);
    const fill = el('path', { d: arco(a0, a1), fill: 'none', stroke: 'var(--s1)', 'stroke-width': 10, 'stroke-linecap': 'round', pathLength: 100, 'stroke-dasharray': `${valor} 100` }, svg);
    for (let i = 0; i <= 20; i++) { const ang = a0 + (i / 20) * 240, [x0, y0] = punto(ang, r - 12), [x1, y1] = punto(ang, r - (i % 5 === 0 ? 20 : 16)); el('line', { x1: x0, y1: y0, x2: x1, y2: y1, stroke: i % 5 === 0 ? 'var(--dim)' : 'var(--axis)', 'stroke-width': 1.2 }, svg); }
    [[25, -60], [50, 0], [75, 60]].forEach(([t, ang]) => { const [x, y] = punto(ang, r - 26); el('text', { x, y: y + 3, 'text-anchor': 'middle', class: 'gauge__tk' }, svg).textContent = t; });
    const aguja = el('g', {}, svg);
    el('path', { d: `M${cx - 2.4} ${cy} L${cx} ${cy - r + 22} L${cx + 2.4} ${cy} Z`, fill: 'var(--ink)' }, aguja);
    el('circle', { cx, cy, r: 4.5, fill: 'var(--card)', stroke: 'var(--ink)', 'stroke-width': 2 }, svg);
    aguja.style.transformOrigin = `${cx}px ${cy}px`; aguja.style.transform = `rotate(${a0 + (valor / 100) * 240}deg)`;
    const c = document.createElement('div'); c.className = 'gauge__c'; c.innerHTML = `<b>${valor}%</b><span>CPU load</span>`; host.appendChild(c);
    return { fill, aguja, a0 };
  }

  // ── Quarterly revenue, signups y latencia ─────────────────────────────────────────────────────────────────────
  function dibujarGrowth() {
    const host = $('#growth'), w = host.clientWidth, h = host.clientHeight, svg = el('svg', { viewBox: `0 0 ${w} ${h}` }, host);
    const x0 = 46, x1 = w - 8, y1 = h - 22, k = (y1 - 20) / 6.6;
    const defs = el('defs', {}, svg), gr = el('linearGradient', { id: 'gQ', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el('stop', { offset: 0, 'stop-color': '#c6f432' }, gr); el('stop', { offset: 1, 'stop-color': '#7d9a1c' }, gr);
    el('filter', { id: 'fGlow', x: '-20%', y: '-60%', width: '140%', height: '220%' }, defs).innerHTML = '<feGaussianBlur stdDeviation="3"/>';
    [['$4M', 4], ['$2M', 2], ['0', 0]].forEach(([t, v]) => el('text', { x: 38, y: y1 - v * k + 4, 'text-anchor': 'end', class: 'ax' }, svg).textContent = t);
    [4, 2].forEach((v) => el('line', { x1: x0, x2: x1, y1: Math.round(y1 - v * k) + 0.5, y2: Math.round(y1 - v * k) + 0.5, class: 'gridln' }, svg));
    el('line', { x1: x0, x2: x1, y1: y1 + 0.5, y2: y1 + 0.5, stroke: 'var(--axis)' }, svg);
    const paso = (x1 - x0) / QUARTERS.length;
    const barras = QUARTERS.map(([q, v], i) => { const x = x0 + i * paso + paso / 2; el('text', { x, y: h - 4, 'text-anchor': 'middle', class: 'ax' }, svg).textContent = q; return el('rect', { x: x - 12, y: y1 - v * k, width: 24, height: v * k, rx: 3, fill: 'url(#gQ)' }, svg); });
    const xa = x0 + paso / 2 - 14, xb = x0 + (QUARTERS.length - 0.5) * paso + 4, ya = y1 - 23, yb = y1 - 50;
    const d = `M${xa} ${ya} C${xa + (xb - xa) * 0.5} ${ya + 4} ${xa + (xb - xa) * 0.78} ${ya - 2} ${xb} ${yb}`;
    el('path', { d, fill: 'none', stroke: '#c6f43266', 'stroke-width': 7, 'stroke-linecap': 'round', filter: 'url(#fGlow)' }, svg);
    const flecha = el('path', { d, fill: 'none', stroke: 'var(--s3)', 'stroke-width': 3.2, 'stroke-linecap': 'round' }, svg);
    el('path', { d: `M${xb - 11} ${yb - 2} L${xb} ${yb} L${xb - 5} ${yb + 9}`, fill: 'none', stroke: 'var(--s3)', 'stroke-width': 3.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
    const ann = document.createElement('span'); ann.className = 'vb__ann'; ann.textContent = '+134% in 6 quarters'; ann.style.left = `${xb - 120}px`; ann.style.top = `${yb - 17}px`; host.appendChild(ann);
    return { barras, flecha };
  }
  function dibujarSignup() {
    const host = $('#signup'), w = host.clientWidth, h = host.clientHeight, svg = el('svg', { viewBox: `0 0 ${w} ${h}` }, host);
    const x0 = 46, x1 = w - 8, y1 = h - 22, k = (y1 - 6) / 20;
    [[20], [10], [0]].forEach(([v]) => el('text', { x: 38, y: y1 - v * k + 4, 'text-anchor': 'end', class: 'ax' }, svg).textContent = v);
    el('line', { x1: x0, x2: x1, y1: y1 + 0.5, y2: y1 + 0.5, stroke: 'var(--axis)' }, svg);
    const paso = (x1 - x0) / SIGNUP.length, barras = [];
    const defs = el('defs', {}, svg); [['gS1', '#2ee6d6'], ['gS2', '#ff5cc8']].forEach(([id, c]) => { const g = el('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 }, defs); el('stop', { offset: 0, 'stop-color': c }, g); el('stop', { offset: 1, 'stop-color': c, 'stop-opacity': 0.45 }, g); });
    SIGNUP.forEach(([a, b], i) => { const x = x0 + i * paso + paso / 2; barras.push(el('rect', { x: x - 15, y: y1 - a * k, width: 14, height: a * k, rx: 2.5, fill: 'url(#gS1)' }, svg), el('rect', { x: x + 1, y: y1 - b * k, width: 13, height: b * k, rx: 2.5, fill: 'url(#gS2)' }, svg)); el('text', { x, y: h - 4, 'text-anchor': 'middle', class: 'ax' }, svg).textContent = `08:${String(i * 2).padStart(2, '0')}`; });
    return barras;
  }
  function dibujarCust() {
    const ul = $('#cust'), max = Math.max(...CUST.map((c) => c[2]));
    ul.innerHTML = CUST.map(([m, t, v, d], i) => `<li class="${i === CUST.length - 1 ? 'is-now' : ''}"><b>${t}</b><span class="cust__bar" style="height:${Math.round((v / max) * 32)}px"></span><span class="cust__l">${m}</span><span class="cust__d">${d || '&nbsp;'}</span></li>`).join('');
    return [...ul.querySelectorAll('.cust__bar')];
  }
  function dibujarLat() {
    const host = $('#lat'), w = host.clientWidth, h = host.clientHeight, svg = el('svg', { viewBox: `0 0 ${w} ${h}` }, host);
    const x0 = 46, x1 = w - 10, y1 = h - 11, k = 28 / 300;
    el('text', { x: 38, y: y1 - 300 * k + 4, 'text-anchor': 'end', class: 'ax' }, svg).textContent = '300';
    el('text', { x: 38, y: y1 + 4, 'text-anchor': 'end', class: 'ax' }, svg).textContent = '0';
    el('line', { x1: x0, x2: x1, y1: y1 - 300 * k + 0.5, y2: y1 - 300 * k + 0.5, stroke: 'var(--s5)', 'stroke-opacity': 0.55 }, svg);
    el('text', { x: x1 - 4, y: y1 - 300 * k - 6, 'text-anchor': 'end', class: 'slo' }, svg).textContent = 'SLO 300 ms';
    const clip = el('clipPath', { id: 'cLat' }, el('defs', {}, svg)); const rect = el('rect', { x: x0 - 4, y: 0, width: 0, height: h }, clip);
    const g = el('g', { 'clip-path': 'url(#cLat)' }, svg);
    LAT.forEach(([c, s]) => { const pts = s.map((v, i) => [x0 + (i / (s.length - 1)) * (x1 - x0), y1 - v * k]); const p = el('path', { d: 'M' + pts.map((q) => q.map((n) => n.toFixed(1)).join(' ')).join(' L'), fill: 'none', stroke: `var(--${c})`, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }, g); p.style.filter = `drop-shadow(0 0 3px color-mix(in oklab, var(--${c}) 55%, transparent))`; const u = pts[pts.length - 1]; el('circle', { cx: u[0], cy: u[1], r: 3, fill: `var(--${c})` }, g); });
    return { rect, ancho: x1 - x0 + 14 };
  }

  // ── el reloj y el ticker ──────────────────────────────────────────────────────────────────────────────────────
  function reloj() {
    const t = $('#reloj'); let seg = 13 * 60 + 54;
    t.innerHTML = '08:13:54'.split('').map((ch) => (ch === ':' ? '<span class="sep">:</span>' : `<span class="dg"><i>${ch}</i></span>`)).join('');
    setInterval(() => {
      seg++; const txt = `08:${String(Math.floor(seg / 60) % 60).padStart(2, '0')}:${String(seg % 60).padStart(2, '0')}`;
      [...t.children].forEach((sp, i) => { if (sp.className !== 'dg') return; const viejo = sp.lastElementChild; if (viejo.textContent === txt[i]) return;
        const nuevo = document.createElement('i'); nuevo.textContent = txt[i]; sp.appendChild(nuevo);
        if (reducido) { viejo.remove(); return; }
        nuevo.animate([{ transform: 'translateY(90%)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 350, easing: ease.p3o });
        viejo.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(-90%)', opacity: 0 }], { duration: 300, easing: 'ease-in' }).onfinish = () => viejo.remove(); });
    }, 1000);
  }

  // ── la entrada ────────────────────────────────────────────────────────────────────────────────────────────────
  function animar(n, frames, ms, demora, curva) { if (reducido) return; return n.animate(frames, { duration: ms, delay: demora, easing: curva, fill: 'backwards' }); }
  function cuenta(n, hasta, fmt, ms, demora) {
    if (reducido) return; const t0 = performance.now() + demora;
    const f = (t) => { const p = Math.min(1, Math.max(0, (t - t0) / ms)), e = 1 - Math.pow(1 - p, 3), v = hasta * e; n.textContent = fmt(v); if (p < 1) requestAnimationFrame(f); };
    n.textContent = fmt(0); requestAnimationFrame(f);
  }

  const rev = dibujarRev();
  const arcosT = dibujarAnillo($('#traffic'), TRAFFIC, '4,688', 'sessions', false);
  const arcosR = dibujarAnillo($('#region'), REGION, '$14.6K', 'revenue', true);
  const fills = dibujarCamp(); const sparks = dibujarKpis(); const gauge = dibujarGauge(61);
  const growth = dibujarGrowth(); const sbar = dibujarSignup(); const cbar = dibujarCust(); const lat = dibujarLat();
  reloj();
  const pill = $('.range__pill');
  $('.range').addEventListener('change', (e) => { const l = e.target.parentElement; const x = l.offsetLeft - 3;
    pill.animate([{ transform: pill.style.transform || 'translateX(0)' }, { transform: `translateX(${x}px)` }], { duration: 500, easing: ease.p3io, fill: 'forwards' });
    pill.style.transform = `translateX(${x}px)`;
    pill.animate([{ scale: '1 1' }, { scale: '1.18 1', offset: 0.42 }, { scale: '1 1' }], { duration: 520, composite: 'add' }); });
  $('#d-refresh').addEventListener('click', () => $('#d-refresh .ico').animate([{ rotate: '0deg' }, { rotate: '360deg' }], { duration: 900, easing: ease.p2io }));

  if (reducido) { rev.linea.style.strokeDasharray = ''; return; }
  animar($('.top'), [{ opacity: 0, transform: 'translateY(-10px)' }, { opacity: 1, transform: 'none' }], 600, 0, ease.p3o);
  document.querySelectorAll('.brand__ray').forEach((r, i) => animar(r, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], 600, 300 + i * 80, ease.p2o));
  const scan = $('.scan'); if (scan) animar(scan, [{ transform: 'translateY(-100%)', opacity: 1 }, { transform: `translateY(${innerHeight}px)`, opacity: 0 }], 1150, 100, 'linear');
  const tarjetas = [...document.querySelectorAll('.card')];
  tarjetas.forEach((c, i) => {
    const t = 350 + i * 60;
    animar(c, [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], 750, t, ease.p3o);
    animar($('.hud', c), [{ opacity: 0, transform: 'scale(1.08)' }, { opacity: 0.55, transform: 'none' }], 700, t + 50, ease.p2o);
  });
  const arranque = (i) => 350 + i * 60 + 120;
  // Revenue: crecen de izquierda a derecha (1,5 s, lineal) y la línea se dibuja .35 s después (1,3 s).
  rev.barras.forEach((b, i) => { b.style.transformBox = 'fill-box'; b.style.transformOrigin = '50% 100%'; animar(b, [{ transform: 'scaleY(0)' }, { transform: 'none' }], 300, arranque(0) + (i / rev.barras.length) * 1500, ease.p2o); });
  const largo = rev.linea.getTotalLength(); rev.linea.style.strokeDasharray = `${largo}`; animar(rev.linea, [{ strokeDashoffset: largo }, { strokeDashoffset: 0 }], 1300, arranque(0) + 350, ease.p2io);
  const big = $('[data-cuenta]'); cuenta(big, +big.dataset.cuenta, (v) => `$${Math.round(v).toLocaleString('en-US')}`, 900, arranque(0));
  [[arcosT, 1], [arcosR, 2]].forEach(([arcos, i]) => arcos.forEach(([a, da], j) => animar(a, [{ strokeDasharray: `0 ${da.split(' ')[1]}` }, { strokeDasharray: da }], 900, arranque(i) + j * 60, ease.p3o)));
  fills.forEach((f, j) => animar(f, [{ transform: 'scaleX(0)' }, { transform: 'none' }], 900, arranque(3) + j * 60, ease.p3o));
  sparks.forEach((s, j) => { const L = s.getTotalLength(); s.style.strokeDasharray = `${L}`; animar(s, [{ strokeDashoffset: L }, { strokeDashoffset: 0 }], 900, arranque(4) + j * 60, ease.p3o); });
  animar(gauge.fill, [{ strokeDasharray: '0 100' }, { strokeDasharray: '61 100' }], 1300, arranque(5), ease.p3io);
  animar(gauge.aguja, [{ transform: `rotate(${gauge.a0}deg)` }, { transform: gauge.aguja.style.transform }], 1300, arranque(5), ease.p3io);
  growth.barras.forEach((b, j) => { b.style.transformBox = 'fill-box'; b.style.transformOrigin = '50% 100%'; animar(b, [{ transform: 'scaleY(0)' }, { transform: 'none' }], 900, arranque(6) + j * 60, ease.p3o); });
  const fl = growth.flecha.getTotalLength(); growth.flecha.style.strokeDasharray = `${fl}`; animar(growth.flecha, [{ strokeDashoffset: fl }, { strokeDashoffset: 0 }], 900, arranque(6) + 400, ease.p2io);
  sbar.forEach((b, j) => { b.style.transformBox = 'fill-box'; b.style.transformOrigin = '50% 100%'; animar(b, [{ transform: 'scaleY(0)' }, { transform: 'none' }], 900, arranque(7) + j * 40, ease.p3o); });
  cbar.forEach((b, j) => animar(b, [{ transform: 'scaleY(0)' }, { transform: 'none' }], 900, arranque(8) + j * 60, ease.p3o));
  animar(lat.rect, [{ width: 0 }, { width: lat.ancho }], 1300, arranque(9), ease.p2io); lat.rect.setAttribute('width', lat.ancho);
  // El ticker: cada 3 s entra un pedido nuevo desde abajo y el viejo sube.
  const PEDIDOS = [['$57.69', 'Europe · Email'], ['$112.40', 'North America · Organic'], ['$38.05', 'APAC · Paid ads'], ['$74.90', 'LATAM · Social']];
  let iped = 0; setInterval(() => { iped = (iped + 1) % PEDIDOS.length; const t = $('#ticker'), viejos = [...t.children], n = document.createElement('span'); n.innerHTML = `<b>${PEDIDOS[iped][0]}</b>${PEDIDOS[iped][1]}`; t.appendChild(n);
    n.animate([{ transform: 'translateY(100%)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 450, delay: 100, easing: ease.p3o, fill: 'backwards' });
    viejos.forEach((v) => (v.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(-100%)', opacity: 0 }], { duration: 220, easing: 'ease-in' }).onfinish = () => v.remove())); }, 3000);
})();
