// La copia de Pelago: los gráficos con las cifras LEÍDAS de la captura (demos/pelago/captura/pagina-1440.png, medidas píxel a píxel) y
// el movimiento. Código nuestro. Lo que está medido sale del INFORME: la barra de la izquierda entra desde x −40 (.9 s, power3.out) y sus
// renglones desde x −12 cada .035 s desde .15 s; la barra de arriba baja desde y −12 cada .05 s desde .05 s; la pastilla del selector
// corre .35 s con la curva de la página (.2, .8, .2, 1); el rayo de la hora de ahora late (dial-pulse); las columnas del gráfico se
// rellenan al pasar (los estados 17). ⚠️ SUPUESTO (el INFORME corta la receta de la página «Overview»): la cabecera sube desde 12 px
// (.65 s); las tarjetas suben desde 16 px (.7 s, desde .25 s, cada .06 s); las barras crecen desde abajo (.9 s, cada .02 s); los rayos
// crecen desde el centro (.8 s, cada .025 s); las columnas suben (.9 s, cada .04 s); las barras finas crecen desde la izquierda (.9 s);
// los números cuentan (.9 s).
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const NS = 'http://www.w3.org/2000/svg';
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const P3 = 'cubic-bezier(.215, .61, .355, 1)', P3IO = 'cubic-bezier(.645, .045, .355, 1)', EASE = 'cubic-bezier(.2, .8, .2, 1)';
  const anim = (n, kf, o) => { if (!quieto && n && n.animate) n.animate(kf, { fill: 'backwards', easing: P3, ...o }); };
  const tel = () => innerWidth <= 760;

  // ── Revenue: 30 días (la altura de cada barra, leída de la captura: 120 px de alto, la última es hoy) ─────────────────
  const REV = [55, 104, 89, 103, 86, 31, 37, 55, 67, 76, 35, 61, 48, 33, 21, 65, 34, 28, 116, 53, 49, 119, 57, 52, 74, 95, 40, 38, 29, 74];
  $('#rev-bars').innerHTML = REV.map((h, i) => `<i style="height:${(h / 120) * 100}%"${i === REV.length - 1 ? ' class="is-hi"' : ''}></i>`).join('');

  // ── Today, by the hour: los pedidos de cada hora hasta las 11 (la de ahora); lo que viene, un punto ────────────────
  const HORAS = [0, 0, 0, 0, 0, 0, 1, 1, 2, 4, 3, 3], AHORA = 11;
  function dial() {
    const el = $('#dial'), W = el.clientWidth, H = el.clientHeight, cx = W / 2, cy = 130;
    const r0 = 64, k = 6.6, rMin = 11, rLab = 117;
    const p = (a, r) => [cx + r * Math.sin((a * Math.PI) / 180), cy - r * Math.cos((a * Math.PI) / 180)];
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Orders by the hour"><circle class="dial__ring" cx="${cx}" cy="${cy}" r="58"/>`;
    for (let h = 0; h < 24; h++) {
      const a = h * 15;
      if (h > AHORA) { const [x, y] = p(a, 67); s += `<circle class="dial__dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2"/>`; continue; }
      const L = rMin + k * HORAS[h], [x1, y1] = p(a, r0), [x2, y2] = p(a, r0 + L);
      s += `<line class="dial__sp${h === AHORA ? ' is-now' : ''}" data-h="${h}" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
    }
    [['12a', 0], ['6a', 90], ['12p', 180], ['6p', 270]].forEach(([t, a]) => { const [x, y] = p(a, rLab); s += `<text class="dial__lab" x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle">${t}</text>`; });
    s += `</svg><div class="dial__mid" style="top:${cy - H / 2}px;bottom:${H / 2 - cy}px"><b data-cuenta>14</b><span>orders · $2,219</span></div>`;
    el.innerHTML = s;
    $$('.dial__sp', el).forEach((sp) => {
      sp.addEventListener('pointerenter', () => { const h = +sp.dataset.h; $('.dial__mid b', el).textContent = HORAS[h]; $('.dial__mid span', el).textContent = `orders · ${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`; });
      sp.addEventListener('pointerleave', () => { $('.dial__mid b', el).textContent = '14'; $('.dial__mid span', el).textContent = 'orders · $2,219'; });
    });
  }

  // ── Demand by category: cada mes, lo de cada canal ($k, leído de la captura) y el año pasado ─────────────────────────
  const MESES = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
  const DEM = [ // [mayoreo (abajo), estudio, en línea (arriba), el año pasado]
    [35.6, 4.3, 32.7, 63.3], [53.6, 7.2, 38.1, 83.5], [20.5, 2.5, 17.6, 34.9], [21.2, 2.5, 18.0, 38.1], [26.6, 3.2, 22.3, 47.5], [32.7, 3.6, 23.4, 52.2],
    [33.8, 4.3, 25.5, 60.4], [28.8, 3.6, 21.2, 48.6], [23.4, 2.5, 18.3, 39.6], [24.8, 2.5, 20.5, 45.0], [29.9, 3.6, 22.7, 50.4], [12.07, 2.5, 18.0, 55.8],
  ];
  const RITMO_OCT = 18.7; // lo que falta para el ritmo del mes (la caja punteada de octubre)
  const TONOS = ['clay', 'ochre', 'petrol'];
  const COLOR = { clay: '#b85a36', ochre: '#c88e1c', petrol: '#136469' };
  let elegido = 11;
  function chart() {
    // En la computadora el gráfico entra entero (41 px por mes); en el teléfono cada mes ocupa 44 px, el gráfico se corre de costado y
    // arranca mostrando el final (como la captura de 390), con los rótulos del eje quietos encima.
    const el = $('#chart'), t = tel(), H = el.clientHeight;
    const paso = t ? 44 : (el.clientWidth - 52) / 12, W = t ? 52 + 12 * paso : el.clientWidth;
    const yT = t ? 45 : 34, yB = t ? 271 : H - 25, k = (yB - yT) / 150, x0 = 52 + paso / 2;
    let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Demand by month"><defs>`;
    TONOS.forEach((tn) => { s += `<pattern id="pd-${tn}" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="${COLOR[tn]}" fill-opacity=".16"/><circle cx="3" cy="3" r=".95" fill="${COLOR[tn]}" fill-opacity=".62"/></pattern>`; });
    s += '</defs>';
    let eje = `<svg class="chart__axis" viewBox="0 0 52 ${H}" aria-hidden="true">`;
    [150, 75, 0].forEach((v) => {
      const y = yB - v * k, txt = `<text class="chart__ax" x="44" y="${y + 4}" text-anchor="end">$${v ? v + 'k' : 0}</text>`;
      s += `<line class="chart__grid" x1="52" x2="${W}" y1="${y}" y2="${y}"/>${t ? '' : txt}`; eje += txt;
    });
    eje += '</svg>';
    DEM.forEach((m, i) => {
      const cx = x0 + i * paso;
      let g = `<g class="chart__col${i === elegido ? ' is-hi' : ''}" data-i="${i}"><rect x="${cx - paso / 2}" y="${yT}" width="${paso}" height="${yB - yT}" fill="transparent"/>`;
      const ly = m[3] * k;
      g += `<rect class="chart__ly" x="${cx - 17}" y="${yB - ly - 2}" width="34" height="${ly + 4}" rx="12"/>`;
      let y = yB;
      m.slice(0, 3).forEach((v, j) => {
        const h = v * k; if (h <= 0) return;
        const r = Math.min(10, h / 2);
        g += `<g class="chart__bar" style="transform-origin:${cx}px ${yB}px"><rect class="seg-dot" x="${cx - 12.5}" y="${y - h}" width="25" height="${h}" rx="${r}" fill="url(#pd-${TONOS[j]})"/><rect class="seg-solid" x="${cx - 12.5}" y="${y - h}" width="25" height="${h}" rx="${r}" fill="${COLOR[TONOS[j]]}"/></g>`;
        y -= h + 3;
      });
      if (i === 11) { const h = RITMO_OCT * k; g += `<rect class="chart__pace" x="${cx - 12.5}" y="${y - h}" width="25" height="${h}" rx="10"/>`; }
      g += `<text class="chart__x${i === elegido ? ' is-hi' : ''}" x="${cx}" y="${yB + 22}" text-anchor="middle">${MESES[i]}</text></g>`;
      s += g;
    });
    s += '</svg>';
    el.innerHTML = t ? `<div class="chart__sc">${s}<span class="chart__tip" id="tip"></span></div>${eje}` : `${s}<span class="chart__tip" id="tip"></span>`;
    if (t) { const sc = $('.chart__sc', el); sc.scrollLeft = sc.scrollWidth; }
    const tip = () => {
      const m = DEM[elegido], cx = x0 + elegido * paso, total = elegido === 11 ? 33.973 : m[0] + m[1] + m[2]; // octubre: lo del panel ($33,973)
      const top = Math.min(yB - (m[0] + m[1] + m[2] + (elegido === 11 ? RITMO_OCT : 0)) * k - 6 - 3 * 3, yB - m[3] * k - 2);
      $('#tip').textContent = `$${Math.round(total)}k`;
      $('#tip').style.left = `${cx}px`; $('#tip').style.top = `${top - 8}px`;
    };
    tip();
    $$('.chart__col', el).forEach((c) => c.addEventListener('click', () => {
      elegido = +c.dataset.i;
      $$('.chart__col', el).forEach((o) => { o.classList.toggle('is-hi', o === c); $('.chart__x', o).classList.toggle('is-hi', o === c); });
      tip();
    }));
  }

  // ── El riel de categorías, con su línea de 12 meses ───────────────────────────────────────────────────────────────
  const CATS = [
    ['All categories', '$689k · 12 mo', 'layers', 'petrol', '#efede8', [6, 14, 13, 9, 11, 10, 12, 10, 9, 11, 12, 15]],
    ['Mugs & cups', '$296k · 43%', 'mug', 'sky', '#d9e9ea', [8, 2, 14, 13, 13, 12, 12, 14, 12, 13, 12, 17]],
    ['Plates & bowls', '$122k · 18%', 'plate', 'ochre', '#f7ebd3', [10, 2, 17, 15, 16, 14, 15, 13, 14, 15, 13, 16]],
    ['Vases', '$79k · 12%', 'vase', 'sand', '#efe6dc', [11, 4, 13, 13, 12, 11, 12, 12, 11, 12, 10, 17]],
    ['Planters', '$108k · 16%', 'plant', 'moss', '#e6eedd', [10, 5, 15, 13, 6, 3, 6, 12, 11, 12, 10, 18]],
    ['Teaware', '$37k · 5%', 'pot', 'clay', '#f4e3dc', [12, 3, 19, 18, 19, 17, 18, 18, 17, 16, 16, 13]],
    ['Table linen', '$47k · 7%', 'linen', 'rose', '#f6e0e4', [11, 3, 16, 14, 15, 13, 11, 14, 13, 14, 12, 17]],
  ];
  const CSP = { petrol: '#136469', sky: '#5a9aa8', ochre: '#d9b24f', sand: '#bfa180', moss: '#7fae55', clay: '#d47e5c', rose: '#d97a8c' };
  function rail() {
    const el = $('#rail');
    el.insertAdjacentHTML('beforeend', CATS.map(([n, s, ic, tono, fondo, pts], i) => {
      const d = pts.map((v, j) => `${j ? 'L' : 'M'}${(j * (56 / 11)).toFixed(1)},${(v).toFixed(1)}`).join(' ');
      return `<button class="rail__item" role="tab" aria-selected="${i === 0}"><span class="rail__ic" style="background:${fondo};color:${CSP[tono]}"><svg class="i"><use href="#i-${ic}"/></svg></span><span><b>${n}</b><small>${s}</small></span><svg class="rail__sp" viewBox="0 0 56 22" aria-hidden="true"><path d="${d}" fill="none" stroke="${CSP[tono]}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg></button>`;
    }).join(''));
    const pill = $('.rail__pill', el);
    $$('.rail__item', el).forEach((b) => b.addEventListener('click', () => {
      $$('.rail__item', el).forEach((o) => o.setAttribute('aria-selected', String(o === b)));
      pill.style.transform = `translateY(${b.offsetTop}px)`;
    }));
  }

  // ── Latest orders, Best sellers y Activity ────────────────────────────────────────────────────────────────────────
  const ORD = [['HD', 'rose', 'PG-10791', '9 min ago', 'Hana Doyle', '$184'], ['IR', 'ochre', 'PG-10790', '24 min ago', 'Ines Romero', '$45'], ['IH', 'sea', 'PG-10789', '39 min ago', 'Ivy Haddad', '$67'],
    ['GF', 'ochre', 'PG-10788', '1 h ago', 'Greta Ferreira', '$142'], ['FB', 'sea', 'PG-10787', '1 h ago', 'Felix Byrne', '$87'], ['LQ', 'ochre', 'PG-10786', '2 h ago', 'Leo Quinn', '$73']];
  $('#orders').innerHTML = ORD.map(([ini, t, n, ago, who, tot]) => `<tr><td><span class="ord"><span class="av t-${t}">${ini}</span><span><code>${n}</code><small>${ago}</small></span></span></td><td>${who}</td><td><span class="chan"><svg class="i"><use href="#i-globe"/></svg>Online shop</span></td><td><span class="paid"><i></i>Paid</span></td><td class="td-total">${tot}</td></tr>`).join('');
  const BEST = [['Morning mug', '$3,355', '144 pieces · Oat', 'oat', 100], ['Harbour mug', '$2,984', '117 pieces · Tide', 'tide', 88.9], ['Pebble espresso set', '$2,914', '94 pieces · Tide', 'tide', 86.9],
    ['Long Table dinner plate', '$2,709', '92 pieces · Oat', 'oat', 80.7], ['Ember pasta bowl', '$1,733', '57 pieces · Tenmoku', 'tenmoku', 51.7], ['Nesting bowl trio', '$1,568', '38 pieces · Celadon', 'celadon', 46.7]];
  $('#best').innerHTML = BEST.map(([n, v, s, gl, w], i) => `<button class="best__row"><span class="best__n">${i + 1}</span><span class="kiln__th gl-${gl}"></span><span class="best__m"><b>${n}</b><em>${v}</em><span class="meter"><span style="width:${w}%"></span></span><small>${s}</small></span></button>`).join('');
  const FEED = [['Hana Doyle ordered $184.00 (online shop)', '9 min ago'], ['Ines Romero ordered $45.00 (online shop)', '24 min ago'], ['Ivy Haddad ordered $66.60 (online shop)', '39 min ago'],
    ['Greta Ferreira ordered $142.00 (online shop)', '1 h ago'], ['Felix Byrne ordered $87.00 (online shop)', '1 h ago'], ['Leo Quinn ordered $73.00 (online shop)', '2 h ago']];
  $('#feed').innerHTML = FEED.map(([t, ago]) => `<li><span class="feed__ic"><svg class="i"><use href="#i-box"/></svg></span><div><a href="#">${t}</a><small>Online shop · ${ago}</small></div></li>`).join('');

  // ── El selector de días ───────────────────────────────────────────────────────────────────────────────────────────
  function seg(primera) {
    const c = $('#seg'), p = $('.seg__pill', c), on = $('[aria-pressed="true"]', c);
    p.style.width = `${on.offsetWidth}px`;
    if (primera) p.style.transition = 'none';
    p.style.transform = `translateX(${on.offsetLeft}px)`;
    if (primera) requestAnimationFrame(() => { p.style.transition = ''; });
  }
  $$('#seg .seg__btn').forEach((b) => b.addEventListener('click', () => { $$('#seg .seg__btn').forEach((o) => o.setAttribute('aria-pressed', String(o === b))); seg(false); }));

  function contar(n, demora) {
    const fin = n.textContent, m = fin.match(/^(\D*?)(\d[\d,]*)(\.\d+)?(.*)$/);
    if (!m || quieto) return;
    const [, pre, cifra, dec = '', suf] = m, v = Number(cifra.replace(/,/g, '') + dec), d = Math.max(0, dec.length - 1);
    const fmt = (x) => `${pre}${x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}${suf}`;
    const t0 = performance.now() + demora; n.textContent = fmt(0);
    const paso = (t) => { const k = Math.min(1, Math.max(0, (t - t0) / 900)); n.textContent = k < 1 ? fmt(v * (1 - Math.pow(1 - k, 3))) : fin; if (k < 1) requestAnimationFrame(paso); };
    requestAnimationFrame(paso);
  }

  function dibujar() { dial(); chart(); }
  rail(); dibujar(); seg(true);
  addEventListener('resize', () => { dibujar(); seg(true); });

  // ── La entrada ────────────────────────────────────────────────────────────────────────────────────────────────────
  if (!quieto && !location.search.includes('quieta')) {
    anim($('.side'), [{ opacity: 0, transform: 'translateX(-40px)' }, { opacity: 1, transform: 'none' }], { duration: 900 });
    $$('.brand, .nav__label, .nav__item, .goal, .me', $('.side')).forEach((n, i) => anim(n, [{ opacity: 0, transform: 'translateX(-12px)' }, { opacity: 1, transform: 'none' }], { duration: 550, delay: 150 + i * 35 }));
    $$('.top > *, .mtop > *').forEach((n, i) => anim(n, [{ opacity: 0, transform: 'translateY(-12px)' }, { opacity: 1, transform: 'none' }], { duration: 550, delay: 50 + i * 50 }));
    $$('.head > div > *, .head__actions > *').forEach((n, i) => anim(n, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 650, delay: 120 + i * 50 }));
    $$('.card').forEach((c, i) => anim(c, [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay: 250 + i * 60 }));
    const base = 450;
    $$('.rev__bars i').forEach((b, i) => anim(b, [{ transform: 'scaleY(0)' }, { transform: 'none' }], { duration: 900, delay: base + i * 20 }));
    $$('.dial__sp').forEach((l, i) => { const L = Math.hypot(l.x2.baseVal.value - l.x1.baseVal.value, l.y2.baseVal.value - l.y1.baseVal.value); l.style.strokeDasharray = `${L} ${L + 20}`; anim(l, [{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 800, delay: base + 100 + i * 25 }); });
    $$('.chart__bar').forEach((b, i) => anim(b, [{ transform: 'scaleY(0)' }, { transform: 'none' }], { duration: 900, delay: base + 150 + Math.floor(i / 3) * 40 }));
    $$('.rev__mix span, .mg__bar span, .meter span').forEach((b, i) => anim(b, [{ transform: 'scaleX(0)' }, { transform: 'none' }], { duration: 900, delay: base + 200 + (i % 8) * 50 }));
    $$('.rail__sp path').forEach((p, i) => { const L = p.getTotalLength(); p.style.strokeDasharray = `${L}`; anim(p, [{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 1100, delay: base + 250 + i * 40, easing: P3IO }); });
    $$('[data-cuenta]').forEach((n) => contar(n, base));
  }
  // El rayo de la hora de ahora late (dial-pulse, medido): un aro que se abre desde su punta.
  const ahora = $('.dial__sp.is-now');
  if (ahora && !quieto) {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('class', 'dial__pulse'); c.setAttribute('cx', ahora.getAttribute('x2')); c.setAttribute('cy', ahora.getAttribute('y2')); c.setAttribute('r', '7');
    ahora.parentNode.appendChild(c);
  }
})();
