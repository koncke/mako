// ═══════════════════════════════════════════════════════════════════════════════════════════
// FOCUS (PANE) — el dibujo y el movimiento de la hoja, copiados de la «Home» de Pane. 4/11/2026.
// Código nuestro: las RECETAS (qué se mueve, desde dónde, cuánto tarda y con qué curva) salen de demos/pane/INFORME.txt,
// que las leyó del bundle. Se escribe con Element.animate, sin GSAP.
//
// Lo que está medido en el informe y se copia:
//   la cabecera   «zc»: el título letra por letra (yPercent 115, rotation 6 → 0 · .85 s power4.out · .022); la bajada y
//                 los botones «po» (opacity 0, y 12 · .55 s power3.out · .06, a los .1); las tres cifras «lo» (y 14, scale
//                 .97 y un recorte desde el 60 % · .9 s expo.out · .06, a los .1; y su contenido opacity 0, y 8 · .55 s ·
//                 .035, a los .14 de cada una)
//   las tarjetas  «lo» (y 26, scale .97, recorte desde el 72 % · .9 s expo.out · .07; su contenido como arriba)
//   las filas     «po» (opacity 0, y 12 · .55 s power3.out · .045)
//   las cifras    «vo» (cuentan · 1.2 s power3.out)
//   el selector   la pastilla viaja .38 s con el resorte de la hoja (--spring) y cambia de ancho en .2 s (--ease)
//   el hover      «So»: lo que lleva [data-lift] sube 4 px · .45 s power3.out, y baja en .5 s
//
// ⚠️ LO QUE NO SE PUDO COPIAR, y no se inventa (anotado en docs/relevo/nube-dashboards.md):
//   - la entrada de la Home (`home.enter`) vive en el chunk home-*.js, que el informe no trae: qué recibe cada receta, en qué
//     orden y con qué demora es una INFERENCIA (las tarjetas con «lo», las filas con «po», las cifras con «vo»).
//   - cómo crecen los anillos y las barras: no está; quedan con su valor final, sin animar.
//   - a qué se le pone [data-lift]: está la receta, no los elementos (se le pone a las tarjetas, como en Halden).
// ═══════════════════════════════════════════════════════════════════════════════════════════
(() => {
  const P4O = 'cubic-bezier(.165,.84,.44,1)';
  const P3O = 'cubic-bezier(.215,.61,.355,1)';
  const EXPO = 'cubic-bezier(.16,1,.3,1)';
  const SPRING = 'cubic-bezier(.34,1.45,.55,1)';
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const captura = location.search.includes('captura');
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, padre) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); padre?.appendChild(n); return n; };

  // ── los anillos (14 de trazo, radios 53 · 38,5 · 24 en un lienzo de 120, desde arriba) ─────────
  $$('[data-rings]').forEach((caja) => {
    const svg = $('svg', caja);
    const anillos = JSON.parse(caja.dataset.rings);
    const radios = [53, 38.5, 24];
    const g = el('g', { transform: 'rotate(-90 60 60)' }, svg);
    anillos.forEach((a, i) => {
      const r = radios[i], C = 2 * Math.PI * r, f = Math.max(0, Math.min(1, a.v / a.de));
      el('circle', { class: 'tr', r, cx: 60, cy: 60, stroke: a.c, 'stroke-opacity': '.24' }, g);
      if (f > 0) el('circle', { class: 'ar', r, cx: 60, cy: 60, stroke: a.c, 'stroke-dasharray': `${f * C} ${C}` }, g);
    });
  });

  // ── la semana: siete pistas, lo hecho desde abajo, y el día de hoy más claro ──────────────────
  $$('[data-bars]').forEach((caja) => {
    const d = JSON.parse(caja.dataset.bars);
    caja.innerHTML = d.dias.map((dia, i) => {
      const v = d.v[i] ?? 0, h = Math.min(100, (v / (d.max || 1)) * 100);
      return `<div class="bar7${i === d.hoy ? ' bar7--hoy' : ''}"><div class="bar7__t"><div class="bar7__f${v ? '' : ' bar7__f--cero'}" style="height:${h}%"></div></div><div class="bar7__l">${dia}</div></div>`;
    }).join('');
  });

  // ── el selector (la pastilla viaja con el resorte y cambia de ancho) ─────────────────────────
  $$('[data-seg]').forEach((seg) => {
    const pill = $('.seg__pill', seg), btns = $$('.seg__btn', seg);
    const ubicar = (anima) => {
      const b = btns.find((k) => k.getAttribute('aria-pressed') === 'true') || btns[0];
      const de = pill.style.transform, deW = pill.style.width;
      pill.style.transform = `translateX(${b.offsetLeft}px)`;
      pill.style.width = `${b.offsetWidth}px`;
      if (anima && de && !quieto) {
        pill.animate([{ transform: de }, { transform: pill.style.transform }], { duration: 380, easing: SPRING });
        pill.animate([{ width: deW }, { width: pill.style.width }], { duration: 200, easing: 'cubic-bezier(.22,.8,.24,1)' });
      }
    };
    ubicar(false);
    document.fonts?.ready.then(() => ubicar(false));
    btns.forEach((b) => b.addEventListener('click', () => { btns.forEach((k) => k.setAttribute('aria-pressed', String(k === b))); ubicar(true); }));
  });

  // ── el hover que sube («So») ──────────────────────────────────────────────────────────────────
  if (matchMedia('(hover: hover)').matches && !quieto) $$('[data-card]').forEach((c) => {
    c.addEventListener('pointerenter', () => c.animate([{ transform: getComputedStyle(c).transform === 'none' ? 'none' : getComputedStyle(c).transform }, { transform: 'translateY(-4px)' }], { duration: 450, easing: P3O, fill: 'forwards' }));
    c.addEventListener('pointerleave', () => c.animate([{ transform: 'translateY(-4px)' }, { transform: 'none' }], { duration: 500, easing: P3O, fill: 'forwards' }));
  });

  // ── las cifras que cuentan («vo») ─────────────────────────────────────────────────────────────
  const p3 = (t) => 1 - Math.pow(1 - t, 3);
  function cuenta(e, demora = 0) {
    const fin = parseFloat(e.dataset.count) || 0;
    if (quieto || captura) { e.textContent = String(fin); return; }
    e.textContent = '0';
    const t0 = performance.now() + demora * 1000;
    const paso = (ahora) => { const t = Math.min(1, Math.max(0, (ahora - t0) / 1200)); e.textContent = String(Math.round(fin * p3(t))); if (t < 1) requestAnimationFrame(paso); };
    requestAnimationFrame(paso);
  }

  // ── la entrada ─────────────────────────────────────────────────────────────────────────────────
  if (quieto || captura) return;
  const recorte = (n, desde) => `inset(0 0 ${Math.round(n.offsetHeight * desde)}px 0 round 30px)`;
  const lo = (nodos, { y = 26, stagger = 0.07, delay = 0, from = 0.72 } = {}) => nodos.forEach((n, i) => {
    const t = delay + i * stagger;
    n.animate([{ transform: `translateY(${y}px) scale(.97)`, clipPath: recorte(n, from) }, { transform: 'none', clipPath: 'inset(0 0 0 0 round 30px)' }], { duration: 900, easing: EXPO, delay: t * 1000, fill: 'backwards' });
    [...n.children].forEach((k, j) => k.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 550, easing: P3O, delay: (t + 0.14 + j * 0.035) * 1000, fill: 'backwards' }));
  });
  const po = (nodos, { y = 12, stagger = 0.045, delay = 0 } = {}) => nodos.forEach((n, i) =>
    n.animate([{ opacity: 0, transform: `translateY(${y}px)` }, { opacity: 1, transform: 'none' }], { duration: 550, easing: P3O, delay: (delay + i * stagger) * 1000, fill: 'backwards' }));
  const titulo = $('.head__title');
  if (titulo) {
    const txt = titulo.textContent;
    titulo.setAttribute('aria-label', txt);
    titulo.innerHTML = `<span class="w" aria-hidden="true">${[...txt].map((c) => `<span class="l">${c}</span>`).join('')}</span>`;
    $$('.l', titulo).forEach((l, i) => l.animate([{ transform: 'translateY(115%) rotate(6deg)' }, { transform: 'none' }], { duration: 850, easing: P4O, delay: i * 22, fill: 'backwards' }));
  }
  po($$('.head__sub, .head__actions > *'), { y: 12, stagger: 0.06, delay: 0.1 });
  lo($$('[data-stat]'), { y: 14, stagger: 0.06, delay: 0.1, from: 0.6 });
  lo($$('[data-card]'), { delay: 0.2 });
  po($$('.task, .hproject, .person, .ev'), { delay: 0.45 });
  $$('[data-count]').forEach((e) => cuenta(e, 0.3));
})();
