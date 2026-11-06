// La copia de la página «Floor» de Torque (código nuestro). Los datos son los del demo, leídos de la captura; el movimiento, las
// recetas del INFORME (demos/torque/INFORME.txt): las tarjetas suben 34 px con escala .985 (.9 s, power3.out, cada .07 s), el título
// entra palabra por palabra desde abajo con un giro de 6° (.85 s, power4.out, cada .022 s), lo chico sube 12 px (.55 s, cada .045 s),
// lo que «salta» entra con back.out(3) desde escala .6, y lo que tiene data-lift sube 4 px al pasar (.45 s, power3.out).
(() => {
  const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const NS = 'http://www.w3.org/2000/svg';
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches || location.search.includes('quieta');
  const P3 = 'cubic-bezier(.215, .61, .355, 1)', P4 = 'cubic-bezier(.165, .84, .44, 1)', P3IO = 'cubic-bezier(.645, .045, .355, 1)';
  const BACK3 = 'cubic-bezier(.34, 1.85, .64, 1)';
  const anim = (n, kf, o) => n && n.animate(kf, { fill: 'backwards', easing: P3, ...o });
  const ic = (id, st = '') => `<svg class="i"${st ? ` style="${st}"` : ''}><use href="#i-${id}"/></svg>`;

  // ── The floor: un dibujo propio del elevador y del auto (los del demo son de la tienda) ─────────────────────────────
  const AUTO = {
    suv: 'M22 52c0-5 3-8 8-9l9-9c2-2 4-3 7-3h41c3 0 5 1 7 3l8 9h12c5 0 9 3 10 7l1 6v3H22z',
    sedan: 'M18 54c0-4 3-6 7-7l14-10c3-2 6-3 9-3h28c4 0 7 1 10 3l12 9 17 2c4 1 7 3 7 7v3H18z',
    pickup: 'M18 54v-8c0-2 2-4 4-4h48V35c0-2 2-4 4-4h20c3 0 5 1 7 3l8 8h18c3 0 5 2 5 5v8l-1 3H18z',
    wagon: 'M20 53c0-5 3-8 8-9l11-10c2-2 4-3 7-3h52c3 0 5 1 6 3l6 9h11c5 0 8 3 9 7v3l-1 3H20z',
  };
  const VENT = { suv: 'M44 36h18v8H38zM66 36h18v8H66zM88 36h6l6 8H88z', sedan: 'M46 38h14v8H39zM64 38h16v8H64zM84 38h4l8 7-12 1z', pickup: 'M76 35h10v8H76zM90 35h3l6 8h-9z', wagon: 'M46 35h20v9H40zM70 35h22v9H70zM96 35h3l5 9h-8z' };
  function escena(tipo, color) {
    return `<svg viewBox="0 0 149 92" preserveAspectRatio="none" aria-hidden="true">
      <rect x="10" y="6" width="6" height="80" rx="3" fill="#cfcdc6"/><rect x="133" y="6" width="6" height="80" rx="3" fill="#cfcdc6"/>
      <rect x="16" y="66" width="117" height="4" fill="#8a3a1c"/>
      <path d="${AUTO[tipo]}" transform="translate(0 3)" fill="${color}"/>
      <path d="${VENT[tipo]}" transform="translate(0 3)" fill="#1d2430" opacity=".72"/>
      <circle cx="38" cy="61" r="6" fill="#1b1d22"/><circle cx="38" cy="61" r="2.4" fill="#c9c9c9"/>
      <circle cx="110" cy="61" r="6" fill="#1b1d22"/><circle cx="110" cy="61" r="2.4" fill="#c9c9c9"/>
    </svg>`;
  }
  const BAYS = [
    { n: 1, st: 'In repair', cls: 'repair', car: 'Toyota RAV4', tipo: 'wagon', color: '#6b6e75', plate: '1RJM013', av: 'IN', tav: 'in', tech: 'Ivan', t: '1:35:04', pct: 69 },
    { n: 2, st: 'Approval', cls: 'approval', car: 'Honda Accord', tipo: 'sedan', color: '#141518', plate: '4VRX153', av: 'CR', tav: 'cr', tech: 'Carlos', espera: 'Marcus · 22 min' },
    { n: 3, st: 'In repair', cls: 'repair', car: 'Lexus RX 450h', tipo: 'wagon', color: '#b9bbbf', plate: '3AMU524', av: 'TA', tav: 'ta', tech: 'Tola', t: '1:25:04', pct: 57 },
    { n: 4, st: 'In repair', cls: 'repair', car: 'Ford F-150', tipo: 'pickup', color: '#f3f0ea', plate: '1ZUY256', av: 'LB', tav: 'lb', tech: 'Liam', t: '1:10:04', pct: 58 },
    { n: 5, st: 'Diagnosis', cls: 'diagnosis', car: 'Volkswagen Golf GTI', tipo: 'sedan', color: '#c8252c', plate: '4LZW032', av: 'JK', tav: 'jk', tech: 'Jae', t: '0:40:04', pct: 67, soft: true },
  ];
  const anillo = (p) => {
    const r = 14, L = 2 * Math.PI * r;
    return `<span class="ring"><svg viewBox="0 0 34 34"><circle cx="17" cy="17" r="${r}" fill="none" stroke="#1c1a160f" stroke-width="3.5"/><circle class="ring__v" cx="17" cy="17" r="${r}" fill="none" stroke="var(--sky)" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="${(L * p) / 100} ${L}"/></svg><span>${p}%</span></span>`;
  };
  $('#bays').innerHTML = BAYS.map((b) => `<article class="bay bay--${b.cls}" data-lift>
      <div class="bay__h"><span class="bay__n">Bay ${b.n}</span><span class="pill"><i></i>${b.st}</span></div>
      <div class="bay__stage">${escena(b.tipo, b.color)}</div>
      <button class="bay__car">${b.car}</button>
      <div class="bay__who"><span class="plate">${b.plate}</span><span class="av t-${b.tav}">${b.av}</span>${b.tech}</div>
      ${b.espera ? `<div class="bay__wait">${ic('hour', 'width:13px;height:13px')}${b.espera}</div>` : `<div class="bay__time">${ic('play')}<b>${b.t}</b>${anillo(b.pct)}</div>`}
      ${b.espera ? `<div class="bay__note">${ic('hour', 'width:13px;height:13px')}Waiting on approval</div>` : `<div class="bay__act"><button class="btn btn--sm ${b.soft ? 'btn--soft' : 'btn--primary'}">${ic(b.soft ? 'send' : 'flag')}${b.soft ? 'Send estimate' : 'Mark ready'}</button></div>`}
    </article>`).join('') + `<article class="bay bay--free">
      <div class="bay__h"><span class="bay__n">Bay 6</span><small>Quick service</small></div>
      <div class="bay__stage is-free"><svg viewBox="0 0 149 92" preserveAspectRatio="none" aria-hidden="true"><rect x="10" y="6" width="6" height="80" rx="3" fill="#cfcdc6"/><rect x="133" y="6" width="6" height="80" rx="3" fill="#cfcdc6"/>${[40, 60, 80, 100, 120].map((x) => `<line x1="${x}" x2="${x}" y1="10" y2="74" stroke="#1c1a1614"/>`).join('')}<rect x="16" y="74" width="117" height="4" rx="2" fill="#dcdad3"/></svg><span>Free</span></div>
      <p class="bay__note">Cars are waiting</p>
      <div class="bay__act"><button class="btn btn--sm btn--soft">${ic('plus')}Bring a car in</button></div>
    </article>`;

  // ── Job board ─────────────────────────────────────────────────────────────────────────────────────────────────────
  const LANES = [
    ['Checked in', '', [
      ['3GKR158', 'rush', '', 'Hyundai Tucson', 'Isabel Cruz', 'clock', 'In 15 min', '', '', 'Start diagnosis'],
      ['9PCB584', 'walk', '', 'Tesla Model 3', 'Priya Raman', 'clock', 'In 10 min', '', '', 'Start diagnosis'],
      ['9JAY870', '', '', 'Toyota Tacoma', 'Tom Walsh', 'clock', 'In 30 min', '', '', 'Start diagnosis'],
      ['4RCF622', '', '', 'Chevrolet Silverado 1500', 'Ethan Cole', 'clock', 'In 50 min', '', '', 'Start diagnosis'],
    ]],
    ['Diagnosis', 'diag', [['4LZW032', '', 'B5', 'Volkswagen Golf GTI', 'Amara Okafor', 'clock', 'Due 3:30 PM', '', 'jk', 'Send estimate']]],
    ['Awaiting approval', 'appr', [
      ['7YPT463', '', '', 'Mazda CX-5', 'Sofia Castillo', 'check', 'Approved', 'good', 'in', 'Start repair'],
      ['4VRX153', '', 'B2', 'Honda Accord', 'Marcus Bell', 'hour', 'Waiting 22 min', 'warn', 'cr', '', true],
    ]],
    ['In repair', 'repair', [
      ['3AMU524', 'walk', 'B3', 'Lexus RX 450h', 'Kenji Mori', 'clock', 'Due 12:30 PM', '', 'ta', 'Mark ready'],
      ['1ZUY256', '', 'B4', 'Ford F-150', 'Luis Navarro', 'clock', 'Due 1:00 PM', '', 'lb', 'Mark ready'],
      ['1RJM013', '', 'B1', 'Toyota RAV4', 'Dana Whitfield', 'clock', 'Due 3:00 PM', '', 'in', 'Mark ready'],
    ]],
    ['Ready for pickup', 'ready', [
      ['9GHM628', '', 'B5', 'Honda CR-V', 'Grace Liu', 'receipt', '$445', 'good', 'jk', 'Hand over'],
      ['2VMC538', '', 'B3', 'Subaru Outback', 'Hannah Price', 'receipt', '$223', 'good', 'lb', 'Hand over'],
    ]],
  ];
  $('#lanes').innerHTML = LANES.map(([n, cls, cards]) => `<section class="lane${cls ? ` lane--${cls}` : ''}">
      <div class="lane__h"><i></i>${n}<b>${cards.length}</b></div>
      ${cards.map(([plate, tag, bay, name, own, sic, st, stc, av, act, corta]) => `<article class="jc${corta ? ' jc--short' : ''}" data-lift>
        <div class="jc__top"><span class="plate">${plate}</span>${tag ? `<span class="jc__tag jc__tag--${tag}">${ic(tag === 'rush' ? 'bolt' : 'walk')}</span>` : ''}${bay ? `<span class="jc__bay">${bay}</span>` : ''}</div>
        <div class="jc__name">${name}</div><div class="jc__own">${own}</div>
        <div class="jc__st${stc ? ` jc__st--${stc}` : ''}">${ic(sic)}${st}</div>
        <div class="jc__foot">${av ? `<span class="av t-${av}">${av.toUpperCase()}</span>` : '<span class="jc__empty"></span>'}${act ? `<button class="btn btn--xs ${act === 'Hand over' ? 'btn--dark' : 'btn--soft'}">${act}</button>` : ''}</div>
      </article>`).join('')}
    </section>`).join('');

  // ── Arriving today ────────────────────────────────────────────────────────────────────────────────────────────────
  const ARR = [['11:30 AM', 'BMW 330i', '4MNK551', 'Noah Fischer · Brake pads'], ['1:00 PM', 'Jeep Wrangler', '7HDT582', 'Leila Farah · Oil change'], ['2:00 PM', 'Ford Mustang Mach-E', '9BFJ315', 'Samir Patel · Tire rotation'], ['2:30 PM', 'Mercedes-Benz E 350', '8ZTN764', 'Henry Adams · A/C check'], ['3:30 PM', 'Mazda Mazda3', '8PMB147', 'Zara Ahmed · Oil change']];
  $('#arr').innerHTML = ARR.map(([t, car, pl, who]) => `<li><span class="arr__t">${t.replace(' ', ' ')}</span><button class="arr__who"><b>${car}</b><span><span class="plate plate--us"><em>CA</em>${pl}</span>${who}</span></button><button class="btn btn--xs btn--soft">${ic('key')}Check in</button></li>`).join('');

  // ── Sales: las dos líneas leídas de la captura, cada 8 px (en miles) ─────────────────────────────────────────────────
  const VENTAS = [2.46, 3.51, 4.49, 5.23, 5.6, 5.48, 4.86, 4.06, 3.32, 2.7, 2.02, 1.35, 0.98, 0.98, 1.35, 1.96, 2.52, 2.95, 3.26, 3.57, 3.75, 4.0, 4.06, 4.12, 4.25, 4.43, 4.99, 5.67, 6.28, 6.59, 6.47, 6.1, 5.48, 4.8, 4.06, 3.07, 2.02, 1.35, 1.35, 2.33, 3.69, 4.8, 5.05, 4.56, 3.69, 2.58];
  const MANO = [0.67, 1.04, 1.41, 1.78, 2.02, 2.02, 1.96, 1.9, 1.84, 1.59, 1.16, 0.73, 0.42, 0.36, 0.6, 0.98, 1.28, 1.59, 1.84, 2.09, 2.27, 2.4, 2.46, 2.46, 2.46, 2.52, 2.58, 2.64, 2.77, 2.77, 2.77, 2.7, 2.58, 2.4, 2.15, 1.65, 1.16, 0.79, 0.79, 1.16, 1.72, 2.15, 2.21, 2.02, 1.72, 1.22];
  const DIAS = [['Oct 21', .054], ['Oct 23', .185], ['Oct 26', .367], ['Oct 28', .549], ['Oct 30', .728], ['Nov 3', .954]];
  const DIAS_TEL = [['Oct 21', .075], ['Oct 24', .275], ['Oct 28', .55], ['Nov 3', .93]];
  function chart() {
    const el = $('#chart'), W = el.clientWidth, H = el.clientHeight, x0 = 44, x1 = W - 14, yT = 10, yB = 172, k = (yB - yT) / 10;
    const pts = (vs) => vs.map((v, i) => [x0 + (i * (x1 - x0)) / (vs.length - 1), yB - v * k]);
    const linea = (p) => p.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
    const v = pts(VENTAS), m = pts(MANO);
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Sales and labor, by day">
      <defs><linearGradient id="tq-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#e2611b" stop-opacity=".22"/><stop offset="1" stop-color="#e2611b" stop-opacity="0"/></linearGradient></defs>
      ${[[10, '$10k'], [5, '$5.0k'], [0, '$0']].map(([n, t]) => `<line class="chart__grid" x1="${x0}" x2="${x1}" y1="${yB - n * k}" y2="${yB - n * k}"/><text class="chart__ax" x="${x0 - 6}" y="${yB - n * k + 4}" text-anchor="end">${t}</text>`).join('')}
      <path class="chart__fill" d="${linea(v)}L${x1},${yB}L${x0},${yB}Z" fill="url(#tq-area)"/>
      <path class="chart__line" d="${linea(v)}" fill="none" stroke="#e2611b" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
      <path class="chart__line" d="${linea(m)}" fill="none" stroke="#3a86d4" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
      ${(W < 400 ? DIAS_TEL : DIAS).map(([t, f]) => `<text class="chart__x" x="${(x0 + f * (x1 - x0)).toFixed(1)}" y="${yB + 22}" text-anchor="middle">${t}</text>`).join('')}
    </svg>`;
  }

  // ── Technicians ───────────────────────────────────────────────────────────────────────────────────────────────────
  const TECHS = [['Carlos', 'cr', 'Available', true, 'orange', 66, '5.3 h sold · 0.8 h on the clock'], ['Ivan', 'in', 'Toyota · Bay 1', false, 'sky', 75, '6.0 h sold · 3.6 h on the clock'], ['Tola', 'ta', 'Lexus · Bay 3', false, 'teal', 31, '2.5 h sold · 1.4 h on the clock'], ['Jae', 'jk', 'Volkswagen · Bay 5', false, 'violet', 11, '0.9 h sold · 1.6 h on the clock'], ['Liam', 'lb', 'Ford · Bay 4', false, 'lime', 40, '3.2 h sold · 2.4 h on the clock']];
  $('#techs').innerHTML = TECHS.map(([n, av, st, ok, tono, w, s]) => `<div class="tech"><span class="av t-${av}">${av.toUpperCase()}</span><div><div class="tech__h"><b>${n}</b><button class="tech__state${ok ? ' tech__state--ok' : ' is-on'}">${ic(ok ? 'check' : 'wrench')}${st}</button></div><div class="tech__bar"><span class="tone-${tono}" style="width:${w}%"></span></div><small>${s}</small></div></div>`).join('');

  // ── Running low ───────────────────────────────────────────────────────────────────────────────────────────────────
  const STOCK = [['Coolant, 50/50, 1 gal', 'CLT-G05', 'B-03', '', 0, 6], ['Front shock, F-150', 'SH-F-FD', 'F-01', '', 0, 2], ['Tire 225/65R17 all-season', 'TYR-22565', 'T-01', '', 0, 8], ['Front brake pads, Honda', 'BP-F-HN', 'C-02', '8 on order', 1, 4], ['Oil filter, Honda / Acura', 'OF-2210', 'A-02', '', 5, 10]];
  $('#stock').innerHTML = STOCK.map(([n, sku, bin, ord, v, de]) => `<li><div><a href="#"><b>${n}</b></a><code>${sku} · bin ${bin}${ord ? ` · <em>${ord}</em>` : ''}</code><div class="stock__bar"><span class="tone-${v ? 'amber' : 'bad'}" style="width:${Math.max(4, (v / de) * 50)}%"></span></div></div><span class="stock__n ${v ? 'is-warn' : 'is-bad'}">${v}<small>/${de}</small></span></li>`).join('');

  // ── Shop load: un arco de 240°, la parte ocupada en naranja, marcas adentro y la aguja ─────────────────────────────
  function gauge() {
    const el = $('#gauge'), cx = 105, cy = 98, r = 88, A0 = -120, A1 = 120, pct = 45;
    const p = (a, rr) => [cx + rr * Math.sin((a * Math.PI) / 180), cy - rr * Math.cos((a * Math.PI) / 180)];
    const arco = (a, b, rr) => { const [x1, y1] = p(a, rr), [x2, y2] = p(b, rr); return `M${x1.toFixed(1)},${y1.toFixed(1)}A${rr},${rr} 0 ${b - a > 180 ? 1 : 0} 1 ${x2.toFixed(1)},${y2.toFixed(1)}`; };
    const aguja = A0 + ((A1 - A0) * pct) / 100;
    let marcas = '';
    for (let i = 0; i <= 10; i++) { const a = A0 + i * 24, [x1, y1] = p(a, i % 5 ? 70 : 66), [x2, y2] = p(a, 76); marcas += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${i % 5 ? '#c9c7c0' : '#3a3b3f'}" stroke-width="${i % 5 ? 1.4 : 2.2}" stroke-linecap="round"/>`; }
    const [nx, ny] = p(aguja, 58);
    el.innerHTML = `<svg viewBox="0 0 210 180" aria-hidden="true">
      <path d="${arco(A0, A1, r)}" fill="none" stroke="#1c1a160f" stroke-width="16" stroke-linecap="round"/>
      <path class="gauge__v" d="${arco(A0, aguja, r)}" fill="none" stroke="var(--orange)" stroke-width="16" stroke-linecap="round"/>
      ${marcas}
      <g class="gauge__needle" style="transform-origin:${cx}px ${cy}px"><path d="M${cx - 3},${cy} L${nx.toFixed(1)},${ny.toFixed(1)} L${cx + 3},${cy}Z" fill="#17181b"/></g>
      <circle cx="${cx}" cy="${cy}" r="7" fill="#17181b"/><circle cx="${cx}" cy="${cy}" r="3" fill="#fff"/>
    </svg><div class="gauge__mid"><b data-cuenta>45%</b><span>of bay time booked</span></div>`;
  }

  // ── Team activity ─────────────────────────────────────────────────────────────────────────────────────────────────
  const FEED = [['clock', '<b>Tola</b> started the battery health check', 'RO-24698', '4 min ago'], ['car', '<b>You</b> checked in the Tucson — A/C blowing warm, marked rush', 'RO-24701', '9 min ago'], ['check', '<b>You</b> sent the timing-belt estimate to Marcus by text', 'RO-24695', '22 min ago'], ['note', '<b>Jae</b> pulled codes P0301 and P0171 on the GTI', 'RO-24697', '31 min ago'], ['car', '<b>Liam</b> marked the Outback ready for pickup', 'RO-24702', '48 min ago'], ['receipt', '<b>You</b> took a card payment from Yusuf — $1,216.95', 'RO-24706', '57 min ago']];
  $('#feed').innerHTML = FEED.map(([i, t, ro, ago]) => `<li><span class="feed__ic">${ic(i)}</span><div><p>${t} · <code>${ro}</code></p><small>${ago}</small></div></li>`).join('');

  // ── El selector 2W · 30D ──────────────────────────────────────────────────────────────────────────────────────────
  function seg(primera) {
    const c = $('#seg'), pl = $('.seg__pill', c), on = $('[aria-pressed="true"]', c);
    pl.style.width = `${on.offsetWidth}px`;
    if (primera) pl.style.transition = 'none';
    pl.style.transform = `translateX(${on.offsetLeft - 4}px)`;
    if (primera) requestAnimationFrame(() => { pl.style.transition = ''; });
  }
  $$('#seg .seg__btn').forEach((b) => b.addEventListener('click', () => { $$('#seg .seg__btn').forEach((o) => o.setAttribute('aria-pressed', String(o === b))); seg(false); }));

  // ── Lo que sube al pasar (data-lift: −4 px, .45 s, power3.out; vuelve en .5 s) ─────────────────────────────────────
  if (matchMedia('(hover: hover)').matches && !quieto) $$('[data-lift]').forEach((e) => {
    e.addEventListener('pointerenter', () => e.animate([{ transform: getComputedStyle(e).transform === 'none' ? 'none' : getComputedStyle(e).transform }, { transform: 'translateY(-4px)' }], { duration: 450, easing: P3, fill: 'forwards' }));
    e.addEventListener('pointerleave', () => e.animate([{ transform: 'translateY(-4px)' }, { transform: 'none' }], { duration: 500, easing: P3, fill: 'forwards' }));
  });

  function contar(n, demora) {
    const fin = n.textContent, m = fin.match(/^(\D*?)(\d[\d,]*)(\.\d+)?(.*)$/);
    if (!m) return;
    const [, pre, cifra, dec = '', suf] = m, v = Number(cifra.replace(/,/g, '') + dec), d = Math.max(0, dec.length - 1);
    const fmt = (x) => `${pre}${x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}${suf}`;
    const t0 = performance.now() + demora; n.textContent = fmt(0);
    const paso = (t) => { const k = Math.min(1, Math.max(0, (t - t0) / 1200)); n.textContent = k < 1 ? fmt(v * (1 - Math.pow(1 - k, 3))) : fin; if (k < 1) requestAnimationFrame(paso); };
    requestAnimationFrame(paso);
  }

  chart(); gauge(); seg(true);
  addEventListener('resize', () => { chart(); seg(true); });

  if (!quieto) {
    // El armazón (xd): la barra entra desde −60 px (.9 s), sus renglones desde −12 px cada .04 s, la barra de arriba desde −12 px.
    anim($('.side'), [{ opacity: 0, transform: 'translateX(-60px)' }, { opacity: 1, transform: 'none' }], { duration: 900 });
    $$('.side .brand, .nav__label, .nav__item, .shop-status, .me').forEach((n, i) => anim(n, [{ opacity: 0, transform: 'translateX(-12px)' }, { opacity: 1, transform: 'none' }], { duration: 550, delay: 150 + i * 40 }));
    $$('.top > *, .mtop > *').forEach((n, i) => anim(n, [{ opacity: 0, transform: 'translateY(-12px)' }, { opacity: 1, transform: 'none' }], { duration: 550, delay: 50 + i * 50 }));
    // La cabecera (Yc): el título palabra por palabra (so), el renglón de arriba (lo, y 8) y los botones (lo, y 14, cada .07 s).
    const t = $('.head__title');
    t.innerHTML = t.textContent.split(' ').map((w) => `<span style="display:inline-block;overflow:hidden;vertical-align:top"><span style="display:inline-block">${w}</span></span>`).join(' ');
    $$('span > span', t).forEach((w, i) => anim(w, [{ transform: 'translateY(115%) rotate(6deg)' }, { transform: 'none' }], { duration: 850, delay: 120 + i * 22, easing: P4 }));
    anim($('.head__eyebrow'), [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 550, delay: 120 });
    $$('.head__actions > *').forEach((n, i) => anim(n, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 550, delay: 240 + i * 70 }));
    // Las tarjetas (co): suben 34 px con escala .985 (.9 s, cada .07 s).
    $$('.stat, .card').forEach((c, i) => anim(c, [{ opacity: 0, transform: 'translateY(34px) scale(.985)' }, { opacity: 1, transform: 'none' }], { duration: 900, delay: 200 + i * 70 }));
    // Adentro (lo): los bays y las tarjetas del tablero suben 12 px cada .045 s; los avatares saltan (uo).
    $$('.bay').forEach((b, i) => anim(b, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 550, delay: 420 + i * 45 }));
    $$('.jc').forEach((b, i) => anim(b, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 550, delay: 520 + i * 45 }));
    $$('.av').forEach((a, i) => anim(a, [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: 700 + (i % 12) * 50, easing: BACK3 }));
    $$('.tech__bar span, .stock__bar span').forEach((b, i) => anim(b, [{ transform: 'scaleX(0)' }, { transform: 'none' }], { duration: 1200, delay: 650 + i * 50 }));
    $$('.chart__line').forEach((p) => { const L = p.getTotalLength(); p.style.strokeDasharray = `${L}`; anim(p, [{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 1200, delay: 650, easing: P3IO }); });
    anim($('.chart__fill'), [{ opacity: 0 }, { opacity: 1 }], { duration: 900, delay: 1100 });
    const g = $('.gauge__v'); if (g) { const L = g.getTotalLength(); g.style.strokeDasharray = `${L}`; anim(g, [{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 1200, delay: 700 }); }
    anim($('.gauge__needle'), [{ transform: 'rotate(-108deg)' }, { transform: 'none' }], { duration: 1200, delay: 700 });
    $$('.ring__v').forEach((r) => { const d = r.getAttribute('stroke-dasharray').split(' '); anim(r, [{ strokeDasharray: `0 ${d[1]}` }, { strokeDasharray: d.join(' ') }], { duration: 1200, delay: 650 }); });
    $$('[data-cuenta]').forEach((n) => contar(n, 300));
  }
})();
