// ═══════════════════════════════════════════════════════════════════════════════════════════
// CHAT ANALYST (PARLEY) — el dibujo y el movimiento de la página «Overview» de Parley. 4/11/2026. Código nuestro.
// Los movimientos salen del INFORME (demos/parley/INFORME.txt):
//   · el armazón: el logo y los renglones de la barra entran de la izquierda (x −10, .5 s, cada .04 s); las herramientas de
//     arriba bajan (y −8, .5 s, cada .06 s, desde .2 s); el saludo entra palabra por palabra (y 70 %, .6 s, cada .06 s) y la
//     bajada después (y 6, .5 s, desde .15 s);
//   · las tarjetas suben (y 28, escala .985 → 1, .8 s, cada .08 s, power3.out);
//   · cada tarjeta arranca lo suyo a los .25 s de su entrada: los números cuentan desde 0 (1,4 s; Audience 1,6 s; Messages sent
//     1,8 s; Active campaigns y los días 1 s), las columnas de Audience suben desde abajo (1,1 s, power4.out, cada .06 s), las
//     casillas se llenan de a una (.35 s, back.out(2.2), cada .018 s), la barra del presupuesto crece (1,2 s);
//   · al pasar sobre una columna del mes, el globo se mueve y rebota (escala .85 → 1, .4 s, back.out(2));
//   · Messages sent sigue vivo: cada 3,5 s suma entre 2 y 10 mensajes.
// ⚠️ Lo que el INFORME NO dice y acá se supone (anotado en el relevo): cómo se dibuja el área de Messages sent (se destapa de
// izquierda a derecha, 1,2 s), cómo crecen las columnas del mes y el anillo (1 s, power3.out), y que al pasar sobre un mes
// los otros se apagan a la mitad.
// ═══════════════════════════════════════════════════════════════════════════════════════════
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, padre) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); padre?.appendChild(n); return n; };
  const P3 = 'cubic-bezier(.215, .61, .355, 1)', P4 = 'cubic-bezier(.165, .84, .44, 1)', BACK = 'cubic-bezier(.3, 1.9, .55, 1)', BACK2 = 'cubic-bezier(.34, 1.7, .64, 1)';
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const anim = (n, kf, o) => (quieto || !n ? null : n.animate(kf, { fill: 'backwards', ...o }));
  const fmt = (v, dec = 0, pre = '') => pre + v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const contar = (n, hasta, { desde = 0, dur = 1400, delay = 0, dec = 0, pre = '' } = {}) => {
    if (quieto) { n.textContent = fmt(hasta, dec, pre); return; }
    n.textContent = fmt(desde, dec, pre);
    const t0 = performance.now() + delay;
    const paso = (t) => {
      const k = Math.min(1, Math.max(0, (t - t0) / dur));
      const e = 1 - Math.pow(1 - k, 3);
      n.textContent = fmt(desde + (hasta - desde) * e, dec, pre);
      if (k < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  };

  // ── los datos del demo ────────────────────────────────────────────────────────────────────
  const AUD = { meses: ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'], v: [212, 268, 242, 345, 298, 386, 351, 318], proyeccion: 408 };
  const MES = {
    2026: { rep: [610, 540, 720, 660, 830, 700, 940, 880, 1010, 1120, null, null], aw: [150, 180, 200, 160, 220, 170, 240, 270, 250, 290, null, null], actual: 9 },
    2025: { rep: [520, 480, 560, 600, 640, 610, 700, 690, 760, 820, 880, 940], aw: [140, 120, 150, 150, 170, 160, 180, 190, 200, 210, 220, 240], actual: 11 },
  };
  const NOMBRES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MEZCLA = {
    'This month': { total: '9.4K', filas: [['SMS', 52, 2.1, '#e4572e'], ['WhatsApp', 31, 4.6, '#1e9a8a'], ['Email', 17, -3.8, '#5b3e8c']] },
    Last: { total: '8.7K', filas: [['SMS', 55, 1.2, '#e4572e'], ['WhatsApp', 28, 3.1, '#1e9a8a'], ['Email', 17, 0.4, '#5b3e8c']] },
  };
  const GENTE = {
    Week: [['AL', 'Amara Lindqvist', 'amara@northfold.co', 486, 32, '#f6d6c8'], ['TM', 'Theo Marchetti', 'theo@marchetti.studio', 352, 23, '#e2d9ef'],
      ['ID', 'Ines Duarte', 'ines.duarte@lumen.io', 297, 20, '#d4ece7'], ['KW', 'Kenji Watanabe', 'kenji@paperplane.jp', 214, 14, '#e2d9ef'],
      ['RA', 'Ruth Abara', 'ruth@abarahomes.com', 168, 11, '#f6d6c8']],
    Month: [['TM', 'Theo Marchetti', 'theo@marchetti.studio', 1904, 29, '#e2d9ef'], ['AL', 'Amara Lindqvist', 'amara@northfold.co', 1771, 27, '#f6d6c8'],
      ['KW', 'Kenji Watanabe', 'kenji@paperplane.jp', 1180, 18, '#e2d9ef'], ['ID', 'Ines Duarte', 'ines.duarte@lumen.io', 1036, 16, '#d4ece7'],
      ['RA', 'Ruth Abara', 'ruth@abarahomes.com', 655, 10, '#f6d6c8']],
  };
  // Messages sent: la altura de cada día en la captura (de 98 px), y el de hoy, que va por la mitad.
  const DIAS = [44, 48, 41, 51, 58, 56, 49, 46, 52, 60, 64, 62, 58, 52, 54, 60, 68, 68, 64, 60, 59, 64, 70, 74, 72, 64, 64, 72, 78, 80, 24].map((h) => h * 78);

  // ── Audience: las columnas ────────────────────────────────────────────────────────────────
  const hbars = $('[data-hbars]');
  const tope = Math.max(...AUD.v, AUD.proyeccion) * 1.1;
  const pico = AUD.v.indexOf(Math.max(...AUD.v));
  const barras = AUD.v.map((v, i) => {
    const col = document.createElement('div');
    col.className = 'hbar' + (i === pico ? ' is-peak' : '');
    col.title = `${AUD.meses[i]}: ${v} new`;
    if (i === AUD.v.length - 1) { const p = document.createElement('i'); p.className = 'hbar__bar hbar__bar--proj'; p.style.height = `calc((100% - 12px) * ${(AUD.proyeccion / tope).toFixed(4)})`; col.append(p); }
    const b = document.createElement('i');
    b.className = 'hbar__bar';
    b.style.height = `${(v / tope) * 100}%`;
    b.innerHTML = `<span class="hbar__val">${v}</span>`;
    col.append(b);
    hbars.append(col);
    return col;
  });
  AUD.meses.forEach((m) => { const s = document.createElement('span'); s.className = 'hbar__m'; s.textContent = m[0]; hbars.append(s); });

  // ── las casillas de Delivery rate y Active campaigns ─────────────────────────────────────────
  const casillas = $$('[data-cells]').map((c) => {
    c.innerHTML = Array.from({ length: 40 }, () => '<i><b></b></i>').join('');
    return { c, n: Math.round(Number(c.dataset.cells) * 40) };
  });
  const llenar = ({ c, n }, delay = 0) => $$('b', c).forEach((b, i) => {
    if (i >= n) return;
    b.classList.add('on');
    anim(b, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 350, delay: delay + i * 18, easing: BACK });
  });

  // ── Messages sent: el área ──────────────────────────────────────────────────────────────────
  const area = $('[data-area]');
  let rango = DIAS;
  const curva = (pts) => {
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i += 1) {
      const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  };
  const dibujarArea = (datos, entrar) => {
    area.innerHTML = '';
    const W = area.clientWidth, H = area.clientHeight;
    const max = Math.max(...datos.slice(0, -1)) * 1.225;
    const pts = datos.map((v, i) => [(i / (datos.length - 1)) * W, H - (v / max) * H]);
    const llenos = pts.slice(0, -1);
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none' }, area);
    const linea = curva(llenos);
    el('path', { d: `${linea} L${llenos.at(-1)[0]},${H} L0,${H} Z`, fill: 'url(#pl-area)' }, svg);
    el('path', { d: linea, fill: 'none', stroke: '#f2835b', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
    const [a, b] = [llenos.at(-1), pts.at(-1)];
    el('path', { d: `M${a[0]},${a[1]} L${b[0]},${b[1]}`, stroke: '#f2835b', 'stroke-width': 2, 'stroke-dasharray': '3 4', 'stroke-linecap': 'round' }, svg);
    el('circle', { cx: b[0], cy: b[1], r: 4, fill: '#f2835b', stroke: '#2a212e', 'stroke-width': 2 }, svg);
    if (entrar) anim(svg, [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 1200, delay: entrar === true ? 0 : entrar, easing: P3 });
  };

  // ── Messages by month ───────────────────────────────────────────────────────────────────────
  const mchart = $('[data-mchart]');
  const MAXY = 2000;
  mchart.innerHTML = `<div class="mchart__plot">${[2000, 1500, 1000, 500, 0].map((v) => `<div class="mchart__grid" style="top:${(1 - v / MAXY) * 100}%"><span>${v >= 1000 ? `${v / 1000}K` : v}</span></div>`).join('')}<div class="mchart__cols"></div></div><div class="mtip" hidden></div>`;
  const cols = $('.mchart__cols', mchart), tip = $('.mtip', mchart);
  let anio = '2026', marcado = -1;
  const pintarMes = (entrar) => {
    const d = MES[anio];
    cols.innerHTML = NOMBRES.map((m, i) => {
      const r = d.rep[i], a = d.aw[i];
      const pila = r == null ? '' : `<div class="mcol__stack${a ? '' : ' solo'}" style="height:${((r + a) / MAXY) * 100}%"><i class="mcol__aw" style="height:${(a / (r + a)) * 100}%"></i><i class="mcol__rep" style="flex:1"></i></div>`;
      return `<div class="mcol" data-i="${i}">${pila}<span class="mcol__x"><span class="l">${m}</span><span class="c">${m[0]}</span></span></div>`;
    }).join('');
    if (entrar) $$('.mcol__stack', cols).forEach((s, i) => anim(s, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 1000, delay: (entrar === true ? 0 : entrar) + i * 40, easing: P3 }));
    marcar(d.actual, false);
    if (entrar) anim(tip, [{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: (entrar === true ? 0 : entrar) + 700, easing: P3 });
  };
  const marcar = (i, rebote) => {
    const d = MES[anio];
    if (d.rep[i] == null) return;
    marcado = i;
    $$('.mcol', cols).forEach((c, k) => c.classList.toggle('is-on', k === i));
    const r = d.rep[i], a = d.aw[i];
    tip.innerHTML = `<b>${NOMBRES[i]} ${anio} · ${fmt(r + a)}</b><div><span><i class="sw"></i>Replied</span><span>${fmt(r)}</span></div><div><span><i class="sw sw--hatch"></i>Awaiting</span><span>${fmt(a)}</span></div>`;
    tip.hidden = false;
    const plot = $('.mchart__plot', mchart);
    const col = $$('.mcol', cols)[i];
    const pila = $('.mcol__stack', col);
    const cx = plot.offsetLeft + col.offsetLeft + col.offsetWidth / 2;
    const arriba = plot.offsetTop + plot.offsetHeight * (1 - (r + a) / MAXY);
    const media = tip.offsetWidth / 2;
    tip.style.left = `${Math.min(Math.max(cx, media), mchart.clientWidth - media - 1)}px`;
    tip.style.top = `${Math.max(0, arriba - tip.offsetHeight - 12)}px`;
    if (rebote) anim(tip, [{ transform: 'translateX(-50%) scale(.85)' }, { transform: 'translateX(-50%) scale(1)' }], { duration: 400, easing: BACK2 });
    void pila;
  };
  cols.addEventListener('pointerover', (e) => { const c = e.target.closest('.mcol'); if (!c) return; const i = Number(c.dataset.i); if (MES[anio].rep[i] == null) return; mchart.classList.add('is-hovering'); if (i !== marcado) marcar(i, true); });
  cols.addEventListener('pointerleave', () => { mchart.classList.remove('is-hovering'); if (marcado !== MES[anio].actual) marcar(MES[anio].actual, true); });

  // ── Channel mix: el anillo ──────────────────────────────────────────────────────────────────
  const donut = $('[data-donut]'), mix = $('[data-mix]');
  const R = 56, C = 2 * Math.PI * R, HUECO = 12, TRAZO = 16;
  const svgD = el('svg', { viewBox: '0 0 128 128' });
  donut.prepend(svgD);
  el('circle', { cx: 64, cy: 64, r: R, fill: 'none', stroke: '#f7f2eb', 'stroke-width': TRAZO }, svgD);
  let mezcla = 'This month';
  const pintarMezcla = (entrar) => {
    const m = MEZCLA[mezcla];
    $$('.seg-arco', svgD).forEach((n) => n.remove());
    let ini = HUECO / 2;
    m.filas.forEach(([, pct, , color], i) => {
      const largo = (pct / 100) * C;
      const vis = Math.max(0.1, largo - HUECO - TRAZO);
      const arco = el('circle', { class: 'seg-arco', cx: 64, cy: 64, r: R, fill: 'none', stroke: color, 'stroke-width': TRAZO, 'stroke-linecap': 'round', 'stroke-dasharray': `${vis} ${C}`, 'stroke-dashoffset': -(ini + TRAZO / 2) }, svgD);
      if (entrar) anim(arco, [{ strokeDasharray: `0.1 ${C}` }, { strokeDasharray: `${vis} ${C}` }], { duration: 1000, delay: (entrar === true ? 0 : entrar) + i * 120, easing: P3 });
      ini += largo;
    });
    $('b', donut).textContent = m.total;
    mix.innerHTML = m.filas.map(([nombre, pct, delta, color]) => `<li><i class="mix__dot" style="background:${color}"></i><span class="mix__name">${nombre}</span><span class="mix__pct num">${pct}%</span><span class="chip${delta < 0 ? ' chip--bad' : ''}"><svg><use href="#i-${delta < 0 ? 'down' : 'up'}"/></svg>${Math.abs(delta).toFixed(1)}%</span></li>`).join('');
  };

  // ── Top contacts ────────────────────────────────────────────────────────────────────────────
  const people = $('[data-people]');
  let gente = 'Week';
  const pintarGente = (entrar) => {
    const filas = GENTE[gente];
    const max = filas[0][3];
    people.innerHTML = filas.map(([ini, nombre, email, n, pct, fondo]) => `<li class="person" data-key="${ini}"><span class="person__av" style="background:${fondo}">${ini}</span><div class="person__mid"><div class="person__name"><a href="#">${nombre}</a><small>${email}</small></div><div class="person__bar"><i style="width:${(n / max) * 100}%"></i></div></div><div class="person__n"><b class="num">${fmt(n)}</b><small>${pct}%</small></div></li>`).join('');
    if (entrar) $$('.person', people).forEach((p, i) => {
      const d = (entrar === true ? 0 : entrar) + i * 60;
      anim(p, [{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: d, easing: P3 });
      anim($('.person__bar i', p), [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 900, delay: d + 150, easing: P3 });
    });
  };

  // ── las pestañas de cada tarjeta ───────────────────────────────────────────────────────────
  $$('[data-seg]').forEach((seg) => seg.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.classList.contains('is-on')) return;
    $$('button', seg).forEach((x) => x.classList.toggle('is-on', x === b));
    const v = b.textContent.trim();
    if (seg.dataset.seg === 'anio') { anio = v; pintarMes(true); }
    if (seg.dataset.seg === 'mezcla') { mezcla = v; pintarMezcla(true); }
    if (seg.dataset.seg === 'gente') { gente = v; pintarGente(true); }
    if (seg.dataset.seg === 'rango') { rango = v === '7d' ? DIAS.slice(-8) : DIAS; dibujarArea(rango, true); }
  }));

  // ── Credits: recargar ──────────────────────────────────────────────────────────────────────
  const menu = $('.topup__menu'), toast = $('.toast');
  let tToast;
  const avisar = (txt) => { toast.textContent = txt; toast.classList.add('is-on'); clearTimeout(tToast); tToast = setTimeout(() => toast.classList.remove('is-on'), 2600); };
  $('.topup__btn').addEventListener('click', (e) => { e.stopPropagation(); menu.classList.toggle('is-open'); if (menu.classList.contains('is-open')) anim(menu, [{ opacity: 0, transform: 'translateY(-6px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 250, easing: P3 }); });
  document.addEventListener('click', () => menu.classList.remove('is-open'));
  let creditos = 1830;
  menu.addEventListener('click', (e) => {
    const b = e.target.closest('[data-add]'); if (!b) return;
    const n = $('[data-n="1830"]', $('#credits')) ?? $('#credits .fig__n');
    const antes = creditos; creditos += Number(b.dataset.add);
    contar(n, creditos, { desde: antes, dur: 900, pre: '$' });
    menu.classList.remove('is-open');
    avisar(`Added $${b.dataset.add} in credits.`);
  });

  // ── la barra: el globo con el nombre al pasar ───────────────────────────────────────────────
  const rtip = $('.rail__tip');
  $$('.rail [data-tip]').forEach((n) => {
    n.addEventListener('pointerenter', () => {
      if (matchMedia('(max-width: 860px)').matches) return;
      rtip.textContent = n.dataset.tip;
      const r = n.getBoundingClientRect();
      rtip.style.top = `${r.top + r.height / 2 - rtip.offsetHeight / 2}px`;
      anim(rtip, [{ opacity: 0, transform: 'translateX(-4px)' }, { opacity: 1, transform: 'none' }], { duration: 180, easing: P3, fill: 'forwards' }) ?? (rtip.style.opacity = 1);
    });
    n.addEventListener('pointerleave', () => { rtip.getAnimations().forEach((a) => a.cancel()); rtip.style.opacity = 0; });
  });

  // ── la entrada ──────────────────────────────────────────────────────────────────────────────
  $$('.rail__logo, .rail__item, .rail__toggle').forEach((n, i) => anim(n, [{ transform: 'translateX(-10px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 500, delay: i * 40, easing: P3 }));
  $$('.top__tools > *').forEach((n, i) => anim(n, [{ transform: 'translateY(-8px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 500, delay: 200 + i * 60, easing: P3 }));
  const h1 = $('.top__title');
  h1.innerHTML = h1.textContent.split(' ').map((w) => `<span class="w">${w}</span>`).join(' ');
  $$('.w', h1).forEach((w, i) => anim(w, [{ transform: 'translateY(70%)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 600, delay: i * 60, easing: P3 }));
  anim($('.top__sub'), [{ transform: 'translateY(6px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 500, delay: 150, easing: P3 });

  const tarjetas = $$('.card');
  tarjetas.forEach((c, i) => anim(c, [{ transform: 'translateY(28px) scale(.985)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 800, delay: i * 80, easing: P3 }));
  const arranque = (id) => tarjetas.findIndex((c) => c.id === id) * 80 + 250;

  $$('[data-n]').forEach((n) => {
    const card = n.closest('.card');
    const dur = Number(n.dataset.dur) || (card.id === 'audience' && n.classList.contains('fig__n') ? 1600 : 1400);
    contar(n, Number(n.dataset.n), { dur, delay: arranque(card.id), dec: Number(n.dataset.dec) || 0, pre: n.dataset.pre ?? '' });
  });
  barras.forEach((b, i) => $$('.hbar__bar', b).forEach((x) => anim(x, [{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: 1100, delay: arranque('audience') + i * 60, easing: P4 })));
  llenar(casillas[0], arranque('delivery'));
  llenar(casillas[1], arranque('campaigns'));
  anim($('.budget__bar i'), [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 1200, delay: arranque('credits'), easing: P3 });
  dibujarArea(rango, arranque('sent'));
  pintarMes(arranque('month'));
  pintarMezcla(arranque('mix'));
  pintarGente(arranque('top-contacts'));
  const rehacer = () => { dibujarArea(rango, false); marcar(marcado, false); };
  addEventListener('resize', rehacer);
  document.fonts?.ready.then(() => requestAnimationFrame(() => marcar(marcado, false)));
  new ResizeObserver(() => marcar(marcado, false)).observe(mchart);

  // ── vivo: llegan mensajes ────────────────────────────────────────────────────────────────────
  const sent = $('[data-sent]'), hoy = $('[data-today]');
  let total = 128409, hoyN = 1908;
  setInterval(() => {
    if (document.hidden) return;
    const mas = 2 + Math.floor(Math.random() * 9);
    contar(sent, total + mas, { desde: total, dur: 900 }); contar(hoy, hoyN + mas, { desde: hoyN, dur: 900 });
    total += mas; hoyN += mas;
  }, 3500);
})();
