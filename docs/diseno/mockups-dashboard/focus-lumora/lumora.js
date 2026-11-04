// ═══════════════════════════════════════════════════════════════════════════════════════════
// FOCUS (LUMORA) — el dibujo y el movimiento de la página «Today» de Lumora. 4/11/2026.
// Código nuestro: las RECETAS salen de demos/lumora/INFORME.txt, que las leyó del bundle, y se escriben con Element.animate.
//
// A diferencia de Pane, el INFORME de Lumora SÍ trae la entrada de su página (`xt`, en dashboard-B8JLywDl.js), así que el
// orden y las demoras de abajo son las suyas:
//   0     el hero sube («er»: opacity 0, y 24, scale .985 · .9 s power3.out); el título letra por letra (yPercent 115,
//         rotation 6 · .85 s power4.out · .022, a los .1); la fecha, el resumen y los botones («Zn»: y 10 · .55 s · .06, a los .15)
//   .15   las dos tarjetas de la IA («qn»: opacity 0, y 40, rotación ±3, scale .94 · .8 s back.out(1.4) · .08)
//   .2    las tarjetas del riel («er», y 26 · .08); a los .35 los días del mes (y 6 · .008); a los .55 las filas del día y de
//         los recordatorios (x 10 · .04)
//   .25   la cinta del día: cada bloque crece desde abajo (scaleY .2 → 1 · .7 s back.out(1.7) · .045); a los .75 la marca del
//         ahora baja (yPercent -40 · .6 s back.out(2))
//   .3    los cuatro números («er» · .06); a los .4 sus líneas se dibujan («Jn»: el trazo · 1 s power2.inOut · .06, a los .1)
//   .45   las tarjetas de abajo («er» · .06); a los .6 los accesos (y 12 · .035); a los .7 las filas (y 10 · .03); a los .95
//         las pastillas de riesgo («nr»: scale .5 → 1 · .6 s back.out(3) · .08)
//   las cifras cuentan («Kn»: 1.2 s power3.out); el hover que sube («$n»: lo que lleva [data-lift] sube 4 px · .45 s power3.out,
//   baja en .5 s); la pastilla del selector viaja con .3 s var(--ease) (la transición `transform .3s var(--ease)` del CSS).
//
// ⚠️ LO QUE NO SE PUDO COPIAR, y no se inventa (anotado en docs/relevo/nube-dashboards.md):
//   - `Oe(.kpis)` en la entrada: el INFORME no trae qué hace ese helper; no se pone.
//   - las curvas back.out de GSAP no tienen un cubic-bezier exacto: van las aproximaciones de abajo.
//   - a qué se le pone [data-lift]: está la receta, no los elementos (se le pone a las tarjetas, como en Pane y Halden).
// ═══════════════════════════════════════════════════════════════════════════════════════════
(() => {
  const P4O = 'cubic-bezier(.165,.84,.44,1)';
  const P3O = 'cubic-bezier(.215,.61,.355,1)';
  const P2IO = 'cubic-bezier(.455,.03,.515,.955)';
  const BACK = { 1.4: 'cubic-bezier(.18,.89,.32,1.22)', 1.7: 'cubic-bezier(.175,.885,.32,1.275)', 2: 'cubic-bezier(.17,.88,.3,1.35)', 3: 'cubic-bezier(.15,.9,.3,1.6)' };
  const EASE = 'cubic-bezier(.2,.8,.2,1)';
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const captura = location.search.includes('captura');
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, padre) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); padre?.appendChild(n); return n; };

  // ── la dona (15 de trazo en un lienzo de 130, desde arriba, con 2 px entre tramos) ──────────────────
  $$('[data-donut]').forEach((caja) => {
    const tramos = JSON.parse(caja.dataset.donut);
    const svg = $('svg', caja), r = 57.5, C = 2 * Math.PI * r, total = tramos.reduce((s, t) => s + t.v, 0) || 1;
    let acum = 0;
    tramos.forEach((t) => {
      const largo = Math.max(0, (t.v / total) * C - 2);
      el('circle', { r, cx: 65, cy: 65, stroke: t.c, 'stroke-dasharray': `${largo} ${C}`, 'stroke-dashoffset': -acum }, svg);
      acum += (t.v / total) * C;
    });
  });

  // ── las barras por clase (promedio y mejor nota, sobre 0-100 %) ───────────────────────────────────
  $$('[data-gbars]').forEach((caja) => {
    const d = JSON.parse(caja.dataset.gbars);
    $('.gbars__cols', caja).innerHTML = d.map(([g, a, b]) =>
      `<div class="gbars__g"><span class="gbars__bar" style="--c:var(--pine);height:${a}%"></span><span class="gbars__bar" style="--c:var(--marigold);height:${b}%"></span><label>${g}</label></div>`).join('');
  });

  // ── el mes (lunes primero; lo de afuera más claro, el fin de semana más claro, los feriados rayados) ──────
  $$('[data-cal]').forEach((caja) => {
    const d = JSON.parse(caja.dataset.cal);
    const dow = d.dias || ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
    let html = dow.map((x) => `<span class="cal__dow">${x}</span>`).join('');
    const ini = new Date(`${d.inicio}T12:00:00Z`);
    for (let i = 0; i < 35; i++) {
      const f = new Date(ini); f.setUTCDate(ini.getUTCDate() + i);
      const iso = f.toISOString().slice(0, 10), fuera = iso.slice(0, 7) !== d.mes, finde = i % 7 >= 5;
      const cls = ['cal__d', fuera && 'is-out', finde && 'is-we', d.feriado.includes(iso) && 'is-hol', iso === d.hoy && 'is-today'].filter(Boolean).join(' ');
      const p = (d.puntos[iso] || []).map((c) => `<i style="--c:${c === 'x' ? 'currentColor' : c}"></i>`).join('');
      html += `<button class="${cls}">${f.getUTCDate()}${p ? `<span class="dots">${p}</span>` : ''}</button>`;
    }
    caja.innerHTML = html;
  });

  // ── la marca del ahora, sobre el bloque que está corriendo (09:40 en el bloque de 09:25 a 10:15) ──────
  $$('.ribbon').forEach((r) => {
    const ahora = $('.ribbon__now', r), b = $('.is-now', r);
    if (ahora && b) ahora.style.left = `${b.offsetLeft + b.offsetWidth * 0.25}px`;
  });

  // ── el selector (la pastilla viaja con la transición del CSS: transform .3s var(--ease)) ─────────────
  $$('[data-seg]').forEach((seg) => {
    const pill = $('.seg__pill', seg), btns = $$('.seg__btn', seg);
    const ubicar = (anima) => {
      const b = btns.find((k) => k.getAttribute('aria-pressed') === 'true') || btns[0];
      const de = pill.style.transform, deW = pill.style.width;
      pill.style.transform = `translateX(${b.offsetLeft}px)`;
      pill.style.width = `${b.offsetWidth}px`;
      if (anima && de && !quieto) {
        pill.animate([{ transform: de, width: deW }, { transform: pill.style.transform, width: pill.style.width }], { duration: 300, easing: EASE });
      }
    };
    ubicar(false);
    document.fonts?.ready.then(() => ubicar(false));
    btns.forEach((b) => b.addEventListener('click', () => { btns.forEach((k) => k.setAttribute('aria-pressed', String(k === b))); ubicar(true); }));
  });

  // ── el hover que sube («$n») ──────────────────────────────────────────────────────────────────────
  if (matchMedia('(hover: hover)').matches && !quieto) $$('[data-card]').forEach((c) => {
    c.addEventListener('pointerenter', () => c.animate([{ transform: 'none' }, { transform: 'translateY(-4px)' }], { duration: 450, easing: P3O, fill: 'forwards' }));
    c.addEventListener('pointerleave', () => c.animate([{ transform: 'translateY(-4px)' }, { transform: 'none' }], { duration: 500, easing: P3O, fill: 'forwards' }));
  });

  // ── las cifras que cuentan («Kn») ─────────────────────────────────────────────────────────────────
  const p3 = (t) => 1 - Math.pow(1 - t, 3);
  function cuenta(e, demora = 0) {
    const fin = parseFloat(e.dataset.count) || 0;
    if (quieto || captura) { e.textContent = String(fin); return; }
    e.textContent = '0';
    const t0 = performance.now() + demora * 1000;
    const paso = (ahora) => { const t = Math.min(1, Math.max(0, (ahora - t0) / 1200)); e.textContent = String(Math.round(fin * p3(t))); if (t < 1) requestAnimationFrame(paso); };
    requestAnimationFrame(paso);
  }

  // ── la entrada (`xt`) ─────────────────────────────────────────────────────────────────────────────
  if (quieto || captura) return;
  const a = (n, desde, dur, ease, delay, extra = {}) => n.animate([desde, { opacity: 1, transform: 'none' }], { duration: dur * 1000, easing: ease, delay: delay * 1000, fill: 'backwards', ...extra });
  const er = (nodos, { y = 34, stagger = 0.07, delay = 0 } = {}) => nodos.forEach((n, i) => a(n, { opacity: 0, transform: `translateY(${y}px) scale(.985)` }, 0.9, P3O, delay + i * stagger));
  const zn = (nodos, { x = 0, y = 12, stagger = 0.045, delay = 0 } = {}) => nodos.forEach((n, i) => a(n, { opacity: 0, transform: `translate(${x}px, ${y}px)` }, 0.55, P3O, delay + i * stagger));
  const qn = (nodos, { stagger = 0.06, delay = 0 } = {}) => nodos.forEach((n, i) => a(n, { opacity: 0, transform: `translateY(40px) rotate(${i % 2 ? 3 : -3}deg) scale(.94)` }, 0.8, BACK[1.4], delay + i * stagger));
  const nr = (nodos, { from = 0.6, stagger = 0.05, delay = 0 } = {}) => nodos.forEach((n, i) => a(n, { opacity: 0, transform: `scale(${from})` }, 0.6, BACK[3], delay + i * stagger));

  er([$('.hero')], { y: 24 });
  const titulo = $('.hero__title');
  if (titulo) {
    const txt = titulo.textContent;
    titulo.setAttribute('aria-label', txt);
    titulo.innerHTML = `<span class="w" aria-hidden="true">${[...txt].map((c) => `<span class="l">${c}</span>`).join('')}</span>`;
    $$('.l', titulo).forEach((l, i) => l.animate([{ transform: 'translateY(115%) rotate(6deg)' }, { transform: 'none' }], { duration: 850, easing: P4O, delay: 100 + i * 22, fill: 'backwards' }));
  }
  zn($$('.hero__date, .hero__sum, .hero__acts > *'), { y: 10, stagger: 0.06, delay: 0.15 });
  $$('.ribbon__it').forEach((n, i) => { n.style.transformOrigin = '50% 100%'; a(n, { opacity: 0, transform: 'scaleY(.2)' }, 0.7, BACK[1.7], 0.25 + i * 0.045); });
  const ahora = $('.ribbon__now');
  if (ahora) a(ahora, { opacity: 0, transform: 'translateY(-40%)' }, 0.6, BACK[2], 0.75);
  qn($$('.ai-card'), { stagger: 0.08, delay: 0.15 });
  er($$('.kpi'), { stagger: 0.06, delay: 0.3 });
  $$('.kpi .spark path').forEach((p, i) => {
    const L = p.getTotalLength();
    p.style.strokeDasharray = String(L);
    p.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 1000, easing: P2IO, delay: (0.4 + 0.1 + i * 0.06) * 1000, fill: 'backwards' });
  });
  // «rt» (`.meter__fill`: scaleX 0 → su valor · 1 s power3.out · .03): en la adaptación la barrita reemplaza a la línea. Se
  // pone a los .4, donde la entrada llama a `Oe(.kpis)` (el INFORME no dice qué hace ese helper: es una inferencia).
  $$('.kpi .meter__fill').forEach((m, i) => { const fin = m.style.transform || 'scaleX(1)'; m.animate([{ transform: 'scaleX(0)' }, { transform: fin }], { duration: 1000, easing: P3O, delay: (0.4 + i * 0.03) * 1000, fill: 'backwards' }); });
  er($$('.quick, .upc, .hw, .perf, .risk, .notes'), { stagger: 0.06, delay: 0.45 });
  zn($$('.quick__a'), { y: 12, stagger: 0.035, delay: 0.6 });
  zn($$('.upc__row, .risk__row, .notes__row'), { y: 10, stagger: 0.03, delay: 0.7 });
  nr($$('.risk .pill'), { from: 0.5, stagger: 0.08, delay: 0.95 });
  er($$('.dash__rail > .card'), { stagger: 0.08, y: 26, delay: 0.2 });
  zn($$('.cal__d'), { y: 6, stagger: 0.008, delay: 0.35 });
  zn($$('.sch__row, .rem__row'), { x: 10, y: 0, stagger: 0.04, delay: 0.55 });
  $$('[data-count]').forEach((e) => cuenta(e, 0.3));
})();
