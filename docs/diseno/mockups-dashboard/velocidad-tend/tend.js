// VELOCIDAD DE LLAMADA (TEND) — el movimiento y los dibujos de la copia de la página «Today» de Tend. 10/11/2026. Código nuestro, desde lo
// medido (demos/tend/INFORME.txt). Lo usan las dos maquetas (copia.html y velocidad.html): los datos los pone cada página en
// window.TEND_DATOS, y esto sólo dibuja.
//
// Lo MEDIDO que está acá:
//   · la entrada de la cabecera (la `R` exportada de la librería, `wc` en el INFORME): el título letra por letra (yPercent 115 y 6° → 0,
//     .85 s power4.out, de a .022 s), el renglón de arriba (y 8, .55 s power3.out) y, a los .12 s, los números y los botones (y 14, de a
//     .07 s);
//   · el selector «2W · 30D» corre su píldora (.3 s, la curva --ease de la hoja: la transición `transform .3s var(--ease)` del CSS);
//   · los hover son los del CSS de la hoja.
// ⚠️ La entrada de las TARJETAS de «Today» vive en su chunk (today-*.js), que el INFORME no muestra: no se inventa, quedan quietas.
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const NS = 'http://www.w3.org/2000/svg';
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const P4 = 'cubic-bezier(.165, .84, .44, 1)', P3 = 'cubic-bezier(.215, .61, .355, 1)';
  const D = window.TEND_DATOS || {};

  // ── la cabecera ────────────────────────────────────────────────────────────────────────────────────────────────────────────
  function entrada() {
    if (quieto) return;
    const t = $('.head__title');
    if (t && !t.dataset.partido) {
      t.dataset.partido = '1';
      const txt = t.textContent; t.textContent = '';
      // Letra por letra, pero cada palabra entera en su caja: si el título no entra, baja de renglón entre palabras, nunca adentro de una.
      txt.split(' ').forEach((pal, k) => {
        if (k) t.appendChild(document.createTextNode(' '));
        const w = document.createElement('span'); w.className = 'pal';
        for (const ch of pal) { const s = document.createElement('span'); s.className = 'ch'; s.textContent = ch; w.appendChild(s); }
        t.appendChild(w);
      });
      $$('.ch', t).forEach((s, i) => s.animate([{ transform: 'translateY(115%) rotate(6deg)' }, { transform: 'none' }], { duration: 850, delay: i * 22, easing: P4, fill: 'backwards' }));
    }
    $$('.head__eyebrow').forEach((e) => e.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 550, easing: P3, fill: 'backwards' }));
    $$('.head .stat, .stats .stat, .head__actions > *').forEach((e, i) => e.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 550, delay: 120 + i * 70, easing: P3, fill: 'backwards' }));
  }

  // ── «Clinicians today»: la línea del día ─────────────────────────────────────────────────────────────────────────────────
  function linea() {
    const caja = $('#td-tl'); if (!caja || !D.linea) return;
    const { ahora, almuerzo, filas } = D.linea;
    // En el teléfono (la captura a 390) la línea muestra una ventana de unas 2 h 40 min alrededor de ahora, no el día entero.
    const angosta = caja.clientWidth < 520 && ahora != null;
    const desde = angosta ? Math.max(D.linea.desde, Math.floor(ahora - 1) + 0.75) : D.linea.desde;
    const hasta = angosta ? desde + 2.65 : D.linea.hasta;
    const pos = (h) => `${((h - desde) / (hasta - desde)) * 100}%`;
    const horas = $('.td-tl__hours', caja);
    horas.innerHTML = '';
    for (let h = Math.ceil(desde); h <= Math.floor(hasta); h += angosta ? 2 : 1) { const s = document.createElement('span'); s.style.left = pos(h); s.textContent = D.linea.rotulo ? D.linea.rotulo(h) : `${h > 12 ? h - 12 : h}${h < 12 ? 'a' : 'p'}`; horas.appendChild(s); }
    const cuerpo = $('.td-tl__body', caja);
    cuerpo.innerHTML = '';
    filas.forEach((f) => {
      const tr = document.createElement('div'); tr.className = 'td-tl__track';
      if (almuerzo && almuerzo[1] > desde && almuerzo[0] < hasta) { const l = document.createElement('div'); l.className = 'td-tl__lunch'; l.style.left = pos(almuerzo[0]); l.style.width = `${((almuerzo[1] - almuerzo[0]) / (hasta - desde)) * 100}%`; tr.appendChild(l); }
      f.bloques.filter((b) => b.h + (b.d ?? 0.25) > desde && b.h < hasta).forEach((b) => {
        const e = document.createElement('button'); e.type = 'button';
        e.className = `td-blk td-blk--${b.c}${b.e ? ` is-${b.e}` : ''}`;
        const ini = Math.max(b.h, desde), fin = Math.min(b.h + (b.d ?? 0.25), hasta);
        e.style.left = pos(ini); e.style.width = `calc(${((fin - ini) / (hasta - desde)) * 100}% - 2px)`;
        if (b.t) { const s = document.createElement('span'); s.textContent = b.t; e.appendChild(s); }
        e.setAttribute('aria-label', b.t || f.nombre);
        tr.appendChild(e);
      });
      cuerpo.appendChild(tr);
    });
    if (ahora != null && ahora >= desde && ahora <= hasta) { const n = document.createElement('div'); n.className = 'td-tl__now'; n.style.left = pos(ahora); n.innerHTML = `<b>${D.linea.ahoraTxt}</b>`; cuerpo.appendChild(n); }
  }

  // ── «Visits»: la curva, con su selector ───────────────────────────────────────────────────────────────────────────────────
  const curva = (pts) => pts.map((p, i) => {
    if (!i) return `M${p[0].toFixed(1)},${p[1].toFixed(1)}`;
    const a = pts[i - 2] ?? pts[i - 1], b = pts[i - 1], d = pts[i + 1] ?? p;
    return `C${(b[0] + (p[0] - a[0]) / 6).toFixed(1)},${(b[1] + (p[1] - a[1]) / 6).toFixed(1)} ${(p[0] - (d[0] - b[0]) / 6).toFixed(1)},${(p[1] - (d[1] - b[1]) / 6).toFixed(1)} ${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  }).join('');
  const el = (tag, at, padre) => { const n = document.createElementNS(NS, tag); for (const k in at) n.setAttribute(k, at[k]); padre?.appendChild(n); return n; };
  let rango = '2w';
  function grafico() {
    const caja = $('#td-chart'); if (!caja || !D.visitas) return;
    const serie = rango === '2w' ? D.visitas.dias.slice(-D.visitas.corto) : D.visitas.dias;
    const W = caja.clientWidth, H = caja.clientHeight || 190, x0 = 34, x1 = W - 6, y0 = 8, y1 = H - 26;
    const tope = D.visitas.tope;
    caja.innerHTML = '';
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': D.visitas.aria }, caja);
    const g = el('defs', {}, svg); const gr = el('linearGradient', { id: 'td-area', x1: 0, y1: 0, x2: 0, y2: 1 }, g);
    el('stop', { offset: 0, 'stop-color': 'var(--teal)', 'stop-opacity': '.22' }, gr); el('stop', { offset: 1, 'stop-color': 'var(--teal)', 'stop-opacity': '0' }, gr);
    [0, 0.5, 1].forEach((k) => {
      const y = y1 - (y1 - y0) * k;
      el('line', { class: 'grid-l', x1: x0, x2: x1, y1: y, y2: y }, svg);
      el('text', { x: x0 - 10, y: y + 4, 'text-anchor': 'end' }, svg).textContent = String(Math.round(tope * k));
    });
    const px = (i) => x0 + 4 + ((x1 - x0 - 8) * i) / Math.max(1, serie.length - 1);
    const py = (v) => y1 - ((y1 - y0) * v) / tope;
    const a = curva(serie.map((d, i) => [px(i), py(d.a)]));
    const b = curva(serie.map((d, i) => [px(i), py(d.b)]));
    el('path', { d: `${a}L${px(serie.length - 1)},${y1}L${px(0)},${y1}Z`, fill: 'url(#td-area)' }, svg);
    el('path', { d: a, fill: 'none', stroke: 'var(--teal)', 'stroke-width': 2.2, 'stroke-linecap': 'round' }, svg);
    el('path', { d: b, fill: 'none', stroke: 'var(--coral)', 'stroke-width': 2, 'stroke-linecap': 'round' }, svg);
    const cada = Math.max(1, Math.ceil(serie.length / (W < 420 ? 4 : 12)));
    serie.forEach((d, i) => {
      const ult = i === serie.length - 1;
      // La anterior a la última, si cae pegada, no va (se pisarían: «9 nov» y «10 nov» a 390). Con los datos de la copia no salta nunca.
      if (!ult && (i % cada || serie.length - 1 - i < cada / 2)) return;
      el('text', { x: px(i), y: H - 4, 'text-anchor': i === 0 ? 'start' : ult ? 'end' : 'middle' }, svg).textContent = d.r;
    });
  }
  function selector() {
    const seg = $('.td-seg'); if (!seg) return;
    const pill = $('.td-seg__pill', seg);
    const poner = (animar) => {
      const on = $('[aria-pressed="true"]', seg); if (!on) return;
      if (!animar) pill.style.transition = 'none';
      pill.style.width = `${on.offsetWidth}px`; pill.style.translate = `${on.offsetLeft}px 0`;
      if (!animar) { void pill.offsetWidth; pill.style.transition = ''; }
    };
    $$('button', seg).forEach((b) => b.addEventListener('click', () => {
      $$('button', seg).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      rango = b.dataset.r; poner(true); grafico();
      const big = $('#td-trend-big'); if (big && D.visitas?.resumen) big.innerHTML = D.visitas.resumen(rango);
    }));
    poner(false);
  }

  // ── el tema (la luna) ─────────────────────────────────────────────────────────────────────────────────────────────────────
  function tema() {
    const b = $('[data-tema]'); if (!b) return;
    b.addEventListener('click', () => {
      const r = document.documentElement;
      r.dataset.theme = r.dataset.theme === 'dark' ? 'light' : 'dark';
      grafico(); linea();
    });
    const q = new URLSearchParams(location.search).get('tema');
    if (q === 'oscuro') document.documentElement.dataset.theme = 'dark';
  }

  document.addEventListener('DOMContentLoaded', () => {
    tema(); linea(); grafico(); selector(); entrada();
    let t = 0; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { grafico(); linea(); }, 80); });
  });
})();
