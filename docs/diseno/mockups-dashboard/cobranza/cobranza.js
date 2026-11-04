// ═══════════════════════════════════════════════════════════════════════════════════════════
// COBRANZA — el dibujo y el movimiento de la hoja, copiados de la raíz «Overview» de Coffer.
// 4/11/2026. Código nuestro: las RECETAS (qué se mueve, desde dónde, cuánto tarda y con qué curva)
// salen de demos/coffer/INFORME.txt, que las leyó del bundle. Se escribe con Element.animate, sin GSAP.
//
// Lo que está medido en el informe y se copia:
//   el título      «co»: cada letra yPercent 115→0 · .85s power4.out · stagger .022
//   las tarjetas   «uo»: opacity 0, y 34, scale .985 → 1 · .85s power3.out · stagger .06
//   las cifras     «po»: cuentan desde 0 · 1.2s power3.out
//   la antigüedad  «Pc»: cada tramo scaleX 0→su acumulado · .9s power3.inOut · demora i·.04
//   el selector    «xo»: la pastilla viaja .5s power3.inOut y se estira (scaleX s → máx+.3·Δ/100 → a)
//   «Remind»       «Gc»: el avión sale (x10 y−8 rot12, opacity 0 · .28 power2.in) y vuelve (.35 back.out(2));
//                  el aviso «mo»: opacity 0, y 18, scale .96 → 1 · .45 back.out(1.8), y se va a los 2.6s
//                  (opacity 0, y 10 · .3 power2.in); las filas «Jc»: opacity .4→1 · .4s · stagger .03
//
// ⚠️ LO QUE NO SE PUDO COPIAR, y no se inventa (anotado en docs/relevo/nube-dashboards.md):
//   - la función de entrada de la Overview (`Nu.overview.enter`) NO está en el informe: no se sabe en qué
//     momento arranca cada pieza ni si el saludo, la línea de abajo, los botones, las filas de las listas, las
//     barras del flujo, las de los clientes o el anillo tienen entrada propia. Esos quedan quietos.
//   - el arranque de las tarjetas (0,1s) y de la antigüedad (con la tarjeta) es una inferencia.
//   - cómo se dibujan los arcos del anillo («Mc»): el informe corta la receta antes de la animación.
//   - a qué se le pone [data-lift] (el hover que sube 3 px): está la receta, no los elementos.
// ═══════════════════════════════════════════════════════════════════════════════════════════
(() => {
  const P4O = 'cubic-bezier(.165,.84,.44,1)';
  const P3O = 'cubic-bezier(.215,.61,.355,1)';
  const P3IO = 'cubic-bezier(.645,.045,.355,1)';
  const P2I = 'cubic-bezier(.55,.085,.68,.53)';
  const B18 = 'cubic-bezier(.34,1.56,.64,1)';
  const B2 = 'cubic-bezier(.34,1.7,.64,1)';
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const captura = location.search.includes('captura');
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs = {}, padre) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (padre) padre.appendChild(n);
    return n;
  };

  // ── el flujo: lo que entra arriba de la línea, lo que sale abajo y el neto como punto ──────────
  const plata = (v) => (v < 0 ? '−' : '') + '$' + Math.round(Math.abs(v) / 1000) + 'K';
  function flujo(caja, cuantos) {
    const d = JSON.parse(caja.dataset.flow);
    const n0 = d.meses.length - (cuantos || d.meses.length);
    const meses = d.meses.slice(n0), entra = d.entra.slice(n0), sale = d.sale.slice(n0);
    const W = caja.clientWidth || 698;
    const H = 261, top = 13, bot = 235, x0 = 51.9, x1 = W - 7.9;
    const y = (v) => top + ((d.max - v) / (d.max - d.min)) * (bot - top);
    caja.innerHTML = '';
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': caja.dataset.label || 'Cash flow' }, caja);
    for (let v = d.min; v <= d.max; v += d.paso) {
      el('line', { class: v === 0 ? 'gl zero' : 'gl', x1: x0, x2: x1, y1: y(v) + .5, y2: y(v) + .5 }, svg);
      const t = el('text', { x: x0 - 8, y: y(v) + .5, 'text-anchor': 'end', 'dominant-baseline': 'middle' }, svg);
      t.textContent = v === 0 ? '0' : plata(v);
    }
    const slot = (x1 - x0) / meses.length;
    const bw = Math.min(25, Math.round(slot - 10));
    const r = 3;
    const cada = slot < 40 ? 2 : 1;
    meses.forEach((m, i) => {
      const cx = x0 + slot * (i + .5);
      const a = Math.round(cx - bw / 2), b = a + bw;
      const yi = y(entra[i]), y0 = y(0) + .5, yo = y(-sale[i]);
      if (entra[i] > 0) el('path', { class: 'b-in', d: `M${a},${y0}V${yi + r}Q${a},${yi} ${a + r},${yi}H${b - r}Q${b},${yi} ${b},${yi + r}V${y0}Z` }, svg);
      if (sale[i] > 0) el('path', { class: 'b-out', d: `M${a},${y0 + 1}V${yo - r}Q${a},${yo} ${a + r},${yo}H${b - r}Q${b},${yo} ${b},${yo - r}V${y0 + 1}Z` }, svg);
      if (!('sinNeto' in caja.dataset)) el('circle', { class: 'net', cx, cy: y(entra[i] - sale[i]), r: 3.5 }, svg);
      if ((meses.length - 1 - i) % cada === 0) {
        const t = el('text', { x: cx, y: 251.5, 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, svg);
        t.textContent = m;
      }
    });
  }
  const cajasFlujo = $$('[data-flow]');
  cajasFlujo.forEach((c) => flujo(c));
  let ancho = innerWidth;
  addEventListener('resize', () => { if (innerWidth !== ancho) { ancho = innerWidth; cajasFlujo.forEach((c) => flujo(c, c._cuantos)); } });

  // ── el anillo (la geometría de «Mc»: r 62 en 160, 2,5 de hueco entre arcos, desde arriba) ─────
  $$('[data-donut]').forEach((caja) => {
    const tramos = JSON.parse(caja.dataset.donut);
    const total = tramos.reduce((s, t) => s + t.v, 0) || 1;
    const C = 2 * Math.PI * 62;
    const svg = el('svg', { viewBox: '0 0 160 160', 'aria-hidden': 'true' });
    const g = el('g', { transform: 'rotate(-90 80 80)' }, svg);
    el('circle', { class: 'd-track', r: 62, cx: 80, cy: 80 }, g);
    let acum = 0;
    for (const t of tramos) {
      const len = Math.max(0, (t.v / total) * C - 2.5);
      const arc = el('circle', { class: 'd-arc', r: 62, cx: 80, cy: 80, 'stroke-dasharray': `${len} ${C}`, 'stroke-dashoffset': -acum }, g);
      arc.style.stroke = t.c;
      acum += (t.v / total) * C;
    }
    caja.prepend(svg);
  });

  // ── la antigüedad («Pc»): tramos apilados, cada uno hasta su acumulado ────────────────────────
  function antiguedad(caja, anima, demora = 0) {
    const vals = caja.dataset.aging.split(',').map(Number);
    const total = vals.reduce((s, v) => s + v, 0) || 1;
    let acum = 0;
    const hasta = vals.map((v) => (acum += v) / total);
    if (!caja.children.length) caja.innerHTML = hasta.map((_, i) => `<span class="aging__seg aging__seg--${i}" style="z-index:${4 - i}"></span>`).reverse().join('');
    [...caja.querySelectorAll('.aging__seg')].reverse().forEach((s, i) => {
      s.style.transform = `scaleX(${hasta[i] ?? 0})`;
      if (anima && !quieto) s.animate([{ transform: 'scaleX(0)' }, { transform: `scaleX(${hasta[i] ?? 0})` }], { duration: 900, easing: P3IO, delay: (demora + i * .04) * 1000, fill: 'backwards' });
    });
  }

  // ── las cifras que cuentan («po») ──────────────────────────────────────────────────────────────
  const p3 = (t) => 1 - Math.pow(1 - t, 3);
  const formato = (e, v) => (e.dataset.prefix || '') + Math.round(v).toLocaleString('en-US') + (e.dataset.suffix || '');
  function cuenta(e, demora = 0) {
    const fin = parseFloat(e.dataset.count) || 0;
    if (quieto || captura) { e.textContent = formato(e, fin); return; }
    e.textContent = formato(e, 0);
    const t0 = performance.now() + demora * 1000;
    const paso = (ahora) => {
      const t = Math.min(1, Math.max(0, (ahora - t0) / 1200));
      e.textContent = formato(e, fin * p3(t));
      if (t < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  }

  // ── el selector de meses («xo») ────────────────────────────────────────────────────────────────
  $$('[data-seg]').forEach((seg) => {
    const pill = $('.seg__pill', seg);
    const btns = $$('.seg__btn', seg);
    let x = 0, s = 1;
    const ubicar = (anima) => {
      const b = btns.find((k) => k.getAttribute('aria-pressed') === 'true') || btns[0];
      const nx = b.offsetLeft, ns = b.offsetWidth / 100;
      if (anima && !quieto) {
        const c = (Math.abs(nx - x) / 100) * .3;
        pill.animate([{ transform: `translateX(${x}px) scaleX(${s})` }, { transform: `translateX(${(x + nx) / 2}px) scaleX(${Math.max(ns, s) + c})` }, { transform: `translateX(${nx}px) scaleX(${ns})` }], { duration: 500, easing: P3IO });
      }
      pill.style.transform = `translateX(${nx}px) scaleX(${ns})`;
      x = nx; s = ns;
    };
    ubicar(false);
    document.fonts?.ready.then(() => ubicar(false));
    btns.forEach((b) => b.addEventListener('click', () => {
      if (b.getAttribute('aria-pressed') === 'true') return;
      btns.forEach((k) => k.setAttribute('aria-pressed', String(k === b)));
      ubicar(true);
      const caja = seg.closest('.card').querySelector('[data-flow]');
      if (caja) { caja._cuantos = parseInt(b.textContent, 10) || 0; flujo(caja, caja._cuantos); }
    }));
  });

  // ── «Remind» («Gc» + «mo» + «Jc») ──────────────────────────────────────────────────────────────
  const toast = $('.toast');
  function aviso(txt) {
    if (!toast) return;
    toast.textContent = txt;
    toast.getAnimations().forEach((a) => a.cancel());
    if (quieto) { toast.style.opacity = 1; setTimeout(() => { toast.style.opacity = 0; }, 2600); return; }
    toast.animate([
      { opacity: 0, transform: 'translateX(-50%) translateY(18px) scale(.96)', easing: B18, offset: 0 },
      { opacity: 1, transform: 'translateX(-50%) translateY(0) scale(1)', easing: 'linear', offset: .45 / 3.35 },
      { opacity: 1, transform: 'translateX(-50%) translateY(0) scale(1)', easing: P2I, offset: 3.05 / 3.35 },
      { opacity: 0, transform: 'translateX(-50%) translateY(10px) scale(1)', offset: 1 },
    ], { duration: 3350 });
  }
  $$('[data-remind]').forEach((b) => b.addEventListener('click', () => {
    const n = +b.dataset.remind || 1;
    const ic = $('svg', b);
    if (ic && !quieto) {
      ic.animate([
        { transform: 'none', opacity: 1, easing: P2I },
        { transform: 'translate(10px,-8px) rotate(12deg)', opacity: 0, offset: .28 / .63 },
        { transform: 'translate(-6px,4px)', opacity: 0, easing: B2, offset: .28 / .63 },
        { transform: 'none', opacity: 1 },
      ], { duration: 630 });
    }
    aviso(b.dataset.aviso || (n === 1 ? 'Reminder sent' : `${n} reminders sent`));
    if (!quieto) $$('.due').forEach((d, i) => d.animate([{ opacity: .4 }, { opacity: 1 }], { duration: 400, delay: i * 30, fill: 'backwards' }));
  }));

  // ── la entrada ─────────────────────────────────────────────────────────────────────────────────
  $$('[data-aging]').forEach((c) => antiguedad(c, false));
  if (quieto || captura) { $$('[data-count]').forEach((e) => cuenta(e)); return; }
  const titulo = $('.head__title');
  if (titulo) {
    const txt = titulo.textContent;
    titulo.innerHTML = `<span class="w">${[...txt].map((c) => `<span class="l">${c === ' ' ? '&nbsp;' : c}</span>`).join('')}</span>`;
    $$('.l', titulo).forEach((l, i) => l.animate([{ transform: 'translateY(115%)' }, { transform: 'none' }], { duration: 850, easing: P4O, delay: i * 22, fill: 'backwards' }));
  }
  $$('[data-card]').forEach((c, i) => c.animate(
    [{ opacity: 0, transform: 'translateY(34px) scale(.985)' }, { opacity: 1, transform: 'none' }],
    { duration: 850, easing: P3O, delay: 100 + i * 60, fill: 'backwards' },
  ));
  $$('[data-aging]').forEach((c) => antiguedad(c, true, .1));
  $$('[data-count]').forEach((e) => cuenta(e, .1));
})();
